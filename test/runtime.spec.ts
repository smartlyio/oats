import * as jsc from 'jsverify';
import * as _ from 'lodash';
import * as assert from 'assert';
import { promisify } from 'util';
import {
  createMakerWith,
  Make,
  makeAllOf,
  makeAny,
  makeArray,
  MakeError,
  makeNumber,
  makeObject,
  makeOneOf,
  makeOptional,
  Maker,
  makeString
} from '../src/make';
import { toJSON, ValueClass } from '../src/value-class';
import { pmap, set } from '../src/runtime';

interface ShapeOfTestClass {
  a: ReadonlyArray<string>;
  b: string;
}
class TestClass extends ValueClass<TestClass, ShapeOfTestClass, 1> {
  static make(v: ShapeOfTestClass): Make<TestClass> {
    return makeTestClass(v);
  }
  public b: string;
  public a: ReadonlyArray<string>;
  constructor(v: ShapeOfTestClass) {
    super();
    const value = makeObject({
        a: makeArray(makeString()),
        b: makeString()
      })(v)
      .success();
    Object.assign(this, value);
  }
}
const makeTestClass: Maker<ShapeOfTestClass, TestClass> = createMakerWith(TestClass);

describe('Make', () => {
  describe('success', () => {
    it('uses custom error handler', () => {
      const value = Make.error([{ path: [], error: 'xxx' }]);
      expect(value.success(e => 'got error')).toEqual('got error');
    });
  });
});

describe('pmap', () => {
  jsc.property('leaves object unchanged when no matches', jsc.json, async dict => {
    const clone = _.cloneDeep(dict);
    const mapped = await pmap(
      dict,
      (n: any): n is string => false,
      async (n: string) => assert.fail('cant happen')
    );
    expect(mapped === dict).toBeTruthy();
    expect(mapped).toEqual(clone);
    return true;
  });

  jsc.property('leaves object unchanged when no changes', jsc.json, async dict => {
    const clone = _.cloneDeep(dict);
    const mapped = await pmap(dict, (n: any): n is any => true, async (n: any) => n);
    expect(mapped === dict).toBeTruthy();
    expect(mapped).toEqual(clone);
    return true;
  });

  jsc.property('maps objects', jsc.dict(jsc.string), async dict => {
    const mapped = await pmap(
      dict,
      (n: any): n is string => _.isString(n),
      async (n: string) => n.toUpperCase()
    );
    expect(mapped).toEqual(
      Object.keys(dict).reduce((memo: any, n) => {
        memo[n] = dict[n].toUpperCase();
        return memo;
      }, {})
    );
    return true;
  });

  it('sets ValueClasses', async () => {
    const value = TestClass.make({ a: ['a value'], b: 'b value' }).success();
    const mapped = await pmap(
      value,
      (n: any): n is string[] => _.isArray(n),
      async (n: string[]) => n.map(w => w.toUpperCase())
    );
    expect(mapped).toBeInstanceOf(TestClass);
    expect(mapped.a).toEqual(['A VALUE']);
    expect(mapped.b).toEqual('b value');
    expect(value !== mapped).toBeTruthy();
  });

  it('throws when setting ValueClass with incorrect value', async () => {
    const value = TestClass.make({ a: ['a value'], b: 'b value' }).success();
    try {
      await pmap(
        value,
        (n: any): n is string[] => _.isArray(n),
        async (n: string[]) => n.map(w => 1 as any)
      );
    } catch (e) {
      expect(e).toBeInstanceOf(MakeError);
    }
  });

  jsc.property('maps arrays', jsc.array(jsc.asciistring), async arr => {
    const mapped = await pmap(
      arr,
      (n: any): n is string => _.isString(n),
      async (n: string) => n.toUpperCase()
    );
    expect(mapped).toEqual(arr.map(n => n.toUpperCase()));
    return true;
  });

  describe('leaks', () => {
    function fail() {
      process.exit(1);
    }

    const predicateResults: { [key: string]: boolean } = {};
    function matchesPredicate(value: any) {
      const key = JSON.stringify(value);
      if (!predicateResults[key]) {
        predicateResults[key] = Math.random() > 0.7;
      }
      return predicateResults[key];
    }
    const promiseResults: { [key: string]: { value: Error | any; delay: number } } = {};
    async function promiseResult(value: any) {
      const key = JSON.stringify(value);
      if (!promiseResults[key]) {
        promiseResults[key] = {
          value: Math.random() > 0.5 ? new Error('key: "' + key + '"') : value,
          delay: Math.random() * 10
        };
      }
      await promisify(setTimeout)(promiseResults[key].delay);
      if (promiseResults[key].value instanceof Error) {
        throw promiseResults[key].value;
      }
      return promiseResults[key].value;
    }

    process.on('unhandledRejection', fail);
    jsc.property(
      'does not trigger unhandledRejection for leaked promises',
      jsc.json,
      async json => {
        await pmap(
            json,
            (n: any): n is any => matchesPredicate(n),
            async (n: any) => {
              return await promiseResult(n);
            }
          )
          .catch(() => null);
        return true;
      }
    );

    jsc.property('waits for all promises when all succeed', jsc.json, async json => {
      let promises = 0;
      let done = 0;
      await pmap(
          json,
          (n: any): n is any => matchesPredicate(n),
          async (n: any) => {
            promises++;
            await promiseResult(n).catch(() => null);
            done++;
            return n;
          }
        )
        .catch(() => null);
      expect(done).toEqual(promises);
      return true;
    });
  });
});

