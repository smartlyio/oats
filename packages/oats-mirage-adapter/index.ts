import * as runtime from '@smartlyio/oats-runtime';
import * as mirage from 'miragejs';
import * as mirageTypes from 'miragejs/-types';
import Schema from 'miragejs/orm/schema';
import { Server } from 'miragejs/server';
import { Registry as MirageRegistry, Registry } from 'miragejs/-types';

function guessContentType(contentTypeHeader: string | undefined, value: any): string {
  if (contentTypeHeader?.includes('application/json')) {
    return 'application/json';
  }
  if (contentTypeHeader) {
    return contentTypeHeader;
  }
  if (value instanceof FormData) {
    return 'multipart/form-data';
  }
  return 'text/html';
}

async function guessValue(contentType: string, value: any) {
  if (value instanceof FormData) {
    return await handleFormData(value);
  }
  if (contentType.match(/application\/json/) && value) {
    return JSON.parse(value);
  }
  return value;
}

async function handleFormData(value: FormData) {
  const result: Record<string, string | ArrayBuffer> = {};
  const keys: string[] = [];
  value.forEach((_, key) => keys.push(key));
  for (const key of keys) {
    const keyValue = value.get(key);
    if (keyValue instanceof Blob) {
      result[key] = await keyValue.arrayBuffer();
    } else if (typeof keyValue === 'string') {
      result[key] = keyValue;
    }
  }
  return result;
}

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
      const headers = Object.keys(request.requestHeaders).reduce<Record<string, string>>(
        (lowerCaseHeaders, key) => {
          lowerCaseHeaders[key.toLowerCase()] = request.requestHeaders[key];

          return lowerCaseHeaders;
        },
        {}
      );

      const contentType = guessContentType(headers['content-type'], request.requestBody);
      const value = await guessValue(contentType, request.requestBody);
      const body = value != null ? { value, contentType } : undefined;
      const ctx = {
        path,
        method,
        servers: [],
        op,
        headers,
        params: request.params,
        query: request.queryParams,
        body,
        requestContext: requestContextCreator(schema, request)
      };
      // eslint-disable-next-line no-console
      console.log('oats-mirage-adapter request', ctx);
      try {
        const result = await handler(ctx);
        // eslint-disable-next-line no-console
        console.log('oats-mirage-adapter response', { result });
        return new mirage.Response(
          result.status,
          { ...result.headers, 'content-type': result.value.contentType },
          result.value.contentType.match(/application\/json/)
            ? JSON.stringify(result.value.value)
            : result.value.value
        );
      } catch (error) {
        // eslint-disable-next-line no-console
        console.log('oats-mirage-adapter handler threw: ' + error.message, { error });
        return new mirage.Response(
          400,
          { 'content-type': 'text/plain' },
          'Error from handler: ' + error.message
        );
      }
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
