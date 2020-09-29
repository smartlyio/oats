# Fast-check generators for smartlyio/oats

[Fast-check](https://www.npmjs.com/package/fast-check)  generators for [@smartlyio/oats](https://www.npmjs.com/package/@smartlyio/oats) types.


## generator.named

Generate values of named types from the openapi specification. Here using a jest wrapper.

```ts
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

```

## generator.override

Override automatic generators globally with a custom Arbitrary

```
// yarn jest examples/override.spec.ts
import * as fc from 'fast-check';
import { generator } from '../src/index';
import * as types from '../tmp/openapi.types.generated';

describe('overriding generators', () => {
  it ('.override provides custom generator for type', () => {
    generator.override(types.typeTestTarget, fc.constant('overridden value'));
    fc.assert(
      fc.property(
        generator.named(types.typeTestTarget),
        (value: types.TestTarget) => {
          expect(value).toEqual('overridden value');
        }
      )
    );
  })

  it ('.clear removes override', () => {
    generator.override(types.typeTestTarget, fc.constant('overridden value'));
    generator.clear(types.typeTestTarget);
    fc.assert(
      fc.property(
        generator.named(types.typeTestTarget),
        (value: types.TestTarget) => {
          expect(value).not.toEqual('overridden value');
        }
      )
    );
  })
});

```

