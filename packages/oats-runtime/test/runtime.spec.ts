import * as jsc from 'jsverify';
import * as _ from 'lodash';
import * as assert from 'assert';
import { promisify } from 'util';
import { make, pmap, set } from '../src/runtime';
import { TestClass } from './test-class';

describe('pmap', () => {
  jsc.property('leaves object unchanged when no matches', jsc.json, async dict => {
    const clone = _.cloneDeep(dict);
    const mapped = await pmap(
      dict,
      (_n: any): _n is string => false,
      async () => assert.fail('cant happen')
    );
    expect(mapped === dict).toBeTruthy();
    expect(mapped).toEqual(clone);
    return true;
  });

  jsc.property('leaves object unchanged when no changes', jsc.json, async dict => {
    const clone = _.cloneDeep(dict);
    const mapped = await pmap(
      dict,
      (_n: any): _n is any => true,
      async (n: any) => n
    );
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
        async (n: string[]) => n.map(() => 1 as any)
      );
    } catch (e) {
      expect(e).toBeInstanceOf(make.MakeError);
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
        ).catch(() => null);
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
      ).catch(() => null);
      expect(done).toEqual(promises);
      return true;
    });
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
