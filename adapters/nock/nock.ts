import nock from 'nock';
import * as runtime from '@smartlyio/oats-runtime';

function adapter(): runtime.server.ServerAdapter {
  return (
    path: string,
    op: string,
    method: runtime.server.Methods,
    handler: runtime.server.SafeEndpoint
  ) => {
    const pathWithParams = path.replace(/{([^}]+)}/g, (m, param) => ' ' + param + ' ');
    const escapedPath = pathWithParams.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const finalPath = escapedPath.replace(/ ([^ ]+) /g, '([^/]+)');
    nock[method](/.*/)
      .path(new RegExp(finalPath))
      // tslint:disable-next-line:only-arrow-functions
      .reply(function (uri: string, requestBody: unknown) {
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
  });
  };
}

export function bind<Spec>(handler: runtime.server.HandlerFactory<Spec>, spec: Spec): Router {
  const router = new Router();
  handler(adapter(router))(spec);
  return router;
}
