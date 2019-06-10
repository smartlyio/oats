import * as oas from 'openapi3-ts';
import * as assert from 'assert';
import * as server from './server';
import * as client from './client';
import * as _ from 'lodash';

export type schema = oas.OpenAPIObject;
export { server };
export { client };

export class Brand<B> {
  // @ts-ignore
  private valueClassBrand: B; // branding, DO NOT ACCESS
}
interface WritableArray<T> extends Array<Writable<T>> {}
type WritableObject<T> = { -readonly [P in keyof T]: Writable<T[P]> };
type Fun = (...a: any[]) => any;
export type Writable<T> = T extends ReadonlyArray<infer R>
  ? WritableArray<R>
  : T extends Fun
  ? T
  : T extends object
  ? WritableObject<T>
  : T;

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

export class ValueClass<Cls extends Shape, Shape, Brand> extends Brand<Brand> {}

export function toJSON<Cls extends ValueClass<any, Shape, any>, Shape>(
  value: Cls
): Writable<Shape> {
  // we cant use _.cloneDeep as that copies the instance allowing a surprising way to
  // create proof carrying objects that do not respect the class constraints
  return asPlainObject(value as any); // how to say that 'this' is the extending class
}

export function set<Cls extends ValueClass<any, Shape, any>, Shape>(
  to: Cls,
  set: Partial<Shape>
): Make<Cls> {
  return (to as any).constructor.make({ ...to, ...set });
}

type ValueType =
  | ValueClass<any, any, any>
  | { [key: string]: any }
  | ReadonlyArray<any>
  | string
  | boolean
  | number;
export async function pmap<A extends ValueType, T extends ValueType>(
  value: A,
  predicate: (a: any) => a is T,
  map: (p: T) => Promise<T>
): Promise<A> {
  return pmapInternal(value, predicate, map);
}

function isPromise(p: any): p is Promise<any> {
  return p && typeof p.then === 'function';
}

function pmapInternal<A extends ValueType, T extends ValueType>(
  value: A,
  predicate: (a: any) => a is T,
  map: (p: T) => Promise<T>
): Promise<A> | A {
  if (predicate(value)) {
    value = map(value) as any;
  }
  if (isPromise(value)) {
    return value.then(n => pmapComposite(n, predicate, map));
  }
  return pmapComposite(value, predicate, map);
}

function selectArray<T>(original: T[], newArray: T[]): T[] {
  for (let i = 0; i < original.length; i++) {
    if (original[i] !== newArray[i]) {
      return newArray;
    }
  }
  return original.length !== newArray.length ? newArray : original;
}

function selectRecord<T extends { [key: string]: unknown }>(original: T, newRecord: T) {
  const changed = Object.keys(original).some(key => {
    return original[key] !== newRecord[key];
  });
  if (!changed) {
    return original;
  }
  if (original instanceof ValueClass) {
    return set(original, newRecord).success();
  }
  return newRecord;
}

async function waitArray<A>(arr: Array<A | Promise<A>>): Promise<A[]> {
  const result = [];
  for (const value of arr) {
    if (isPromise(value)) {
      result.push(await value);
    } else {
      result.push(value);
    }
  }
  return result;
}

function pmapArray<A, T>(
  value: A[],
  predicate: (v: any) => v is T,
  map: (v: T) => Promise<T>
): Promise<A[]> | A[] {
  const mapped = value.map(n => pmapInternal<A, T>(n, predicate, map));
  if (mapped.some(isPromise)) {
    return waitArray(mapped).then(newValues => {
      return selectArray(value, newValues);
    });
  }
  return selectArray<A>(value, mapped as any);
}

function pmapObject<A, T>(
  value: A,
  predicate: (v: any) => v is T,
  map: (v: T) => Promise<T>
): Promise<A> | A {
  const record: any = {};
  const promises: Array<Promise<unknown>> = [];
  Object.keys(value).forEach(key => {
    const v = pmapInternal((value as any)[key], predicate, map);
    if (isPromise(v)) {
      promises.push(
        v.then(result => {
          record[key] = result;
        })
      );
    } else {
      record[key] = v;
    }
  });

  if (promises.length) {
    return Promise.all(promises).then(() => selectRecord(value, record));
  }
  return selectRecord(value, record);
}

