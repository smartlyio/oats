import { Maker } from './make';
import * as assert from 'assert';
import safe from '@smartlyio/safe-navigation';
import * as runtime from './runtime';

export type Type =
  | UnknownType
  | VoidType
  | BooleanType
  | IntegerType
  | NumberType
  | NullType
  | UnionType
  | IntersectionType
  | StringType
  | ArrayType
  | ObjectType
  | NamedType;

export interface NamedTypeDefinition<A> {
  readonly name: string;
  readonly definition: Type;
  readonly maker: Maker<any, A>;
  readonly isA: null | ((value: any) => value is A);
}

export interface UnknownType {
  readonly type: 'unknown';
}

export interface VoidType {
  readonly type: 'void';
}

export interface NullType {
  readonly type: 'null';
}

export interface UnionType {
  readonly type: 'union';
  readonly options: Type[];
}

export interface IntersectionType {
  readonly type: 'intersection';
  readonly options: Type[];
}

export interface StringType {
  readonly type: 'string';
  readonly format?: string;
  readonly pattern?: string;
  readonly enum?: string[];
}

export interface BooleanType {
  readonly type: 'boolean';
  readonly enum?: boolean[];
}

export interface NumberType {
  readonly type: 'number';
  readonly enum: number[];
}

export interface IntegerType {
  readonly type: 'integer';
  readonly enum: number[];
}

export interface ArrayType {
  readonly type: 'array';
  readonly items: Type;
}

export interface NamedType {
  readonly type: 'named';
  readonly reference: NamedTypeDefinition<unknown>;
}

export interface PropType {
  required: boolean;
  value: Type;
}

export interface Props {
  [name: string]: PropType;
}
export type AdditionalProp = boolean | Type;
export interface ObjectType {
  readonly type: 'object';
  readonly additionalProperties: AdditionalProp;
  readonly properties: Props;
}

type Path = PathItem[];
type PathItem =
  | { type: 'path'; path: string }
  | { type: 'array' }
  | { type: 'additionalProperty'; definedProperties: string[] };

export class Traversal<Root, Leaf> {
  static compile<Root, Leaf>(root: NamedTypeDefinition<Root>, leaf: NamedTypeDefinition<Leaf>) {
    return new Traversal(root, leaf);
  }

  private cache: Reaches = new Map();
  private constructor(
    private readonly root: NamedTypeDefinition<Root>,
    private readonly leaf: NamedTypeDefinition<Leaf>
  ) {
    this.createPathsToName(root, leaf);
  }

  map(value: Root, fn: (leaf: Leaf) => Leaf) {
    this.validateRoot(value);
    const match = this.matcher();
    return runtime.map(value, ((value: any) => !!match(value)) as any, (value: any) => {
      this.paths(value).forEach((path: Path) => {
        value = safeMapPath(value, path, fn);
      });
      return value;
    });
  }

  async pmap(value: Root, fn: (leaf: Leaf) => Promise<Leaf>) {
    this.validateRoot(value);
    const match = this.matcher();
    return await runtime.pmap(
      value,
      ((value: any) => !!match(value)) as any,
      async (value: any) => {
        for (const path of this.paths(value)) {
          value = await safePmapPath(value, path, fn);
        }
        return value;
      }
    );
  }

  private paths(value: any): Path[] {
    const parents = this.cache.get(this.leaf);
    const paths: Path[] = [];
    for (const [path, parent] of parents!.entries()) {
      parent.forEach(p => {
        if (p.isA && p.isA(value)) {
          paths.push(JSON.parse(path));
        }
      });
    }
    return paths;
  }

  private matcher(): (a: any) => boolean {
    const parents = this.cache.get(this.leaf);
    return function match(value: any) {
      for (const [, parent] of parents!.entries()) {
        if (
          parent.find(p => {
            if (p.isA) {
              return p.isA(value);
            }
          })
        ) {
          return true;
        }
      }
      return false;
    };
  }

  private validateRoot(value: any) {
    assert(this.root.isA && this.root.isA(value), 'Root value does not match expected root type');
  }

  private createPathsToName(from: NamedTypeDefinition<unknown>, leaf: NamedTypeDefinition<Leaf>) {
    calculateReverseReach(new Set(), this.cache, from, leaf, false);
    const found = this.cache.get(leaf);
    if (!found) {
      return assert.fail('no path to target');
    }
    for (const parents of found.values()) {
      // we can only find objects with isA during traversal
      // todo: we could relax this a bit by finding the unambiguous parent of parent if there is one
      parents.forEach(parent =>
        assert(parent.isA, 'nearest containing named thing is not an object ' + parent.name)
      );
    }
  }
}

