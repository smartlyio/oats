/**
 * Reflection metadata generation for runtime type information.
 */

import * as ts from 'typescript';
import * as oas from 'openapi3-ts';
import * as assert from 'assert';
import { isReferenceObject } from '../util';
import { GenerationContext } from './context';
import {
  generateNumericLiteral,
  fromLib,
  makeAnyProperty,
  isScalar
} from './helpers';

/**
 * Generates reflection type metadata from a schema.
 * This is recursive and handles all schema types.
 */
export function generateReflectionType(
  schema: oas.SchemaObject | oas.ReferenceObject,
  ctx: GenerationContext
): ts.ObjectLiteralExpression {
  if (isReferenceObject(schema)) {
    const resolved = ctx.resolveRefToTypeName(schema.$ref, 'reflection');
    const type: ts.Expression = resolved.qualified
      ? ts.factory.createPropertyAccessExpression(resolved.qualified, resolved.member)
      : ts.factory.createIdentifier(resolved.member);
    return ts.factory.createObjectLiteralExpression(
      [
        ts.factory.createPropertyAssignment('type', ts.factory.createStringLiteral('named')),
        ts.factory.createPropertyAssignment(
          'reference',
          ts.factory.createArrowFunction(
            undefined,
            undefined,
            [],
            undefined,
            ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
            ts.factory.createBlock([ts.factory.createReturnStatement(type)], false)
          )
        )
      ],
      true
    );
  }

  if (schema.oneOf) {
    return ts.factory.createObjectLiteralExpression(
      [
        ts.factory.createPropertyAssignment('type', ts.factory.createStringLiteral('union')),
        ts.factory.createPropertyAssignment(
          'options',
          ts.factory.createArrayLiteralExpression(
            schema.oneOf.map(s => generateReflectionType(s, ctx)),
            true
          )
        )
      ],
      true
    );
  }

  if (schema.allOf) {
    return ts.factory.createObjectLiteralExpression(
      [
        ts.factory.createPropertyAssignment('type', ts.factory.createStringLiteral('intersection')),
        ts.factory.createPropertyAssignment(
          'options',
          ts.factory.createArrayLiteralExpression(
            schema.allOf.map(s => generateReflectionType(s, ctx)),
            true
          )
        )
      ],
      true
    );
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
    return ts.factory.createObjectLiteralExpression(
      [ts.factory.createPropertyAssignment('type', ts.factory.createStringLiteral('void'))],
      true
    );
  }

  if (schema.type === 'null') {
    return ts.factory.createObjectLiteralExpression(
      [ts.factory.createPropertyAssignment('type', ts.factory.createStringLiteral('null'))],
      true
    );
  }

  if (schema.type === 'string') {
    const enumValues = schema.enum
      ? [
          ts.factory.createPropertyAssignment(
            'enum',
            ts.factory.createArrayLiteralExpression(
              schema.enum.map(value => ts.factory.createStringLiteral(value))
            )
          )
        ]
      : [];

    if (schema.format === 'binary') {
      return ts.factory.createObjectLiteralExpression(
        [ts.factory.createPropertyAssignment('type', ts.factory.createStringLiteral('binary'))],
        true
      );
    }

    const format = schema.format
      ? [
          ts.factory.createPropertyAssignment(
            'format',
            ts.factory.createStringLiteral(schema.format)
          )
        ]
      : [];

    const pattern = schema.pattern
      ? [
          ts.factory.createPropertyAssignment(
            'pattern',
            ts.factory.createStringLiteral(schema.pattern)
          )
        ]
      : [];

    const minLength =
      schema.minLength != null
        ? [
            ts.factory.createPropertyAssignment(
              'minLength',
              generateNumericLiteral(schema.minLength)
            )
          ]
        : [];

    const maxLength =
      schema.maxLength != null
        ? [
            ts.factory.createPropertyAssignment(
              'maxLength',
              generateNumericLiteral(schema.maxLength)
            )
          ]
        : [];

    return ts.factory.createObjectLiteralExpression(
      [
        ts.factory.createPropertyAssignment('type', ts.factory.createStringLiteral('string')),
        ...enumValues,
        ...format,
        ...pattern,
        ...minLength,
        ...maxLength
      ],
      true
    );
  }

  if (schema.type === 'number' || schema.type === 'integer') {
    const enumValues = schema.enum
      ? [
          ts.factory.createPropertyAssignment(
            'enum',
            ts.factory.createArrayLiteralExpression(
              schema.enum.map(i => generateNumericLiteral('' + i))
            )
          )
        ]
      : [];

    const properties = [
      ts.factory.createPropertyAssignment('type', ts.factory.createStringLiteral(schema.type)),
      ...enumValues
    ];

    if (schema.minimum != null) {
      properties.push(
        ts.factory.createPropertyAssignment('minimum', generateNumericLiteral(schema.minimum + ''))
      );
    }

    if (schema.maximum != null) {
      properties.push(
        ts.factory.createPropertyAssignment('maximum', generateNumericLiteral(schema.maximum + ''))
      );
    }

    return ts.factory.createObjectLiteralExpression(properties, true);
  }

  if (schema.type === 'boolean') {
    const enumValues = schema.enum
      ? [
          ts.factory.createPropertyAssignment(
            'enum',
            ts.factory.createArrayLiteralExpression(
              schema.enum.map(i =>
                i === true
                  ? ts.factory.createTrue()
                  : i === false
                  ? ts.factory.createFalse()
                  : assert.fail('unknown enum ' + i)
              )
            )
          )
        ]
      : [];

    return ts.factory.createObjectLiteralExpression(
      [
        ts.factory.createPropertyAssignment('type', ts.factory.createStringLiteral('boolean')),
        ...enumValues
      ],
      true
    );
  }

  if (schema.type === 'array') {
    const properties = [
      ts.factory.createPropertyAssignment('type', ts.factory.createStringLiteral('array')),
      ts.factory.createPropertyAssignment('items', generateReflectionType(schema.items || {}, ctx))
    ];

    if (schema.minItems != null) {
      properties.push(
        ts.factory.createPropertyAssignment('minItems', generateNumericLiteral(schema.minItems + ''))
      );
    }

    if (schema.maxItems != null) {
      properties.push(
        ts.factory.createPropertyAssignment('maxItems', generateNumericLiteral(schema.maxItems + ''))
      );
    }

    return ts.factory.createObjectLiteralExpression(properties, true);
  }

  if (schema.type === 'object') {
    return generateObjectReflectionType(schema, ctx);
  }

  if (!schema.type) {
    return ts.factory.createObjectLiteralExpression(
      [ts.factory.createPropertyAssignment('type', ts.factory.createStringLiteral('unknown'))],
      true
    );
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
): ts.Expression {
  if (props === false) {
    return ts.factory.createFalse();
  }
  if (props === true || !props || (props && typeof props === 'object' && Object.keys(props).length === 0)) {
    return ts.factory.createTrue();
  }
  return generateReflectionType(props, ctx);
}

/**
 * Generates reflection type for an object schema.
 */
export function generateObjectReflectionType(
  schema: oas.SchemaObject,
  ctx: GenerationContext
): ts.ObjectLiteralExpression {
  const { options } = ctx;
  const additionalProps = generateAdditionalPropsReflectionType(schema.additionalProperties, ctx);

  return ts.factory.createObjectLiteralExpression(
    [
      ts.factory.createPropertyAssignment('type', ts.factory.createStringLiteral('object')),
      ts.factory.createPropertyAssignment('additionalProperties', additionalProps),
      ts.factory.createPropertyAssignment(
        'properties',
        ts.factory.createObjectLiteralExpression(
          Object.keys(schema.properties || {}).map((propertyName: string) => {
            return ts.factory.createPropertyAssignment(
              ts.factory.createStringLiteral(
                options.propertyNameMapper
                  ? options.propertyNameMapper(propertyName)
                  : propertyName
              ),
              ts.factory.createObjectLiteralExpression(
                [
                  ts.factory.createPropertyAssignment(
                    'required',
                    (schema.required || []).indexOf(propertyName) >= 0
                      ? ts.factory.createTrue()
                      : ts.factory.createFalse()
                  ),
                  ...(options.propertyNameMapper
                    ? [
                        ts.factory.createPropertyAssignment(
                          'networkName',
                          ts.factory.createStringLiteral(propertyName)
                        )
                      ]
                    : []),
                  ts.factory.createPropertyAssignment(
                    'value',
                    generateReflectionType(
                      (schema.properties as Record<string, oas.SchemaObject | oas.ReferenceObject>)[
                        propertyName
                      ],
                      ctx
                    )
                  )
                ],
                true
              )
            );
          }),
          true
        )
      )
    ],
    true
  );
}

/**
 * Creates the fromReflection call for a maker.
 */
export function generateReflectionMaker(key: string, ctx: GenerationContext): ts.Expression {
  const { options } = ctx;
  return ts.factory.createCallExpression(
    ts.factory.createPropertyAccessExpression(
      ts.factory.createIdentifier('oar'),
      ts.factory.createIdentifier('fromReflection')
    ),
    undefined,
    [
      ts.factory.createPropertyAccessExpression(
        ts.factory.createIdentifier(options.nameMapper(key, 'reflection')),
        ts.factory.createIdentifier('definition')
      )
    ]
  );
}

/**
 * Generates the named type definition declaration.
 */
export function generateNamedTypeDefinitionDeclaration(
  key: string,
  schema: oas.SchemaObject | oas.ReferenceObject,
  ctx: GenerationContext
): ts.VariableStatement {
  const { options } = ctx;
  const isA = inventIsA(key, schema, ctx);

  return ts.factory.createVariableStatement(
    [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
    ts.factory.createVariableDeclarationList(
      [
        ts.factory.createVariableDeclaration(
          options.nameMapper(key, 'reflection'),
          undefined,
          ts.factory.createTypeReferenceNode(fromLib('reflection', 'NamedTypeDefinition'), [
            ts.factory.createTypeReferenceNode(options.nameMapper(key, 'value'), []),
            ts.factory.createTypeReferenceNode(options.nameMapper(key, 'shape'), [])
          ]),
          ts.factory.createAsExpression(
            ts.factory.createObjectLiteralExpression(
              [
                ts.factory.createPropertyAssignment(
                  'name',
                  ts.factory.createStringLiteral(options.nameMapper(key, 'value'))
                ),
                ts.factory.createPropertyAssignment('definition', generateReflectionType(schema, ctx)),
                ts.factory.createPropertyAssignment(
                  'maker',
                  ts.factory.createIdentifier('make' + options.nameMapper(key, 'value'))
                ),
                ts.factory.createPropertyAssignment('isA', isA ?? ts.factory.createNull())
              ],
              true
            ),
            ts.factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword)
          )
        )
      ],
      ts.NodeFlags.Const
    )
  );
}

/**
 * Determines the appropriate isA function for a schema.
 */
export function inventIsA(
  key: string,
  schema: oas.SchemaObject | oas.ReferenceObject,
  ctx: GenerationContext
): ts.ArrowFunction | undefined {
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
export function generateIsA(type: string): ts.ArrowFunction {
  return ts.factory.createArrowFunction(
    undefined,
    undefined,
    [makeAnyProperty('value')],
    undefined,
    ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
    ts.factory.createBinaryExpression(
      ts.factory.createIdentifier('value'),
      ts.factory.createToken(ts.SyntaxKind.InstanceOfKeyword),
      ts.factory.createIdentifier(type)
    )
  );
}

/**
 * Generates a maker-based isA function for scalar types.
 */
export function generateIsAForScalar(key: string, ctx: GenerationContext): ts.ArrowFunction {
  const { options } = ctx;
  return ts.factory.createArrowFunction(
    undefined,
    undefined,
    [makeAnyProperty('value')],
    undefined,
    ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
    ts.factory.createCallExpression(
      ts.factory.createPropertyAccessExpression(
        ts.factory.createCallExpression(
          ts.factory.createIdentifier('make' + options.nameMapper(key, 'value')),
          undefined,
          [ts.factory.createIdentifier('value')]
        ),
        'isSuccess'
      ),
      undefined,
      []
    )
  );
}

