// yarn jest examples/type.spec.ts
import * as fc from 'fast-check';
import { generator } from '../src/index';
import * as runtime from '@smartlyio/oats-runtime';
import * as types from '../tmp/openapi.types.generated';

describe('value generation', () => {
  it ('generates valid values', () =>
    fc.assert(
      fc.property(
        // create a fast-check Arbitrary from the type structure
        generator.named(types.typeTestObject),
        (value: types.TestObject) => {
          // assert that all the generated values are valid
          const json = runtime.valueClass.toJSON(value);
          types.typeTestObject.maker(json).success();
        }
      )
  ))
});
