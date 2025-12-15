/**
 * Test utilities for codegen tests.
 * Uses Prettier to normalize TypeScript code for comparison.
 */

import * as prettier from 'prettier';

const PRETTIER_CONFIG: prettier.Options = {
  parser: 'typescript',
  singleQuote: true,
  printWidth: 100,
  tabWidth: 4,
  trailingComma: 'none'
};

/**
 * Formats TypeScript code using Prettier for normalized comparison.
 * Trims and normalizes whitespace so tests don't depend on exact formatting.
 */
export async function format(code: string): Promise<string> {
  const formatted = await prettier.format(code, PRETTIER_CONFIG);
  return formatted.trim();
}

/**
 * Asserts that two TypeScript code strings are equivalent after formatting.
 */
export async function expectCodeEqual(actual: string, expected: string): Promise<void> {
  const formattedActual = await format(actual);
  const formattedExpected = await format(expected);
  expect(formattedActual).toBe(formattedExpected);
}

