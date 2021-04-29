import * as Router from 'koa-router';
import { ParameterizedContext } from 'koa';
import * as runtime from '@smartlyio/oats-runtime';

function adapter<StateT, CustomT, RequestContext>(
  router: Router<StateT, CustomT>,
  requestContextCreator: (ctx: ParameterizedContext<StateT, CustomT>) => RequestContext
): runtime.server.ServerAdapter {
  return (
    path: string,
    op: string,
    method: runtime.server.Methods,
    handler: runtime.server.SafeEndpoint
  ) => {
    const koaPath = path.replace(/{([^}]+)}/g, (m, param) => ':' + param);
    (router as any)[method](koaPath, async (ctx: ParameterizedContext<StateT, CustomT>) => {
      const files = (ctx as any).request.files;
      let fileFields = {};
      if (files) {
        fileFields = Object.keys(files).reduce((memo: any, name) => {
          memo[name] = new runtime.make.File(files[name].path, files[name].size, files[name].name);
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
      ctx.status = result.status;
      ctx.body = result.value.value;
      ctx.set(result.headers);
    });
  };
}

/**
 * Bind provided handlers for the OpenAPI routes
 *
 * Koa's default StateT and CustomT values are selected as defaults
 * @param handler
 * @param spec
 * @param requestContextCreator
 */
export function bind<Spec, RequestContext = void, StateT = any, CustomT = Record<string, unknown>>(
  handler: runtime.server.HandlerFactory<Spec>,
  spec: Spec,
  requestContextCreator?: (ctx: ParameterizedContext<StateT, CustomT>) => RequestContext
): Router<StateT, CustomT> {
  const router = new Router<StateT, CustomT>();
  handler(adapter(router, requestContextCreator || (() => ({}))))(spec);
  return router;
}
