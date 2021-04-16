import { ValueClass } from '../src/value-class';
import { createMakerWith, Make, makeArray, makeObject, Maker, makeString } from '../src/make';
import { ShapeOf } from '../src/runtime';

export type ShapeOfTestClass = ShapeOf<TestClass>;

export class TestClass extends ValueClass {
  static make(v: ShapeOf<TestClass>): Make<TestClass> {
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
export const makeTestClass: Maker<ShapeOf<TestClass>, TestClass> = createMakerWith(TestClass);
