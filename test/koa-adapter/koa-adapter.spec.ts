// yarn ts-node examples/server.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import * as server from './tmp/server/generated';
import * as client from './tmp/client/generated';
import * as runtime from '@smartlyio/oats-runtime';
import * as koaAdapter from '@smartlyio/oats-koa-adapter';
import * as Koa from 'koa';
import * as koaBody from 'koa-body';
import * as axiosAdapter from '@smartlyio/oats-axios-adapter';
import * as http from 'http';
import { IMiddleware } from 'koa-router';
import axios from 'axios';

const spec: server.Endpoints = {
  '/test': {
    get: async () => {
      return runtime.noContent(201);
    }
  },
  '/test-redirect': {
    get: async () => {
      return runtime.redirect('/');
    }
  },
  '/': {
    get: async () => {
      return runtime.text(200, 'Welcome to Home Page!');
    }
  }
};

function createRoutes(middleware: IMiddleware<any, any>) {
  return koaAdapter.bind({
    handler: runtime.server.createHandlerFactory<server.Endpoints>(server.endpointHandlers),
    spec,
    middlewares: [middleware]
  });
}

function createApp(middleware: IMiddleware<any, any>) {
  const app = new Koa();
  app.use(
    koaBody({
      multipart: true
    })
  );
  app.use(createRoutes(middleware).routes());
  return app;
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

describe('Koa adapter', () => {
  let apiClient: client.ClientSpec;
  let apiClientNoAutoRedirect: client.ClientSpec;
  let httpServer: http.Server | undefined;
  let middlewareHit = false;

  beforeEach(() => {
    middlewareHit = false;
  });

  afterAll(() => {
    httpServer?.close();
  });

  beforeAll(async () => {
    httpServer = await new Promise<http.Server>(resolve => {
      const httpServer = createApp(async (ctx, next) => {
        middlewareHit = true;
        await next();
      }).listen(0, () => resolve(httpServer));
    });
    const port = serverPort(httpServer);
    const url = `http://localhost:${port}`;

    apiClient = client.client(spec => {
      return axiosAdapter.create()({ ...spec, servers: [url] });
    });
    apiClientNoAutoRedirect = client.client(spec => {
      return axiosAdapter.create({
        axiosInstance: axios.create({ maxRedirects: 0, validateStatus: status => status < 400 })
      })({ ...spec, servers: [url] });
    });
  });

  it('sets a valid status code, when noContent is returned', async () => {
    const item = await apiClient.test.get();
    expect(item.status).toEqual(201);
  });

  it('hits the given middleware', async () => {
    await apiClient.test.get();
    expect(middlewareHit).toBeTruthy();
  });

  it('redirects to "/"', async () => {
    const result = await apiClient['test-redirect'].get();
    expect(result.status).toBe(200);
    expect(result.value.contentType).toBe('text/plain');
    expect(result.value.value).toBe('Welcome to Home Page!');
  });

  it('does not redirect to "/" if auto redirect is not enabled', async () => {
    const result = await apiClientNoAutoRedirect['test-redirect'].get();
    expect(result.status).toBe(302);
    expect(result.value.contentType).toBe('text/html');
    expect(result.value.value).toBe('Redirecting to <a href="/">/</a>.');
  });
});
