import * as server from '../src/server';
import * as oar from '../src/runtime';

describe('safe', () => {
  it('validates request and response', async () => {
    const endpoint = server.safe<any, any, any, any, any>(
      oar.makeVoid(),
      oar.makeVoid(),
      oar.makeObject({ param: oar.makeNumber() }) as oar.Maker<any, any>,
      oar.makeVoid(),
      oar.makeObject({
        status: oar.makeNumber(200),
        value: oar.makeObject({
          contentType: oar.makeString(),
          value: oar.makeString()
        })
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
      body: null as any
    });
    expect(response.status).toEqual(200);
    expect(response.value.value).toEqual('response');
  });
});
