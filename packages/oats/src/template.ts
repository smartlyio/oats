/**
 * Tagged template literal utilities for TypeScript code generation.
 * Uses Prettier for consistent formatting of complete statements.
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const prettier = require('prettier') as {
  format: (source: string, options: Record<string, unknown>) => string;
};

/** Fixed Prettier config to ensure consistent output regardless of project settings. */
const PRETTIER_CONFIG = {
  parser: 'typescript',
  singleQuote: true,
  printWidth: 100,
  tabWidth: 4,
  trailingComma: 'none'
};

/**
 * Tagged template that builds strings with array interpolation.
 * Does NOT run Prettier - use for code fragments that aren't complete statements.
 */
export function raw(
  strings: TemplateStringsArray,
  ...values: (string | readonly string[] | undefined | null)[]
): string {
  let result = strings[0];
  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    if (Array.isArray(value)) {
      result += value.join('\n');
    } else if (value != null) {
      result += value;
    }
    result += strings[i + 1];
  }
  return result;
}

/**
 * Tagged template that formats TypeScript code using Prettier.
 * Use for complete statements/declarations that can be parsed as valid TypeScript.
 */
export function ts(
  strings: TemplateStringsArray,
  ...values: (string | readonly string[] | undefined | null)[]
): string {
  const result = raw(strings, ...values);
  return prettier.format(result, PRETTIER_CONFIG).trim();
}

/**
 * Helper to quote a property name if it contains special characters.
 */
export function quoteProp(name: string): string {
  if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name)) {
    return name;
  }
  return JSON.stringify(name);
}

/**
 * Helper to create a string literal in generated code.
 */
export function str(value: string): string {
  return JSON.stringify(value);
}

/**
 * Conditionally include content in template.
 */
export function when(condition: boolean | undefined | null, content: string): string {
  return condition ? content : '';
}

/**
 * Join array elements with a separator, filtering out empty strings.
 */
export function join(items: (string | undefined | null)[], separator: string): string {
  return items.filter(item => item != null && item !== '').join(separator);
}
