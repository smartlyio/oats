/**
 * Type generation functions for converting OpenAPI schemas to TypeScript types.
 */

import * as ts from 'typescript';
import * as oas from 'openapi3-ts';
import * as assert from 'assert';
import * as _ from 'lodash';
import { isReferenceObject, SchemaObject, errorTag } from '../util';
import { GenerationContext, AdditionalPropertiesIndexSignature } from './context';
import {
  quotedProp,
  generateLiteral,
  fromLib,
  readonlyModifier,
  valueClassIndexSignatureKey,
  oatsBrandFieldName
} from './helpers';

/**
 * Generates the additional properties type for index signatures.
 */
export function generateAdditionalPropType(
  additional: boolean | oas.SchemaObject['additionalProperties'],
  ctx: GenerationContext
): ts.TypeNode | undefined {
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
    return ts.factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword);
  }
  if (options.emitUndefinedForIndexTypes || options.emitUndefinedForIndexTypes == null) {
    return ts.factory.createUnionTypeNode([
      generateType(additional, ctx),
      ts.factory.createKeywordTypeNode(ts.SyntaxKind.UndefinedKeyword)
    ]);
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
): readonly ts.ClassElement[] {
  const { options } = ctx;

  const proptypes: ts.ClassElement[] = _.map(properties, (value, key) => {
    return ts.factory.createPropertyDeclaration(
      [ts.factory.createToken(ts.SyntaxKind.ReadonlyKeyword)],
      quotedProp(options.propertyNameMapper ? options.propertyNameMapper(key) : key),
      required && required.indexOf(key) >= 0
        ? ts.factory.createToken(ts.SyntaxKind.ExclamationToken)
        : ts.factory.createToken(ts.SyntaxKind.QuestionToken),
      generateType(value, ctx),
      undefined
    );
  });

  proptypes.push(generateOatsBrandProperty());

  const additionalType = generateAdditionalPropType(additional, ctx);
  if (additionalType) {
    proptypes.push(
      ts.factory.createIndexSignature(
        [ts.factory.createToken(ts.SyntaxKind.ReadonlyKeyword)],
        [
          ts.factory.createParameterDeclaration(
            undefined,
            undefined,
            valueClassIndexSignatureKey,
            undefined,
            ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword)
          )
        ],
        additionalType
      ) as unknown as ts.ClassElement
    );
  }
  return proptypes;
}

/**
 * Generates the private brand property for value classes.
 */
export function generateOatsBrandProperty(): ts.PropertyDeclaration {
  return ts.factory.createPropertyDeclaration(
    [ts.factory.createToken(ts.SyntaxKind.ReadonlyKeyword)],
    ts.factory.createPrivateIdentifier(`#${oatsBrandFieldName}`),
    ts.factory.createToken(ts.SyntaxKind.ExclamationToken),
    ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
    undefined
  );
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
): ts.TypeElement[] {
  const { options } = ctx;

  const proptypes: ts.TypeElement[] = _.map(properties, (value, key) =>
    errorTag(`property '${key}'`, () =>
      ts.factory.createPropertySignature(
        readonlyModifier,
        quotedProp(options.propertyNameMapper ? options.propertyNameMapper(key) : key),
        required && required.indexOf(key) >= 0
          ? undefined
          : ts.factory.createToken(ts.SyntaxKind.QuestionToken),
        generateType(value, ctx, typeMapper)
      )
    )
  );

  const additionalType = generateAdditionalPropType(additional, ctx);
  if (additionalType) {
    proptypes.push(
      ts.factory.createIndexSignature(
        readonlyModifier,
        [
          ts.factory.createParameterDeclaration(
            undefined,
            undefined,
            'key',
            undefined,
            ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword)
          )
        ],
        additionalType
      ) as unknown as ts.TypeElement
    );
  }
  return proptypes;
}

/**
 * Generates a TypeScript type node from an OpenAPI schema.
 * This is the main recursive type generator.
 */
export function generateType(
  schema: SchemaObject,
  ctx: GenerationContext,
  typeMapper: (name: string) => string = n => n
): ts.TypeNode {
  assert(schema, 'missing schema');

  if (isReferenceObject(schema)) {
    const resolved = ctx.resolveRefToTypeName(schema.$ref, 'value');
    const type = resolved.qualified
      ? ts.factory.createQualifiedName(resolved.qualified, typeMapper(resolved.member))
      : typeMapper(resolved.member);
    return ts.factory.createTypeReferenceNode(type, undefined);
  }

  if (schema.oneOf) {
    return ts.factory.createUnionTypeNode(
      schema.oneOf.map(s => generateType(s, ctx, typeMapper))
    );
  }

  if (schema.allOf) {
    return ts.factory.createIntersectionTypeNode(
      schema.allOf.map(s => generateType(s, ctx, typeMapper))
    );
  }

  assert(!schema.anyOf, 'anyOf is not supported');

  if (schema.nullable) {
    return ts.factory.createUnionTypeNode([
      generateType({ ...schema, nullable: false }, ctx, typeMapper),
      ts.factory.createLiteralTypeNode(ts.factory.createNull())
    ]);
  }

  if (schema.type === 'object') {
    return ts.factory.createTypeLiteralNode(
      generateObjectMembers(
        schema.properties,
        schema.required,
        schema.additionalProperties,
        ctx,
        typeMapper
      )
    );
  }

  if (schema.enum) {
    return ts.factory.createUnionTypeNode(
      schema.enum.map(e => {
        return ts.factory.createLiteralTypeNode(generateLiteral(e));
      })
    );
  }

  if (schema.type === 'array') {
    const itemType = generateType(schema.items || {}, ctx, typeMapper);
    return ts.factory.createTypeReferenceNode('ReadonlyArray', [itemType]);
  }

  if (schema.type === 'string') {
    return generateStringType(schema.format);
  }

  if (schema.type === 'integer' || schema.type === 'number') {
    return ts.factory.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword);
  }

  if (schema.type === 'boolean') {
    return ts.factory.createKeywordTypeNode(ts.SyntaxKind.BooleanKeyword);
  }

  // @ts-expect-error schemas really do not have void type. but we do
  if (schema.type === 'void') {
    return ts.factory.createKeywordTypeNode(ts.SyntaxKind.VoidKeyword);
  }

  if (schema.type === 'null') {
    return ts.factory.createLiteralTypeNode(ts.factory.createNull());
  }

  if (!schema.type) {
    return ts.factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword);
  }

  return assert.fail('unknown schema type: ' + schema.type);
}

/**
 * Generates a string type, handling binary format specially.
 */
export function generateStringType(format: string | undefined): ts.TypeNode {
  if (format === 'binary') {
    return ts.factory.createTypeReferenceNode(fromLib('make', 'Binary'), []);
  }
  return ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword);
}

/**
 * Wraps a type with a brand for scalar types.
 */
export function scalarTypeWithBrand(
  key: string,
  type: ts.TypeNode,
  ctx: GenerationContext
): ts.TypeNode {
  const brandName = 'BrandOf' + ctx.options.nameMapper(key, 'value');
  return ts.factory.createTypeReferenceNode(fromLib('BrandedScalar'), [
    type,
    ts.factory.createTypeReferenceNode(brandName, [])
  ]);
}

