import { toJSON } from '../src/value-class';
import { TestClass, ShapeOfTestClass } from './test-class';

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
});
