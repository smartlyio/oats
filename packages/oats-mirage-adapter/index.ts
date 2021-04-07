import * as runtime from '@smartlyio/oats-runtime';
import * as mirage from 'miragejs';
import * as mirageTypes from 'miragejs/-types';
import Schema from 'miragejs/orm/schema';
import { ServerConfig } from 'miragejs/server';

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
      const contentType = request.requestHeaders['content-type'];
      const value = contentType.match(/application\/json/)
        ? JSON.parse(request.requestBody)
        : request.requestBody;
      const body = Object.keys(value).length > 0 ? { value, contentType } : undefined;
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
      return new mirage.Response(
        result.status,
        { ...result.headers, contentType: result.value.contentType },
        result.value.contentType.match(/application\/json/)
          ? JSON.stringify(value.value)
          : value.value
      );
    });
  };
}

/**
 * Bind provided handlers for the OpenAPI routes
 */
export function bind<
  Spec,
  Models extends mirageTypes.AnyModels,
  Factories extends mirageTypes.AnyFactories,
  RequestContext = void
>(
  handler: runtime.server.HandlerFactory<Spec>,
  spec: Spec,
  config: ServerConfig<Models, Factories>,
  requestContextCreator?: (
    schema: Schema<mirageTypes.Registry<Models, Factories>>,
    request: mirage.Request
  ) => RequestContext
): mirage.Server<mirage.Registry<Models, Factories>> {
  return mirage.createServer({
    ...config,
    routes() {
      handler(adapter(this, requestContextCreator || (() => ({}))))(spec);
    }
  });
}
