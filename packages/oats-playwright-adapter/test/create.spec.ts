import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import * as playwrightAdapter from '../index';
import type { APIRequestContext, APIResponse } from 'playwright';
import type * as runtime from '@smartlyio/oats-runtime';

function mockResponse(
  overrides: Partial<{
    status: number;
    headers: Record<string, string>;
    body: string;
  }> = {}
): APIResponse {
  const status = overrides.status ?? 200;
  const headers = overrides.headers ?? { 'content-type': 'text/plain' };
  const body = overrides.body ?? 'ok';

  return {
    status: () => status,
    headers: () => headers,
    text: async () => body,
    json: async () => JSON.parse(body)
  } as APIResponse;
}

function mockRequest(): APIRequestContext & { fetch: jest.Mock } {
  return {
    fetch: jest.fn(async () => mockResponse())
  } as unknown as APIRequestContext & { fetch: jest.Mock };
}

function adapterArg(
  overrides: Partial<runtime.server.EndpointArg<any, any, any, any>> = {}
): Parameters<ReturnType<typeof playwrightAdapter.create>>[0] {
  return {
    path: '/',
    method: 'get',
    servers: ['http://localhost:3000'],
    headers: undefined,
    params: undefined,
    query: undefined,
    body: undefined,
    requestContext: { path: overrides.path ?? '/' },
    ...overrides
  };
}

describe('create()', () => {
  let request: ReturnType<typeof mockRequest>;

  beforeEach(() => {
    request = mockRequest();
  });

  it('builds request url from relative server without using URL constructor', async () => {
    const adapter = playwrightAdapter.create(request);

    await adapter(
      adapterArg({
        servers: ['/creative-templates'],
        path: '/items'
      })
    );

    expect(request.fetch).toHaveBeenCalledWith(
      '/creative-templates/items',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('builds request url from another relative server', async () => {
    const adapter = playwrightAdapter.create(request);

    await adapter(
      adapterArg({
        servers: ['/matrix'],
        path: '/entities'
      })
    );

    expect(request.fetch).toHaveBeenCalledWith('/matrix/entities', expect.any(Object));
  });

  it('appends query parameters to relative server urls', async () => {
    const adapter = playwrightAdapter.create(request);

    await adapter(
      adapterArg({
        servers: ['/matrix'],
        path: '/entities',
        query: { one: 'the loneliest number' }
      })
    );

    expect(request.fetch).toHaveBeenCalledWith(
      '/matrix/entities?one=the+loneliest+number',
      expect.any(Object)
    );
  });

  it('appends array query parameters to relative server urls', async () => {
    const adapter = playwrightAdapter.create(request);

    await adapter(
      adapterArg({
        servers: ['/matrix'],
        path: '/entities',
        query: { numbers: ['one', 'two'] }
      })
    );

    expect(request.fetch).toHaveBeenCalledWith(
      '/matrix/entities?numbers=one&numbers=two',
      expect.any(Object)
    );
  });

  it('builds request url from absolute server', async () => {
    const adapter = playwrightAdapter.create(request);

    await adapter(
      adapterArg({
        servers: ['http://localhost:3000'],
        path: '/items',
        query: { filter: 'active' }
      })
    );

    expect(request.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/items?filter=active',
      expect.any(Object)
    );
  });

  it('omits query string when query parameters are empty', async () => {
    const adapter = playwrightAdapter.create(request);

    await adapter(
      adapterArg({
        servers: ['/matrix'],
        path: '/entities',
        query: {}
      })
    );

    expect(request.fetch).toHaveBeenCalledWith('/matrix/entities', expect.any(Object));
  });
});
