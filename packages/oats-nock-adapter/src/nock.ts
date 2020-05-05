import * as nock from 'nock';
import * as runtime from '@smartlyio/oats-runtime';
import * as assert from 'assert';

function getBody(contentType: string, value: unknown) {
  if (/application\/json/.test(contentType)) {
    return { contentType: 'application/json', value };
  }
  return undefined;
}

function getQuery(url: URL): undefined | { [key: string]: string } {
  const query: { [key: string]: string } = {};
  url.searchParams.forEach((value: string, key: string) => {
    query[key] = value;
  });
  return Object.keys(query).length > 0 ? query : undefined;
}

function getParams(
  pathTemplate: string,
  actualPath: string
): { [key: string]: string } | undefined {
  const pathRegex = getPathRegex(pathTemplate);
  const match = actualPath.match(pathRegex);
  if (!match) {
    return assert.fail('path regex did not match given path: ' + actualPath);
  }
  const params: { [key: string]: string } = {};
  getPathParamNames(pathTemplate).forEach((key, index) => {
    params[key] = match[index + 1];
  });
  return Object.keys(params).length > 0 ? params : undefined;
}

function getPathParamNames(pathTemplate: string): readonly string[] {
  return pathTemplate.match(/{([^}]+)}/g) || [];
}

function getPathRegex(pathTemplate: string): RegExp {
  const pathWithParams = pathTemplate.replace(/{([^}]+)}/g, (m, param) => ' ' + param + ' ');
  const escapedPath = pathWithParams.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(escapedPath.replace(/ ([^ ]+) /g, '([^/]+)'));
}

function adapter(
  path: string,
  op: string,
  method: runtime.server.Methods,
  handler: runtime.server.SafeEndpoint,
  servers: string[]
) {
  servers.map(server => adapterForServer(path, op, method, handler, server));
}

function adapterForServer(
  path: string,
  op: string,
  method: runtime.server.Methods,
  handler: runtime.server.SafeEndpoint,
  server: string
) {
  nock(server)
    [method](getPathRegex(path))
    .times(Infinity)
    .reply(
      // tslint:disable-next-line:only-arrow-functions
      async function(uri, requestBody, cb) {
        const body = getBody(this.req.headers['content-type'], requestBody);
        const url = new URL('http://host-for-nock' + uri);
        try {
          const result = await handler({
            path,
            method,
            servers: [server],
            op,
            headers: this.req.headers,
            params: getParams(path, this.req.path),
            query: getQuery(url),
            body,
            requestContext: null
          });
          const status = result.status;
          const responseBody = result.value.value;
          cb(null, [status, responseBody]);
        } catch (e) {
          cb(e, [400, e.message]);
        }
      }
    );
}

export function bind<Spec>(handler: runtime.server.HandlerFactory<Spec>, spec: Spec) {
  handler(adapter)(spec);
}
