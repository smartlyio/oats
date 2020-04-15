import * as assert from 'assert';
import safe from '@smartlyio/safe-navigation';
import * as _ from 'lodash';
import { ValueClass } from './value-class';

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

export interface MakeOptions {
  unknownField?: 'drop' | 'fail';
}

export type Maker<Shape, V> = (value: Shape, opts?: MakeOptions) => Make<V>;

function getErrorWithValueMsg<T>(msg: string, value: T): Make<T> {
  return error(`${msg}, but got "${value}" instead.`);
}

function error<T>(error: string): Make<T> {
  return Make.error<T>([{ path: [], error }]);
}

export function registerFormat(format: string, maker: Maker<any, undefined>) {
  assert(!formats[format], `format ${format} is already registered`);
  formats[format] = maker;
}

const formats: Record<string, Maker<any, undefined>> = {};

function getFormatter(format: string | undefined): Maker<any, undefined> {
  if (format === undefined) {
    return () => Make.ok(undefined);
  }
  const formatter = formats[format];
  if (!formatter) {
    return () => Make.ok(undefined);
  }
  return formatter;
}

function getPatterner(pattern: string | undefined): Maker<any, void> {
  if (pattern === undefined) {
    return value => Make.ok(value);
  }
  try {
    const reg = new RegExp(pattern);
    return value => {
      if (!reg.test(value)) {
        return error(`${value} does not match pattern /${pattern}/`);
      }
      return Make.ok(undefined);
    };
  } catch (e) {
    if (e instanceof SyntaxError) {
      throw new Error("pattern for 'type: string' is not valid: " + e.message);
    }
    throw e;
  }
}

export function makeString(
  format: string | undefined = undefined,
  pattern: string | undefined = undefined
): Maker<any, string> {
  const formatter = getFormatter(format);
  const patterner = getPatterner(pattern);

  return (value: any) => {
    if (typeof value !== 'string') {
      return getErrorWithValueMsg('expected a string', value);
    }
    const formatted = formatter(value);
    if (formatted.isError()) {
      return formatted;
    }
    const patterned = patterner(value);
    if (patterned.isError()) {
      return patterned;
    }
    return Make.ok(value);
  };
}

function checkNumber(value: any): Make<number> {
  if (typeof value !== 'number') {
    return getErrorWithValueMsg('expected a number', value);
  }
  return Make.ok(value);
}

export function makeNumber(value?: number): Maker<number, number> {
  if (value != null) {
    return (v: number) => {
      if (value !== v) {
        return getErrorWithValueMsg('expected value ' + value, v);
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
    return getErrorWithValueMsg('expected no value', value);
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
      return getErrorWithValueMsg(err, value);
    }
    return Make.ok(value);
  };
}

export function makeOptional(maker: any) {
  return { optional: maker };
}

function checkBoolean(value: any) {
  if (typeof value !== 'boolean') {
    return getErrorWithValueMsg('expected a boolean', value);
  }
  return Make.ok(value);
}

export function makeBoolean() {
  return checkBoolean;
}

export function makeArray(maker: any) {
  return (value: any, opts?: MakeOptions) => {
    if (!Array.isArray(value)) {
      return getErrorWithValueMsg('expected an array', value);
    }
    const result = [];
    for (let index = 0; index < value.length; index++) {
      const item = value[index];
      const mapped: Make<any> = maker(item, opts);
      if (mapped.isError()) {
        return mapped.errorPath('[' + index + ']');
      }
      result.push(mapped.success());
    }
    return Make.ok(result);
  };
}

export function makeOneOf(...options: any[]) {
  return (value: any, opts?: MakeOptions) => {
    let errors = [];
    if (options.length === 0) {
      errors.push(error('no options given for oneof'));
    }
    let success;
    let preferredSuccess;
    for (const option of options) {
      const mapped = option(value, opts);
      if (mapped.isSuccess()) {
        if (value instanceof ValueClass && mapped.success() === value) {
          if (preferredSuccess) {
            return error('multiple preferred options match');
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
  return (value: any, opts?: MakeOptions) => {
    for (const make of all) {
      const result: Make<any> = make(value, opts);
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
  return (value: any, opts?: MakeOptions) => {
    if (typeof value !== 'object' || value == null) {
      return getErrorWithValueMsg('expected an object', value);
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
        if (safe(opts).unknownField.$ === 'drop') {
          continue;
        }
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
  return getErrorWithValueMsg('expected a binary value', value);
}

export function makeBinary() {
  // note: do *not* construct the instance here
  // only check that the instance is ok. The adapter needs to construct the instance itself.
  // if we would construct the intance from say a { path: nnnn } here that would allow the client to
  // supply any path in the request and possibly leak or otherwise cause havoc on any file in the fs
  return checkBinary;
}

export function makeNullable(maker: any) {
  return (value: any, opts?: MakeOptions) => {
    if (value == null) {
      return Make.ok(value);
    }
    return maker(value, opts);
  };
}

export function createMaker<Shape, Type>(fun: () => any) {
  let cached: Maker<Shape, Type>;
  return (value: Shape, opts?: MakeOptions) => {
    if (!cached) {
      cached = fun();
    }
    return cached(value, opts);
  };
}

export function createMakerWith<Shape, Type>(
  constructor: new (v: Shape, opts?: MakeOptions) => Type
): Maker<Shape, Type> {
  return (value: Shape, opts?: MakeOptions) => {
    if (value instanceof constructor) {
      return Make.ok(value);
    }
    try {
      return Make.ok(new constructor(value, opts));
    } catch (e) {
      if (e instanceof MakeError) {
        return Make.error(e.errors);
      }
      throw e;
    }
  };
}
