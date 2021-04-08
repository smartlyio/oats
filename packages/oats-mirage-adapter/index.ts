import * as runtime from '@smartlyio/oats-runtime';
import * as mirage from 'miragejs';
import * as mirageTypes from 'miragejs/-types';
import Schema from 'miragejs/orm/schema';
import { Server } from 'miragejs/server';
import { Registry as MirageRegistry, Registry } from 'miragejs/-types';

function adapter<Registry extends mirageTypes.AnyRegistry, RequestContext>(
  mirageServer: mirage.Server<Registry>,
  requestContextCreator: (schema: Schema<Registry>, request: mirage.Request) => RequestContext
): runtime.server.ServerAdapter {
  return (
    path: string,
    op: string,
    method: runtime.server.Methods,
    handler: runtime.server.SafeEndpoint
  ) => {
    const miragePath = path.replace(/{([^}]+)}/g, (m, param) => ':' + param);
    const mirageHandler: typeof mirageServer.get = (mirageServer as any)[method];
    mirageHandler(miragePath, async (schema, request) => {
      const contentType = request.requestHeaders['content-type'] || 'text/html';
      const value =
        contentType.match(/application\/json/) && request.requestBody
          ? JSON.parse(request.requestBody)
          : request.requestBody;
      const body = value != null ? { value, contentType } : undefined;
      const result = await handler({
        path,
        method: runtime.server.assertMethod('get'),
        servers: [],
        op,
        headers: request.requestHeaders,
        params: request.params,
        query: request.queryParams,
        body,
        requestContext: requestContextCreator(schema, request)
      });
      // eslint-disable-next-line no-console
      console.log(result);
      return new mirage.Response(
        result.status,
        { ...result.headers, 'content-type': result.value.contentType },
        result.value.contentType.match(/application\/json/)
          ? JSON.stringify(result.value.value)
          : result.value.value
      );
    });
  };
}

/**
 * Bind provided handlers for the OpenAPI routes
 */
export function bind<
  Spec,
  Models extends mirageTypes.AnyModels = never,
  Factories extends mirageTypes.AnyFactories = never,
  RequestContext = void
>(opts: {
  server: Server<MirageRegistry<Models, Factories>>;
  handler: runtime.server.HandlerFactory<Spec>;
  spec: Spec;
  requestContextCreator?: (schema: Schema<Registry<Models, Factories>>) => RequestContext;
}): void {
  opts.handler(adapter(opts.server, opts.requestContextCreator || (() => ({}))))(opts.spec);
}
