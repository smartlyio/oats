import * as common from '../tmp/client/common.types.generated';
import * as types from '../tmp/client/types.generated';

describe('codegen', () => {
  it('splits nullable types', () => {
    expect(common.typeNullable.maker(null).success()).toBeNull();
    expect(common.typeNullable.maker({ field: 'abc' }).success()).toBeInstanceOf(
      common.NonNullableNullable
    );
  });

  it('works correctly with boolean enums', () => {
    expect(common.typeGuard.maker(true).success()).toBe(true);
    expect(common.typeGuard.maker(false as any).success).toThrowError();
  });

  it('oneOf with discriminator with implicit mappings works properly', () => {
    expect(common.typeChoice.maker({ type: 'choice1', field: 'foo' }).success()).toEqual({
      type: 'choice1',
      field: 'foo'
    });
    expect(common.typeChoice.maker({ type: 'choice3', field3: 'foo' }).success()).toBeInstanceOf(
      common.ChoiceItem3
    );
    expect(common.typeChoice.maker({ type: 'choice2', field: 'foo' } as any).errors).toEqual([
      { error: 'unexpected property', path: ['field'] }
    ]);
    expect(
      types.typeChoiceWithExternalRef.maker({ type: 'choice3', field3: 'foo' }).success()
    ).toBeInstanceOf(common.ChoiceItem3);
  });

  it('oneOf with discriminator with explicit mappings works properly', () => {
    expect(
      types.typeChoiceWithExplicitMapping.maker({ type: 'choice4', field4: 'foo' }).success()
    ).toEqual({
      type: 'choice4',
      field4: 'foo'
    });
    expect(
      types.typeChoiceWithExplicitMapping.maker({ type: 'choice3', field3: 'foo' }).success()
    ).toBeInstanceOf(common.ChoiceItem3);
    expect(
      types.typeChoiceWithExplicitMapping.maker({ type: 'choice2', field: 'foo' } as any).errors
    ).toEqual([
      {
        error: 'unexpected value "choice2" in field "type" which is used as discriminator',
        path: []
      }
    ]);
  });
});
