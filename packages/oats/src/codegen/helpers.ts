/**
 * Pure utility functions for code generation with no context dependency.
 */

import * as oas from 'openapi3-ts';
import { NameMapper } from '../util';
import { quoteProp, str } from '../template';

/** Runtime library identifier used in generated code. */
export const runtime = 'oar';

/** Key used for index signatures in value classes. */
export const valueClassIndexSignatureKey = 'instanceIndexSignatureKey';

/** Brand field name for value class type safety. */
export const oatsBrandFieldName = '__oats_value_class_brand_tag';

/** Scalar types that get branded. */
export const scalarTypes = ['string', 'integer', 'number', 'boolean'];

/**
 * Quotes a property name if it contains special characters.
 */
export function quotedProp(prop: string): string {
  return quoteProp(prop);
}

/**
 * Generates a literal value as code string from a JavaScript value.
 */
export function generateLiteral(e: unknown): string {
  if (e === true) return 'true';
  if (e === false) return 'false';
  if (e === null) return 'null';
  if (typeof e === 'string') return str(e);
  if (typeof e === 'bigint') return `${e}n`;
  if (typeof e === 'number') return generateNumericLiteral(e);
  throw new Error(`unsupported enum value: "${e}"`);
}

/**
 * Generates a numeric literal, handling negative numbers with prefix.
 */
export function generateNumericLiteral(value: number | string): string {
  const n = Number(value);
  if (n < 0) {
    return String(n);
  }
  return String(n);
}

/**
 * Creates a qualified name from the runtime library.
 */
export function fromLib(...names: string[]): string {
  return `${runtime}.${names.join('.')}`;
}

/**
 * Creates a call expression to a runtime make function.
 */
export function makeCall(fun: string, args: readonly string[]): string {
  return `${runtime}.make.${fun}(${args.join(', ')})`;
}

/**
 * Creates an any-typed parameter declaration.
 */
export function makeAnyProperty(name: string): string {
  return `${name}: any`;
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
  // eslint-disable-next-line @typescript-eslint/no-var-requires
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
