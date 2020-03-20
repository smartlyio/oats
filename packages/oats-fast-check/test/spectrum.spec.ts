// yarn jest examples/type.spec.ts
import * as fc from 'fast-check';
import { generator } from '../src/index';
import * as types from '../tmp/openapi.types.generated';
import * as runtime from '@smartlyio/oats-runtime';
import * as assert from 'assert';
import * as _ from 'lodash';

describe('spectrum of generated values', () => {
  it('generates all kinds of values', () => {
    const keys = new Set();
    const values = fc.sample(generator.named(types.typeTestObject), 100);
    values.forEach(value => Object.keys(value).forEach(key => keys.add(key)));
    expect(keys.size).toBeGreaterThan(50);
  });

  it('shrinks failures without crashing or timeouting', async () => {
    let count = 0;
    const rounds = 100;
    let shrinks = 0;
    while (count++ < rounds) {
      const result = await fc.check(
        fc.asyncProperty(generator.named(types.typeTestObject), async (value: types.TestObject) => {
          const mappedValue = runtime.reflection.Traversal.compile(
            types.typeTestObject,
            types.typeTestTarget
          ).map(value, str => types.typeTestTarget.maker(str + 'a').success());
          const pmappedValue = await runtime.reflection.Traversal.compile(
            types.typeTestObject,
            types.typeTestTarget
          ).pmap(value, async str => types.typeTestTarget.maker(str + 'b').success());
          assert(_.isEqual(mappedValue, pmappedValue), 'incorrectly expected values to match');
        })
      );
      shrinks += result.numShrinks;
      expect(result.error).toMatch(
        'AssertionError [ERR_ASSERTION]: incorrectly expected values to match'
      );
    }
    expect(shrinks).toBeGreaterThan(rounds * 5);
  });
});
