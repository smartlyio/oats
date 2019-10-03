import * as oar from '../src/runtime';
import * as jsc from 'jsverify';
import * as _ from 'lodash';
import * as assert from 'assert';
import { promisify } from 'util';

interface ShapeOfTestClass {
  a: readonly string[];
  b: string;
}
class TestClass extends oar.ValueClass<ShapeOfTestClass, 1> {
  static make(v: ShapeOfTestClass): oar.Make<TestClass> {
    return makeTestClass(v);
  }
  public b: string;
  public a: readonly string[];
  constructor(v: ShapeOfTestClass) {
    super();
    const value = oar
      .makeObject({
        a: oar.makeArray(oar.makeString()),
        b: oar.makeString()
      })(v)
      .success();
    Object.assign(this, value);
  }
}
const makeTestClass: oar.Maker<ShapeOfTestClass, TestClass> = oar.createMakerWith(TestClass);

describe('Make', () => {
  describe('success', () => {
    it('uses custom error handler', () => {
      const value = oar.Make.error([{ path: [], error: 'xxx' }]);
      expect(value.success(e => 'got error')).toEqual('got error');
    });
  });
});

describe('pmap', () => {
  jsc.property('leaves object unchanged when no matches', jsc.json, async dict => {
    const clone = _.cloneDeep(dict);
    const mapped = await oar.pmap(
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
    const mapped = await oar.pmap(dict, (n: any): n is any => true, async (n: any) => n);
    expect(mapped === dict).toBeTruthy();
    expect(mapped).toEqual(clone);
    return true;
  });

  jsc.property('maps objects', jsc.dict(jsc.string), async dict => {
    const mapped = await oar.pmap(
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
    const mapped = await oar.pmap(
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
      await oar.pmap(
        value,
        (n: any): n is string[] => _.isArray(n),
        async (n: string[]) => n.map(w => 1 as any)
      );
    } catch (e) {
      expect(e).toBeInstanceOf(oar.MakeError);
    }
  });

  jsc.property('maps arrays', jsc.array(jsc.asciistring), async arr => {
    const mapped = await oar.pmap(
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
        await oar
          .pmap(
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
      await oar
        .pmap(
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
    const fun = oar.makeOneOf(
      oar.makeObject({ a: oar.makeString() }),
      oar.makeObject({ a: oar.makeNumber() })
    );
    expect(fun({ a: 1 }).success()).toEqual({ a: 1 });
  });

  it('prefers matching ValueClass', () => {
    const fun = oar.makeOneOf(oar.makeAny(), TestClass.make);
    const test = TestClass.make({ a: ['a'], b: 'b' }).success();
    expect(fun(test).success()).toEqual(test);
  });

  it('fails if multiple values classes match', () => {
    const fun = oar.makeOneOf(oar.makeAny(), TestClass.make, TestClass.make);
    const test = TestClass.make({ a: ['a'], b: 'b' }).success();
    expect(fun(test).isSuccess()).toBeFalsy();
  });

  it('fails on multiple matches', () => {
    const fun = oar.makeOneOf(
      oar.makeObject({ a: oar.makeString() }),
      oar.makeObject({ a: oar.makeAny() })
    );
    expect(fun({ a: 'x' }).isSuccess()).toBeFalsy();
  });
});

describe('makeAllOf', () => {
  it('applies all makers to value in succession', () => {
    const fun = oar.makeAllOf(
      oar.makeObject({ a: oar.makeString() }, oar.makeAny()),
      oar.makeObject({}, oar.makeAllOf())
    );
    expect(fun({ a: 'xxx', b: 1 }).success()).toEqual({ a: 'xxx', b: 1 });
  });
});

describe('makeAny', () => {
  jsc.property('allows anything', jsc.json, async item => {
    const fun = oar.makeAny();
    expect(fun(item).success()).toEqual(item);
    if (item && typeof item === 'object') {
      expect(fun(item).success() !== item).toBeTruthy();
    }
    return true;
  });
});

describe('makeArray', () => {
  it('keeps the order', () => {
    const fun = oar.makeArray(oar.makeString());
    expect(fun(['a', 'b']).success()).toEqual(['a', 'b']);
  });
});

describe('makeObject', () => {
  it('drops unknown properties if told to', () => {
    const fun = oar.makeObject({ a: oar.makeNumber() });
    expect(fun({ a: 1, missing: 'a' }, { unknownField: 'drop' }).success()).toEqual({ a: 1 });
  });

  it('disallows extra fields', () => {
    const fun = oar.makeObject({ a: oar.makeNumber() });
    expect(fun({ a: 1, missing: 'a' }).isError()).toBeTruthy();
  });

  it('allows fields', () => {
    const fun = oar.makeObject({ a: oar.makeNumber() });
    expect(fun({ a: 1 }).isSuccess()).toBeTruthy();
  });

  it('allows additional props', () => {
    const fun = oar.makeObject({}, oar.makeString());
    expect(fun({ a: 'xxx' }).success()).toEqual({ a: 'xxx' });
  });

  it('prefers specified field to additional props', () => {
    const fun = oar.makeObject({ a: oar.makeNumber() }, oar.makeString());
    expect(fun({ a: 1 }).success()).toEqual({ a: 1 });
  });

  it('allows undefined props', () => {
    const fun = oar.makeObject({ a: oar.makeOptional(oar.makeNumber()) });
    expect(fun({ a: undefined }).success()).toEqual({});
  });
});

describe('ValueClass', () => {
  describe('toJSON', () => {
    it('returns a plain javascript object', () => {
      const value = TestClass.make({ b: 'a', a: ['a'] }).success();
      const json = oar.toJSON(value);
      expect(json instanceof TestClass).toBeFalsy();
      expect(json.a).toEqual(['a']);
      expect(json.b).toEqual('a');
    });
  });

  describe('set', () => {
    it('creates a new value', () => {
      const value = TestClass.make({ a: ['a'], b: 'original value' }).success();
      const newValue = oar.set(value, { b: 'new value' }).success();
      expect(newValue.b).toEqual('new value');
      expect(newValue.a).toEqual(['a']);
      expect(value.b).toEqual('original value');
    });
  });
});

describe('createMakerWith', () => {
  function maker() {
    return oar.createMakerWith<ShapeOfTestClass, TestClass>(TestClass);
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
