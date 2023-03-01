import { ValueClass } from '../src/value-class';
import { NamedTypeDefinition, ObjectType } from '../src/reflection-type';
import { createMakerWith, Make, fromReflection, Maker } from '../src/make';
import { ShapeOf } from '../src/runtime';

export type ShapeOfTestClass = ShapeOf<TestClass>;
export type ShapeOfTestClassB = ShapeOf<TestClassB>;

const type: ObjectType = {
  type: 'object',
  additionalProperties: false,
  properties: {
    a: { value: { type: 'array', items: { type: 'string' } }, required: true, networkName: 'netB' },
    b: { value: { type: 'string' }, required: true, networkName: 'netB' }
  }
};
export const named: NamedTypeDefinition<any> = {
  name: 'TestClass',
  maker: fromReflection(type),
  definition: type,
  isA: (a: any): a is TestClass => a instanceof TestClass
};
export class TestClass extends ValueClass {
  static make(v: ShapeOf<TestClass>): Make<TestClass> {
    return makeTestClass(v);
  }
  public b!: string;
  public a!: ReadonlyArray<string>;
  constructor(v: ShapeOfTestClass) {
    super();
    const value = named.maker(v).success();
    Object.assign(this, value);
  }
  static reflection() {
    return named;
  }
}

export class TestClassB extends ValueClass {
  static make(v: ShapeOf<TestClassB>): Make<TestClassB> {
    return makeTestClassB(v);
  }
  public b!: string;
  public a!: ReadonlyArray<string>;
  public c!: undefined;
  constructor(v: ShapeOfTestClassB) {
    super();
    const value = named.maker(v).success();
    Object.assign(this, value);
  }
  static reflection() {
    return named;
  }
}
export const makeTestClass: Maker<ShapeOf<TestClass>, TestClass> = createMakerWith(TestClass);
export const makeTestClassB: Maker<ShapeOf<TestClassB>, TestClassB> = createMakerWith(TestClassB);
