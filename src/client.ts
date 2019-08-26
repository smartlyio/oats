import * as server from './server';
import * as assert from 'assert';
import safe from '@smartlyio/safe-navigation';
import axios from 'axios';
import * as runtime from './runtime';
import * as FormData from 'form-data';

type HeaderProp<H, Next> = H extends void ? Next : { headers: H } & Next;
type QueryProp<Q, Next> = Q extends void ? Next : { query: Q } & Next;
type BodyProp<B> = B extends void ? {} : { body: B };

export type ClientArg<
  H extends server.Headers | void,
  Q extends server.Query | void,
  B extends server.RequestBody<any> | void
> = HeaderProp<H, QueryProp<Q, BodyProp<B>>>;

export type ClientEndpoint<
  H extends server.Headers | void,
  Q extends server.Query | void,
  B extends server.RequestBody<any> | void,
  R extends server.Response<number, any, any>
> = {} extends ClientArg<H, Q, B> ? () => Promise<R> : (ctx: ClientArg<H, Q, B>) => Promise<R>;

type PathParam = (param: string) => ClientSpec | ClientEndpoint<any, any, any, any>;
export interface ClientSpec {
  readonly [part: string]: ClientSpec | PathParam | ClientEndpoint<any, any, any, any>;
}

export type ClientAdapter = server.SafeEndpoint;
export type ClientFactory<Spec> = (adapter: ClientAdapter) => Spec;

interface RequestBody<T, ContentType> {
  contentType: ContentType;
  value: T;
}
export function body<T, ContentType extends string>(
  contentType: ContentType,
  value: T
): RequestBody<T, ContentType> {
  return {
    contentType,
    value
  };
}

export function json<T>(data: T): RequestBody<T, 'application/json'> {
  return body('application/json', data);
}

export function formData<T>(data: T): RequestBody<T, 'multipart/form-data'> {
  return body('multipart/form-data', data);
}

export function formUrlEncoded<T>(data: T): RequestBody<T, 'application/x-www-form-urlencoded'> {
  return body('application/x-www-form-urlencoded', data);
}

function toAxiosData(data: server.RequestBody<any> | undefined) {
  if (data == null) {
    return data;
  }
  if (data.contentType === 'application/json') {
    return axiosToJson(data.value);
  }
  if (['application/x-www-form-urlencoded', 'multipart/form-data'].indexOf(data.contentType) >= 0) {
    const form = new FormData();
    Object.keys(data.value).forEach(key => {
      const element = data.value[key];
      if (element instanceof runtime.FormBinary) {
        form.append(key, element.binary, element.options);
      } else {
        form.append(key, element);
      }
    });
    return form;
  }
  assert.fail('unknown content type for axios client ' + data.contentType);
}

function axiosToJson(data: any) {
  if (data instanceof runtime.ValueClass) {
    return runtime.toJSON(data);
  }
  return data;
}

export const axiosAdapter: ClientAdapter = async (
  arg: server.EndpointArg<any, any, any, any>
): Promise<any> => {
  if (arg.servers.length !== 1) {
    return assert.fail('cannot decide which server to use from ' + arg.servers.join(', '));
  }
  const server = arg.servers[0];
  const params = axiosToJson(arg.query);
  const data = toAxiosData(arg.body);
  const url = server + arg.path;
  const headers = { ...arg.headers, ...(data instanceof FormData ? data.getHeaders() : {}) };
  const response = await axios.request({
    method: arg.method,
    headers,
    url,
    params,
    data,
    validateStatus: () => true
  });
  return {
    status: response.status,
    value: {
      contentType: 'application/json',
      value: response.data
    }
  };
};

export default function literal<T extends string>(literal: T): T {
  return literal;
}

export function emptyTree<T>(): OpTree<T> {
  return {
    methods: {},
    parts: {}
  };
}

export function identifier(part: string) {
  return part;
}

