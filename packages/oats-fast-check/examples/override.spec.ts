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
