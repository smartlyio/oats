import { toJSON, toShape } from '../src/value-class';
import { TestClass } from './test-class';

describe('ValueClass', () => {
  describe('toJSON', () => {
    it('returns a plain javascript object', () => {
      const value = TestClass.make({ b: 'a', a: ['a'] }).success();
      const json = toJSON(value);
      expect(json instanceof TestClass).toBeFalsy();
      expect(json.a).toEqual(['a']);
      expect(json.b).toEqual('a');
    });
  });
  describe('toShape', () => {
    it('returns a plain javascript object', () => {
      const value = TestClass.make({ b: 'a', a: ['a'] }).success();
      const json = toShape(value);
      expect(json instanceof TestClass).toBeFalsy();
      expect(json.a).toEqual(['a']);
      expect(json.b).toEqual('a');
    });
  });
});
