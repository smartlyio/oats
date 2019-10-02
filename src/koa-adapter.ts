import * as Router from 'koa-router';
import * as Koa from 'koa';
import * as runtime from './runtime';

function koaAdapter(router: Router): runtime.server.ServerAdapter {
  return (
    path: string,
    op: string,
    method: runtime.server.Methods,
    handler: runtime.server.SafeEndpoint
  ) => {
    const koaPath = path.replace(/{([^}]+)}/g, (m, param) => ':' + param);
    (router as any)[method](koaPath, async (ctx: Koa.Context) => {
      const files = (ctx as any).request.files;
      let fileFields = {};
      if (files) {
        fileFields = Object.keys(files).reduce((memo: any, name) => {
          memo[name] = new runtime.make.File(files[name].path, files[name].size);
          return memo;
        }, {});
      }
      const contentType = ctx.request.type;
      const value = { ...(ctx.request as any).body, ...fileFields };
      const body = Object.keys(value).length > 0 ? { value, contentType } : undefined;
      const result = await handler({
        path,
        method: runtime.server.assertMethod(ctx.method.toLowerCase()),
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

export function koaBindRoutes<Spec>(
  handler: runtime.server.HandlerFactory<Spec>,
  spec: Spec
): Router {
  const router = new Router();
  const adapter = koaAdapter(router);
  handler(adapter)(spec);
  return router;
}
