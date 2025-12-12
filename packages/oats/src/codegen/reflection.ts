/**
 * Reflection metadata generation for runtime type information.
 */

import * as oas from 'openapi3-ts';
import * as assert from 'assert';
import { isReferenceObject } from '../util';
import { GenerationContext } from './context';
import { ts, str } from '../template';
import { fromLib, isScalar } from './helpers';

/**
 * Generates reflection type metadata from a schema.
 * This is recursive and handles all schema types.
 * Returns an object literal expression string (not a complete statement).
 */
export function generateReflectionType(
  schema: oas.SchemaObject | oas.ReferenceObject,
  ctx: GenerationContext
): string {
  if (isReferenceObject(schema)) {
    const resolved = ctx.resolveRefToTypeName(schema.$ref, 'reflection');
    const type = resolved.qualified ? `${resolved.qualified}.${resolved.member}` : resolved.member;
    return `{ type: "named", reference: () => { return ${type}; } }`;
  }

  if (schema.oneOf) {
    const options = schema.oneOf.map(s => generateReflectionType(s, ctx)).join(', ');
    return `{ type: "union", options: [${options}] }`;
  }

  if (schema.allOf) {
    const options = schema.allOf.map(s => generateReflectionType(s, ctx)).join(', ');
    return `{ type: "intersection", options: [${options}] }`;
  }

  assert(!schema.anyOf, 'anyOf is not supported');

  if (schema.nullable) {
    return generateReflectionType(
      { oneOf: [{ ...schema, nullable: false }, { type: 'null' }] },
      ctx
    );
  }

  // @ts-expect-error schemas really do not have void type. but we do
  if (schema.type === 'void') {
    return `{ type: "void" }`;
  }

  if (schema.type === 'null') {
    return `{ type: "null" }`;
  }

  if (schema.type === 'string') {
    if (schema.format === 'binary') {
      return `{ type: "binary" }`;
    }

    const props = [
      'type: "string"',
      schema.enum ? `enum: [${schema.enum.map(v => str(v)).join(', ')}]` : '',
      schema.format ? `format: ${str(schema.format)}` : '',
      schema.pattern ? `pattern: ${str(schema.pattern)}` : '',
      schema.minLength != null ? `minLength: ${schema.minLength}` : '',
      schema.maxLength != null ? `maxLength: ${schema.maxLength}` : ''
    ].filter(p => p !== '');

    return `{ ${props.join(', ')} }`;
  }

  if (schema.type === 'number' || schema.type === 'integer') {
    const props = [
      `type: ${str(schema.type)}`,
      schema.enum ? `enum: [${schema.enum.join(', ')}]` : '',
      schema.minimum != null ? `minimum: ${schema.minimum}` : '',
      schema.maximum != null ? `maximum: ${schema.maximum}` : ''
    ].filter(p => p !== '');

    return `{ ${props.join(', ')} }`;
  }

  if (schema.type === 'boolean') {
    const props = [
      'type: "boolean"',
      schema.enum ? `enum: [${schema.enum.join(', ')}]` : ''
    ].filter(p => p !== '');

    return `{ ${props.join(', ')} }`;
  }

  if (schema.type === 'array') {
    const items = generateReflectionType(schema.items || {}, ctx);
    const props = [
      'type: "array"',
      `items: ${items}`,
      schema.minItems != null ? `minItems: ${schema.minItems}` : '',
      schema.maxItems != null ? `maxItems: ${schema.maxItems}` : ''
    ].filter(p => p !== '');

    return `{ ${props.join(', ')} }`;
  }

  if (schema.type === 'object') {
    return generateObjectReflectionType(schema, ctx);
  }

  if (!schema.type) {
    return `{ type: "unknown" }`;
  }

  assert.fail('todo generateReflectionType', schema);
  throw new Error();
}

/**
 * Generates reflection type for additional properties.
 */
export function generateAdditionalPropsReflectionType(
  props: oas.SchemaObject['additionalProperties'],
  ctx: GenerationContext
): string {
  if (props === false) {
    return 'false';
  }
  if (
    props === true ||
    !props ||
    (props && typeof props === 'object' && Object.keys(props).length === 0)
  ) {
    return 'true';
  }
  return generateReflectionType(props, ctx);
}

/**
 * Generates reflection type for an object schema.
 */
export function generateObjectReflectionType(
  schema: oas.SchemaObject,
  ctx: GenerationContext
): string {
  const { options } = ctx;
  const additionalProps = generateAdditionalPropsReflectionType(schema.additionalProperties, ctx);

  const propertyEntries = Object.keys(schema.properties || {}).map((propertyName: string) => {
    const mappedName = options.propertyNameMapper
      ? options.propertyNameMapper(propertyName)
      : propertyName;
    const isRequired = (schema.required || []).indexOf(propertyName) >= 0;
    const valueReflection = generateReflectionType(
      (schema.properties as Record<string, oas.SchemaObject | oas.ReferenceObject>)[propertyName],
      ctx
    );

    const networkNameProp = options.propertyNameMapper ? `, networkName: ${str(propertyName)}` : '';

    return `${str(
      mappedName
    )}: { required: ${isRequired}${networkNameProp}, value: ${valueReflection} }`;
  });

  const propsStr = propertyEntries.length > 0 ? `{ ${propertyEntries.join(', ')} }` : '{}';

  return `{ type: "object", additionalProperties: ${additionalProps}, properties: ${propsStr} }`;
}

/**
 * Creates the fromReflection call for a maker.
 */
export function generateReflectionMaker(key: string, ctx: GenerationContext): string {
  const { options } = ctx;
  return `oar.fromReflection(${options.nameMapper(key, 'reflection')}.definition)`;
}

/**
 * Generates the named type definition declaration.
 */
export function generateNamedTypeDefinitionDeclaration(
  key: string,
  schema: oas.SchemaObject | oas.ReferenceObject,
  ctx: GenerationContext
): string {
  const { options } = ctx;
  const isA = inventIsA(key, schema, ctx);
  const valueName = options.nameMapper(key, 'value');
  const shapeName = options.nameMapper(key, 'shape');
  const reflectionName = options.nameMapper(key, 'reflection');
  const definition = generateReflectionType(schema, ctx);

  return ts`export const ${reflectionName}: ${fromLib(
    'reflection',
    'NamedTypeDefinition'
  )}<${valueName}, ${shapeName}> = { name: ${str(
    valueName
  )}, definition: ${definition}, maker: make${valueName}, isA: ${isA ?? 'null'} } as any;`;
}

/**
 * Determines the appropriate isA function for a schema.
 */
export function inventIsA(
  key: string,
  schema: oas.SchemaObject | oas.ReferenceObject,
  ctx: GenerationContext
): string | undefined {
  if (isReferenceObject(schema)) return undefined;

  if (schema.type === 'object') {
    return generateIsA(ctx.options.nameMapper(key, 'value'));
  }
  if (isScalar(schema)) {
    return generateIsAForScalar(key, ctx);
  }
  return undefined;
}

/**
 * Generates an instanceof-based isA function.
 */
export function generateIsA(type: string): string {
  return `(value: any) => value instanceof ${type}`;
}

/**
 * Generates a maker-based isA function for scalar types.
 */
export function generateIsAForScalar(key: string, ctx: GenerationContext): string {
  const { options } = ctx;
  return `(value: any) => make${options.nameMapper(key, 'value')}(value).isSuccess()`;
}
