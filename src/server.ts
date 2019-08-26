import * as Router from 'koa-router';
import * as Koa from 'koa';
import * as oar from './runtime';
import * as assert from 'assert';
import safeNavigation from '@smartlyio/safe-navigation';

export interface Response<Status extends number, ContentType, Value> {
  status: Status;
  value: {
    contentType: ContentType;
    value: Value;
  };
}

export interface RequestBody<A> {
  contentType: string;
  value: A;
}

export interface Params {
  [param: string]: unknown;
}

export interface Headers {
  [key: string]: unknown;
}

export interface Query {
  [key: string]: unknown;
}

export interface EndpointArg<
  H extends Headers | void,
  P extends Params | void,
  Q extends Query | void,
  Body extends RequestBody<any> | void
> {
  path: string;
  method: Methods;
  servers: string[];
  op?: string;
  headers: H;
  params: P;
  query: Q;
  body: Body;
}
export type Endpoint<
  H extends Headers | void,
  P extends Params | void,
  Q extends Query | void,
  Body extends RequestBody<any> | void,
  R extends Response<number, any, any>
> = (ctx: EndpointArg<H, P, Q, Body>) => Promise<R>;

export type SafeEndpoint = Endpoint<
  Headers | undefined,
  Params | undefined,
  Query | undefined,
  RequestBody<any> | undefined,
  Response<number, any, any>
>;

export interface MethodHandlers {
  get?: SafeEndpoint;
  post?: SafeEndpoint;
  put?: SafeEndpoint;
  delete?: SafeEndpoint;
  patch?: SafeEndpoint;
  options?: SafeEndpoint;
}

export interface Endpoints {
  [opOrUrl: string]: MethodHandlers;
}

export class RequestValidationError extends Error {
  constructor(public tag: string, public errors: oar.ValidationError[]) {
    super('invalid request ' + tag + ' ' + errors.map(oar.validationErrorPrinter).join('\n'));
  }
}

export class ResponseValidationError extends Error {
  constructor(
    public tag: string,
    public originalResponse: any,
    public errors: oar.ValidationError[]
  ) {
    super('invalid response ' + tag + ' ' + errors.map(oar.validationErrorPrinter).join('\n'));
  }
}

function throwRequestValidationError(tag: string, e: oar.Make<any>) {
  throw new RequestValidationError(tag, e.errors);
  return null as any;
}

function throwResponseValidationError(tag: string, originalValue: any, e: oar.Make<any>) {
  throw new ResponseValidationError(tag, originalValue, e.errors);
  return null as any;
}

function lowercaseObject(o: {} | undefined | null): {} | null | undefined {
  if (o == null) {
    return o;
  }
  const result: any = {};
  for (const key of Object.keys(o)) {
    result[key.toLowerCase()] = (o as any)[key];
  }
  return result;
}

function voidify(value: {} | undefined | null) {
  if (value && Object.keys(value).length > 0) {
    return value;
  }
  return null;
}

function cleanHeaders<H>(maker: oar.Maker<any, H>, headers: {}) {
  const normalized = voidify(lowercaseObject(headers));
  const acceptsNull = maker(null);
  if (acceptsNull.isSuccess()) {
    return acceptsNull.success();
  }
  return maker(normalized, {
    unknownField: 'drop'
  }).success(throwRequestValidationError.bind(null, 'headers'));
}

export function safe<
  H extends Headers,
  P extends Params,
  Q extends Query,
  Body extends RequestBody<any>,
  R extends Response<any, any, any>
>(
  headers: oar.Maker<any, H>,
  params: oar.Maker<any, P>,
  query: oar.Maker<any, Q>,
  body: oar.Maker<any, Body>,
  response: oar.Maker<any, R>,
  endpoint: Endpoint<H, P, Q, Body, R>
): Endpoint<Headers, Params, Query, RequestBody<any>, Response<number, any, any>> {
  return async ctx => {
    const result = await endpoint({
      path: ctx.path,
      method: ctx.method,
      servers: ctx.servers,
      op: ctx.op,
      headers: cleanHeaders(headers, ctx.headers),
      params: params(voidify(ctx.params)).success(throwRequestValidationError.bind(this, 'params')),
      query: query(voidify(ctx.query)).success(throwRequestValidationError.bind(this, 'query')),
      body: body(voidify(ctx.body)).success(throwRequestValidationError.bind(this, 'body'))
    });
    return response(result).success(
      throwResponseValidationError.bind(this, `body ${ctx.path}`, result.value.value)
    );
  };
}

