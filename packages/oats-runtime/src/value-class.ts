import { NamedTypeDefinition } from './reflection-type';

export type Branded<A, BrandTag> = A & Brand<BrandTag>;

export class Brand<B> {
  protected readonly valueClassBrand!: B; // branding, DO NOT ACCESS
}

function asPlainObject(value: any): any {
  if (Array.isArray(value)) {
    return value.map(asPlainObject) as any;
  }
  if (value && typeof value === 'object') {
    return Object.keys(value).reduce((memo, key) => {
      (memo as any)[key] = asPlainObject(value[key]);
      return memo as any;
    }, {});
  }
  return value;
}

export class ValueClass<Shape, BrandTag> extends Brand<BrandTag> {
  public static reflection: NamedTypeDefinition<ValueClass<any, any>>;
  protected readonly valueClassShape!: Shape; // stops TypeScript from ignoring the "Shape" type, DO NOT ACCESS
}

type WritableArray<T> = Array<Writable<T>>;
type Fun = (...a: any[]) => any;

type WritableObject<T> = { -readonly [P in keyof T]: Writable<T[P]> };
export type Writable<T> = T extends ReadonlyArray<infer R>
  ? WritableArray<R>
  : T extends Fun
  ? T
  : T extends object
  ? WritableObject<T>
  : T;

export function toJSON<Cls>(
  value: Cls
): Cls extends ValueClass<infer Shape, any> ? Writable<Shape> : never {
  // we cant use _.cloneDeep as that copies the instance allowing a surprising way to
  // create proof carrying objects that do not respect the class constraints
  return asPlainObject(value as any); // how to say that 'this' is the extending class
}
