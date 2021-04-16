import * as runtime from '../src/runtime';

const tag = Symbol();
type Value = runtime.BrandedScalar<string, typeof tag>;
const tag2 = Symbol();
type Value2 = runtime.BrandedScalar<string, typeof tag2>;

const tagNum = Symbol();
type ValueNum = runtime.BrandedScalar<number, typeof tagNum>;
const tagBool = Symbol();
type ValueBool = runtime.BrandedScalar<boolean, typeof tagBool>;
const tagNull = Symbol();
type ValueNull = runtime.BrandedScalar<null, typeof tagNull>;
const tagUndefined = Symbol();
type ValueUndefined = runtime.BrandedScalar<undefined, typeof tagUndefined>;

const tagNullOrString = Symbol();
type ValueNullOrString = runtime.BrandedScalar<null | string, typeof tagNullOrString>;

function assignableTo<T>(_t: T) {
  return;
}

class BrandedClass extends runtime.valueClass.ValueClass {
  private readonly brand = null;
  a = 'a';
}

class BrandedClass2 extends runtime.valueClass.ValueClass {
  private readonly brand = null;
  a = 'a';
}

type CustomShaped = runtime.Shaped<{ f: number }, string>;
type CustomIndexType = runtime.Shaped<{ [k: string]: number }, string>;

describe('ShapeOf', () => {
  it('works with branded types', () => {
    assignableTo<runtime.ShapeOf<Value>>('a');
    // @ts-expect-error
    assignableTo<runtime.ShapeOf<Value>>(1);

    assignableTo<runtime.ShapeOf<ValueNum>>(1);
    // @ts-expect-error
    assignableTo<runtime.ShapeOf<ValueNum>>('a');

    assignableTo<runtime.ShapeOf<ValueBool>>(true);
    // @ts-expect-error
    assignableTo<runtime.ShapeOf<ValueBool>>(1);

    assignableTo<runtime.ShapeOf<ValueNull>>(null);
    // @ts-expect-error
    assignableTo<runtime.ShapeOf<ValueNull>>(1);

    assignableTo<runtime.ShapeOf<ValueUndefined>>(undefined);
    // @ts-expect-error
    assignableTo<runtime.ShapeOf<ValueUndefined>>(null);

    assignableTo<runtime.ShapeOf<ValueNullOrString>>(null);
    assignableTo<runtime.ShapeOf<ValueNullOrString>>('aa');
    // @ts-expect-error prevent assign to wrong value
    assignableTo<runtime.ShapeOf<ValueNullOrString>>(1);
  });

  it('Shapes Arrays', () => {
    assignableTo<runtime.ShapeOf<Value[]>>(['a']);
    // @ts-expect-error
    assignableTo<runtime.ShapeOf<Value[]>>([1]);
    // @ts-expect-error
    assignableTo<runtime.ShapeOf<Value[]>>({});
  });

  it('Shapes ReadonlyArrays', () => {
    assignableTo<runtime.ShapeOf<readonly string[]>>(['a']);
    // @ts-expect-error
    assignableTo<runtime.ShapeOf<readonly string[]>>([1]);
    // @ts-expect-error
    assignableTo<runtime.ShapeOf<readonly string[]>>({});

    assignableTo<readonly string[]>([] as runtime.ShapeOf<readonly string[]>);
    assignableTo<readonly string[]>([] as runtime.ShapeOf<string[]>);
    // @ts-expect-error
    assignableTo<string[]>([] as runtime.ShapeOf<readonly string[]>);
    assignableTo<string[]>([] as runtime.ShapeOf<string[]>);
  });

  it('Shapes Objects', () => {
    assignableTo<runtime.ShapeOf<{ a: Value }>>({ a: 'a' });
    // @ts-expect-error
    assignableTo<runtime.ShapeOf<{ a: Value }>>({ a: 1 }); // prevent nested type mismatch
    // @ts-expect-error
    assignableTo<runtime.ShapeOf<{ a: Value }>>({ b: 'a' }); // prevent unknown fields

    assignableTo<runtime.ShapeOf<BrandedClass>>({ a: 'a' });
    // @ts-expect-error
    assignableTo<runtime.ShapeOf<BrandedClass>>({ b: 'a' });

    assignableTo<runtime.ShapeOf<BrandedClass>>({ a: 'a' } as BrandedClass2);
    assignableTo<runtime.ShapeOf<BrandedClass2>>({ a: 'a' } as BrandedClass);
  });

  it('keeps type literal', () => {
    assignableTo<runtime.ShapeOf<'abc'>>('abc');
    // @ts-expect-error
    assignableTo<runtime.ShapeOf<'abc'>>('zzz');
  });

  it('follows unions', () => {
    assignableTo<runtime.ShapeOf<string | number>>(1);
    assignableTo<runtime.ShapeOf<string | number>>('a');
    // @ts-expect-error
    assignableTo<runtime.ShapeOf<string | number>>(true);
  });

  describe('Shaped', () => {
    it('can retrieve the shape', () => {
      assignableTo<runtime.ShapeOf<CustomShaped>>('abc');

      assignableTo<runtime.ShapeOf<CustomIndexType>>('abc');
      // @ts-expect-error shape of index type does not allow invalid field types
      assignableTo<runtime.ShapeOf<CustomIndexType>>({ p: 1 });
    });

    it('does not get confused by index types', () => {
      assignableTo<runtime.ShapeOf<{ [k: string]: number }>>({ k: 1 });
      // @ts-expect-error index type does not accidentally extend shape tag
      assignableTo<runtime.ShapeOf<{ [k: string]: number }>>(1);
    });

    it('does not leak the shape tags to destructuring', () => {
      const a: CustomShaped = { f: 1 } as any;
      const { ...r } = a;
      assignableTo<runtime.ShapeOf<typeof r>>({ f: 1 });
      // @ts-expect-error shape gets leaked :shrug:
      assignableTo<runtime.ShapeOf<typeof r>>('abc');
    });
  });
});

describe('Branding', () => {
  it('separates classes', () => {
    const a: BrandedClass = {} as any;
    // @ts-expect-error cross assign is prevented
    assignableTo<BrandedClass2>(a);
    assignableTo<BrandedClass>(a); // allaws assign with correct branding

    const { ...r } = a;
    // @ts-expect-error destructuring loses branding
    assignableTo<BrandedClass>(r);
  });
  it('separates types', () => {
    // @ts-expect-error prevent unbranded assign
    assignableTo<Value>('a');
    assignableTo<Value>('a' as Value); // allow assign with branded value
    // @ts-expect-error prevent cross assign
    assignableTo<Value>('a' as Value2);
    assignableTo<Value2>('a' as Value2);

    // @ts-expect-error prevent assign with wrong scalar type
    assignableTo<Value>(1);
    // @ts-expect-error prevent 'as' with incompatible type
    assignableTo<Value>(1 as Value);

    // @ts-expect-error cannot destructure branded scalars
    const { ...r } = 'a' as Value;
    r === r;
  });
});
