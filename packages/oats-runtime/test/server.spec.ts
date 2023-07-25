import * as server from '../src/server';
import * as oar from '../src/runtime';
import {
  makeNumber,
  makeObject,
  Maker,
  makeString,
  makeVoid,
  makeEnum,
  makeArray
} from '../src/make';

describe('safe', () => {
  it('validates request and response', async () => {
    const endpoint = server.safe<any, any, any, any, any, any>(
      makeVoid(),
      makeVoid(),
      makeObject({ param: makeNumber() }) as Maker<any, any>,
      makeVoid(),
      makeObject({
        status: makeEnum(200),
        value: makeObject({
          contentType: makeString(),
          value: makeString()
        }),
        headers: makeObject({})
      }),
      async () => {
        return oar.json(200, 'response');
      }
    );

    const response = await endpoint({
      method: 'get',
      servers: ['https://example.com'],
      path: 'some/path',
      op: 'someOp',
      headers: null as any,
      params: null as any,
      query: { param: 1 } as any,
      body: null as any,
      requestContext: {}
    });
    expect(response.status).toEqual(200);
    expect(response.value.value).toEqual('response');
  });

  it('accepts empty array as body', async () => {
    const endpoint = server.safe<any, any, any, any, any, any>(
      makeVoid(),
      makeVoid(),
      makeObject({ param: makeNumber() }) as Maker<any, any>,
      makeArray(makeString()),
      makeObject({
        status: makeEnum(200),
        value: makeObject({
          contentType: makeString(),
          value: makeString()
        }),
        headers: makeObject({})
      }),
      async () => {
        return oar.json(200, 'response');
      }
    );

    const response = await endpoint({
      method: 'get',
      servers: ['https://example.com'],
      path: 'some/path',
      op: 'someOp',
      headers: null as any,
      params: null as any,
      query: { param: 1 } as any,
      body: [] as any,
      requestContext: {}
    });
    expect(response.status).toEqual(200);
    expect(response.value.value).toEqual('response');
  });
});
