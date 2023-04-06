import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import * as server from './tmp/server/generated';
import * as client from './tmp/client/generated';
import * as runtime from '@smartlyio/oats-runtime';
import * as koaAdapter from '@smartlyio/oats-koa-adapter';
import * as Koa from 'koa';
import { koaBody } from 'koa-body';
import * as fetchAdapter from '@smartlyio/oats-fetch-adapter';
import * as http from 'http';

describe('fetch adapter', () => {
  let apiClient: client.ClientSpec;
  let httpServer: http.Server | undefined;
  let receivedContext: any;

  const spec: server.Endpoints = Object.fromEntries(
    server.endpointHandlers.map(handler => [
      handler.path,
      {
        [handler.method]: async (ctx: any) => {
          receivedContext = ctx;
          return runtime.text(200, 'done');
        }
      }
    ])
  );

  function createApp() {
    return new Koa()
      .use(koaBody({ multipart: true, json: true }))
      .use(
        koaAdapter
          .bind({ handler: runtime.server.createHandlerFactory(server.endpointHandlers), spec })
          .routes()
      );
  }

  function serverPort(server: http.Server) {
    return serverAddress(server).split(/:/)[2] || 80;
  }

  function serverAddress(server: http.Server) {
    const addr = server.address();
    if (typeof addr === 'string') {
      return addr;
    } else if (!addr) {
      throw new Error('missing server address');
    }

    return `http://localhost:${addr.port}`;
  }

  beforeEach(() => {
    receivedContext = null;
  });

  afterAll(() => {
    httpServer?.close();
  });

  beforeAll(async () => {
    httpServer = await new Promise<http.Server>(resolve => {
      const httpServer = createApp().listen(0, () => resolve(httpServer));
    });
    const port = serverPort(httpServer);
    const url = `http://localhost:${port}`;

    apiClient = client.client(spec => fetchAdapter.create()({ ...spec, servers: [url] }));
  });

  it('correctly calls basic GET request', async () => {
    const response = await apiClient.get();

    expect(response.status).toBe(200);
    expect(response.value.value).toBe('done');

    expect(receivedContext).toBeDefined();
    expect(receivedContext.method).toEqual('get');
    expect(receivedContext.path).toEqual('/');
    expect(receivedContext.query).toEqual({});
    expect(receivedContext.headers).toEqual(null);
    expect(receivedContext.body).toEqual(null);
  });

  it('correctly calls GET request with query parameters', async () => {
    const response = await apiClient['with-query'].get({
      query: { one: 'the loneliest number' }
    });

    expect(response.status).toBe(200);
    expect(response.value.value).toBe('done');

    expect(receivedContext).toBeDefined();
    expect(receivedContext.method).toEqual('get');
    expect(receivedContext.path).toEqual('/with-query');
    expect(receivedContext.query).toEqual({ one: 'the loneliest number' });
    expect(receivedContext.headers).toEqual(null);
    expect(receivedContext.body).toEqual(null);
  });

  it('correctly calls GET request with header parameters', async () => {
    const response = await apiClient['with-headers'].get({
      headers: { one: 'the loneliest number' }
    });

    expect(response.status).toBe(200);
    expect(response.value.value).toBe('done');

    expect(receivedContext).toBeDefined();
    expect(receivedContext.method).toEqual('get');
    expect(receivedContext.path).toEqual('/with-headers');
    expect(receivedContext.headers).toEqual({ one: 'the loneliest number' });
    expect(receivedContext.body).toEqual(null);
  });

  it('correctly calls POST request with json body', async () => {
    const response = await apiClient['json-body'].post({
      body: {
        contentType: 'application/json',
        value: { one: 'the loneliest number' }
      }
    });

    expect(response.status).toBe(200);
    expect(response.value.value).toBe('done');

    expect(receivedContext).toBeDefined();
    expect(receivedContext.method).toEqual('post');
    expect(receivedContext.path).toEqual('/json-body');
    expect(receivedContext.headers).toEqual(null);
    expect(receivedContext.body).toEqual({
      contentType: 'application/json',
      value: { one: 'the loneliest number' }
    });
  });
});
