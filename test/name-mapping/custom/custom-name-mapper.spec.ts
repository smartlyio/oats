import * as types from './tmp/client/types.generated';

describe('mapping works', () => {
  const something: any = 1;
  it('everything gets mapped', async () => {
    const c: types.ValueItemWithSuffix = something;
    const b = types.ReflectionItemTypeWithSuffix;
    const a: types.ShapeOfItemTypeWithSuffix = something;
    const r = types.ReflectionNullableObjectWithSuffix;
    a || b || c || r;
  });

  it('provides makers', () => {
    types.makeValueItemTypeWithSuffix('custom').success();
    types.ValueItemWithSuffix.make({ id: 'a', flag: true, type: 'custom', name: 'ab' }).success();
    types.makeValueNullableObjectWithSuffix(null).success();
    types.makeValueNullableObjectWithSuffix({ foo: 1 }).success();
    types.ValueNonNullableNullableObjectWithSuffix.make({ foo: 1 }).success();
  });

  it('provides isA', () => {
    expect(types.ReflectionNullableObjectWithSuffix.isA).toBeDefined();
    expect(types.ReflectionItemTypeWithSuffix.isA!('custom')).toBeTruthy();
    expect(
      types.ReflectionItemWithSuffix.isA!(
        types.ValueItemWithSuffix.make({
          id: 'a',
          flag: true,
          type: 'custom',
          name: 'ab'
        }).success()
      )
    ).toBeTruthy();
  });
});
