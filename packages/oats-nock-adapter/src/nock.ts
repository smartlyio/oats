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
    params[stripCurlies(key)] = match[index + 1];
  });
  return Object.keys(params).length > 0 ? params : undefined;
}

function stripCurlies(param: string) {
  return param.replace(/}|{/g, '');
}

function getPathParamNames(pathTemplate: string): readonly string[] {
  return pathTemplate.match(/{([^}]+)}/g) || [];
}

function getPathRegex(pathTemplate: string): RegExp {
  const pathWithParams = pathTemplate.replace(/{([^}]+)}/g, (m, param) => ' ' + param + ' ');
  const escapedPath = pathWithParams.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(escapedPath.replace(/ ([^ ]+) /g, '([^/]+)'));
}

export class Server<Spec> {
  private readonly scopes: nock.Scope[] = [];
  private routes: Spec = {} as Spec;
  private handlers: Record<string, runtime.server.SafeEndpoint[]> = {};
  private readonly mocks: Record<string, boolean> = {};

  constructor(private readonly handler: runtime.server.HandlerFactory<Spec>) {}

  addHandler(method: string, path: string, handler: runtime.server.SafeEndpoint) {
    const key = this.getKey(method, path);
    if (!this.handlers[key]) {
      this.handlers[key] = [handler];
    } else {
      this.handlers[key].unshift(handler);
    }
  }

  private getKey(method: string, path: string): string {
    return method + ' ' + path;
  }

  private getMockKey(server: string, method: string, path: string) {
    return [server, method, path].join(' ');
  }

  isMocked(server: string, method: string, path: string) {
    return this.mocks[this.getMockKey(server, method, path)];
  }
  setMocked(server: string, method: string, path: string) {
    this.mocks[this.getMockKey(server, method, path)] = true;
  }

  getNock(server: string, method: string, path: string): runtime.server.SafeEndpoint {
    this.setMocked(server, method, path);
    return async ctx => {
      for (const handler of this.handlers[this.getKey(ctx.method, ctx.path)]) {
        try {
          return await handler(ctx);
        } catch (e) {
          if (!(e instanceof Next)) {
            throw e;
          }
        }
      }
      throw new Error('no nock handler matched');
    };
  }

  mock(spec: Spec): this {
    this.handler(this.adapter)(spec);
    return this;
  }

  addNock(scope: nock.Scope) {
    this.scopes.push(scope);
  }

  private adapter = (
    path: string,
    op: string,
    method: runtime.server.Methods,
    handler: runtime.server.SafeEndpoint,
    servers: string[]
  ) => {
    servers.map(server => this.adapterForServer(path, op, method, handler, server));
  };

  private adapterForServer(
    path: string,
    op: string,
    method: runtime.server.Methods,
    handler: runtime.server.SafeEndpoint,
    server: string
  ) {
    this.addHandler(method, path, handler);
    if (this.isMocked(server, method, path)) {
      return;
    }
    const nocked = this.getNock(server, method, path);
    nock(server)
      [method](getPathRegex(path))
      .reply(
        // tslint:disable-next-line:only-arrow-functions
        async function(uri, requestBody, cb) {
          const body = getBody(this.req.headers['content-type'], requestBody);
          const url = new URL('http://host-for-nock' + uri);
          try {
            const result = await nocked({
              path,
              method,
              servers: [server],
              op,
              headers: this.req.headers,
              params: getParams(path, uri),
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
      )
      .persist(true);
  }
}

export class Next extends Error {
  constructor() {
    super('Next nock handler requested');
  }
}

export function bind<Spec>(
  handler: runtime.server.HandlerFactory<Spec>,
  spec?: Spec
): Server<Spec> {
  return new Server(handler).mock(spec || ({} as any));
}
