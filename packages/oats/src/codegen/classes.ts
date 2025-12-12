/**
 * Value class generation for TypeScript output.
 */

import * as ts from 'typescript';
import * as oas from 'openapi3-ts';
import { GenerationContext } from './context';
import { runtime, runtimeLibrary, fromLib } from './helpers';
import { generateClassMembers } from './types';
import { buildMethod } from '../builder';

/**
 * Generates a complete value class declaration.
 */
export function generateValueClass(
  key: string,
  valueIdentifier: string,
  schema: oas.SchemaObject,
  ctx: GenerationContext
): ts.ClassDeclaration {
  const members = generateClassMembers(
    schema.properties,
    schema.required,
    schema.additionalProperties,
    ctx
  );

  const brand = ts.factory.createExpressionWithTypeArguments(
    ts.factory.createPropertyAccessExpression(runtimeLibrary, 'valueClass.ValueClass'),
    []
  );

  return ts.factory.createClassDeclaration(
    [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
    valueIdentifier,
    [],
    [ts.factory.createHeritageClause(ts.SyntaxKind.ExtendsKeyword, [brand])],
    [...members, ...generateClassBuiltinMembers(key, ctx)]
  );
}

/**
 * Generates the class constructor method.
 */
export function generateClassConstructor(key: string, ctx: GenerationContext): ts.MethodDeclaration {
  const { options } = ctx;

  return ts.factory.createMethodDeclaration(
    [ts.factory.createModifier(ts.SyntaxKind.PublicKeyword)],
    undefined,
    'constructor',
    undefined,
    undefined,
    [
      ts.factory.createParameterDeclaration(
        undefined,
        undefined,
        'value',
        undefined,
        ts.factory.createTypeReferenceNode(options.nameMapper(key, 'shape'), [])
      ),
      ts.factory.createParameterDeclaration(
        undefined,
        undefined,
        'opts',
        ts.factory.createToken(ts.SyntaxKind.QuestionToken),
        ts.factory.createUnionTypeNode([
          ts.factory.createTypeReferenceNode(fromLib('make', 'MakeOptions'), []),
          ts.factory.createTypeReferenceNode(
            ts.factory.createIdentifier('InternalUnsafeConstructorOption'),
            undefined
          )
        ])
      )
    ],
    undefined,
    ts.factory.createBlock([
      ts.factory.createExpressionStatement(
        ts.factory.createCallExpression(ts.factory.createIdentifier('super'), [], [])
      ),
      ts.factory.createExpressionStatement(
        ts.factory.createCallExpression(
          ts.factory.createPropertyAccessExpression(
            ts.factory.createIdentifier('oar'),
            'instanceAssign'
          ),
          [],
          [
            ts.factory.createThis(),
            ts.factory.createIdentifier('value'),
            ts.factory.createIdentifier('opts'),
            ts.factory.createIdentifier('build' + options.nameMapper(key, 'value'))
          ]
        )
      )
    ])
  );
}

/**
 * Generates the static reflection property.
 */
export function generateReflectionProperty(
  key: string,
  ctx: GenerationContext
): ts.PropertyDeclaration {
  const { options } = ctx;

  return ts.factory.createPropertyDeclaration(
    [
      ts.factory.createModifier(ts.SyntaxKind.PublicKeyword),
      ts.factory.createModifier(ts.SyntaxKind.StaticKeyword)
    ],
    ts.factory.createIdentifier('reflection'),
    undefined,
    ts.factory.createTypeReferenceNode(fromLib('reflection', 'NamedTypeDefinitionDeferred'), [
      ts.factory.createTypeReferenceNode(
        ts.factory.createIdentifier(options.nameMapper(key, 'value')),
        []
      )
    ]),
    ts.factory.createArrowFunction(
      undefined,
      undefined,
      [],
      undefined,
      ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
      ts.factory.createBlock(
        [
          ts.factory.createReturnStatement(
            ts.factory.createIdentifier(options.nameMapper(key, 'reflection'))
          )
        ],
        false
      )
    )
  );
}

/**
 * Generates the static make method using a template.
 */
export function generateClassMakeMethod(key: string, ctx: GenerationContext): ts.MethodDeclaration {
  const { options } = ctx;
  const className = options.nameMapper(key, 'value');
  const shapeName = options.nameMapper(key, 'shape');

  return buildMethod(`
    static make(value: ${shapeName}, opts?: ${runtime}.make.MakeOptions): ${runtime}.make.Make<${className}> {
      if (value instanceof ${className}) { 
        return ${runtime}.make.Make.ok(value);
      }
      const make = build${className}(value, opts); 
      if (make.isError()) {
        return ${runtime}.make.Make.error(make.errors);
      } else {
        return ${runtime}.make.Make.ok(new ${className}(make.success(), { unSafeSet: true }));
      }
    }
  `);
}

/**
 * Generates all built-in class members (constructor, reflection, make).
 */
export function generateClassBuiltinMembers(
  key: string,
  ctx: GenerationContext
): ts.ClassElement[] {
  return [
    generateClassConstructor(key, ctx),
    generateReflectionProperty(key, ctx),
    generateClassMakeMethod(key, ctx)
  ];
}

