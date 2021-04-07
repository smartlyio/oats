import * as runtime from '@smartlyio/oats-runtime';
import * as mirage from 'miragejs';
import * as mirageTypes from 'miragejs/-types';
import Schema from 'miragejs/orm/schema';
import { ServerConfig } from 'miragejs/server';
import { Registry } from 'miragejs/-types';

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

enum ServiceBrand {}
type Service<
  Models extends mirageTypes.AnyModels = never,
  Factories extends mirageTypes.AnyFactories = never
> = {
  handler: runtime.server.HandlerFactory<unknown>;
  spec: unknown;
} & { _brand: ServiceBrand };

export function service<
  Spec,
  Models extends mirageTypes.AnyModels = never,
  Factories extends mirageTypes.AnyFactories = never
>(handler: runtime.server.HandlerFactory<Spec>, spec: Spec): Service<Models, Factories> {
  return { handler, spec } as any;
}

/**
 * Bind provided handlers for the OpenAPI routes
 */
export function bind<
  Models extends mirageTypes.AnyModels = never,
  Factories extends mirageTypes.AnyFactories = never,
  RequestContext = void
>(opts: {
  namespaces: { [namespace: string]: Service<Models, Factories> };
  service?: Service<Models, Factories>;
  requestContextCreator?: (schema: Schema<Registry<Models, Factories>>) => RequestContext;
  config: ServerConfig<Models, Factories>;
}): mirage.Server<mirage.Registry<Models, Factories>> {
  return mirage.createServer({
    ...opts.config,
    routes() {
      if (opts.service) {
        opts.service.handler(adapter(this, opts.requestContextCreator || (() => ({}))))(
          opts.service.spec
        );
      }
      Object.keys(opts.namespaces).forEach(namespace => {
        this.namespace = namespace;
        opts.namespaces[namespace].handler(
          adapter(this, opts.requestContextCreator || (() => ({})))
        )(opts.namespaces[namespace].spec);
      });
    }
  });
}
