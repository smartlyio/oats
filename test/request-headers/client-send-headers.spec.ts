import { describe, it, expect, beforeAll } from '@jest/globals';
import * as client from './tmp/client/generated';
import * as Koa from 'koa';
import * as axiosAdapter from '@smartlyio/oats-axios-adapter';
import * as http from 'http';
import { AddressInfo } from 'net';

describe('client send headers', () => {
  let receivedHeaders: http.IncomingHttpHeaders | null;

  beforeEach(() => {
    receivedHeaders = null;
  });

  const createApp = () => {
    const app = new Koa();
    app.use((ctx, next) => {
      receivedHeaders = ctx.headers;
      ctx.status = 204;
      return next();
    });
    return app;
  };

  const createServer = async () => {
    const httpServer = await new Promise<http.Server>(resolve => {
      const server = createApp().listen(0, () => resolve(server));
    });
    const { port } = httpServer.address() as AddressInfo;
    const clientSpec = client.createClient()(spec => {
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

  describe('Endpoint with required headers', () => {
    const endpointUrl = 'send-required-header';

    it('should fail to send a request without the required headers', async () => {
      await expect(() =>
        clientSpec[endpointUrl].get({
          // @ts-expect-error required header is missing
          headers: { 'x-request-id': 'testrequestid' }
        })
      ).rejects.toThrow(
        new Error(
          'invalid request headers authorization: expected a string, but got `undefined` instead.'
        )
      );

      expect(receivedHeaders).toBeNull();
    });

    it('should drop unknown headers', async () => {
      const response = await clientSpec[endpointUrl].get({
        headers: {
          authorization: 'basic auth',
          'x-request-id': 'testrequestid',
          // @ts-expect-error unknown header
          unknown: 'somevalue'
        }
      });

      expect(response.status).toBe(204);
      expect(receivedHeaders).toEqual(
        expect.objectContaining({ authorization: 'basic auth', 'x-request-id': 'testrequestid' })
      );
      expect('unknown' in receivedHeaders!).toBe(false);
    });

    it('should make a request with required headers', async () => {
      const response = await clientSpec[endpointUrl].get({
        headers: { authorization: 'basic auth' }
      });

      expect(response.status).toBe(204);
      expect(receivedHeaders).toEqual(expect.objectContaining({ authorization: 'basic auth' }));
    });
  });

  describe('Endpoint with optional headers', () => {
    const endpointUrl = 'send-optional-header';

    it('should send no headers', async () => {
      const response = await clientSpec[endpointUrl].get();

      expect(response.status).toBe(204);
      expect(receivedHeaders).toBeTruthy();
    });

    it('should send optional headers', async () => {
      const response = await clientSpec[endpointUrl].get({
        headers: { 'x-request-id': 'basic auth' }
      });

      expect(response.status).toBe(204);
      expect(receivedHeaders).toEqual(expect.objectContaining({ 'x-request-id': 'basic auth' }));
    });
  });

  describe('Endpoint without headers', () => {
    const endpointUrl = 'send-no-headers';

    it('should send no headers', async () => {
      const response = await clientSpec[endpointUrl].get();

      expect(response.status).toBe(204);
      expect(receivedHeaders).toBeTruthy();
    });
  });
});
