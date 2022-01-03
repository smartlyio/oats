import * as server from './tmp/server/types.generated';

describe('undefined does not get emitted', () => {
  it('prevents using non existing query parameter', async () => {
    // @ts-expect-error undefined cannot be used with shape
    const nok: server.ShapeOfQuery = { foo: undefined };
    const ok: server.ShapeOfQuery = { foo: 'abc' };
    expect(nok && ok).toBeTruthy();
    // @ts-expect-error undefined cannot be used for making
    server.typeQuery.maker({ foo: undefined });
    server.typeQuery.maker({ foo: 'abc' }).success();
  });
});
