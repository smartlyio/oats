import { ValueClass } from '../src/value-class';
import { createMakerWith, Make, makeArray, makeObject, Maker, makeString } from '../src/make';

export interface ShapeOfTestClass {
  a: ReadonlyArray<string>;
  b: string;
}
export class TestClass extends ValueClass<ShapeOfTestClass, 1> {
  static make(v: ShapeOfTestClass): Make<TestClass> {
    return makeTestClass(v);
  }
  public b!: string;
  public a!: ReadonlyArray<string>;
  constructor(v: ShapeOfTestClass) {
    super();
    const value = makeObject({
      a: makeArray(makeString()),
      b: makeString()
    })(v).success();
    Object.assign(this, value);
  }
}
export const makeTestClass: Maker<ShapeOfTestClass, TestClass> = createMakerWith(TestClass);
