/**
 * Maker function and top-level type generation.
 */

import * as oas from 'openapi3-ts';
import { isReferenceObject, nonNullableClass } from '../util';
import { GenerationContext } from './context';
import { ts } from '../template';
import { fromLib, isScalar } from './helpers';
import { generateType, scalarTypeWithBrand } from './types';
import { generateValueClass } from './classes';
import { generateReflectionMaker, generateNamedTypeDefinitionDeclaration } from './reflection';

/**
 * Generates the ShapeOf type alias.
 */
export function generateTypeShape(
  key: string,
  valueIdentifier: string,
  ctx: GenerationContext
): string {
  const { options } = ctx;
  return ts`export type ${options.nameMapper(key, 'shape')} = ${fromLib(
    'ShapeOf'
  )}<${valueIdentifier}>;`;
}

/**
 * Generates an empty enum for branding scalar types.
 */
export function generateBrand(key: string, ctx: GenerationContext): string {
  const brandName = 'BrandOf' + ctx.options.nameMapper(key, 'value');
  return ts`enum ${brandName} {}`;
}

/**
 * Generates the class builder function.
 */
export function generateTopLevelClassBuilder(
  key: string,
  valueIdentifier: string,
  ctx: GenerationContext
): string {
  return generateTopLevelMaker(key, ctx, 'build', valueIdentifier);
}

/**
 * Generates a maker variable that references the class's make method.
 */
export function generateTopLevelClassMaker(
  key: string,
  valueIdentifier: string,
  ctx: GenerationContext
): string {
  const { options } = ctx;
  const shapeName = options.nameMapper(key, 'shape');

  return ts`export const make${valueIdentifier}: ${fromLib(
    'make',
    'Maker'
  )}<${shapeName}, ${valueIdentifier}> = ${valueIdentifier}.make;`;
}

/**
 * Generates a maker function declaration.
 */
export function generateTopLevelMaker(
  key: string,
  ctx: GenerationContext,
  name = 'make',
  resultType?: string
): string {
  const { options } = ctx;
  const shapeName = options.nameMapper(key, 'shape');
  resultType = resultType || options.nameMapper(key, 'value');
  const makerName = name + options.nameMapper(key, 'value');
  const reflectionMaker = generateReflectionMaker(key, ctx);

  return ts`export const ${makerName}: ${fromLib(
    'make',
    'Maker'
  )}<${shapeName}, ${resultType}> = ${fromLib(
    'make',
    'createMaker'
  )}(function () { return ${reflectionMaker}; });`;
}

/**
 * Generates a complete class with all supporting types and makers.
 */
export function generateTopLevelClass(
  key: string,
  schema: oas.SchemaObject,
  ctx: GenerationContext
): readonly string[] {
  const { options } = ctx;

  if (schema.nullable) {
    const classKey = nonNullableClass(key);
    const proxy = generateTopLevelType(
      key,
      {
        oneOf: [{ type: 'null' }, { $ref: '#/components/schemas/' + classKey }]
      },
      ctx
    );
    return [...generateTopLevelClass(classKey, { ...schema, nullable: false }, ctx), ...proxy];
  }

  const valueIdentifier = options.nameMapper(key, 'value');
  return [
    generateTypeShape(key, valueIdentifier, ctx),
    generateValueClass(key, valueIdentifier, schema, ctx),
    generateTopLevelClassBuilder(key, valueIdentifier, ctx),
    generateTopLevelClassMaker(key, valueIdentifier, ctx),
    generateNamedTypeDefinitionDeclaration(key, schema, ctx)
  ];
}

/**
 * Main entry point for generating a top-level type from a schema.
 */
export function generateTopLevelType(
  key: string,
  schema: oas.SchemaObject | oas.ReferenceObject,
  ctx: GenerationContext
): readonly string[] {
  const { options } = ctx;
  const valueIdentifier = options.nameMapper(key, 'value');

  if (isReferenceObject(schema)) {
    const resolved = ctx.resolveRefToTypeName(schema.$ref, 'value');
    const type = resolved.qualified ? `${resolved.qualified}.${resolved.member}` : resolved.member;

    return [
      ts`export type ${valueIdentifier} = ${type};`,
      generateTypeShape(key, valueIdentifier, ctx),
      generateTopLevelMaker(key, ctx),
      generateNamedTypeDefinitionDeclaration(key, schema, ctx)
    ];
  }

  if (schema.type === 'object') {
    return generateTopLevelClass(key, schema, ctx);
  }

  if (isScalar(schema)) {
    const baseType = generateType(schema, ctx);
    return [
      generateBrand(key, ctx),
      ts`export type ${valueIdentifier} = ${scalarTypeWithBrand(key, baseType, ctx)};`,
      generateTypeShape(key, valueIdentifier, ctx),
      generateTopLevelMaker(key, ctx),
      generateNamedTypeDefinitionDeclaration(key, schema, ctx)
    ];
  }

  return [
    ts`export type ${valueIdentifier} = ${generateType(schema, ctx)};`,
    generateTypeShape(key, valueIdentifier, ctx),
    generateTopLevelMaker(key, ctx),
    generateNamedTypeDefinitionDeclaration(key, schema, ctx)
  ];
}
