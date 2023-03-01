import { assert, fail } from './assert';
import safe from '@smartlyio/safe-navigation';
import * as _ from 'lodash';
import { isEqual, uniq } from 'lodash';
import { ValueClass } from './value-class';
import { NamedTypeDefinition, ObjectType, Type } from './reflection-type';
import { discriminateUnion } from './union-discriminator';
import { getType, getTypeSet, withType } from './type-tag';

export class MakeError extends Error {
  constructor(readonly errors: ValidationError[]) {
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

  isError() {
    return this.errors.length > 0;
  }

  isSuccess() {
    return !this.isError();
  }

  success(handler?: (e: this) => V): V {
    if (this.isSuccess()) {
      return this.value as V;
    }
    if (handler) {
      return handler(this);
    }
    throw new MakeError(this.errors);
  }

  group(groupMessage: string) {
    return new Make(null, [{ path: [], error: { groupMessage, errors: this.errors } }]);
  }

  errorPath(path: string) {
    return new Make(
      null,
      this.errors.map(error => ({
        path: [path, ...error.path],
        error: error.error
      }))
    );
  }

  map<R>(fn: (value: V) => R): Make<R> {
    if (this.isError()) {
      return Make.error(this.errors);
    }
    if (this.isSuccess()) {
      return Make.ok(fn(this.success()));
    }
    return fail('neither failed or succesfull make');
  }
}

export interface MakeOptions {
  unknownField?: 'drop' | 'fail';
  /**
   * If enabled, "number" ans "integer" schemas will accept strings and try to parse them.
   */
  parseNumericStrings?: boolean;
  /**
   * If enabled, "boolean" schemas will accept strings and try to parse them.
   */
  parseBooleanStrings?: boolean;
  /**
   * If enabled, "array" schema will convert any non-array value to an array with a single element.
   * Useful for supporting arrays in query parameters
   * (if query parameter is not repeated, it will not be an array on server side).
   */
  allowConvertForArrayType?: boolean;

