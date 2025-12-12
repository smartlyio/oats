import {
  createContext,
  GenerationState,
  Options,
  AdditionalPropertiesIndexSignature
} from '../../src/codegen/context';
import {
  generateType,
  generateStringType,
  generateAdditionalPropType,
  generateObjectMembers
} from '../../src/codegen/types';

function printNode(node: string): string {
  return node;
}

function createTestContext(optionOverrides: Partial<Options> = {}) {
  const options: Options = {
    header: '',
    sourceFile: './test.yaml',
    targetFile: './test.generated.ts',
    resolve: () => undefined,
    oas: { openapi: '3.0.0', info: { title: 'Test', version: '1.0.0' }, paths: {} },
    runtimeModule: '@smartlyio/oats-runtime',
    emitStatusCode: () => true,
    nameMapper: (name, kind) => {
      const capitalized = name.charAt(0).toUpperCase() + name.slice(1);
      if (kind === 'shape') return 'ShapeOf' + capitalized;
      if (kind === 'reflection') return 'type' + capitalized;
      return capitalized;
    },
    ...optionOverrides
  };

  const state: GenerationState = {
    cwd: '.',
    imports: {},
    actions: []
  };

  return createContext(options, state, new Set());
}

describe('codegen/types', () => {
  describe('generateType', () => {
    it('generates string type', () => {
      const ctx = createTestContext();
      const result = generateType({ type: 'string' }, ctx);
      expect(printNode(result)).toBe('string');
    });

    it('generates number type for integer', () => {
      const ctx = createTestContext();
      const result = generateType({ type: 'integer' }, ctx);
      expect(printNode(result)).toBe('number');
    });

    it('generates number type for number', () => {
      const ctx = createTestContext();
      const result = generateType({ type: 'number' }, ctx);
      expect(printNode(result)).toBe('number');
    });

    it('generates boolean type', () => {
      const ctx = createTestContext();
      const result = generateType({ type: 'boolean' }, ctx);
      expect(printNode(result)).toBe('boolean');
    });

    it('generates void type', () => {
      const ctx = createTestContext();
      const result = generateType({ type: 'void' as any }, ctx);
      expect(printNode(result)).toBe('void');
    });

    it('generates null type', () => {
      const ctx = createTestContext();
      const result = generateType({ type: 'null' }, ctx);
      expect(printNode(result)).toBe('null');
    });

    it('generates unknown for missing type', () => {
      const ctx = createTestContext();
      const result = generateType({}, ctx);
      expect(printNode(result)).toBe('unknown');
    });

    it('generates array type', () => {
      const ctx = createTestContext();
      const result = generateType({ type: 'array', items: { type: 'string' } }, ctx);
      expect(printNode(result)).toBe('ReadonlyArray<string>');
    });

    it('generates array type with unknown items when items missing', () => {
      const ctx = createTestContext();
      const result = generateType({ type: 'array' }, ctx);
      expect(printNode(result)).toBe('ReadonlyArray<unknown>');
    });

    it('generates nested array type', () => {
      const ctx = createTestContext();
      const result = generateType(
        {
          type: 'array',
          items: { type: 'array', items: { type: 'number' } }
        },
        ctx
      );
      expect(printNode(result)).toBe('ReadonlyArray<ReadonlyArray<number>>');
    });

    it('generates enum type from string values', () => {
      const ctx = createTestContext();
      const result = generateType({ enum: ['a', 'b', 'c'] }, ctx);
      expect(printNode(result)).toBe('"a" | "b" | "c"');
    });

    it('generates enum type from number values', () => {
      const ctx = createTestContext();
      const result = generateType({ enum: [1, 2, 3] }, ctx);
      expect(printNode(result)).toBe('1 | 2 | 3');
    });

    it('generates enum type with negative numbers', () => {
      const ctx = createTestContext();
      const result = generateType({ enum: [-1, 0, 1] }, ctx);
      expect(printNode(result)).toBe('-1 | 0 | 1');
    });

    it('generates enum type with boolean values', () => {
      const ctx = createTestContext();
      const result = generateType({ enum: [true, false] }, ctx);
      expect(printNode(result)).toBe('true | false');
    });

    it('generates union type for oneOf', () => {
      const ctx = createTestContext();
      const result = generateType(
        {
          oneOf: [{ type: 'string' }, { type: 'number' }]
        },
        ctx
      );
      expect(printNode(result)).toBe('string | number');
    });

    it('generates intersection type for allOf', () => {
      const ctx = createTestContext();
      const result = generateType(
        {
          allOf: [
            { type: 'object', properties: { a: { type: 'string' } }, additionalProperties: false },
            { type: 'object', properties: { b: { type: 'number' } }, additionalProperties: false }
          ]
        },
        ctx
      );
      expect(printNode(result)).toBe('{ readonly a?: string; } & { readonly b?: number; }');
    });

    it('generates nullable type', () => {
      const ctx = createTestContext();
      const result = generateType({ type: 'string', nullable: true }, ctx);
      expect(printNode(result)).toBe('string | null');
    });

    it('generates object type literal with required property', () => {
      const ctx = createTestContext();
      const result = generateType(
        {
          type: 'object',
          properties: { name: { type: 'string' } },
          required: ['name'],
          additionalProperties: false
        },
        ctx
      );
      expect(printNode(result)).toBe('{ readonly name: string; }');
    });

    it('generates object type literal with optional property', () => {
      const ctx = createTestContext();
      const result = generateType(
        {
          type: 'object',
          properties: { name: { type: 'string' } },
          additionalProperties: false
        },
        ctx
      );
      expect(printNode(result)).toBe('{ readonly name?: string; }');
    });

    it('generates object type literal with index signature', () => {
      const ctx = createTestContext();
      const result = generateType(
        {
          type: 'object',
          properties: { name: { type: 'string' } },
          required: ['name'],
          additionalProperties: true
        },
        ctx
      );
      expect(printNode(result)).toBe('{ readonly name: string; readonly [key: string]: unknown; }');
    });

    it('generates reference type', () => {
      const ctx = createTestContext();
      const result = generateType({ $ref: '#/components/schemas/User' }, ctx);
      expect(printNode(result)).toBe('User');
    });

    it('applies typeMapper to reference types', () => {
      const ctx = createTestContext();
      const result = generateType(
        { $ref: '#/components/schemas/User' },
        ctx,
        name => 'Shape' + name
      );
      expect(printNode(result)).toBe('ShapeUser');
    });
  });

  describe('generateStringType', () => {
    it('generates string type for undefined format', () => {
      const result = generateStringType(undefined);
      expect(printNode(result)).toBe('string');
    });

    it('generates string type for regular formats', () => {
      const result = generateStringType('date-time');
      expect(printNode(result)).toBe('string');
    });

    it('generates Binary type for binary format', () => {
      const result = generateStringType('binary');
      expect(printNode(result)).toBe('oar.make.Binary');
    });
  });

  describe('generateAdditionalPropType', () => {
    it('returns undefined for false', () => {
      const ctx = createTestContext();
      const result = generateAdditionalPropType(false, ctx);
      expect(result).toBeUndefined();
    });

    it('returns unknown for true', () => {
      const ctx = createTestContext();
      const result = generateAdditionalPropType(true, ctx);
      expect(printNode(result!)).toBe('unknown');
    });

    it('returns unknown for undefined (default)', () => {
      const ctx = createTestContext();
      const result = generateAdditionalPropType(undefined, ctx);
      expect(printNode(result!)).toBe('unknown');
    });

    it('returns undefined when configured to omit', () => {
      const ctx = createTestContext({
        unknownAdditionalPropertiesIndexSignature: AdditionalPropertiesIndexSignature.omit
      });
      const result = generateAdditionalPropType(true, ctx);
      expect(result).toBeUndefined();
    });

    it('generates type union with undefined for schema', () => {
      const ctx = createTestContext({ emitUndefinedForIndexTypes: true });
      const result = generateAdditionalPropType({ type: 'string' }, ctx);
      expect(printNode(result!)).toBe('string | undefined');
    });

    it('generates type without undefined when configured', () => {
      const ctx = createTestContext({ emitUndefinedForIndexTypes: false });
      const result = generateAdditionalPropType({ type: 'string' }, ctx);
      expect(printNode(result!)).toBe('string');
    });
  });

  describe('generateObjectMembers', () => {
    it('generates required property without question mark', () => {
      const ctx = createTestContext();
      const result = generateObjectMembers({ name: { type: 'string' } }, ['name'], false, ctx);

      expect(result).toHaveLength(1);
      expect(printNode(result[0])).toBe('readonly name: string;');
    });

    it('generates optional property with question mark', () => {
      const ctx = createTestContext();
      const result = generateObjectMembers({ name: { type: 'string' } }, [], false, ctx);

      expect(result).toHaveLength(1);
      expect(printNode(result[0])).toBe('readonly name?: string;');
    });

    it('generates multiple properties', () => {
      const ctx = createTestContext();
      const result = generateObjectMembers(
        {
          id: { type: 'integer' },
          name: { type: 'string' },
          active: { type: 'boolean' }
        },
        ['id', 'name'],
        false,
        ctx
      );

      expect(result).toHaveLength(3);
      expect(printNode(result[0])).toBe('readonly id: number;');
      expect(printNode(result[1])).toBe('readonly name: string;');
      expect(printNode(result[2])).toBe('readonly active?: boolean;');
    });

    it('adds index signature for additional properties true', () => {
      const ctx = createTestContext();
      const result = generateObjectMembers({ name: { type: 'string' } }, ['name'], true, ctx);

      expect(result).toHaveLength(2);
      expect(printNode(result[0])).toBe('readonly name: string;');
      expect(printNode(result[1])).toBe('readonly [key: string]: unknown;');
    });

    it('adds typed index signature for additional properties schema', () => {
      const ctx = createTestContext({ emitUndefinedForIndexTypes: false });
      const result = generateObjectMembers(
        { name: { type: 'string' } },
        ['name'],
        { type: 'number' },
        ctx
      );

      expect(result).toHaveLength(2);
      expect(printNode(result[1])).toBe('readonly [key: string]: number;');
    });

    it('applies propertyNameMapper', () => {
      const ctx = createTestContext({
        propertyNameMapper: name => (name === 'snake_case' ? 'snakeCase' : name)
      });
      const result = generateObjectMembers(
        { snake_case: { type: 'string' } },
        ['snake_case'],
        false,
        ctx
      );

      expect(printNode(result[0])).toBe('readonly snakeCase: string;');
    });

    it('quotes special property names', () => {
      const ctx = createTestContext();
      const result = generateObjectMembers(
        { 'content-type': { type: 'string' } },
        ['content-type'],
        false,
        ctx
      );

      expect(printNode(result[0])).toBe('readonly "content-type": string;');
    });
  });
});
