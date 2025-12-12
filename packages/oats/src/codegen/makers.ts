/**
 * Maker function and top-level type generation.
 */

import * as ts from 'typescript';
import * as oas from 'openapi3-ts';
import { isReferenceObject, nonNullableClass } from '../util';
import { GenerationContext } from './context';
import { fromLib, makeCall, isScalar } from './helpers';
import { generateType, scalarTypeWithBrand } from './types';
import { generateValueClass } from './classes';
import {
  generateReflectionMaker,
  generateNamedTypeDefinitionDeclaration
} from './reflection';

/**
 * Generates the ShapeOf type alias.
 */
export function generateTypeShape(
  key: string,
  valueIdentifier: string,
  ctx: GenerationContext
): ts.TypeAliasDeclaration {
  const { options } = ctx;

  return ts.factory.createTypeAliasDeclaration(
    [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
    options.nameMapper(key, 'shape'),
    undefined,
    ts.factory.createTypeReferenceNode(fromLib('ShapeOf'), [
      ts.factory.createTypeReferenceNode(valueIdentifier, [])
    ])
  );
}

/**
 * Generates an empty enum for branding scalar types.
 */
export function generateBrand(key: string, ctx: GenerationContext): ts.EnumDeclaration {
  const brandName = 'BrandOf' + ctx.options.nameMapper(key, 'value');
  return ts.factory.createEnumDeclaration(undefined, brandName, []);
}

/**
 * Generates the class builder function.
 */
export function generateTopLevelClassBuilder(
  key: string,
  valueIdentifier: string,
  ctx: GenerationContext
): ts.VariableStatement {
  return generateTopLevelMaker(key, ctx, 'build', valueIdentifier);
}

/**
 * Generates a maker variable that references the class's make method.
 */
export function generateTopLevelClassMaker(
  key: string,
  valueIdentifier: string,
  ctx: GenerationContext
): ts.VariableStatement {
  const { options } = ctx;
  const shape = options.nameMapper(key, 'shape');

  return ts.factory.createVariableStatement(
    [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
    ts.factory.createVariableDeclarationList(
      [
        ts.factory.createVariableDeclaration(
          'make' + valueIdentifier,
          undefined,
          ts.factory.createTypeReferenceNode(fromLib('make', 'Maker'), [
            ts.factory.createTypeReferenceNode(shape, []),
            ts.factory.createTypeReferenceNode(valueIdentifier, [])
          ]),
          ts.factory.createPropertyAccessExpression(
            ts.factory.createIdentifier(valueIdentifier),
            'make'
          )
        )
      ],
      ts.NodeFlags.Const
    )
  );
}

/**
 * Generates a maker function declaration.
 */
export function generateTopLevelMaker(
  key: string,
  ctx: GenerationContext,
  name = 'make',
  resultType?: string
): ts.VariableStatement {
  const { options } = ctx;
  const makerFun = 'createMaker';
  const shape = options.nameMapper(key, 'shape');
  resultType = resultType || options.nameMapper(key, 'value');

  return ts.factory.createVariableStatement(
    [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
    ts.factory.createVariableDeclarationList(
      [
        ts.factory.createVariableDeclaration(
          name + options.nameMapper(key, 'value'),
          undefined,
          ts.factory.createTypeReferenceNode(fromLib('make', 'Maker'), [
            ts.factory.createTypeReferenceNode(shape, []),
            ts.factory.createTypeReferenceNode(resultType, [])
          ]),
          makeCall(makerFun, [
            ts.factory.createFunctionExpression(
              undefined,
              undefined,
              undefined,
              undefined,
              [],
              undefined,
              ts.factory.createBlock([
                ts.factory.createReturnStatement(generateReflectionMaker(key, ctx))
              ])
            )
          ])
        )
      ],
      ts.NodeFlags.Const
    )
  );
}

/**
 * Generates a complete class with all supporting types and makers.
 */
export function generateTopLevelClass(
  key: string,
  schema: oas.SchemaObject,
  ctx: GenerationContext
): readonly ts.Node[] {
  const { options } = ctx;

  if (schema.nullable) {
    const classKey = nonNullableClass(key);
    const proxy = generateTopLevelType(key, {
      oneOf: [{ type: 'null' }, { $ref: '#/components/schemas/' + classKey }]
    }, ctx);
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
): readonly ts.Node[] {
  const { options } = ctx;
  const valueIdentifier = options.nameMapper(key, 'value');

  if (isReferenceObject(schema)) {
    const resolved = ctx.resolveRefToTypeName(schema.$ref, 'value');
    const type = resolved.qualified
      ? ts.factory.createQualifiedName(resolved.qualified, resolved.member)
      : resolved.member;

    return [
      ts.factory.createTypeAliasDeclaration(
        [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
        valueIdentifier,
        undefined,
        ts.factory.createTypeReferenceNode(type, undefined)
      ),
      generateTypeShape(key, valueIdentifier, ctx),
      generateTopLevelMaker(key, ctx),
      generateNamedTypeDefinitionDeclaration(key, schema, ctx)
    ];
  }

  if (schema.type === 'object') {
    return generateTopLevelClass(key, schema, ctx);
  }

  if (isScalar(schema)) {
    return [
      generateBrand(key, ctx),
      ts.factory.createTypeAliasDeclaration(
        [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
        options.nameMapper(key, 'value'),
        undefined,
        scalarTypeWithBrand(key, generateType(schema, ctx), ctx)
      ),
      generateTypeShape(key, valueIdentifier, ctx),
      generateTopLevelMaker(key, ctx),
      generateNamedTypeDefinitionDeclaration(key, schema, ctx)
    ];
  }

  return [
    ts.factory.createTypeAliasDeclaration(
      [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
      options.nameMapper(key, 'value'),
      undefined,
      generateType(schema, ctx)
    ),
    generateTypeShape(key, valueIdentifier, ctx),
    generateTopLevelMaker(key, ctx),
    generateNamedTypeDefinitionDeclaration(key, schema, ctx)
  ];
}

