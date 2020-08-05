import * as make from '../src/make';
import * as jsc from 'jsverify';
import { ShapeOfTestClass, TestClass } from './test-class';
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
  it('succeeds if only one match', () => {
    const fun = make.makeOneOf(
      make.makeObject({ a: make.makeString() }),
      make.makeObject({ a: make.makeNumber() })
    );
    expect(fun({ a: 1 }).success()).toEqual({ a: 1 });
  });

  it('prefers matching ValueClass', () => {
    const fun = make.makeOneOf(make.makeAny(), TestClass.make);
    const test = TestClass.make({ a: ['a'], b: 'b' }).success();
    expect(fun(test).success()).toEqual(test);
  });

  it('fails if multiple values classes match', () => {
    const fun = make.makeOneOf(make.makeAny(), TestClass.make, TestClass.make);
    const test = TestClass.make({ a: ['a'], b: 'b' }).success();
    expect(fun(test).isSuccess()).toBeFalsy();
  });

  it('fails on multiple matches', () => {
    const fun = make.makeOneOf(
      make.makeObject({ a: make.makeString() }),
      make.makeObject({ a: make.makeAny() })
    );
    expect(fun({ a: 'x' }).isSuccess()).toBeFalsy();
  });

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
        a: expected a string, but got "undefined" instead.
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

describe('makeString', () => {
  it('rejects if the pattern does not match', () => {
    const fun = make.makeString(undefined, 'a+');
    expect(fun('b').errors[0].error).toEqual('b does not match pattern /a+/');
  });

  it('accepts if the pattern matches', () => {
    const fun = make.makeString(undefined, 'a+');
    fun('aaa').success();
  });

  it('throws on invalid regex', () => {
    expect(() => make.makeString(undefined, '\\')).toThrow(
      "pattern for 'type: string' is not valid: Invalid regular expression"
    );
  });

  it('accepts if format is not defined', () => {
    const fun = make.makeString('some-format');
    fun('b').success();
  });

  it('rejects if format rejects', () => {
    make.registerFormat('some-rejecting-format', () =>
      make.Make.error([{ path: [], error: 'some error' }])
    );
    const fun = make.makeString('some-rejecting-format');
    expect(fun('b').errors[0].error).toEqual('some error');
  });

  it('accepts if format accepts', () => {
    make.registerFormat('some-accepting-format', () => make.Make.ok(undefined));
    const fun = make.makeString('some-accepting-format');
    expect(fun('b').success()).toEqual('b');
  });
});

describe('makeAllOf', () => {
  it('applies all makers to value in succession', () => {
    const fun = make.makeAllOf(
      make.makeObject({ a: make.makeString() }, make.makeAny()),
      make.makeObject({}, make.makeAllOf())
    );
    expect(fun({ a: 'xxx', b: 1 }).success()).toEqual({ a: 'xxx', b: 1 });
  });
});

describe('makeAny', () => {
  jsc.property('allows anything', jsc.json, async item => {
    const fun = make.makeAny();
    expect(fun(item).success()).toEqual(item);
    if (item && typeof item === 'object') {
      expect(fun(item).success() !== item).toBeTruthy();
    }
    return true;
  });
});

describe('makeArray', () => {
  it('keeps the order', () => {
    const fun = make.makeArray(make.makeString());
    expect(fun(['a', 'b']).success()).toEqual(['a', 'b']);
  });
});

describe('makeObject', () => {
  describe('magic fields', () => {
    it('disallows __proto__', () => {
      const obj = Object.create(null);
      obj.__proto__ = make.makeNumber();
      const fun = make.makeObject(obj);
      const value = JSON.parse(`{"__proto__": 1}`);
      expect(fun(value).errors[0].error).toEqual(
        'Using __proto__ as field of an object is not allowed'
      );
    });

    it('disallows constructor', () => {
      const obj = Object.create(null);
      obj.constructor = make.makeNumber();
      const fun = make.makeObject(obj);
      const value = JSON.parse(`{"constructor": 1}`);
      expect(fun(value).errors[0].error).toEqual(
        'Using constructor as field of an object is not allowed'
      );
    });

    it('disallows __proto__ in additionalFields', () => {
      const fun = make.makeObject({}, make.makeNumber());
      const value = JSON.parse(`{"__proto__": 1}`);
      expect(fun(value).errors[0].error).toEqual(
        'Using __proto__ as objects additional field is not allowed.'
      );
    });

    it('disallows constructor in additionalFields', () => {
      const fun = make.makeObject({}, make.makeNumber());
      const value = JSON.parse(`{"constructor": 1}`);
      expect(fun(value).errors[0].error).toEqual(
        'Using constructor as objects additional field is not allowed.'
      );
    });
  });

  it('drops unknown properties if told to', () => {
    const fun = make.makeObject({ a: make.makeNumber() });
    expect(fun({ a: 1, missing: 'a' }, { unknownField: 'drop' }).success()).toEqual({ a: 1 });
  });

  it('disallows extra fields', () => {
    const fun = make.makeObject({ a: make.makeNumber() });
    expect(fun({ a: 1, missing: 'a' }).isError()).toBeTruthy();
  });

  it('allows fields', () => {
    const fun = make.makeObject({ a: make.makeNumber() });
    expect(fun({ a: 1 }).isSuccess()).toBeTruthy();
  });

  it('allows additional props', () => {
    const fun = make.makeObject({}, make.makeString());
    expect(fun({ a: 'xxx' }).success()).toEqual({ a: 'xxx' });
  });

  it('prefers specified field to additional props', () => {
    const fun = make.makeObject({ a: make.makeNumber() }, make.makeString());
    expect(fun({ a: 1 }).success()).toEqual({ a: 1 });
  });

  it('allows undefined props', () => {
    const fun = make.makeObject({ a: make.makeOptional(make.makeNumber()) });
    expect(fun({ a: undefined }).success()).toEqual({});
  });
});
