import { ts, raw, quoteProp, str, when, join } from '../src/template';

describe('template utilities', () => {
  describe('ts tagged template', () => {
    it('formats code with Prettier', () => {
      const result = ts`const x = 1; const y = 2;`;
      // Prettier formats as separate lines
      expect(result).toBe('const x = 1;\nconst y = 2;');
    });

    it('handles single declaration', () => {
      const result = ts`const x = 1;`;
      expect(result).toBe('const x = 1;');
    });

    it('formats function declarations', () => {
      const result = ts`function foo() { return 1; }`;
      // Prettier will format multi-line
      expect(result).toContain('function foo()');
      expect(result).toContain('return 1;');
    });

    it('interpolates string values', () => {
      const name = 'myVar';
      const result = ts`const ${name} = 1;`;
      expect(result).toBe('const myVar = 1;');
    });

    it('interpolates arrays by joining with newlines', () => {
      const members = ['a: string;', 'b: number;'];
      const result = ts`interface Foo { ${members} }`;
      // Prettier formats interface members
      expect(result).toContain('interface Foo');
      expect(result).toContain('a: string;');
      expect(result).toContain('b: number;');
    });

    it('handles empty arrays', () => {
      const members: string[] = [];
      const result = ts`interface Foo { ${members} }`;
      expect(result).toBe('interface Foo {}');
    });

    it('handles null and undefined values by omitting them', () => {
      const maybeValue: string | null = null;
      const maybeUndefined: string | undefined = undefined;
      const result = ts`const x = "prefix${maybeValue}${maybeUndefined}suffix";`;
      expect(result).toContain('prefixsuffix');
    });

    it('handles nested templates', () => {
      const inner = 'nested: true,';
      const result = ts`const obj = { ${inner} outer: false };`;
      expect(result).toContain('nested: true');
      expect(result).toContain('outer: false');
    });

    it('formats type definitions', () => {
      const typeName = 'MyType';
      const result = ts`type ${typeName} = { x: number; y: number; };`;
      expect(result).toContain('type MyType');
      expect(result).toContain('x: number');
      expect(result).toContain('y: number');
    });

    it('uses single quotes by default', () => {
      const result = ts`const x = { name: "foo" };`;
      // Prettier config uses singleQuote: true
      expect(result).toContain("name: 'foo'");
    });
  });

  describe('raw tagged template', () => {
    it('concatenates without formatting', () => {
      const result = raw`const x = 1; const y = 2;`;
      expect(result).toBe('const x = 1; const y = 2;');
    });

    it('interpolates string values', () => {
      const name = 'myVar';
      const result = raw`const ${name} = 1;`;
      expect(result).toBe('const myVar = 1;');
    });

    it('interpolates arrays by joining with newlines', () => {
      const members = ['a: string', 'b: number'];
      const result = raw`interface Foo { ${members} }`;
      expect(result).toBe('interface Foo { a: string\nb: number }');
    });

    it('handles empty arrays', () => {
      const members: string[] = [];
      const result = raw`interface Foo { ${members} }`;
      expect(result).toBe('interface Foo {  }');
    });

    it('handles null and undefined values by omitting them', () => {
      const maybeValue: string | null = null;
      const maybeUndefined: string | undefined = undefined;
      const result = raw`prefix${maybeValue}${maybeUndefined}suffix`;
      expect(result).toBe('prefixsuffix');
    });

    it('preserves whitespace exactly', () => {
      const result = raw`
        some
        indented
        content
      `;
      expect(result).toBe('\n        some\n        indented\n        content\n      ');
    });
  });

  describe('quoteProp', () => {
    it('returns simple identifiers unchanged', () => {
      expect(quoteProp('foo')).toBe('foo');
      expect(quoteProp('_private')).toBe('_private');
      expect(quoteProp('$jquery')).toBe('$jquery');
      expect(quoteProp('camelCase')).toBe('camelCase');
      expect(quoteProp('PascalCase')).toBe('PascalCase');
      expect(quoteProp('with123numbers')).toBe('with123numbers');
    });

    it('quotes properties starting with numbers', () => {
      expect(quoteProp('123abc')).toBe('"123abc"');
      expect(quoteProp('0')).toBe('"0"');
    });

    it('quotes properties with special characters', () => {
      expect(quoteProp('with-dash')).toBe('"with-dash"');
      expect(quoteProp('with.dot')).toBe('"with.dot"');
      expect(quoteProp('with space')).toBe('"with space"');
      expect(quoteProp('/path/like')).toBe('"/path/like"');
      expect(quoteProp('has:colon')).toBe('"has:colon"');
    });

    it('handles empty string', () => {
      expect(quoteProp('')).toBe('""');
    });
  });

  describe('str', () => {
    it('creates JSON string literals', () => {
      expect(str('hello')).toBe('"hello"');
      expect(str('')).toBe('""');
    });

    it('escapes special characters', () => {
      expect(str('line1\nline2')).toBe('"line1\\nline2"');
      expect(str('tab\there')).toBe('"tab\\there"');
      expect(str('quote"here')).toBe('"quote\\"here"');
      expect(str('back\\slash')).toBe('"back\\\\slash"');
    });

    it('handles unicode', () => {
      expect(str('émoji 🎉')).toBe('"émoji 🎉"');
    });
  });

  describe('when', () => {
    it('returns content when condition is true', () => {
      expect(when(true, 'included')).toBe('included');
    });

    it('returns empty string when condition is false', () => {
      expect(when(false, 'excluded')).toBe('');
    });

    it('returns empty string for null condition', () => {
      expect(when(null, 'excluded')).toBe('');
    });

    it('returns empty string for undefined condition', () => {
      expect(when(undefined, 'excluded')).toBe('');
    });

    it('treats truthy values as true', () => {
      expect(when(1 as unknown as boolean, 'included')).toBe('included');
      expect(when('yes' as unknown as boolean, 'included')).toBe('included');
    });
  });

  describe('join', () => {
    it('joins strings with separator', () => {
      expect(join(['a', 'b', 'c'], ', ')).toBe('a, b, c');
    });

    it('filters out null values', () => {
      expect(join(['a', null, 'c'], ', ')).toBe('a, c');
    });

    it('filters out undefined values', () => {
      expect(join(['a', undefined, 'c'], ', ')).toBe('a, c');
    });

    it('filters out empty strings', () => {
      expect(join(['a', '', 'c'], ', ')).toBe('a, c');
    });

    it('handles empty array', () => {
      expect(join([], ', ')).toBe('');
    });

    it('handles array with single element', () => {
      expect(join(['only'], ', ')).toBe('only');
    });

    it('handles newline separator', () => {
      expect(join(['line1', 'line2'], '\n')).toBe('line1\nline2');
    });
  });
});
