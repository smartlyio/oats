import * as types from '../tmp/client/common.types.generated';
describe('codegen', () => {
  it('splits nullable types', () => {
    expect(types.typeNullable.maker(null).success()).toBeNull();
    expect(types.typeNullable.maker({ field: 'abc' }).success()).toBeInstanceOf(
      types.NonNullableNullable
    );
  });
});