function safeMapPath(value: any, path: Path, fn: (value: any) => any) {
  let cursor = safe(value);
  // tslint:disable-next-line:prefer-for-of
  for (let ix = 0; ix < path.length; ix++) {
    const p = path[ix];
    if (p.type === 'array') {
      return cursor.$map(arrayValue =>
        arrayValue.map((item: any) => safeMapPath(item, path.slice(ix + 1), fn))
      );
    }
    if (p.type === 'additionalProperty') {
      const fields = Object.keys(cursor.$ || {});
      const extraFields = fields.filter(field => p.definedProperties.indexOf(field) < 0);
      return cursor.$map((value: any) => {
        for (const prop of extraFields) {
          value = safeMapPath(value, [{ type: 'path', path: prop }, ...path.slice(ix + 1)], fn);
        }
        return value;
      });
    }
    cursor = cursor[p.path];
  }
  return cursor.$map(fn);
}

async function safePmapPath(value: any, path: Path, fn: (value: any) => Promise<any>) {
  let cursor = safe(value);
  // tslint:disable-next-line:prefer-for-of
  for (let ix = 0; ix < path.length; ix++) {
    const p = path[ix];
    if (p.type === 'array') {
      return cursor.$pmap(arrayValue =>
        Promise.all(arrayValue.map((item: any) => safePmapPath(item, path.slice(ix + 1), fn)))
      );
    }
    if (p.type === 'additionalProperty') {
      const fields = Object.keys(cursor.$ || {});
      const extraFields = fields.filter(field => p.definedProperties.indexOf(field) < 0);
      return cursor.$pmap(async (value: any) => {
        for (const prop of extraFields) {
          value = await safePmapPath(
            value,
            [{ type: 'path', path: prop }, ...path.slice(ix + 1)],
            fn
          );
        }
        return value;
      });
    }
    cursor = cursor[p.path];
  }
  return cursor.$pmap(fn);
}

type ReachTo = Array<NamedTypeDefinition<unknown>>;
type Reaches = Map<NamedTypeDefinition<unknown>, Map<string, ReachTo>>;

function canReach(
  reaches: Reaches,
  from: NamedTypeDefinition<unknown>,
  to: NamedTypeDefinition<unknown>,
  byPath: Path
) {
  let existing = reaches.get(to);
  if (!existing) {
    existing = new Map();
    reaches.set(to, existing);
  }
  const pathString = JSON.stringify(byPath);
  let froms = existing.get(pathString);
  if (!froms) {
    froms = [];
    existing.set(pathString, froms);
  }
  froms.push(from);
}

function calculateReverseReach(
  processed: Set<NamedTypeDefinition<unknown>>,
  reaches: Reaches,
  from: NamedTypeDefinition<unknown>,
  to: NamedTypeDefinition<unknown>,
  ambiguousPath: boolean
) {
  assert(
    from !== to || !ambiguousPath,
    'Cannot calculate unambiguous type. There are union or intersection type between the nearest containing named object and the target leaf'
  );
  if (processed.has(from)) {
    return;
  }
  if (from.definition.type === 'object') {
    ambiguousPath = false;
    processed.add(from);
  }
  calculateReachInType(processed, reaches, from, to, from.definition, [], ambiguousPath);
}

function ambiguousOptions(options: Type[]) {
  const ambiguous = options.filter(option => option.type !== 'null');
  return ambiguous.length > 1;
}

function calculateReachInType(
  processed: Set<NamedTypeDefinition<unknown>>,
  reaches: Reaches,
  from: NamedTypeDefinition<unknown>,
  to: NamedTypeDefinition<unknown>,
  type: Type,
  path: Path,
  ambiguousPath: boolean
) {
  if (type.type === 'named') {
    canReach(reaches, from, type.reference, path);
    calculateReverseReach(processed, reaches, type.reference, to, ambiguousPath);
  } else if (type.type === 'array') {
    calculateReachInType(
      processed,
      reaches,
      from,
      to,
      type.items,
      [...path, { type: 'array' }],
      ambiguousPath
    );
  } else if (type.type === 'union') {
    type.options.map(option =>
      calculateReachInType(
        processed,
        reaches,
        from,
        to,
        option,
        path,
        ambiguousOptions(type.options) || ambiguousPath
      )
    );
  } else if (type.type === 'intersection') {
    type.options.map(option =>
      calculateReachInType(
        processed,
        reaches,
        from,
        to,
        option,
        path,
        ambiguousOptions(type.options) || ambiguousPath
      )
    );
  } else if (type.type === 'object') {
    if (type.additionalProperties && type.additionalProperties !== true) {
      calculateReachInType(
        processed,
        reaches,
        from,
        to,
        type.additionalProperties,
        [...path, { type: 'additionalProperty', definedProperties: Object.keys(type.properties) }],
        ambiguousPath
      );
    }
    Object.keys(type.properties).forEach(property => {
      calculateReachInType(
        processed,
        reaches,
        from,
        to,
        type.properties[property].value,
        [...path, { type: 'path', path: property }],
        ambiguousPath
      );
    });
  }
}
