import * as nock from 'nock';
import * as runtime from '@smartlyio/oats-runtime';
import * as assert from 'assert';

function parseContentDisposition(contentDispositionValue: string): Record<string, string> {
  return contentDispositionValue
    .split(';')
    .map(part => part.trim())
    .map(part => {
      const [key, ...values] = part.split('=');
      return [key, values.join('=').replace(/^"/g, '').replace(/"$/, '')];
    })
    .reduce((memo, [key, value]) => ({ ...memo, [key]: value }), {});
}

function parseFormItem(item: string) {
  const headers: Record<string, string> = {};
  const lines = item.split('\r\n');
  let data;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === '') {
      data = lines.slice(i + 1).join('\n');
      break;
    }
    const [header, ...headerValues] = lines[i].split(':');
    headers[header.toLowerCase()] = headerValues.join(':').trim();
  }
  if (headers['content-disposition']) {
    const contentDisposition = parseContentDisposition(headers['content-disposition']);
    if (contentDisposition.filename) {
      return {
        key: contentDisposition.name,
        value: new runtime.make.FormBinary(Buffer.from(data || ''), contentDisposition.filename)
      };
    }
    return {
      key: contentDisposition.name,
      value: data
    };
  }
}

function parseFormData(boundary: RegExp, value: unknown) {
  if (typeof value !== 'string') {
    return assert.fail('form-data value is not a string');
  }
  return value.split(boundary).reduce((memo, item) => {
    if (item === '') {
      return memo;
    }
    const parsed = parseFormItem(item);
    if (!parsed) {
      return memo;
    }
    return { ...memo, [parsed.key]: parsed.value };
  }, {});
}

function getBody(contentType: string | undefined, value: unknown) {
  if (!contentType) {
    return value;
  }
  if (/application\/json/.test(contentType)) {
    return { contentType: 'application/json', value };
  }
  const formData = contentType.match(/^multipart\/form-data.*; boundary=([^;]+)/);
  if (formData) {
    const boundary = new RegExp('(?:\r\n)?[^\r\n]*' + formData[1] + '[^\r\n]*(?:\r\n)?');
    return { contentType: 'multipart/form-data', value: parseFormData(boundary, value) };
  }
  const multipartRelatedData = contentType.match(/^multipart\/related.*; boundary=([^;]+)/);
  if (multipartRelatedData) {
    return { contentType: 'multipart/related', value: value };
  }
  return value as any;
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
  return new RegExp(escapedPath.replace(/ ([^ ]+) /g, '([^?/]+)'));
}

function normalizeHeaderValue(value: unknown): string {
  if (Array.isArray(value)) {
    assert(value.length === 1, 'unexpected length of header array');
    value = value[0];
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number') {
    return `${value}`;
  }
  assert.fail(`Unknown header value ${value}`);
}

function normalizeHeaders(headers: Record<string, unknown> | undefined): Record<string, string> {
  headers = headers || {};
  return Object.entries(headers).reduce((memo, [key, value]) => {
    return {
      ...memo,
      [key]: normalizeHeaderValue(value)
    };
  }, {});
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
      .reply(async function (uri, requestBody, cb) {
        const headers = normalizeHeaders(this.req.headers);
        const body = getBody(headers['content-type'], requestBody);
        const url = new URL('http://host-for-nock' + uri);
        try {
          const result = await nocked({
            path,
            method,
            servers: [server],
            op,
            headers,
            params: getParams(path, uri),
            query: getQuery(url),
            body,
            requestContext: null
          });
          const status = result.status;
          const responseBody = result.value.value;
          const responseHeaders = result.headers;
          cb(null, [status, responseBody, responseHeaders]);
        } catch (e: any) {
          cb(e, [400, e.message]);
        }
      })
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
