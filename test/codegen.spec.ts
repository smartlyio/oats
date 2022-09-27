import * as common from '../tmp/client/common.types.generated';

describe('codegen', () => {
  it('splits nullable types', () => {
    expect(common.typeNullable.maker(null).success()).toBeNull();
    expect(common.typeNullable.maker({ field: 'abc' }).success()).toBeInstanceOf(
      common.NonNullableNullable
    );
  });

  it('works correctly with boolean enums', () => {
    expect(common.typeGuard.maker(true).success()).toBe(true);
    expect(common.typeGuard.maker(false as any).success).toThrow();
  });
});
