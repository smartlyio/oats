import * as server from './tmp/server/types.generated';

describe('unknown index signatures', () => {
  it('prevents using non existing query parameter', async () => {
    // @ts-expect-error extra prop
    const nok: server.ShapeOfDefaultAdditional = { foo: 'a', a: 'a' };
    // @ts-expect-error extra prop
    const nok2: server.ShapeOfExplicitAdditional = { foo: 'a', a: 'a' };
    const nok3: server.ShapeOfTypedAdditional = { foo: 'a', a: 'a' };
    nok && nok2 && nok3;
  });
});
