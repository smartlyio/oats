// yarn ts-node examples/server.ts
import { describe, it, expect, beforeAll } from '@jest/globals';
import * as server from './tmp/server/generated';
import * as runtime from '@smartlyio/oats-runtime';
import * as koaAdapter from '@smartlyio/oats-koa-adapter';
import * as Koa from 'koa';
import { koaBody } from 'koa-body';
import * as http from 'http';
import { AddressInfo } from 'net';
import { Axios } from 'axios';

describe('server body', () => {
  const getRoutes = () =>
    koaAdapter.bind(
      server.createRouter({ validationOptions: { body: { unknownField: 'drop' } } }),
      {
        '/item': {
          post: async ctx => {
            return runtime.json(200, { body: ctx.body.value });
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
    const axios = new Axios({
      baseURL: `http://localhost:${port}`
    });
    return {
      httpServer,
      axios
    };
  };

  let httpServer: http.Server;
  let axios: Axios;
  beforeAll(async () => {
    const response = await createServer();
    httpServer = response.httpServer;
    axios = response.axios;
  });

  afterAll(() => {
    httpServer?.close();
  });

  it('should drop all unknown values and process request when dropping unknown fields', async () => {
    const actual = await axios.post(
      '/item',
      JSON.stringify({
        thisIsUnkownProperty: 'value',
        requiredField: 'xxx',
        optionalField: 'yyy'
      }),
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    expect(actual.status).toBe(200);
    expect(JSON.parse(actual.data)).toEqual({
      body: {
        requiredField: 'xxx',
        optionalField: 'yyy'
      }
    });
  });

  it('should drop unknown fields and match to closest schema', async () => {
    const actual = await axios.post(
      '/item',
      JSON.stringify({
        requiredField: 'xxx',
        optionalField: 'yyy',
        typeUnion: {
          field_a: 'a',
          field_b: 'b',
          unknownField: true
        }
      }),
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    expect(actual.status).toBe(200);
    expect(JSON.parse(actual.data)).toEqual({
      body: {
        requiredField: 'xxx',
        optionalField: 'yyy',
        typeUnion: {
          field_a: 'a',
          field_b: 'b'
        }
      }
    });
  });

  it('should return error when request would match two different schemas with same amount of properties', async () => {
    const actual = await axios.post(
      '/item',
      JSON.stringify({
        requiredField: 'xxx',
        optionalField: 'yyy',
        typeUnion: {
          field_a: 'a',
          unknownField: true
        }
      }),
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    expect(actual.status).toBe(500);
  });
});
