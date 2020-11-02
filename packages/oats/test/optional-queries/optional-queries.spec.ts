// yarn ts-node examples/server.ts
import * as server from './tmp/server/generated';
import * as client from './tmp/client/generated';
import * as runtime from '@smartlyio/oats-runtime';
import * as koaAdapter from '@smartlyio/oats-koa-adapter';
import * as Koa from 'koa';
import * as koaBody from 'koa-body';
import * as axiosAdapter from '@smartlyio/oats-axios-adapter';
import * as http from 'http';

// 'api.EndpointsWithContext' is the generated type of the server
const spec: server.Endpoints = {
  '/item/{id}': {
    post: async () => runtime.json(200, { ok: 'post with id' })
  },
  '/item': {
    post: async () => {
      return runtime.json(200, { ok: 'post' });
    },
    get: async ctx => {
      return runtime.json(200, { ok: ctx.query.field || 'no value' });
    }
  }
};

const routes = koaAdapter.bind(
  runtime.server.createHandlerFactory<server.Endpoints>(server.endpointHandlers),
  spec
);

function createApp() {
  const app = new Koa();
  app.use(
    koaBody({
      multipart: true
    })
  );
  app.use(routes.routes());
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

describe('optional queries', () => {
  let apiClient: client.ClientSpec;
  let server: any;

  afterAll(() => {
    server?.close();
  });

  beforeAll(async () => {
    server = await new Promise(ok => {
      const server = createApp().listen(0, () => ok(server));
    });
    const port = serverPort(server);
    const url = `http://localhost:${port}`;
    apiClient = client.client((spec: typeof server.endpointHandlers) => {
      return axiosAdapter.bind({ ...spec, servers: [url] });
    });
  });

  describe('with no query parameters', () => {
    it('allows calling without any query parameters whene there are path params', async () => {
      const item = await apiClient.item('abc').post();
      expect(item.value.value.ok).toEqual('post with id');
    });
    it('allows calling without any query paramets', async () => {
      const item = await apiClient.item.post();
      expect(item.value.value.ok).toEqual('post');
    });
    it('prevents using non existing query parameters', async () => {
      // @ts-expect-error unknown query parameter
      await expect(apiClient.item.get({ query: { a: 'a' } })).rejects.toThrow();
    });
  });

  describe('with optional query params', () => {
    it('prevents using non existing query parameter', async () => {
      // @ts-expect-error unknown query parameter
      await expect(apiClient.item.get({ query: { error: 1 } })).rejects.toThrow();
    });

    it('allows calling without any query paramets', async () => {
      const item = await apiClient.item.get();
      expect(item.value.value.ok).toEqual('no value');
    });

    it('allows calling without query paramets', async () => {
      const item = await apiClient.item.get({ query: { field: 'something' } });
      expect(item.value.value.ok).toEqual('something');
    });
  });
});