function pmapComposite<A, T>(
  value: A,
  predicate: (v: any) => v is T,
  map: (v: T) => Promise<T>
): Promise<A> | A {
  if (Array.isArray(value)) {
    return pmapArray(value, predicate, map) as any;
  }
  if (value && typeof value === 'object') {
    return pmapObject(value, predicate, map);
  }
  return value;
}

export class MakeError extends Error {
  constructor(public readonly errors: ValidationError[]) {
    super(
      'tried to get success value from error: ' + errors.map(validationErrorPrinter).join('\n')
    );
  }
}
export interface ValidationError {
  path: Path;
  error: string;
}

type Path = ReadonlyArray<string>;

export function validationErrorPrinter(error: ValidationError) {
  return `${error.path.join('/')}: ${error.error}`;
}

export class Make<V> {
  static ok<V>(value: V) {
    return new Make(value, []);
  }
  static error<V>(errors: ValidationError[]): Make<V> {
    return new Make<V>(null, errors);
  }
  readonly errors: ValidationError[];
  private readonly value: V | null;

  private constructor(value: V | null, errors: ValidationError[]) {
    this.value = value;
    this.errors = errors;
  }

  public isError() {
    return this.errors.length > 0;
  }

  public isSuccess() {
    return !this.isError();
  }

  public success(handler?: (e: this) => V): V {
    if (!this.isSuccess()) {
      if (handler) {
        return handler(this);
      }
    }
    if (!this.isSuccess()) {
      throw new MakeError(this.errors);
    }
    assert(this.isSuccess());
    return this.value as V;
  }

  public errorPath(path: string) {
    return new Make(
      null,
      this.errors.map(error => ({
        path: [path, ...error.path],
        error: error.error
      }))
    );
  }

  public map<R>(fn: (value: V) => R): Make<R> {
    if (this.isError()) {
      return Make.error(this.errors);
    }
    if (this.isSuccess()) {
      return Make.ok(fn(this.success()));
    }
    return assert.fail('neither failed or succesfull make');
  }
}
export type Maker<Shape, V> = (value: Shape) => Make<V>;

function error<T>(error: string): Make<T> {
  return Make.error<T>([{ path: [], error }]);
}
function checkString(value: any) {
  if (typeof value !== 'string') {
    return error('expected a string');
  }
  return Make.ok(value);
}

export function makeString() {
  return checkString;
}

function checkNumber(value: any): Make<number> {
  if (typeof value !== 'number') {
    return error('expected a number');
  }
  return Make.ok(value);
}

export function makeNumber(value?: number): Maker<number, number> {
  if (value != null) {
    return (v: number) => {
      if (value !== v) {
        return error('expected value ' + value);
      }
      return Make.ok(v);
    };
  }
  return checkNumber;
}

function checkAny(value: any) {
  return Make.ok(_.cloneDeep(value));
}

export function makeAny() {
  return checkAny;
}

function checkVoid(value: any) {
  if (value != null) {
    return error('expected no value');
  }
  return Make.ok(value);
}

export function makeVoid() {
  return checkVoid;
}

export function makeEnum<T>(...args: T[]) {
  const err = 'expected value to be one of ' + args.join(', ');
  return (value: T) => {
    if (args.indexOf(value) < 0) {
      return error(err);
    }
    return Make.ok(value);
  };
}

export function makeOptional(maker: any) {
  return { optional: maker };
}

function checkBoolean(value: any) {
  if (typeof value !== 'boolean') {
    return error('expected a boolean');
  }
  return Make.ok(value);
}

export function makeBoolean() {
  return checkBoolean;
}

export function makeArray(maker: any) {
  return (value: any) => {
    if (!Array.isArray(value)) {
      return error('expected an array');
    }
    const result = [];
    for (let index = 0; index < value.length; index++) {
      const item = value[index];
      const mapped: Make<any> = maker(item);
      if (mapped.isError()) {
        return mapped.errorPath('[' + index + ']');
      }
      result.push(mapped.success());
    }
    return Make.ok(result);
  };
}