describe('makeOneOf', () => {
  it('succeeds if only one match', () => {
    const fun = makeOneOf(
      makeObject({ a: makeString() }),
      makeObject({ a: makeNumber() })
    );
    expect(fun({ a: 1 }).success()).toEqual({ a: 1 });
  });

  it('prefers matching ValueClass', () => {
    const fun = makeOneOf(makeAny(), TestClass.make);
    const test = TestClass.make({ a: ['a'], b: 'b' }).success();
    expect(fun(test).success()).toEqual(test);
  });

  it('fails if multiple values classes match', () => {
    const fun = makeOneOf(makeAny(), TestClass.make, TestClass.make);
    const test = TestClass.make({ a: ['a'], b: 'b' }).success();
    expect(fun(test).isSuccess()).toBeFalsy();
  });

  it('fails on multiple matches', () => {
    const fun = makeOneOf(
      makeObject({ a: makeString() }),
      makeObject({ a: makeAny() })
    );
    expect(fun({ a: 'x' }).isSuccess()).toBeFalsy();
  });
});

describe('makeAllOf', () => {
  it('applies all makers to value in succession', () => {
    const fun = makeAllOf(
      makeObject({ a: makeString() }, makeAny()),
      makeObject({}, makeAllOf())
    );
    expect(fun({ a: 'xxx', b: 1 }).success()).toEqual({ a: 'xxx', b: 1 });
  });
});

describe('makeAny', () => {
  jsc.property('allows anything', jsc.json, async item => {
    const fun = makeAny();
    expect(fun(item).success()).toEqual(item);
    if (item && typeof item === 'object') {
      expect(fun(item).success() !== item).toBeTruthy();
    }
    return true;
  });
});

describe('makeArray', () => {
  it('keeps the order', () => {
    const fun = makeArray(makeString());
    expect(fun(['a', 'b']).success()).toEqual(['a', 'b']);
  });
});

describe('makeObject', () => {
  it('drops unknown properties if told to', () => {
    const fun = makeObject({ a: makeNumber() });
    expect(fun({ a: 1, missing: 'a' }, { unknownField: 'drop' }).success()).toEqual({ a: 1 });
  });

  it('disallows extra fields', () => {
    const fun = makeObject({ a: makeNumber() });
    expect(fun({ a: 1, missing: 'a' }).isError()).toBeTruthy();
  });

  it('allows fields', () => {
    const fun = makeObject({ a: makeNumber() });
    expect(fun({ a: 1 }).isSuccess()).toBeTruthy();
  });

  it('allows additional props', () => {
    const fun = makeObject({}, makeString());
    expect(fun({ a: 'xxx' }).success()).toEqual({ a: 'xxx' });
  });

  it('prefers specified field to additional props', () => {
    const fun = makeObject({ a: makeNumber() }, makeString());
    expect(fun({ a: 1 }).success()).toEqual({ a: 1 });
  });

  it('allows undefined props', () => {
    const fun = makeObject({ a: makeOptional(makeNumber()) });
    expect(fun({ a: undefined }).success()).toEqual({});
  });
});

describe('ValueClass', () => {
  describe('toJSON', () => {
    it('returns a plain javascript object', () => {
      const value = TestClass.make({ b: 'a', a: ['a'] }).success();
      const json = toJSON<TestClass, ShapeOfTestClass>(value);
      expect(json instanceof TestClass).toBeFalsy();
      expect(json.a).toEqual(['a']);
      expect(json.b).toEqual('a');
    });
  });

  describe('set', () => {
    it('creates a new value', () => {
      const value = TestClass.make({ a: ['a'], b: 'original value' }).success();
      const newValue = set(value, { b: 'new value' }).success();
      expect(newValue.b).toEqual('new value');
      expect(newValue.a).toEqual(['a']);
      expect(value.b).toEqual('original value');
    });
  });
});

describe('createMakerWith', () => {
  function maker() {
    return createMakerWith<ShapeOfTestClass, TestClass>(TestClass);
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
