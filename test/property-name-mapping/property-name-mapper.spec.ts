import * as types from './tmp/client/types.generated';
import { serialize } from '../../packages/oats-runtime/src/serialize';

describe('network ts mappig', () => {
  describe('mapping works', () => {
    it('maps inputs', async () => {
      const p = types.typeItem
        .maker({ some_property: 'x' } as any, { convertFromNetwork: true })
        .success();
      expect(p.someProperty).toEqual('x');
    });

    it('does not map input unnecessarily', async () => {
      const p = types.typeItem.maker({ someProperty: 'x' }).success();
      expect(p.someProperty).toEqual('x');
    });

    it('serializes object values', async () => {
      const value = types.typeItem.maker({ someProperty: 'x' }).success();
      const serialized = serialize(value);
      expect(serialized.some_property).toEqual('x');
    });
  });
});
