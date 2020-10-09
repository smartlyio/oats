import * as types from '../tmp/client/common.types.generated';
describe('codegen', () => {
  it('splits nullable types', () => {
    expect(types.typeNullable.maker(null).success()).toBeNull();
    expect(types.typeNullable.maker({ field: 'abc' }).success()).toBeInstanceOf(
      types.NonNullableNullable
    );
  });

  it('works correctly with boolean enums', () => {
    expect(types.typeGuard.maker(true).success()).toBe(true);
    expect(types.typeGuard.maker(false as any).success).toThrowError();
  })
});