export type Methods = keyof MethodHandlers;
export const supportedMethods: Methods[] = ['get', 'post', 'put', 'patch', 'options', 'delete'];

type AnyMaker = oar.Maker<any, any>;

interface CheckingTree {
  [path: string]: {
    [method: string]: {
      safeHandler: (e: Endpoint<any, any, any, any, any>) => SafeEndpoint;
      op: string;
    };
  };
}

export interface Handler {
  op?: string;
  path: string;
  servers: string[];
  method: Methods;
  headers: AnyMaker;
  query: AnyMaker;
  body: AnyMaker;
  params: AnyMaker;
  response: AnyMaker;
}

function createTree(handlers: Handler[]): CheckingTree {
  return handlers.reduce((memo: any, element) => {
    if (!memo[element.path]) {
      memo[element.path] = {};
    }
    memo[element.path][element.method] = {
      safeHandler: (e: Endpoint<any, any, any, any, any>) =>
        safe(element.headers, element.params, element.query, element.body, element.response, e),
      op: element.op
    };
    return memo;
  }, {});
}

function koaAdapter(router: Router): ServerAdapter {
  return (path: string, op: string, method: Methods, handler: SafeEndpoint) => {
    const koaPath = path.replace(/{([^}]+)}/g, (m, param) => ':' + param);
    (router as any)[method](koaPath, async (ctx: Koa.Context) => {
      const files = (ctx as any).request.files;
      let fileFields = {};
      if (files) {
        fileFields = Object.keys(files).reduce((memo: any, name) => {
          memo[name] = new oar.File(files[name].path, files[name].size);
          return memo;
        }, {});
      }
      const contentType = ctx.request.type;
      const value = { ...(ctx.request as any).body, ...fileFields };
      const body = Object.keys(value).length > 0 ? { value, contentType } : undefined;
      const result = await handler({
        path,
        method: assertMethod(ctx.method.toLowerCase()),
        servers: [],
        op,
        headers: ctx.request.headers,
        params: ctx.params,
        query: ctx.query,
        body
      });
      ctx.status = result.status;
      ctx.body = result.value.value;
    });
  };
}

export type HandlerFactory<Spec> = (adapter: ServerAdapter) => (spec: Spec) => void;

export function koaBindRoutes<Spec>(handler: HandlerFactory<Spec>, spec: Spec): Router {
  const router = new Router();
  const adapter = koaAdapter(router);
  handler(adapter)(spec);
  return router;
}

function assertMethod(method: string): Methods {
  assert(supportedMethods.indexOf(method as any) >= 0, 'unsupported method name ' + method);
  return method as any;
}

type ServerAdapter = (path: string, op: string, method: Methods, handler: SafeEndpoint) => void;

export function createHandlerFactory<Spec extends Endpoints>(
  handlers: Handler[]
): HandlerFactory<Spec> {
  const tree = createTree(handlers);
  return (adapter: ServerAdapter) => {
    return (spec: Spec) => {
      Object.keys(spec).forEach(path => {
        const endpoint: MethodHandlers = spec[path];
        Object.keys(endpoint).forEach(method => {
          const methodHandler = (endpoint as any)[method];
          const endpointWrapper = safeNavigation(tree)[path][method].$;
          if (!endpointWrapper) {
            assert.fail('unknown endpoint ' + method.toUpperCase() + ' ' + path);
            return;
          }
          adapter(
            path,
            endpointWrapper.op,
            assertMethod(method),
            endpointWrapper.safeHandler(methodHandler)
          );
        });
      });
    };
  };
}
