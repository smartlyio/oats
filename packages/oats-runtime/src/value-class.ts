import { NamedTypeDefinition } from './reflection-type';
import { ShapeOf } from './runtime';

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

export class ValueClass {
  public static reflection: NamedTypeDefinition<ValueClass>;
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

export function toJSON<Cls>(value: Cls): Cls extends ValueClass ? Writable<ShapeOf<Cls>> : never {
  return toShape(value) as any;
}

export function toShape<Cls>(value: Cls): Cls extends ValueClass ? ShapeOf<Cls> : never {
  // we cant use _.cloneDeep as that copies the instance allowing a surprising way to
  // create proof carrying objects that do not respect the class constraints
  return asPlainObject(value as any); // how to say that 'this' is the extending class
}