  /** If true convert property names from network to ts format while parsing objects */
  convertFromNetwork?: boolean;
}

export type Maker<Shape, V> = (value: Shape, opts?: MakeOptions) => Make<V>;

function getErrorWithValueMsg<T>(msg: string, value: T): Make<T> {
  const stringified =
    typeof value === 'object' || typeof value === 'string' ? JSON.stringify(value) : String(value);
  return error(`${msg}, but got \`${stringified}\` instead.`);
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
  format?: string,
  pattern?: string,
  minLength?: number,
  maxLength?: number
): Maker<any, string> {
  const formatter = getFormatter(format);
  const patterner = getPatterner(pattern);

  return (value: any) => {
    if (typeof value !== 'string') {
      return getErrorWithValueMsg('expected a string', value);
    }
    if (minLength != null && value.length < minLength) {
      return getErrorWithValueMsg(
        'expected a string with a length of at least ' + minLength,
        value
      );
    }
    if (maxLength != null && value.length > maxLength) {
      return getErrorWithValueMsg(
        'expected a string with a length of at maximum ' + maxLength,
        value
      );
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

export function makeNumber(min?: number, max?: number) {
  return makeFloatOrInteger(false, min, max);
}
export function makeInteger(min?: number, max?: number) {
  return makeFloatOrInteger(true, min, max);
}
function makeFloatOrInteger(
  isInteger: boolean,
  min?: number,
  max?: number
): Maker<unknown, number> {
  return (x, { parseNumericStrings = false } = {}) => {
    let value: number;
    if (typeof x === 'number') {
      value = x;
    } else if (typeof x === 'string' && parseNumericStrings) {
      value = x.trim() === '' ? NaN : Number(x);
      if (!Number.isFinite(value)) {
        return getErrorWithValueMsg('expected a number', x as any);
      }
    } else {
      return getErrorWithValueMsg('expected a number', x as number);
    }
    if (isInteger && !Number.isInteger(value)) {
      return getErrorWithValueMsg('expected an integer', x);
    }
    if (min != null && value < min) {
      return getErrorWithValueMsg('expected a number greater than ' + min, value);
    }
    if (max != null && value > max) {
      return getErrorWithValueMsg('expected a number smaller than ' + max, value);
    }
    return Make.ok(value);
  };
}

function checkAny(value: any) {
  const type = getType(value);
  if (type && type.length > 0) {
    return Make.ok(withType(_.cloneDeep(value), type));
  }
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

export function makeBoolean(): Maker<unknown, boolean> {
  return (x: unknown, { parseBooleanStrings = false } = {}) => {
    let value: boolean;
    if (typeof x === 'boolean') {
      value = x;
    } else if (parseBooleanStrings && x === 'true') {
      value = true;
    } else if (parseBooleanStrings && x === 'false') {
      value = false;
    } else {
      return getErrorWithValueMsg('expected a boolean', x as boolean);
    }
    return Make.ok(value);
  };
}

export function makeArray(
  maker: any,
  minSize?: number,
  maxSize?: number
): Maker<unknown, unknown[]> {
  return (x, opts) => {
    let value: unknown[];
    if (Array.isArray(x)) {
      value = x;
    } else if (opts?.allowConvertForArrayType) {
      value = [x];
    } else {
      return getErrorWithValueMsg('expected an array', x as unknown[]);
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
        return mapped.errorPath('[' + index + ']') as Make<any>;
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

export function makeAllOf(...all: Maker<any, any>[]) {
  return (value: any, opts?: MakeOptions) => {
    const types = [];
    for (const make of all) {
      const result: Make<any> = make(value, opts);
      if (result.isError()) {
        return result.errorPath('(allOf)');
      }
      value = result.success();
      types.push(...(getTypeSet(value) ?? []));
    }
    return Make.ok(withType(value, types));
  };
}

function isMagic(field: string) {
  return ['__proto__', 'constructor'].indexOf(field) >= 0;
}

function getInputPropName(args: {
  value: any;
  index: string;
  fromNetwork: Record<string, string>;
  opts?: MakeOptions;
}) {
  if (!args.opts?.convertFromNetwork) {
    return args.index;
  }
  // we need to look at the types already used for making the value to detect cases
  // where the property has already been mapped and we should use the ts side
  // property name
  const types = getType(args.value) ?? [];
  const networkProp = args.fromNetwork?.[args.index] ?? args.index;
  for (const type of types) {
    if (type.type !== 'object') {
      // only objects can have network mappings
      continue;
    }
    const mapped = type.properties[args.index];
    if (mapped) {
      // if the object was made already then network mapping has been done for listed properties
      // and we should use the ts side property
      assert(
        networkProp == mapped.networkName,
        `Network names for properties with the same name need to be equal when a object has multiple types. Mismatch in ${networkProp} and ${mapped.networkName}.`
      );
      return args.index;
    }
  }
  return networkProp;
}

export function makeObject<
  P extends { [key: string]: Maker<any, any> | { optional: Maker<any, any> } }
>(props: P, additionalProp?: any, comparisorOrder?: string[], type?: ObjectType) {
  const fromNetwork = fromNetworkMap(type);
  const listedInputPropNames = new Set(Object.keys(props).map(prop => fromNetwork[prop] ?? prop));

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
      const inputPropName = getInputPropName({ opts, index, fromNetwork, value });
      let maker: any = props[index];
      if (!maker) {
        return error(`Prop maker not found for key ${index}. This is likely a bug in oats`);
      }
      if (maker.optional) {
        if (!(inputPropName in value) || value[inputPropName] === undefined) {
          continue;
        }
        maker = maker.optional;
      }
      const propResult: Make<any> = maker(value[inputPropName], opts);
      if (propResult.isError()) {
        return propResult.errorPath(index);
      }
      result[index] = propResult.success();
    }
    for (const index of Object.keys(value)) {
      // do not consider props that got mapped
      if (opts?.convertFromNetwork && listedInputPropNames.has(index)) {
        continue;
      }
      if (isMagic(index)) {
        return error(`Using ${index} as objects additional field is not allowed.`);
      }
      // do not allow overriding mapped props
      if (props[index]) {
        continue;
      }
      if (!additionalProp) {
        // do not consider props that have undefined value
        if (value[index] === undefined) {
          continue;
        }
        if (safe(opts).unknownField.$ === 'drop') {
          continue;
        }
        return error('unexpected property').errorPath(index);
      }
      // If the input value A has been made already with network prop name mapping
      // this runs the property value through the current additionalProps maker to validate it
      // nb. the property key *has* already been mapped when making A and we just use it here
      // this works unless we start mapping additionalProp property names.
      const propResult: Make<any> = additionalProp(value[index], opts);
      if (propResult.isError()) {
        return propResult.errorPath(index);
      } else if (value[index] === undefined) {
        // when a schema is provided as additional props we should also skip the undefined values
        continue;
      }
      result[index] = propResult.success();
    }
    const oldType = getType(value);
    if (oldType) {
      withType(result, oldType);
    }
    return Make.ok(withType(result, type ? [type] : []));
  };
}

interface FormDataArguments {
  value: any;
  options: string | undefined | { [key: string]: string };
}

export type Binary = File | Buffer | FormBinary;

export class FormBinary {
  constructor(readonly binary: Binary, readonly options?: FormDataArguments['options']) {}
}

enum FileBrand {}

export class File {
  // @ts-ignore
  private brand: FileBrand;

  constructor(readonly path: string, readonly size: number, readonly name?: string) {}
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
    return isScalar(type.reference().definition);
  }
  return ['array', 'object', 'union', 'intersection', 'unknown'].indexOf(type.type) < 0;
}

function enumOptions(type: Type): number | null {
  if (type.type === 'null') {
    return 1;
  }
  if (type.type === 'named') {
    return enumOptions(type.reference().definition);
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

enum Priority {
  Tag = 0,
  Enum = 1,
  Pattern = 2,
  Required = 3,
  Scalar,
  NonScalar
}

function priority(v: ObjectType['properties'][string]) {
  // check scalars first to avoid constructing trees unnecessarily
  if (isScalar(v.value)) {
    const enums = enumOptions(v.value);
    if (enums !== null) {
      // high chance this is a union type tag
      if (enums === 1) {
        return Priority.Tag;
      }
      // enum matches less things than non enum
      return Priority.Enum;
    }
    if (v.value.type === 'string') {
      // a pattern matches less things than a non pattern so lets try this first
      if (v.value.pattern) {
        return Priority.Pattern;
      }
    }
    if (v.required) {
      return Priority.Required;
    }
    return Priority.Scalar;
  }
  return Priority.NonScalar;
}

function fromNetworkMap(type?: ObjectType) {
  if (!type) {
    return {};
  }
  const fromNetwork = Object.keys(type.properties).reduce<Record<string, string>>((memo, key) => {
    const mapped = type.properties[key].networkName;
    if (mapped) {
      memo[key] = mapped;
    }
    return memo;
  }, {});
  return fromNetwork;
}
function fromObjectReflection(type: ObjectType): Maker<any, any> {
  const comparisonOrder = Object.keys(type.properties).sort((aKey, bKey) => {
    const a = type.properties[aKey]!;
    const b = type.properties[bKey]!;
    return priority(a) - priority(b);
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
    comparisonOrder,
    type
  );
}

function networkMapFromDiscriminatedType(prop: string, type: Type): string | undefined {
  switch (type.type) {
    case 'object':
      return type.properties[prop].networkName;
    case 'named':
      return networkMapFromDiscriminatedType(prop, type.reference().definition);
    case 'intersection':
      // note that within a single discriminator set the key must the be the same
      // and thus the network key must be the same and we can consider only the first option
      return networkMapFromDiscriminatedType(prop, type.options[0]);
    case 'union':
      return networkMapFromDiscriminatedType(prop, type.options[0]);
    default:
      throw new Error(
        `Non object like type when looking for discriminator network mapping for ${prop}. This is likely a bug in oats`
      );
  }
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
    discriminatedMakers.set(key, makeOneOf(...[...untaggedMaker, fromReflection(t)]));
  }
  // we choose the first entry from discriminators as all the options *must* have the same property name and
  // thus the same network property name.
  const networkDiscriminatorKey =
    networkMapFromDiscriminatedType(discriminator.key, [...discriminator.map.values()][0]) ??
    discriminator.key;
  return (value: any, opts?: MakeOptions) => {
    const key = getInputPropName({
      value,
      index: discriminator.key,
      fromNetwork: { [discriminator.key]: networkDiscriminatorKey },
      opts
    });
    if (value && typeof value === 'object' && !Array.isArray(value) && key in value) {
      const discriminatedType = discriminatedMakers.get(value[key]);
      if (discriminatedType) {
        return discriminatedType(value, opts);
      }
    }
    // we know that none of the discriminated types can match as the tag value did not match
    // so its enough to check the non discriminated types
    if (untaggedMaker[0]) {
      return untaggedMaker[0](value, opts);
    }
    if (value) {
      return error(`Invalid value '${value[key]}' for object discriminator '${discriminator.key}'`);
    }
    return error(`Missing object value when discriminating by property '${discriminator.key}'`);
  };
}

export function fromReflection(type: Type): Maker<any, any> {
  if ((type as any).enum) {
    return makeEnum(...(type as any).enum);
  }
  switch (type.type) {
    case 'integer':
      return makeInteger(type.minimum, type.maximum);
    case 'number':
      return makeNumber(type.minimum, type.maximum);
    case 'string':
      return makeString(type.format, type.pattern, type.minLength, type.maxLength);
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
      return type.reference().maker;
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

/**
 * Merge multiple mappings into one set of mappings
 *
 * Throw error if there are duplicate koys
 * @deprecated
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

export function extractDiscriminatorKeys(
  discriminatorField: string,
  typeObjectRef: Type
): string[] {
  const typeObject =
    typeObjectRef.type === 'named' ? typeObjectRef.reference().definition : typeObjectRef;

  if (typeObject.type === 'union') {
    const keys = typeObject.options.map(type => extractDiscriminatorKeys(discriminatorField, type));
    if (!isEqual(keys[0], uniq(keys.flat(1)))) {
      throw new Error('All values from union need to have same discriminator keys');
    }
    return keys[0];
  }

  if (typeObject.type !== 'object') {
    throw new Error(
      'Invalid type used for discriminator: type is not an object' + JSON.stringify(typeObject)
    );
  }
  const fieldSchemaRef = typeObject.properties[discriminatorField].value;
  const fieldSchema =
    fieldSchemaRef.type === 'named' ? fieldSchemaRef.reference().definition : fieldSchemaRef;

  if (fieldSchema.type === 'union') {
    return extractDiscriminatorKeys(discriminatorField, fieldSchemaRef);
  }
  if (fieldSchema.type !== 'string') {
    throw new Error(
      'Invalid type used for discriminator: no value defined ' + JSON.stringify(typeObject)
    );
  }
  return fieldSchema.enum || [];
}

/** @deprecated */
export function extractDiscriminatorValueMap(
  discriminatorField: string,
  typeObject: NamedTypeDefinition<any>
): { [key: string]: Maker<any, any> } {
  const keys = extractDiscriminatorKeys(discriminatorField, typeObject.definition);
  return keys.reduce(
    (memo: { [key: string]: Maker<any, any> }, e: string) => ({ ...memo, [e]: typeObject.maker }),
    {}
  );
}

/**
 * Make oneOf with the discriminator support
 *
 * Will use given mapping to find correct maker. If optional importedTypes are provided, will extract
 * extra mapping keys from them.
 *
 * @deprecated
 *
 * @param discriminatorField Field to use as discriminator
 * @param mapping Mappings that we should use to determine target makers
 * @param importedTypes Optional types where we should extract enum values for makers
 */
export function makeOneOfWithDiscriminator(
  discriminatorField: string,
  mapping: { [key: string]: Maker<any, any> },
  importedTypes?: readonly any[]
) {
  const fullMapping = mergeMappings(
    mapping,
    ...(importedTypes ?? []).map((type: NamedTypeDefinition<any>) =>
      extractDiscriminatorValueMap(discriminatorField, type)
    )
  );
  return (value: any, opts?: MakeOptions) => {
    if (typeof value !== 'object') {
      return error('value for oneOf with discriminator needs to be an object');
    }
    let discriminatorValue;
    if (
      !(discriminatorField in value) ||
      typeof (discriminatorValue = value[discriminatorField]) !== 'string'
    ) {
      return error(
        `value for discriminator field "${discriminatorField}" must be a string but value was "${discriminatorValue}" instead`
      );
    }
    const maker = fullMapping[discriminatorValue];
    if (!maker) {
      return error(
        `unexpected value ${JSON.stringify(
          discriminatorValue
        )} in field "${discriminatorField}" which is used as discriminator`
      );
    }
    return maker(value, opts);
  };
}
