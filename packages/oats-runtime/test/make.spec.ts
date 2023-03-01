import { describe } from '@jest/globals';
import * as make from '../src/make';
import { ShapeOfTestClass, ShapeOfTestClassB, TestClass, TestClassB } from './test-class';
import { validationErrorPrinter } from '../src/make';

describe('createMakerWith', () => {
  function maker() {
    return make.createMakerWith<ShapeOfTestClass, TestClass>(TestClass);
  }

  it('uses the class instance if given as parameter', () => {
    const value = TestClass.make({ a: ['a'], b: 'original value' }).success();
    const fun = maker();
    const result = fun(value).success();
    expect(result).toEqual(value);
  });

  it('constructs the given class instance', () => {
    const fun = maker();
    const result = fun({ a: ['a'], b: 'string' }).success();
    expect(result).toBeInstanceOf(TestClass);
    expect(result.a).toEqual(['a']);
  });

  it('when additional properties is false then remove undefined values', () => {
    // I don't know how to pass the additional properties option
    const fun = make.createMakerWith<ShapeOfTestClassB, TestClassB>(TestClassB);
    const result = fun({ a: ['a'], b: 'string', c: undefined }).success();
    expect(result).toBeInstanceOf(TestClassB);
    expect(result.a).toEqual(['a']);
    expect(result.b).toEqual(undefined);
  });
});

describe('Make', () => {
  describe('success', () => {
    it('uses custom error handler', () => {
      const value = make.Make.error([{ path: [], error: 'xxx' }]);
      expect(value.success(() => 'got error')).toEqual('got error');
    });
  });
});

describe('makeOneOf', () => {
  it('groups errors', () => {
    const fun = make.makeObject({
      root: make.makeOneOf(
        make.makeObject({ a: make.makeString() }),
        make.makeObject({ b: make.makeAny() })
      )
    });
    const result = fun({ root: { foo: 'x' } });
    expect(result.isError()).toBeTruthy();
    expect(result.errors.length).toEqual(1);
    const expected = `root: no option of oneOf matched
    - option 1
        a: expected a string, but got \`undefined\` instead.
    - option 2
        foo: unexpected property`;
    expect(validationErrorPrinter(result.errors[0])).toEqual(expected);
  });
});

describe('registerFormat', () => {
  it('throws for duplicate registers', () => {
    make.registerFormat('duplicate-register', () => make.Make.ok(undefined));
    expect(() => {
      make.registerFormat('duplicate-register', () => make.Make.ok(undefined));
    }).toThrow('format duplicate-register is already registered');
  });
});
