import { Type } from './reflection-type';

export function intersectMap(a: Map<string, any>, b: Map<string, any>): Map<string, any> {
  const result = new Map();
  for (const [key, values] of a) {
    const gots = b.get(key);
    if (arrayEq(gots, values)) {
      result.set(key, values);
    }
  }
  return result;
}

function arrayEq(a: unknown[], b: unknown[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

export function getTags(type: Type): Map<string, unknown[]> {
  const root = rootType(type);
  if (root.type === 'object') {
    const values: [string, any][] = Object.entries(root.properties).flatMap(([key, prop]) => {
      if (prop.required) {
        const tags = typeTag(rootType(prop.value));
        if (tags.length) {
          return [[key, tags.sort()]];
        }
      }
      return [];
    });
    return new Map(values);
  }
  if (root.type === 'union') {
    const [fst, ...rest] = root.options.map(getTags);
    if (!fst) {
      return new Map();
    }
    return rest.reduce((memo, r) => intersectMap(memo, r), fst);
  }
  return new Map();
}

function rootType(type: Type): Type {
  if (type.type === 'named') {
    return rootType(type.reference.definition);
  }
  return type;
}

function typeTag(v: Type): unknown[] {
  if (v.type === 'named') {
    return typeTag(v.reference.definition);
  }
  if (v.type === 'string' || v.type === 'boolean' || v.type === 'number' || v.type === 'integer') {
    if (v.enum) {
      return v.enum;
    }
  }
  return [];
}

function discriminators(
  candidates: Map<string, Map<unknown, Type>>,
  type: { type: Type; tags: Map<string, any> }
): Map<string, Map<unknown, Type>> {
  const invalid = new Set<string>();
  for (const [key, tags] of candidates) {
    const tagValues = type.tags.get(key);
    if (tagValues && tagValues.length > 0) {
      for (const tagValue of tagValues) {
        if (!tags.has(tagValue)) {
          tags.set(tagValue, type.type);
        } else {
          invalid.add(key);
          break;
        }
      }
    } else {
      invalid.add(key);
    }
  }
  for (const key of invalid.keys()) {
    candidates.delete(key);
  }
  return candidates;
}

export interface TypeTags {
  /** type definition*/
  type: Type;
  /** possible type tags with values from the type */
  tags: Map<string, unknown[]>;
}
export interface Differentator {
  /** property key that is used for discriminating the types*/
  key: string;
  /** map from object[key] values to type definitions */
  map: Map<unknown, Type>;
}
export function differentator(types: TypeTags[]): Differentator | null {
  const fst = types[0];
  if (!fst) {
    return null;
  }
  const init = new Map([...fst.tags.keys()].map(key => [key, new Map()]));
  const discs = types.reduce((memo, type) => discriminators(memo, type), init);
  const [found] = discs.entries();
  if (!found || found[1].size === 0) {
    return null;
  }
  return { key: found[0], map: found[1] };
}

export interface UnionDiscriminator {
  /** map from type tag prop values to types */
  discriminator: Differentator | null;
  /** non discriminated types */
  undiscriminated: Type[];
}

export function discriminateUnion(types: Type[]): UnionDiscriminator {
  const tagged = types.map(type => ({ tags: getTags(type), type }));
  const withTag = tagged.filter(tags => tags.tags.size > 0);
  const undiscriminated = tagged.filter(tags => tags.tags.size === 0);
  const discriminator = differentator(withTag);
  return { discriminator, undiscriminated: undiscriminated.map(u => u.type) };
}
