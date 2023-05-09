// yarn ts-node examples/server.ts
import { describe, it, expect, beforeAll } from '@jest/globals';
import * as server from './tmp/server/generated';
import * as client from './tmp/client/generated';
import * as runtime from '@smartlyio/oats-runtime';
import * as koaAdapter from '@smartlyio/oats-koa-adapter';
import * as Koa from 'koa';
import { koaBody } from 'koa-body';
import * as axiosAdapter from '@smartlyio/oats-axios-adapter';
import * as http from 'http';
import { AddressInfo } from 'net';

describe('client body send', () => {
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

  it('should drop all unknown values before sending request to server when dropping unknown fields', async () => {
    const body = {
      thisIsUnkownProperty: 'value',
      requiredField: 'xxx',
      optionalField: 'yyy'
    } as any;
    const actual = await clientSpec.item.post({
      body: runtime.client.json(body)
    });

    expect(actual.status).toBe(200);
    expect(actual.value.value).toEqual({
      body: {
        requiredField: 'xxx',
        optionalField: 'yyy'
      }
    });
  });

  it('should drop unknown fields and match to closest schema', async () => {
    const body = {
      requiredField: 'yyy',
      optionalField: 'xxx',
      typeUnion: {
        field_a: 'a',
        field_b: 'b',
        unknownField: true
      }
    } as any;

    const actual = await clientSpec.item.post({
      body: runtime.client.json(body)
    });

    expect(actual.status).toBe(200);
    expect(actual.value.value).toEqual({
      body: {
        requiredField: 'yyy',
        optionalField: 'xxx',
        typeUnion: {
          field_a: 'a',
          field_b: 'b'
        }
      }
    });
  });

  it('should throw error when object would match two different schemas with same amount of properties', async () => {
    const body = {
      requiredField: 'yyy',
      optionalField: 'xxx',
      typeUnion: {
        field_a: 'a',
        unknownField: true
      }
    } as any;

    await expect(() =>
      clientSpec.item.post({
        body: runtime.client.json(body)
      })
    ).rejects.toThrow(/typeUnion: multiple options match/);
  });
});
