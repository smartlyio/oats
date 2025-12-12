import * as ts from 'typescript';
import {
  quotedProp,
  generateLiteral,
  generateNumericLiteral,
  fromLib,
  brandTypeName,
  isScalar,
  addIndexSignatureIgnores,
  resolveModule,
  valueClassIndexSignatureKey,
  oatsBrandFieldName
} from '../../src/codegen/helpers';

function printNode(node: ts.Node): string {
  const printer = ts.createPrinter();
  const sourceFile = ts.createSourceFile('test.ts', '', ts.ScriptTarget.Latest);
  return printer.printNode(ts.EmitHint.Unspecified, node, sourceFile);
}

describe('codegen/helpers', () => {
  describe('quotedProp', () => {
    it('returns identifier for simple property names', () => {
      const result = quotedProp('foo');
      expect(ts.isIdentifier(result)).toBe(true);
      expect(printNode(result)).toBe('foo');
    });

    it('returns identifier for names with underscores', () => {
      const result = quotedProp('foo_bar');
      expect(ts.isIdentifier(result)).toBe(true);
      expect(printNode(result)).toBe('foo_bar');
    });

    it('returns identifier for names with numbers', () => {
      const result = quotedProp('foo123');
      expect(ts.isIdentifier(result)).toBe(true);
      expect(printNode(result)).toBe('foo123');
    });

    it('returns string literal for names with dashes', () => {
      const result = quotedProp('foo-bar');
      expect(ts.isStringLiteral(result)).toBe(true);
      expect(printNode(result)).toBe('"foo-bar"');
    });

    it('returns string literal for names with spaces', () => {
      const result = quotedProp('foo bar');
      expect(ts.isStringLiteral(result)).toBe(true);
      expect(printNode(result)).toBe('"foo bar"');
    });

    it('returns identifier for names starting with numbers', () => {
      // Note: quotedProp only quotes based on \W (non-word chars), not leading digits
      // TypeScript identifiers can't start with digits but that's a separate concern
      const result = quotedProp('123foo');
      expect(ts.isIdentifier(result)).toBe(true);
    });
  });

  describe('generateLiteral', () => {
    it('generates true literal', () => {
      const result = generateLiteral(true);
      expect(printNode(result as ts.Node)).toBe('true');
    });

    it('generates false literal', () => {
      const result = generateLiteral(false);
      expect(printNode(result as ts.Node)).toBe('false');
    });

    it('generates null literal', () => {
      const result = generateLiteral(null);
      expect(printNode(result as ts.Node)).toBe('null');
    });

    it('generates string literal', () => {
      const result = generateLiteral('hello');
      expect(printNode(result as ts.Node)).toBe('"hello"');
    });

    it('generates positive number literal', () => {
      const result = generateLiteral(42);
      expect(printNode(result as ts.Node)).toBe('42');
    });

    it('generates negative number literal', () => {
      const result = generateLiteral(-42);
      expect(printNode(result as ts.Node)).toBe('-42');
    });

    it('generates zero literal', () => {
      const result = generateLiteral(0);
      expect(printNode(result as ts.Node)).toBe('0');
    });

    it('throws for unsupported types', () => {
      expect(() => generateLiteral(undefined)).toThrow('unsupported enum value');
      expect(() => generateLiteral({})).toThrow('unsupported enum value');
      expect(() => generateLiteral([])).toThrow('unsupported enum value');
    });
  });

  describe('generateNumericLiteral', () => {
    it('generates positive integer', () => {
      const result = generateNumericLiteral(123);
      expect(printNode(result as ts.Node)).toBe('123');
    });

    it('generates negative integer with prefix', () => {
      const result = generateNumericLiteral(-123);
      expect(printNode(result as ts.Node)).toBe('-123');
    });

    it('generates zero', () => {
      const result = generateNumericLiteral(0);
      expect(printNode(result as ts.Node)).toBe('0');
    });

    it('handles string input', () => {
      const result = generateNumericLiteral('456');
      expect(printNode(result as ts.Node)).toBe('456');
    });

    it('handles negative string input', () => {
      const result = generateNumericLiteral('-789');
      expect(printNode(result as ts.Node)).toBe('-789');
    });
  });

  describe('fromLib', () => {
    it('creates qualified name from single part', () => {
      const result = fromLib('make');
      expect(printNode(result)).toBe('oar.make');
    });

    it('creates qualified name from multiple parts joined with dot', () => {
      const result = fromLib('make', 'Maker');
      expect(printNode(result)).toBe('oar.make.Maker');
    });

    it('creates qualified name for reflection types', () => {
      const result = fromLib('reflection', 'NamedTypeDefinition');
      expect(printNode(result)).toBe('oar.reflection.NamedTypeDefinition');
    });
  });

  describe('brandTypeName', () => {
    it('generates brand type name with nameMapper', () => {
      const nameMapper = (name: string, kind: string) => 
        kind === 'value' ? name.charAt(0).toUpperCase() + name.slice(1) : name;
      
      const result = brandTypeName('myType', nameMapper);
      expect(result).toBe('BrandOfMyType');
    });

    it('handles already capitalized names', () => {
      const nameMapper = (name: string) => name;
      const result = brandTypeName('MyType', nameMapper);
      expect(result).toBe('BrandOfMyType');
    });
  });

  describe('isScalar', () => {
    it('returns true for string type', () => {
      expect(isScalar({ type: 'string' })).toBe(true);
    });

    it('returns true for integer type', () => {
      expect(isScalar({ type: 'integer' })).toBe(true);
    });

    it('returns true for number type', () => {
      expect(isScalar({ type: 'number' })).toBe(true);
    });

    it('returns true for boolean type', () => {
      expect(isScalar({ type: 'boolean' })).toBe(true);
    });

    it('returns false for object type', () => {
      expect(isScalar({ type: 'object' })).toBe(false);
    });

    it('returns false for array type', () => {
      expect(isScalar({ type: 'array' })).toBe(false);
    });

    it('returns false for schema without type', () => {
      expect(isScalar({})).toBe(false);
    });

    it('handles array of types with scalar', () => {
      expect(isScalar({ type: ['string', 'null'] as any })).toBe(true);
    });

    it('handles array of types without scalar', () => {
      expect(isScalar({ type: ['object', 'array'] as any })).toBe(false);
    });
  });

  describe('addIndexSignatureIgnores', () => {
    it('adds ts-ignore before index signature lines', () => {
      const input = `class Foo {
    readonly [${valueClassIndexSignatureKey}: string]: SomeType;
}`;
      const result = addIndexSignatureIgnores(input);
      expect(result).toContain('// @ts-ignore tsc does not like the branding type in index signatures');
      expect(result).toContain(valueClassIndexSignatureKey);
    });

    it('does not add ts-ignore for unknown index signatures', () => {
      const input = `class Foo {
    readonly [${valueClassIndexSignatureKey}: string]: unknown;
}`;
      const result = addIndexSignatureIgnores(input);
      expect(result).not.toContain('// @ts-ignore');
    });

    it('does not add ts-ignore for any index signatures', () => {
      const input = `class Foo {
    readonly [${valueClassIndexSignatureKey}: string]: any;
}`;
      const result = addIndexSignatureIgnores(input);
      expect(result).not.toContain('// @ts-ignore');
    });

    it('adds ts-ignore before brand property', () => {
      const input = `class Foo {
    readonly #${oatsBrandFieldName}!: string;
}`;
      const result = addIndexSignatureIgnores(input);
      expect(result).toContain('// @ts-ignore tsc does not like unused privates');
    });

    it('leaves unrelated lines unchanged', () => {
      const input = `class Foo {
    readonly name: string;
}`;
      const result = addIndexSignatureIgnores(input);
      expect(result).toBe(input);
    });
  });

  describe('resolveModule', () => {
    it('returns package imports unchanged', () => {
      expect(resolveModule('./output.ts', '@smartlyio/oats-runtime')).toBe('@smartlyio/oats-runtime');
    });

    it('resolves relative path in same directory', () => {
      const result = resolveModule('./output/types.ts', './output/other.ts');
      expect(result).toBe('./other.ts');
    });

    it('resolves relative path in parent directory', () => {
      const result = resolveModule('./sub/output.ts', './other.ts');
      expect(result).toBe('../other.ts');
    });

    it('adds ./ prefix when needed', () => {
      const result = resolveModule('./a/b.ts', './a/c.ts');
      expect(result.startsWith('./')).toBe(true);
    });
  });
});

