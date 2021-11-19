// yarn ts-node examples/server.ts
import * as server from './tmp/server/generated';
import * as client from './tmp/client/generated';
import * as runtime from '@smartlyio/oats-runtime';
import * as koaAdapter from '@smartlyio/oats-koa-adapter';
import * as Koa from 'koa';
import * as koaBody from 'koa-body';
import * as axiosAdapter from '@smartlyio/oats-axios-adapter';
import * as http from 'http';
import { IMiddleware } from 'koa-router';

const spec: server.Endpoints = {
  '/test': {
    get: async () => {
      return runtime.noContent(201);
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
  let server: any;
  let middlewareHit = false;

  beforeEach(() => {
    middlewareHit = false;
  });

  afterAll(() => {
    server?.close();
  });

  beforeAll(async () => {
    server = await new Promise(ok => {
      const server = createApp(async (ctx, next) => {
        middlewareHit = true;
        await next();
      }).listen(0, () => ok(server));
    });
    const port = serverPort(server);
    const url = `http://localhost:${port}`;
    apiClient = client.client((spec: typeof server.endpointHandlers) => {
      return axiosAdapter.create()({ ...spec, servers: [url] });
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
});
