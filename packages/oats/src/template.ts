/**
 * Tagged template literal utilities for TypeScript code generation.
 * Provides dedent behavior and array joining for cleaner code generation.
 */

/**
 * Tagged template that normalizes indentation (dedent) and handles array interpolation.
 * Strips common leading whitespace from all lines and joins arrays with newlines.
 *
 * @example
 * ```ts
 * const members = ['a: string', 'b: number'];
 * const code = ts`
 *   interface Foo {
 *     ${members}
 *   }
 * `;
 * // Results in:
 * // interface Foo {
 * //   a: string
 * //   b: number
 * // }
 * ```
 */
export function ts(
  strings: TemplateStringsArray,
  ...values: (string | string[] | undefined | null)[]
): string {
  // Build the raw string with placeholders replaced
  let result = strings[0];
  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    if (Array.isArray(value)) {
      // Detect indentation from the position in the template
      const lastNewline = result.lastIndexOf('\n');
      const currentLineStart = lastNewline >= 0 ? result.slice(lastNewline + 1) : result;
      const indent = currentLineStart.match(/^(\s*)/)?.[1] ?? '';
      result += value.join('\n' + indent);
    } else if (value != null) {
      result += value;
    }
    result += strings[i + 1];
  }

  return dedent(result);
}

/**
 * Removes common leading whitespace from all lines.
 * Also trims the first line if empty and the last line if only whitespace.
 */
function dedent(text: string): string {
  const lines = text.split('\n');

  // Remove first line if empty (common with template literals starting with newline)
  if (lines[0].trim() === '') {
    lines.shift();
  }

  // Remove last line if only whitespace
  if (lines.length > 0 && lines[lines.length - 1].trim() === '') {
    lines.pop();
  }

  if (lines.length === 0) return '';

  // Find minimum indentation (ignoring empty lines)
  let minIndent = Infinity;
  for (const line of lines) {
    if (line.trim() === '') continue;
    const match = line.match(/^(\s*)/);
    if (match) {
      minIndent = Math.min(minIndent, match[1].length);
    }
  }

  if (minIndent === Infinity) minIndent = 0;

  // Strip the common indentation
  return lines.map(line => line.slice(minIndent)).join('\n');
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

