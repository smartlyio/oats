/**
 * Type generation functions for converting OpenAPI schemas to TypeScript types.
 */

import * as oas from 'openapi3-ts';
import * as assert from 'assert';
import * as _ from 'lodash';
import { isReferenceObject, SchemaObject, errorTag } from '../util';
import { GenerationContext, AdditionalPropertiesIndexSignature } from './context';
import {
  quotedProp,
  generateLiteral,
  fromLib,
  valueClassIndexSignatureKey,
  oatsBrandFieldName
} from './helpers';

/**
 * Generates the additional properties type for index signatures.
 */
export function generateAdditionalPropType(
  additional: boolean | oas.SchemaObject['additionalProperties'],
  ctx: GenerationContext
): string | undefined {
  const { options } = ctx;

  if (additional === false) {
    return;
  }
  if (additional === true || additional == null) {
    if (
      options.unknownAdditionalPropertiesIndexSignature === AdditionalPropertiesIndexSignature.omit
    ) {
      return;
    }
    return 'unknown';
  }
  if (options.emitUndefinedForIndexTypes || options.emitUndefinedForIndexTypes == null) {
    return `${generateType(additional, ctx)} | undefined`;
  }
  return generateType(additional, ctx);
}

/**
 * Generates class members (property declarations) for a value class.
 */
export function generateClassMembers(
  properties: oas.SchemaObject['properties'],
  required: oas.SchemaObject['required'],
  additional: oas.SchemaObject['additionalProperties'],
  ctx: GenerationContext
): readonly string[] {
  const { options } = ctx;

  const proptypes: string[] = _.map(properties, (value, key) => {
    const propName = quotedProp(options.propertyNameMapper ? options.propertyNameMapper(key) : key);
    const isRequired = required && required.indexOf(key) >= 0;
    const modifier = isRequired ? '!' : '?';
    return `readonly ${propName}${modifier}: ${generateType(value, ctx)};`;
  });

  proptypes.push(generateOatsBrandProperty());

  const additionalType = generateAdditionalPropType(additional, ctx);
  if (additionalType) {
    proptypes.push(`readonly [${valueClassIndexSignatureKey}: string]: ${additionalType};`);
  }
  return proptypes;
}

/**
 * Generates the private brand property for value classes.
 */
export function generateOatsBrandProperty(): string {
  return `readonly #${oatsBrandFieldName}!: string;`;
}

/**
 * Generates object type members (property signatures) for type literals.
 */
export function generateObjectMembers(
  properties: oas.SchemaObject['properties'],
  required: oas.SchemaObject['required'],
  additional: oas.SchemaObject['additionalProperties'],
  ctx: GenerationContext,
  typeMapper: (typeName: string) => string = n => n
): string[] {
  const { options } = ctx;

  const proptypes: string[] = _.map(properties, (value, key) =>
    errorTag(`property '${key}'`, () => {
      const propName = quotedProp(
        options.propertyNameMapper ? options.propertyNameMapper(key) : key
      );
      const isRequired = required && required.indexOf(key) >= 0;
      const modifier = isRequired ? '' : '?';
      return `readonly ${propName}${modifier}: ${generateType(value, ctx, typeMapper)};`;
    })
  );

  const additionalType = generateAdditionalPropType(additional, ctx);
  if (additionalType) {
    proptypes.push(`readonly [key: string]: ${additionalType};`);
  }
  return proptypes;
}

/**
 * Generates a TypeScript type string from an OpenAPI schema.
 * This is the main recursive type generator.
 */
export function generateType(
  schema: SchemaObject,
  ctx: GenerationContext,
  typeMapper: (name: string) => string = n => n
): string {
  assert(schema, 'missing schema');

  if (isReferenceObject(schema)) {
    const resolved = ctx.resolveRefToTypeName(schema.$ref, 'value');
    const type = resolved.qualified
      ? `${resolved.qualified}.${typeMapper(resolved.member)}`
      : typeMapper(resolved.member);
    return type;
  }

  if (schema.oneOf) {
    return schema.oneOf.map(s => generateType(s, ctx, typeMapper)).join(' | ');
  }

  if (schema.allOf) {
    return schema.allOf.map(s => generateType(s, ctx, typeMapper)).join(' & ');
  }

  assert(!schema.anyOf, 'anyOf is not supported');

  if (schema.nullable) {
    return `${generateType({ ...schema, nullable: false }, ctx, typeMapper)} | null`;
  }

  if (schema.type === 'object') {
    const members = generateObjectMembers(
      schema.properties,
      schema.required,
      schema.additionalProperties,
      ctx,
      typeMapper
    );
    if (members.length === 0) {
      return '{}';
    }
    return `{ ${members.join(' ')} }`;
  }

  if (schema.enum) {
    return schema.enum.map(e => generateLiteral(e)).join(' | ');
  }

  if (schema.type === 'array') {
    const itemType = generateType(schema.items || {}, ctx, typeMapper);
    return `ReadonlyArray<${itemType}>`;
  }

  if (schema.type === 'string') {
    return generateStringType(schema.format);
  }

  if (schema.type === 'integer' || schema.type === 'number') {
    return 'number';
  }

  if (schema.type === 'boolean') {
    return 'boolean';
  }

  // @ts-expect-error schemas really do not have void type. but we do
  if (schema.type === 'void') {
    return 'void';
  }

  if (schema.type === 'null') {
    return 'null';
  }

  if (!schema.type) {
    return 'unknown';
  }

  return assert.fail('unknown schema type: ' + schema.type);
}

/**
 * Generates a string type, handling binary format specially.
 */
export function generateStringType(format: string | undefined): string {
  if (format === 'binary') {
    return fromLib('make', 'Binary');
  }
  return 'string';
}

/**
 * Wraps a type with a brand for scalar types.
 */
export function scalarTypeWithBrand(key: string, type: string, ctx: GenerationContext): string {
  const brandName = 'BrandOf' + ctx.options.nameMapper(key, 'value');
  return `${fromLib('BrandedScalar')}<${type}, ${brandName}>`;
}
