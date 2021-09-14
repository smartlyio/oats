import * as assert from 'assert';
import safe from '@smartlyio/safe-navigation';
import * as _ from 'lodash';
import { ValueClass } from './value-class';
import { ObjectType, Type } from './reflection-type';
import { discriminateUnion } from './union-discriminator';

export class MakeError extends Error {
  constructor(public readonly errors: ValidationError[]) {
    super(
      'tried to get success value from error: ' + errors.map(validationErrorPrinter).join('\n')
    );
  }
}

export interface ErrorGroup {
  groupMessage: string;
  errors: ValidationError[];
}

export interface ValidationError {
  path: Path;
  error: string | ErrorGroup;
}

type Path = ReadonlyArray<string>;

function indent(i: number) {
  const str = [];
  while (i-- > 0) {
    str.push('    ');
  }
  return str.join('');
}

export function validationErrorPrinter(error: ValidationError, indentation = 0) {
  if (typeof error.error === 'string') {
    return `${indent(indentation)}${error.path.join('/')}: ${error.error}`;
  }
  const subErrors: string[] = error.error.errors.map(e =>
    validationErrorPrinter(e, indentation + 1)
  );
  return `${indent(indentation)}${error.path.length > 0 ? error.path.join('/') + ': ' : ''}${
    error.error.groupMessage
  }\n${subErrors.join('\n')}`;
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

  public group(groupMessage: string) {
    return new Make(null, [{ path: [], error: { groupMessage, errors: this.errors } }]);
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
  return error(`${msg}, but got "${JSON.stringify(value)}" instead.`);
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

export function makeNumber(min?: number, max?: number): Maker<number, number> {
  return (value: any) => {
    if (typeof value !== 'number') {
      return getErrorWithValueMsg('expected a number', value);
    }
    if (min != null && value < min) {
      return getErrorWithValueMsg('expected a number greater or equal to ' + min, value);
    }
    if (max != null && value > max) {
      return getErrorWithValueMsg('expected a number smaller or equal to ' + max, value);
    }
    return Make.ok(value);
  };
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

export function makeArray(maker: any, minSize?: number, maxSize?: number) {
  return (value: any, opts?: MakeOptions) => {
    if (!Array.isArray(value)) {
      return getErrorWithValueMsg('expected an array', value);
    }
    if (minSize != null && value.length < minSize) {
      return getErrorWithValueMsg(`expected an array of minimum length ${minSize}`, value);
    }
    if (maxSize != null && value.length > maxSize) {
      return getErrorWithValueMsg(`expected an array of maximum length ${maxSize}`, value);
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

/**
 * Merge multiple mappings into one set of mappings
 *
 * Throw error if there are duplicate koys
 */
export function mergeMappings(...mappings: readonly { [key: string]: Maker<any, any> }[]): {
  [key: string]: Maker<any, any>;
} {
  return mappings.reduce((memo, current) => {
    _.forEach(current, (maker: Maker<any, any>, key: string) => {
      if (memo[key]) {
        throw new Error(`Value ${key} already has mapping`);
      }
      memo[key] = maker;
    });
    return memo;
  }, {});
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
        errors = [...errors, mapped];
      }
    }
    if (preferredSuccess || success) {
      return preferredSuccess || success;
    }
    return Make.error(errors.map((error, i) => error.group('- option ' + (i + 1)).errors[0])).group(
      'no option of oneOf matched'
    );
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

function isMagic(field: string) {
  return ['__proto__', 'constructor'].indexOf(field) >= 0;
}

export function makeObject<
  P extends { [key: string]: Maker<any, any> | { optional: Maker<any, any> } }
>(props: P, additionalProp?: any, comparisorOrder?: string[]) {
  return (value: any, opts?: MakeOptions) => {
    if (typeof value !== 'object' || value == null || Array.isArray(value)) {
      return getErrorWithValueMsg('expected an object', value);
    }
    comparisorOrder ||= Object.keys(props);
    const result: { [key: string]: any } = {};
    for (const index of comparisorOrder) {
      if (isMagic(index)) {
        return error(`Using ${index} as field of an object is not allowed`);
      }
      let maker: any = props[index];
      if (!maker) {
        return error(`Prop maker not found for key ${index}. This is likely a bug in oats`);
      }
      if (maker.optional) {
        if (!(index in value) || value[index] === undefined) {
          continue;
        }
        maker = maker.optional;
      }
      const propResult: Make<any> = maker(value[index], opts);
      if (propResult.isError()) {
        return propResult.errorPath(index);
      }
      result[index] = propResult.success();
    }
    for (const index of Object.keys(value)) {
      if (isMagic(index)) {
        return error(`Using ${index} as objects additional field is not allowed.`);
      }
      if (props[index]) {
        continue;
      }
      if (!additionalProp) {
        if (safe(opts).unknownField.$ === 'drop') {
          continue;
        }
        return error('unexpected property').errorPath(index);
      }
      const propResult: Make<any> = additionalProp(value[index], opts);
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

  constructor(
    public readonly path: string,
    public readonly size: number,
    public readonly name?: string
  ) {}
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

function isScalar(type: Type): boolean {
  if (type.type === 'named') {
    return isScalar(type.reference.definition);
  }
  return ['array', 'object', 'union', 'intersection', 'unknown'].indexOf(type.type) < 0;
}

function enumOptions(type: Type): number | null {
  if (type.type === 'null') {
    return 1;
  }
  if (type.type === 'named') {
    return enumOptions(type.reference.definition);
  }
  if (
    type.type === 'string' ||
    type.type === 'boolean' ||
    type.type === 'number' ||
    type.type === 'integer'
  ) {
    return type.enum?.length || null;
  }
  return null;
}

function priority(v: ObjectType['properties'][0]) {
  // check scalars first to avoid constructing trees unnecessarily
  if (isScalar(v.value)) {
    const enums = enumOptions(v.value);
    if (enums !== null) {
      // high chance this is a union type tag
      if (enums === 1) {
        return 4;
      }
      // enum matches less things than non enum
      return 3;
    }
    if (v.value.type === 'string') {
      // a pattern matches less things than a non pattern so lets try this first
      if (v.value.pattern) {
        return 3;
      }
    }
    if (v.required) {
      return 2;
    }
    return 1;
  }
  return 0;
}

function fromObjectReflection(type: ObjectType): Maker<any, any> {
  const comparisonOrder = Object.keys(type.properties).sort((aKey, bKey) => {
    const a = type.properties[aKey]!;
    const b = type.properties[bKey]!;
    return priority(b) - priority(a);
  });
  return makeObject(
    Object.entries(type.properties).reduce(
      (memo, [key, prop]) => ({
        ...memo,
        [key]: prop.required ? fromReflection(prop.value) : { optional: fromReflection(prop.value) }
      }),
      {}
    ),
    type.additionalProperties
      ? type.additionalProperties === true
        ? makeAny()
        : fromReflection(type.additionalProperties)
      : undefined,
    comparisonOrder
  );
}

function fromUnionReflection(types: Type[]): Maker<any, any> {
  const { discriminator, undiscriminated } = discriminateUnion(types);
  const untaggedMaker =
    undiscriminated.length > 0
      ? [makeOneOf(...undiscriminated.map(type => fromReflection(type)))]
      : [];

  if (!discriminator) {
    return makeOneOf(...types.map(type => fromReflection(type)));
  }
  const discriminatedMakers = new Map();
  for (const [key, t] of discriminator.map) {
    // note that we need to check the undiscriminated values also as those *might* match also
    // due to additionalProps or non enum props
    discriminatedMakers.set(key, makeOneOf(...[...untaggedMaker, fromReflection(t)]));
  }
  return (value: any, opts?: MakeOptions) => {
    if (value && typeof value === 'object' && !Array.isArray(value) && value[discriminator.key]) {
      const discriminatedType = discriminatedMakers.get(value[discriminator.key]);
      if (discriminatedType) {
        return discriminatedType(value, opts);
      }
    }
    // we know that none of the discriminated types can match as the tag value did not match
    // so its enough to check the non discriminated types
    if (untaggedMaker[0]) {
      return untaggedMaker[0](value, opts);
    }
    return error(`No value matching discriminator key ${discriminator.key}`);
  };
}

export function fromReflection(type: Type): Maker<any, any> {
  if ((type as any).enum) {
    return makeEnum(...(type as any).enum);
  }
  switch (type.type) {
    case 'integer':
    case 'number':
      return makeNumber(type.minimum, type.maximum);
    case 'string':
      return makeString(type.format, type.pattern);
    case 'boolean':
      return makeBoolean();
    case 'array':
      return makeArray(fromReflection(type.items), type.minItems, type.maxItems);
    case 'object':
      return fromObjectReflection(type);
    case 'void':
      return makeVoid();
    case 'null':
      return makeEnum(null);
    case 'union':
      return fromUnionReflection(type.options);
    case 'intersection':
      return makeAllOf(...type.options.map(req => fromReflection(req)));
    case 'named':
      return type.reference.maker;
    case 'unknown':
      return makeAny();
    case 'binary':
      return makeBinary();
  }
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
