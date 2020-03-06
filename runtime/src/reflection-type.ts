import { Maker } from './make';

export type Type =
  | UnknownType
  | VoidType
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
  readonly enum?: string[];
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

export interface ObjectType {
  readonly type: 'object';
  readonly additionalProperties: boolean | Type;
  readonly properties: { [name: string]: { required: boolean; value: Type } };
}
