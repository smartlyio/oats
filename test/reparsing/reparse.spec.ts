import * as server from './tmp/server/types.generated';

describe('reparsing', () => {
  it('avoids reparsing value classes', async () => {
    const got = server.typeValue.maker({ prop: 'x' }).success();
    expect(server.typeValue.maker(got).success()).toBe(got);
  });
});
