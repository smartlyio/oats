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
  '/item': {
    post: async ctx => {
      return runtime.json(200, { ok: 'post', query: ctx.query });
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

describe('queries', () => {
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
      return axiosAdapter.create()({ ...spec, servers: [url] });
    });
  });

  describe('with additionalProperties', () => {
    it('allows calling with specified query property', async () => {
      const item = await apiClient.item.post({ query: { foo: 'abc' } });
      expect(item.value.value.query).toEqual({ foo: 'abc' });
    });

    it('allows calling with additionalProps', async () => {
      const item = await apiClient.item.post({ query: { field: 'something', extra: 'other' } });
      expect(item.value.value.query).toEqual({ field: 'something', extra: 'other' });
    });
  });
});
