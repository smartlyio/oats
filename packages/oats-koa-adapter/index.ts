import * as Router from 'koa-router';
import { ParameterizedContext } from 'koa';
import * as runtime from '@smartlyio/oats-runtime';
import * as assert from 'assert';
import { IMiddleware } from 'koa-router';

function adapter<StateT, CustomT, RequestContext>(
  router: Router<StateT, CustomT>,
  requestContextCreator: (ctx: ParameterizedContext<StateT, CustomT>) => RequestContext,
  middlewares: Array<IMiddleware<StateT, CustomT>>
): runtime.server.ServerAdapter {
  return (
    path: string,
    op: string,
    method: runtime.server.Methods,
    handler: runtime.server.SafeEndpoint
  ) => {
    const koaPath = path.replace(/{([^}]+)}/g, (m, param) => ':' + param);
    (router as any)[method](
      koaPath,
      ...middlewares,
      async (ctx: ParameterizedContext<StateT, CustomT>) => {
        const files = (ctx as any).request.files;
        let fileFields = {};
        if (files) {
          fileFields = Object.keys(files).reduce((memo: any, name) => {
            memo[name] = new runtime.make.File(
              files[name].path,
              files[name].size,
              files[name].name
            );
            return memo;
          }, {});
        }
        const contentType = ctx.request.type;
        const requestBody = (ctx.request as any).body;
        let body;

        if (Array.isArray(requestBody)) {
          body = { value: requestBody, contentType };
        } else if (typeof requestBody === 'object') {
          const bodyWithFileFields = { ...requestBody, ...fileFields };
          body =
            Object.keys(bodyWithFileFields).length > 0
              ? { value: bodyWithFileFields, contentType }
              : undefined;
        }

        const result = await handler({
          path,
          method: runtime.server.assertMethod(ctx.method.toLowerCase()),
          servers: [],
          op,
          headers: ctx.request.headers,
          params: (ctx as any).params,
          query: ctx.query,
          body,
          requestContext: requestContextCreator(ctx)
        });
        ctx.body = result.value.value;
        ctx.status = result.status;

        if (result.value.contentType !== runtime.noContentContentType) {
          ctx.set('content-type', result.value.contentType);
        }
        ctx.set(result.headers);
      }
    );
  };
}

type Opts<Spec, StateT, CustomT, RequestContext> = {
  handler: runtime.server.HandlerFactory<Spec>;
  spec: Spec;
  requestContextCreator?: (ctx: ParameterizedContext<StateT, CustomT>) => RequestContext;
  middlewares?: Array<IMiddleware<StateT, CustomT>>;
};

/**
 * Bind provided handlers for the OpenAPI routes
 *
 * Koa's default StateT and CustomT values are selected as defaults
 * @param opts Named arguments to the function
 * @param spec Deprecated use the named arguments
 * @param requestContextCreator Deprecated
 */
export function bind<
  Spec,
  RequestContext extends Record<string, any> = Record<string, unknown>,
  StateT = any,
  CustomT = Record<string, unknown>
>(
  opts: runtime.server.HandlerFactory<Spec> | Opts<Spec, StateT, CustomT, RequestContext>,
  spec?: Spec,
  requestContextCreator?: (ctx: ParameterizedContext<StateT, CustomT>) => RequestContext
): Router<StateT, CustomT> {
  const arg =
    typeof opts === 'function'
      ? { handler: opts, spec, requestContextCreator, middlewares: [] }
      : opts;
  assert(arg.spec, 'Missing spec argument -- please use the named argument version of bind');
  const router = new Router<StateT, CustomT>();
  arg.handler(adapter(router, arg.requestContextCreator || (() => ({})), arg.middlewares || []))(
    arg.spec
  );
  return router;
}
