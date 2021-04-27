import * as assert from 'assert';
import safeNavigation from '@smartlyio/safe-navigation';
import { Make, Maker, ValidationError, validationErrorPrinter } from './make';

export interface Response<
  Status extends number,
  ContentType,
  Value,
  Headers extends Record<string, any>
> {
  status: Status;
  value: {
    contentType: ContentType;
    value: Value;
  };
  headers: Headers;
}

export interface RequestBody<A> {
  contentType: string;
  value: A;
}

export type Params = object;

export type Headers = object;

export type Query = object;

export type RequestContext = any;

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

export type ServerEndpointArg<
  H extends Headers | void,
  P extends Params | void,
  Q extends Query | void,
  Body extends RequestBody<any> | void,
  RC extends RequestContext
> = EndpointArg<H, P, Q, Body> & { readonly requestContext: RC };

export type Endpoint<
  H extends Headers | void,
  P extends Params | void,
  Q extends Query | void,
  Body extends RequestBody<any> | void,
  R extends Response<number, any, any, Record<string, any>>,
  RC extends RequestContext
> = (ctx: ServerEndpointArg<H, P, Q, Body, RC>) => Promise<R>;

export type SafeEndpoint = Endpoint<
  Headers | undefined,
  Params | undefined,
  Query | undefined,
  RequestBody<any> | undefined,
  Response<number, any, any, Record<string, any>>,
  RequestContext
>;

export interface MethodHandlers {
  get?: SafeEndpoint;
  post?: SafeEndpoint;
  put?: SafeEndpoint;
  delete?: SafeEndpoint;
  patch?: SafeEndpoint;
  options?: SafeEndpoint;
  head?: SafeEndpoint;
}

export interface Endpoints {
  [opOrUrl: string]: MethodHandlers;
}

export class RequestValidationError extends Error {
  constructor(public tag: string, public errors: ValidationError[]) {
    super('invalid request ' + tag + ' ' + errors.map(validationErrorPrinter).join('\n'));
  }
}

export class ResponseValidationError extends Error {
  constructor(public tag: string, public originalResponse: any, public errors: ValidationError[]) {
    super('invalid response ' + tag + ' ' + errors.map(validationErrorPrinter).join('\n'));
  }
}

function throwRequestValidationError(tag: string, e: Make<any>): any {
  throw new RequestValidationError(tag, e.errors);
}

function throwResponseValidationError(tag: string, originalValue: any, e: Make<any>): any {
  throw new ResponseValidationError(tag, originalValue, e.errors);
}

function lowercaseObject(o: object | undefined | null): object | null | undefined {
  if (o == null) {
    return o;
  }
  const result: any = {};
  for (const key of Object.keys(o)) {
    result[key.toLowerCase()] = (o as any)[key];
  }
  return result;
}

function voidify(value: object | undefined | null) {
  if (value && Object.keys(value).length > 0) {
    return value;
  }
  if (value && Array.isArray(value)) {
    return value;
  }
  return null;
}

function cleanHeaders<H>(maker: Maker<any, H>, headers: object) {
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
  R extends Response<any, any, any, Record<string, any>>,
  RC extends RequestContext
>(
  headers: Maker<any, H>,
  params: Maker<any, P>,
  query: Maker<any, Q>,
  body: Maker<any, Body>,
  response: Maker<any, R>,
  endpoint: Endpoint<H, P, Q, Body, R, RC>
): Endpoint<
  Headers,
  Params,
  Query,
  RequestBody<any>,
  Response<number, any, any, Record<string, any>>,
  RequestContext
> {
  return async ctx => {
    const result = await endpoint({
      path: ctx.path,
      method: ctx.method,
      servers: ctx.servers,
      op: ctx.op,
      headers: cleanHeaders(headers, ctx.headers),
      params: params(voidify(ctx.params)).success(throwRequestValidationError.bind(null, 'params')),
      query: query(ctx.query || {}).success(throwRequestValidationError.bind(null, 'query')),
      body: body(voidify(ctx.body)).success(throwRequestValidationError.bind(null, 'body')),
      requestContext: ctx.requestContext as any
    });
    return response(result).success(
      throwResponseValidationError.bind(null, `body ${ctx.path}`, result.value.value)
    );
  };
}

export type Methods = keyof MethodHandlers;
export const supportedMethods: Methods[] = [
  'get',
  'post',
  'head',
  'put',
  'patch',
  'options',
  'delete'
];

type AnyMaker = Maker<any, any>;

interface CheckingTree {
  [path: string]: {
    [method: string]: {
      safeHandler: (e: Endpoint<any, any, any, any, any, any>) => SafeEndpoint;
      op: string;
      servers: string[];
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
      safeHandler: (e: Endpoint<any, any, any, any, any, any>) =>
        safe(element.headers, element.params, element.query, element.body, element.response, e),
      op: element.op,
      servers: element.servers
    };
    return memo;
  }, {});
}

export type HandlerFactory<Spec> = (adapter: ServerAdapter) => (spec: Spec) => void;

export function assertMethod(method: string): Methods {
  assert(supportedMethods.indexOf(method as any) >= 0, 'unsupported method name ' + method);
  return method as any;
}

export type ServerAdapter = (
  path: string,
  op: string,
  method: Methods,
  handler: SafeEndpoint,
  servers: string[]
) => void;

export function createHandlerFactory<Spec>(handlers: Handler[]): HandlerFactory<Spec> {
  const tree = createTree(handlers);
  return (adapter: ServerAdapter) => {
    return (spec: Spec) => {
      Object.keys(spec).forEach(path => {
        const endpoint: MethodHandlers = (spec as any)[path];
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
            endpointWrapper.safeHandler(methodHandler),
            endpointWrapper.servers
          );
        });
      });
    };
  };
}
