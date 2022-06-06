import { assert } from './assert';
import safeNavigation from '@smartlyio/safe-navigation';
import { Make, MakeOptions, Maker, ValidationError, validationErrorPrinter } from './make';
import { serialize } from './serialize';

export type { RedirectStatus } from './redirect';

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

function cleanHeaders<H>(mode: Mode, maker: Maker<any, H>, headers: object) {
  // note: we now expect that on client side headers are type conforming so do not need to lowercase those
  // this is slightly breaking change is somebody has subverted the type checker
  const normalized = voidify(mode === 'server' ? lowercaseObject(headers) : headers);
  const acceptsNull = maker(null);
  if (acceptsNull.isSuccess()) {
    return acceptsNull.success();
  }
  return maker(normalized, {
    unknownField: 'drop',
    convertFromNetwork: mode === 'server'
  }).success(throwRequestValidationError.bind(null, 'headers'));
}

function serializeWhenClient(mode: Mode, value: any) {
  if (mode === 'client') {
    return serialize(value);
  }
  return value;
}

function getOutBody<Body extends RequestBody<any>>(mode: Mode, value: Body): Body {
  if (!value) {
    return value;
  }
  return { contentType: value.contentType, value: serializeWhenClient(mode, value.value) } as Body;
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
  endpoint: Endpoint<H, P, Q, Body, R, RC>,
  { validationOptions = {}, mode }: HandlerOptions & InternalHandlerOptions = { mode: 'client' }
): Endpoint<
  Headers,
  Params,
  Query,
  RequestBody<any>,
  Response<number, any, any, Record<string, any>>,
  RequestContext
> {
  return async ctx => {
    // note: data coming to client adapter needs to be serialized and data coming from the adapter needs conversion from network
    // note: data coming to server adapter needs to be deserialized and data coming from the adapter needs serialization
    // this is all very clear.
    const internalMakeOptions = { convertFromNetwork: mode === 'server' };
    const result = await endpoint({
      path: ctx.path,
      method: ctx.method,
      servers: ctx.servers,
      op: ctx.op,
      headers: serializeWhenClient(mode, cleanHeaders(mode, headers, ctx.headers)),
      // note: path params come to the adapter in network format always as those are gleaned from the path definition
      params: params(voidify(ctx.params), {
        ...validationOptions.params,
        ...internalMakeOptions,
        convertFromNetwork: true
      }).success(throwRequestValidationError.bind(null, 'params')),
      query: serializeWhenClient(
        mode,
        query(ctx.query || {}, { ...validationOptions.query, ...internalMakeOptions }).success(
          throwRequestValidationError.bind(null, 'query')
        )
      ),
      body: getOutBody<Body>(
        mode,
        body(voidify(ctx.body), internalMakeOptions).success(
          throwRequestValidationError.bind(null, 'body')
        )
      ),
      requestContext: ctx.requestContext as any
    });
    const responseValue = response(result, { convertFromNetwork: mode === 'client' }).success(
      throwResponseValidationError.bind(null, `body ${ctx.path}`, result.value.value)
    );
    if (mode === 'client' || !responseValue) {
      return responseValue;
    }
    // the response must be serialized for transferring from server to client
    return {
      ...responseValue,
      headers: serialize(responseValue.headers),
      value: {
        ...responseValue.value,
        value: serialize(responseValue.value.value)
      }
    };
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
      safeHandler: (
        e: Endpoint<any, any, any, any, any, any>,
        opts?: HandlerOptions & InternalHandlerOptions
      ) => SafeEndpoint;
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
      safeHandler: (
        e: Endpoint<any, any, any, any, any, any>,
        opts?: HandlerOptions & InternalHandlerOptions
      ) =>
        safe(
          element.headers,
          element.params,
          element.query,
          element.body,
          element.response,
          e,
          opts
        ),
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

type Mode = 'client' | 'server';
export interface InternalHandlerOptions {
  /** whether we are calling this on client side or in server side.
   * This may have effect on eg network <-> ts property mapping.
   * This value is set automatically by oats.
   * */
  mode: Mode;
}

export interface HandlerOptions {
  /**
   * Options for request schema validation.
   */
  validationOptions?: {
    query?: MakeOptions;
    params?: MakeOptions;
  };
}

export function createHandlerFactory<Spec>(
  handlers: Handler[],
  opts?: HandlerOptions
): HandlerFactory<Spec> {
  const tree = createTree(handlers);
  return (adapter: ServerAdapter) => {
    return (spec: Spec) => {
      Object.keys(spec).forEach(path => {
        const endpoint: MethodHandlers = (spec as any)[path];
        Object.keys(endpoint).forEach(method => {
          const methodHandler = (endpoint as any)[method];
          const endpointWrapper = safeNavigation(tree)[path][method].$;
          assert(endpointWrapper, 'unknown endpoint ' + method.toUpperCase() + ' ' + path);
          adapter(
            path,
            endpointWrapper.op,
            assertMethod(method),
            endpointWrapper.safeHandler(methodHandler, { ...opts, mode: 'server' }),
            endpointWrapper.servers
          );
        });
      });
    };
  };
}
