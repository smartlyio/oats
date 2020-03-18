// yarn jest examples/type.spec.ts
import * as fc from 'fast-check';
import { generator } from '../src/index';
import * as types from '../tmp/openapi.types.generated';

describe('spectrum of generated values', () => {
  it('generates all kinds of values', () => {
    const keys = new Set();
    const values = fc.sample(generator.named(types.typeTestObject), 100);
    values.forEach(value => Object.keys(value).forEach(key => keys.add(key)));
    expect(keys.size).toBeGreaterThan(50);
  });
});
