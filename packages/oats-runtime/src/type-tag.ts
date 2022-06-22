import { Type } from './reflection-type';
import { ValueClass } from './value-class';

export function withType<A>(to: A, type: Type[]): A {
  if (type.length === 0) {
    return to;
  }
  // todo: is it possible to confuse typing by re-use of valueclassed values
  //  eg. with value 'v: SomeValueClass' passing it to multiple makers
  // -> no? the re-use happens only if the valueclass instance matches so it
  // will not mutate the tagged reflection types
  const previous = getTypeSet(to);
  if (previous) {
    type.forEach(type => previous.add(type));
    return to;
  }
  const newType = new Set(type);
  // tag each constructed object with a hidden type property
  Object.defineProperty(to, reflection, {
    enumerable: false,
    value: newType
  });
  return to;
}

export function getTypeSet(value: Record<string, any>): Set<Type> | undefined {
  if (!value || typeof value !== 'object') {
    return;
  }

  // NOTE: prefer using the added reflection type instead of the contstructor type
  // the added reflection type will have types from eg allOf
  // @ts-ignore
  const t: Set<Type> = value[reflection];
  if (t && t.size > 0) {
    return t;
  }
  if (value instanceof ValueClass) {
    // a bit of leap here to trust that all ValueClasses have generated `reflection`
    // @ts-ignore
    const classType = new Set([value.constructor.reflection().definition]);
    // tag each constructed object with a hidden type property
    // this ensures that ValueClasses have a mutable reflection type property
    Object.defineProperty(value, reflection, {
      enumerable: false,
      value: classType
    });
    return classType;
  }
  return;
}

/**  Get reflection type from a  made value.
 * Note that only directly made object values or ValueClasses can be used
 * */
export function getType(value: Record<string, any>): Type[] | undefined {
  const t = getTypeSet(value);
  if (t) {
    return [...t];
  }
}

const reflection = Symbol('reflection');
