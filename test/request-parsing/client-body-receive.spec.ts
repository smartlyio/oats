// yarn ts-node examples/server.ts
import { describe, it, expect, beforeAll } from '@jest/globals';
import * as server from './tmp/server/generated';
import * as client from './tmp/client-out-of-sync/generated';
import * as runtime from '@smartlyio/oats-runtime';
import * as koaAdapter from '@smartlyio/oats-koa-adapter';
import * as Koa from 'koa';
import { koaBody } from 'koa-body';
import * as axiosAdapter from '@smartlyio/oats-axios-adapter';
import * as http from 'http';
import { AddressInfo } from 'net';

describe('client body receive', () => {
  const getRoutes = () =>
    koaAdapter.bind(
      server.createRouter({ validationOptions: { body: { unknownField: 'fail' } } }),
      {
        '/item': {
          post: async ctx => {
            return runtime.json(200, { body: ctx.body.value });
          },
          get: async _ctx => {
            return runtime.json(200, {
              existingField: 'xxx',
              newField: 'yyy'
            });
          }
        }
      }
    );
  const createApp = () => {
    const app = new Koa();
    app.use(koaBody({ multipart: true }));
    app.use(getRoutes().routes());
    return app;
  };

  const createServer = async () => {
    const httpServer = await new Promise<http.Server>(resolve => {
      const server = createApp().listen(0, () => resolve(server));
    });
    const { port } = httpServer.address() as AddressInfo;
    const clientSpec = client.createClient({
      validationOptions: { body: { unknownField: 'drop' } }
    })(spec => {
      return axiosAdapter.create()({ ...spec, servers: [`http://localhost:${port}`] });
    });
    return {
      httpServer,
      clientSpec
    };
  };

  let httpServer: http.Server;
  let clientSpec: client.ClientSpec;
  beforeAll(async () => {
    const response = await createServer();
    httpServer = response.httpServer;
    clientSpec = response.clientSpec;
  });

  afterAll(() => {
    httpServer?.close();
  });

  it('should drop all unknown values when receiving request from server when dropping unknown fields', async () => {
    const actual = await clientSpec.item.get();

    expect(actual.status).toBe(200);
    expect(actual.value.value).toEqual({
      existingField: 'xxx'
    });
  });
});
