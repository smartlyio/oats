// yarn ts-node examples/server.ts
import { describe, it, expect, afterAll, beforeAll } from '@jest/globals';
import * as server from './tmp/server/generated';
import * as client from './tmp/client/generated';
import * as runtime from '@smartlyio/oats-runtime';
import * as koaAdapter from '@smartlyio/oats-koa-adapter';
import * as Koa from 'koa';
import * as koaBody from 'koa-body';
import * as axiosAdapter from '@smartlyio/oats-axios-adapter';
import * as http from 'http';
import { AddressInfo } from 'net';

const items = new Map([
  [1, { id: 1, name: 'first-item' }],
  [2, { id: 2, name: 'second-item' }],
  [3, { id: 3, name: 'third-item' }]
]);
const routes = koaAdapter.bind(server.createRouter(), {
  '/item/{id}': {
    async get(ctx) {
      if (!items.has(ctx.params.id)) {
        return runtime.text(404, `Item #${ctx.params.id} not found.`);
      }
      return runtime.json(200, items.get(ctx.params.id)!);
    }
  },
  '/item': {
    get: async ctx => {
      return runtime.json(
        200,
        ctx.query.ids.map(id => items.get(id) ?? null)
      );
    }
  }
});

function createApp() {
  const app = new Koa();
  app.use(koaBody({ multipart: true }));
  app.use(routes.routes());
  return app;
}

describe('parse and convert `validationOptions`', () => {
  let apiClient: client.ClientSpec;
  let server: http.Server | undefined;

  afterAll(() => {
    server?.close();
  });

  beforeAll(async () => {
    server = await new Promise<http.Server>(resolve => {
      const server = createApp().listen(0, () => resolve(server));
    });
    const { port } = server.address() as AddressInfo;
    const url = `http://localhost:${port}`;
    apiClient = client.client(spec => {
      return axiosAdapter.create()({ ...spec, servers: [url] });
    });
  });

  it('parses path parameters', async () => {
    await expect(apiClient.item(2).get()).resolves.toMatchObject({
      status: 200,
      value: {
        value: {
          id: 2,
          name: 'second-item'
        }
      }
    });
    await expect(apiClient.item(0).get()).resolves.toMatchObject({
      status: 404,
      value: {
        value: 'Item #0 not found.'
      }
    });
    await expect(apiClient.item('a').get()).rejects.toThrow(
      'invalid request params id: expected a number, but got `"a"` instead.'
    );
    await expect(apiClient.item(1.5).get()).rejects.toThrow(
      'invalid request params id: expected an integer, but got `1.5` instead.'
    );
  });

  it('parses query parameters', async () => {
    await expect(apiClient.item.get({ query: { ids: [3] } })).resolves.toMatchObject({
      status: 200,
      value: {
        value: [
          {
            id: 3,
            name: 'third-item'
          }
        ]
      }
    });
    await expect(apiClient.item.get({ query: { ids: [0, 2, 1.5] } })).resolves.toMatchObject({
      status: 200,
      value: {
        value: [
          null,
          {
            id: 2,
            name: 'second-item'
          },
          null
        ]
      }
    });
  });
});