export function makeOneOf(...options: any[]) {
  return (value: any) => {
    let errors = [];
    if (options.length === 0) {
      errors.push(error('no options given for oneof'));
    }
    let success;
    let preferredSuccess;
    for (const option of options) {
      const mapped = option(value);
      if (mapped.isSuccess()) {
        if (value instanceof ValueClass && mapped.success() === value) {
          if (preferredSuccess) {
            return error('multiple options match');
          }
          preferredSuccess = mapped;
        } else if (success) {
          return error('multiple options match');
        } else {
          success = mapped;
        }
      } else {
        errors = [...errors, ...mapped.errors];
      }
    }
    if (preferredSuccess || success) {
      return preferredSuccess || success;
    }
    return Make.error(errors).errorPath('(oneOf)');
  };
}

export function makeAllOf(...all: any[]) {
  return (value: any) => {
    for (const make of all) {
      const result: Make<any> = make(value);
      if (result.isError()) {
        return result.errorPath('(allOf)');
      }
      value = result.success();
    }
    return Make.ok(value);
  };
}

export function makeObject<
  P extends { [key: string]: Maker<any, any> | { optional: Maker<any, any> } }
>(props: P, additionalProp?: any) {
  return (value: any) => {
    if (typeof value !== 'object' || value == null) {
      return error('expected an object');
    }
    const result: { [key: string]: any } = {};
    for (const index of Object.keys(props)) {
      let maker: any = props[index];
      if (maker.optional) {
        if (!(index in value) || value[index] === undefined) {
          continue;
        }
        maker = maker.optional;
      }
      const propResult: Make<any> = maker(value[index]);
      if (propResult.isError()) {
        return propResult.errorPath(index);
      }
      result[index] = propResult.success();
    }
    for (const index of Object.keys(value)) {
      if (props[index]) {
        continue;
      }
      if (!additionalProp) {
        return error('unexpected property').errorPath(index);
      }
      const propResult: Make<any> = additionalProp(value[index]);
      if (propResult.isError()) {
        return propResult.errorPath(index);
      }
      result[index] = propResult.success();
    }
    return Make.ok(result);
  };
}

interface FormDataArguments {
  value: any;
  options: string | undefined | { [key: string]: string };
}

export type Binary = File | Buffer | FormBinary;
export class FormBinary {
  constructor(
    public readonly binary: Binary,
    public readonly options?: FormDataArguments['options']
  ) {}
}

enum FileBrand {}
export class File {
  // @ts-ignore
  private brand: FileBrand;
  constructor(public readonly path: string, public readonly size: number) {}
}

function checkBinary(value: any) {
  if (value instanceof File) {
    return Make.ok(value);
  }
  if (value instanceof Buffer) {
    return Make.ok(value);
  }
  if (value instanceof FormBinary) {
    return Make.ok(value);
  }
  return error('expected a binary value');
}
export function makeBinary() {
  // note: do *not* construct the instance here
  // only check that the instance is ok. The adapter needs to construct the instance itself.
  // if we would construct the intance from say a { path: nnnn } here that would allow the client to
  // supply any path in the request and possibly leak or otherwise cause havoc on any file in the fs
  return checkBinary;
}

export function makeNullable(maker: any) {
  return (value: any) => {
    if (value == null) {
      return Make.ok(value);
    }
    return maker(value);
  };
}

export function createMaker<Shape, Type>(fun: () => any) {
  let cached: Maker<Shape, Type>;
  return (value: Shape) => {
    if (!cached) {
      cached = fun();
    }
    return cached(value);
  };
}
export function createMakerWith<Shape, Type>(
  constructor: new (v: Shape) => Type
): Maker<Shape, Type> {
  return (value: Shape) => {
    if (value instanceof constructor) {
      return Make.ok(value);
    }
    try {
      return Make.ok(new constructor(value));
    } catch (e) {
      if (e instanceof MakeError) {
        return Make.error(e.errors);
      }
      throw e;
    }
  };
}

export function json<Status extends number, Value>(
  status: Status,
  value: Value
): server.Response<Status, 'application/json', Value> {
  return {
    status,
    value: {
      contentType: 'application/json',
      value
    }
  };
}

export function text<Status extends number, Value>(
  status: Status,
  value: Value
): server.Response<Status, 'text/plain', Value> {
  return {
    status,
    value: {
      contentType: 'text/plain',
      value
    }
  };
}