export function addPath<T>(
  opTree: OpTree<T>,
  path: string,
  method: server.Methods,
  value: T
): OpTree<T> {
  const parts: string[] = path.split('/').filter(n => n);
  function addPath_(parts: string[], opTree: OpTree<T> | undefined): OpTree<T> {
    opTree = opTree || emptyTree();
    const part = parts[0];
    if (part === undefined) {
      assert(
        safe(opTree).methods[method].$ === undefined,
        'duplicate method definition for ' + path
      );
      return {
        ...opTree,
        methods: {
          ...opTree.methods,
          [method]: value
        }
      };
    }
    const param = part.match('(.*){([^}]+)}');
    if (param) {
      assert(
        !/{.*}/.test(param[1]),
        'only single path parameter is supported per url segment. Got multiple in ' + path
      );
      if (param[1] === '') {
        return {
          ...opTree,
          param: {
            name: identifier(param[2]),
            tree: addPath_(parts.slice(1), safe(opTree).param.tree.$)
          }
        };
      } else {
        const id = identifier(param[1]);
        return {
          ...opTree,
          parts: {
            ...opTree.parts,
            [id]: addPath_(['{' + param[2] + '}', ...parts.slice(1)], opTree.parts[id])
          }
        };
      }
    }
    const id = identifier(part);
    return {
      ...opTree,
      parts: { ...opTree.parts, [id]: addPath_(parts.slice(1), opTree.parts[id]) }
    };
  }
  return addPath_(parts, opTree);
}

export interface OpTree<T> {
  methods: {
    [method: string]: T;
  };
  parts: {
    [part: string]: OpTree<T>;
  };
  param?: {
    name: string;
    tree: OpTree<T>;
  };
}

function makeParam(
  adapter: ClientAdapter,
  param: { name: string; tree: OpTree<server.Handler> },
  pathParams: string[]
) {
  return (value: string) => fromTree(adapter, param.tree, [...pathParams, value]);
}

function paramObject(pathParams: string[], path: string) {
  const matches = path.match(/{([^}]+)}/g) || [];
  assert(matches.length === pathParams.length, 'mismatch in path param sizes for ' + path);
  if (matches.length === 0) {
    return undefined;
  }
  const params: any = {};
  for (let i = 0; i < matches.length; i++) {
    params[matches[i].replace(/{|}/g, '')] = pathParams[i];
  }
  return params;
}

function fillInPathParams(params: { [key: string]: string }, path: string) {
  return path.replace(/{([^}]+)}/g, (m, param) => {
    assert(params[param] != null, 'missing path param ' + param);
    return params[param];
  });
}

function makeMethod(adapter: ClientAdapter, handler: server.Handler, pathParams: string[]) {
  const params = paramObject(pathParams, handler.path);
  const call = server.safe(
    handler.headers,
    handler.params,
    handler.query,
    handler.body,
    handler.response,
    ctx =>
      adapter({ ...ctx, path: fillInPathParams(params, handler.path), servers: handler.servers })
  );
  return (ctx: ClientArg<any, any, any>) =>
    call({
      path: handler.path,
      servers: handler.servers,
      method: handler.method,
      params,
      headers: safe(ctx ).headers.$,
      query: safe(ctx).query.$,
      body: safe(ctx).body.$
    });
}

function fromTree(
  adapter: ClientAdapter,
  tree: OpTree<server.Handler>,
  pathParams: string[]
): ClientSpec {
  const node: any = tree.param ? makeParam(adapter, tree.param, pathParams) : {};
  Object.keys(tree.methods).forEach(key => {
    assert(!node[key], 'duplicate path part ' + key);
    node[key] = makeMethod(adapter, tree.methods[key], pathParams);
  });
  Object.keys(tree.parts).forEach(key => {
    assert(!node[key], 'duplicate path part ' + key);
    node[key] = fromTree(adapter, tree.parts[key], pathParams);
  });
  return node;
}

export function createClientFactory<Spec>(handlers: server.Handler[]): ClientFactory<Spec> {
  return (adapter: ClientAdapter): Spec => {
    const tree: OpTree<server.Handler> = handlers.reduce((memo, handler) => {
      return addPath(memo, handler.path, handler.method, handler);
    }, emptyTree<server.Handler>());
    return (fromTree(adapter, tree, []) as unknown) as Spec;
  };
}
