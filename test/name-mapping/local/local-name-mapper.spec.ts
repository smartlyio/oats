import * as types from './tmp/client/types.generated';

describe('mapping works', () => {
  const something: any = 1;
  it('everything gets mapped', async () => {
    const c: types.Item = something;
    const b = types.typeItem;
    const a: types.ShapeOfItemType = something;
    const r = types.typeNullableObject;
    a || b || c || r;
  });

  it('provides makers', () => {
    types.makeItemType('custom').success();
    types.Item.make({ id: 'a', flag: true, type: 'custom', name: 'ab' }).success();
    types.makeNullableObject(null).success();
    types.makeNullableObject({ foo: 1 }).success();
    types.NonNullableNullableObject.make({ foo: 1 }).success();
  });

  it('provides isA', () => {
    expect(types.typeNullableObject.isA).toBeDefined();
    expect(types.typeItemType.isA!('custom')).toBeTruthy();
    expect(
      types.typeItem.isA!(
        types.Item.make({
          id: 'a',
          flag: true,
          type: 'custom',
          name: 'ab'
        }).success()
      )
    ).toBeTruthy();
  });
});
