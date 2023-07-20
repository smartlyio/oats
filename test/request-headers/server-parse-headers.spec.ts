import { describe, it, expect, beforeAll } from '@jest/globals';
import * as server from './tmp/server/generated';
import * as runtime from '@smartlyio/oats-runtime';
import * as koaAdapter from '@smartlyio/oats-koa-adapter';
import * as Koa from 'koa';
import * as http from 'http';
import { AddressInfo } from 'net';
import { Axios } from 'axios';

describe('server parse headers', () => {
  let parsedHeaders: object | null = null;

  beforeEach(() => {
    parsedHeaders = null;
  });

  const getRoutes = () =>
    koaAdapter.bind(
      server.createRouter<Koa.Context>(),
      {
        '/send-required-header': {
          get: async ctx => {
            parsedHeaders = ctx.headers;

            return runtime.noContent(204);
          }
        },
        '/send-optional-header': {
          get: async ctx => {
            parsedHeaders = ctx.headers;

            return runtime.noContent(204);
          }
        },
        '/send-no-headers': {
          get: async ctx => {
            parsedHeaders = ctx.headers;

            return runtime.noContent(204);
          }
        }
      },
      koaContext => koaContext
    );
  const createApp = () => {
    const app = new Koa();
    app.use(async (ctx, next) => {
      try {
        await next();
      } catch (error) {
        if (error instanceof runtime.server.RequestValidationError) {
          ctx.status = 400;
          ctx.set('content-type', 'text/plain');
          ctx.body = error.message;
          return;
        }
        throw error;
      }
    });
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

  describe('Endpoint with required headers', () => {
    const endpointUrl = '/send-required-header';

    it('should fail request without the required headers', async () => {
      const response = await axios.get(endpointUrl, {
        headers: { 'x-request-id': 'testrequestid' }
      });

      expect(response.status).toBe(400);
      expect(response.data).toContain(
        'invalid request headers authorization: expected a string, but got `undefined` instead.'
      );
      expect(parsedHeaders).toBeNull();
    });

    it('should drop unknown headers', async () => {
      const response = await axios.get(endpointUrl, {
        headers: { authorization: 'basic auth', unknown: 'somevalue' }
      });

      expect(response.status).toBe(204);
      expect(parsedHeaders).toEqual({ authorization: 'basic auth' });
      expect('unknown' in parsedHeaders!).toBe(false);
    });

    it('should accept request with required headers', async () => {
      const response = await axios.get(endpointUrl, {
        headers: { authorization: 'basic auth' }
      });

      expect(response.status).toBe(204);
      expect(parsedHeaders).toEqual({ authorization: 'basic auth' });
    });
  });

  describe('Endpoint with optional headers', () => {
    const endpointUrl = '/send-optional-header';

    it('should accept request without headers', async () => {
      const response = await axios.get(endpointUrl);

      expect(response.status).toBe(204);
      expect(parsedHeaders).toEqual({});
    });

    it('should include optional headers', async () => {
      const response = await axios.get(endpointUrl, {
        headers: { 'x-request-id': 'testrequestid' }
      });

      expect(response.status).toBe(204);
      expect(parsedHeaders).toEqual({ 'x-request-id': 'testrequestid' });
    });
  });

  describe('Endpoint without headers', () => {
    const endpointUrl = '/send-no-headers';

    it('should drop all headers', async () => {
      const response = await axios.get(endpointUrl, {
        headers: { unknown: 'somevalue' }
      });

      expect(response.status).toBe(204);
      expect(parsedHeaders).toEqual({});
    });

    it('should accept request without headers', async () => {
      const response = await axios.get(endpointUrl);

      expect(response.status).toBe(204);
      expect(parsedHeaders).toEqual({});
    });
  });
});
