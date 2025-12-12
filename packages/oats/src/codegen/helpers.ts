/**
 * Pure utility functions for code generation with no context dependency.
 */

import * as ts from 'typescript';
import * as oas from 'openapi3-ts';
import { NameMapper } from '../util';

/** Runtime library identifier used in generated code. */
export const runtime = 'oar';
export const runtimeLibrary = ts.factory.createIdentifier(runtime);

/** Readonly modifier array for reuse. */
export const readonlyModifier = [ts.factory.createModifier(ts.SyntaxKind.ReadonlyKeyword)];

/** Key used for index signatures in value classes. */
export const valueClassIndexSignatureKey = 'instanceIndexSignatureKey';

/** Brand field name for value class type safety. */
export const oatsBrandFieldName = '__oats_value_class_brand_tag';

/** Scalar types that get branded. */
export const scalarTypes = ['string', 'integer', 'number', 'boolean'];

/**
 * Quotes a property name if it contains special characters.
 */
export function quotedProp(prop: string): ts.StringLiteral | ts.Identifier {
  if (/\W/.test(prop)) {
    return ts.factory.createStringLiteral(prop);
  }
  return ts.factory.createIdentifier(prop);
}

/**
 * Generates a literal AST node from a JavaScript value.
 */
export function generateLiteral(e: unknown): ts.LiteralTypeNode['literal'] {
  const type = typeof e;
  if (e === true) return ts.factory.createTrue();
  if (e === false) return ts.factory.createFalse();
  if (e === null) return ts.factory.createNull();
  if (type === 'string') return ts.factory.createStringLiteral(e as string);
  if (type === 'bigint') return ts.factory.createBigIntLiteral(e as string);
  if (type === 'number') return generateNumericLiteral(e as number);
  throw new Error(`unsupported enum value: "${e}"`);
}

/**
 * Generates a numeric literal, handling negative numbers with prefix.
 */
export function generateNumericLiteral(value: number | string): ts.LiteralTypeNode['literal'] {
  value = Number(value);
  if (value < 0) {
    return ts.factory.createPrefixUnaryExpression(
      ts.SyntaxKind.MinusToken,
      ts.factory.createNumericLiteral(Math.abs(value))
    );
  }
  return ts.factory.createNumericLiteral(value);
}

/**
 * Creates a qualified name from the runtime library.
 */
export function fromLib(...names: string[]): ts.QualifiedName {
  return ts.factory.createQualifiedName(runtimeLibrary, names.join('.'));
}

/**
 * Creates a call expression to a runtime make function.
 */
export function makeCall(fun: string, args: readonly ts.Expression[]): ts.CallExpression {
  return ts.factory.createCallExpression(
    ts.factory.createPropertyAccessExpression(runtimeLibrary, 'make.' + fun),
    undefined,
    args
  );
}

/**
 * Creates an any-typed parameter declaration.
 */
export function makeAnyProperty(name: string): ts.ParameterDeclaration {
  return ts.factory.createParameterDeclaration(
    undefined,
    undefined,
    ts.factory.createIdentifier(name),
    undefined,
    ts.factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword),
    undefined
  );
}

/**
 * Generates the brand type name for a given key.
 */
export function brandTypeName(key: string, nameMapper: NameMapper): string {
  return 'BrandOf' + nameMapper(key, 'value');
}

/**
 * Checks if a schema represents a scalar type.
 */
export function isScalar(schema: oas.SchemaObject): boolean {
  if (!schema.type) return false;
  if (Array.isArray(schema.type)) {
    return schema.type.findIndex(t => scalarTypes.includes(t)) >= 0;
  }
  return scalarTypes.includes(schema.type);
}

/**
 * Post-processes generated source to add ts-ignore comments where needed.
 */
export function addIndexSignatureIgnores(src: string): string {
  const result: string[] = [];
  src.split('\n').forEach(line => {
    const m = line.match(new RegExp('\\[\\s*' + valueClassIndexSignatureKey));
    if (m) {
      if (!/\b(unknown|any)\b/.test(line)) {
        result.push('    // @ts-ignore tsc does not like the branding type in index signatures');
        result.push(line);
        return;
      }
    }
    const brandMatch = line.match(new RegExp('\\s*readonly #' + oatsBrandFieldName));
    if (brandMatch) {
      result.push('    // @ts-ignore tsc does not like unused privates');
      result.push(line);
      return;
    }
    result.push(line);
  });
  return result.join('\n');
}

/**
 * Resolves module path for imports.
 */
export function resolveModule(fromModule: string, toModule: string): string {
  const path = require('path');
  if (!toModule.startsWith('.')) {
    return toModule;
  }
  const p = path.relative(path.dirname(fromModule), toModule);
  if (p[0] === '.') {
    return p;
  }
  return './' + p;
}

