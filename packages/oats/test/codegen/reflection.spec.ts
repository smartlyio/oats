import * as ts from 'typescript';
import { createContext, GenerationState, Options } from '../../src/codegen/context';
import {
  generateReflectionType,
  generateAdditionalPropsReflectionType,
  generateIsA,
  inventIsA
} from '../../src/codegen/reflection';
import { ts as dedent } from '../../src/template';

function printNode(node: ts.Node): string {
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  const sourceFile = ts.createSourceFile('test.ts', '', ts.ScriptTarget.Latest);
  return printer.printNode(ts.EmitHint.Unspecified, node, sourceFile);
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

describe('codegen/reflection', () => {
  describe('generateReflectionType', () => {
    it('generates string reflection', () => {
      const ctx = createTestContext();
      const result = generateReflectionType({ type: 'string' }, ctx);
      expect(printNode(result)).toBe(dedent`
        {
            type: "string"
        }
      `);
    });

    it('generates string reflection with enum', () => {
      const ctx = createTestContext();
      const result = generateReflectionType({ type: 'string', enum: ['a', 'b'] }, ctx);
      expect(printNode(result)).toBe(dedent`
        {
            type: "string",
            enum: ["a", "b"]
        }
      `);
    });

    it('generates string reflection with format', () => {
      const ctx = createTestContext();
      const result = generateReflectionType({ type: 'string', format: 'date-time' }, ctx);
      expect(printNode(result)).toBe(dedent`
        {
            type: "string",
            format: "date-time"
        }
      `);
    });

    it('generates string reflection with pattern', () => {
      const ctx = createTestContext();
      const result = generateReflectionType({ type: 'string', pattern: '^[a-z]+$' }, ctx);
      expect(printNode(result)).toBe(dedent`
        {
            type: "string",
            pattern: "^[a-z]+$"
        }
      `);
    });

    it('generates string reflection with length constraints', () => {
      const ctx = createTestContext();
      const result = generateReflectionType({ type: 'string', minLength: 1, maxLength: 100 }, ctx);
      expect(printNode(result)).toBe(dedent`
        {
            type: "string",
            minLength: 1,
            maxLength: 100
        }
      `);
    });

    it('generates binary reflection for binary format', () => {
      const ctx = createTestContext();
      const result = generateReflectionType({ type: 'string', format: 'binary' }, ctx);
      expect(printNode(result)).toBe(dedent`
        {
            type: "binary"
        }
      `);
    });

    it('generates integer reflection', () => {
      const ctx = createTestContext();
      const result = generateReflectionType({ type: 'integer' }, ctx);
      expect(printNode(result)).toBe(dedent`
        {
            type: "integer"
        }
      `);
    });

    it('generates integer reflection with enum', () => {
      const ctx = createTestContext();
      const result = generateReflectionType({ type: 'integer', enum: [1, 2, 3] }, ctx);
      expect(printNode(result)).toBe(dedent`
        {
            type: "integer",
            enum: [1, 2, 3]
        }
      `);
    });

    it('generates number reflection with bounds', () => {
      const ctx = createTestContext();
      const result = generateReflectionType({ type: 'number', minimum: 0, maximum: 100 }, ctx);
      expect(printNode(result)).toBe(dedent`
        {
            type: "number",
            minimum: 0,
            maximum: 100
        }
      `);
    });

    it('generates number reflection with negative minimum', () => {
      const ctx = createTestContext();
      const result = generateReflectionType({ type: 'number', minimum: -10, maximum: 10 }, ctx);
      expect(printNode(result)).toBe(dedent`
        {
            type: "number",
            minimum: -10,
            maximum: 10
        }
      `);
    });

    it('generates boolean reflection', () => {
      const ctx = createTestContext();
      const result = generateReflectionType({ type: 'boolean' }, ctx);
      expect(printNode(result)).toBe(dedent`
        {
            type: "boolean"
        }
      `);
    });

    it('generates boolean reflection with enum', () => {
      const ctx = createTestContext();
      const result = generateReflectionType({ type: 'boolean', enum: [true] }, ctx);
      expect(printNode(result)).toBe(dedent`
        {
            type: "boolean",
            enum: [true]
        }
      `);
    });

    it('generates array reflection', () => {
      const ctx = createTestContext();
      const result = generateReflectionType({ type: 'array', items: { type: 'string' } }, ctx);
      expect(printNode(result)).toBe(dedent`
        {
            type: "array",
            items: {
                type: "string"
            }
        }
      `);
    });

    it('generates array reflection with min/max items', () => {
      const ctx = createTestContext();
      const result = generateReflectionType({ 
        type: 'array', 
        items: { type: 'string' },
        minItems: 1,
        maxItems: 10
      }, ctx);
      expect(printNode(result)).toBe(dedent`
        {
            type: "array",
            items: {
                type: "string"
            },
            minItems: 1,
            maxItems: 10
        }
      `);
    });

    it('generates object reflection with required property', () => {
      const ctx = createTestContext();
      const result = generateReflectionType({
        type: 'object',
        properties: { name: { type: 'string' } },
        required: ['name']
      }, ctx);
      expect(printNode(result)).toBe(dedent`
        {
            type: "object",
            additionalProperties: true,
            properties: {
                "name": {
                    required: true,
                    value: {
                        type: "string"
                    }
                }
            }
        }
      `);
    });

    it('generates object reflection with optional property', () => {
      const ctx = createTestContext();
      const result = generateReflectionType({
        type: 'object',
        properties: { name: { type: 'string' } }
      }, ctx);
      expect(printNode(result)).toBe(dedent`
        {
            type: "object",
            additionalProperties: true,
            properties: {
                "name": {
                    required: false,
                    value: {
                        type: "string"
                    }
                }
            }
        }
      `);
    });

    it('generates object reflection with additionalProperties false', () => {
      const ctx = createTestContext();
      const result = generateReflectionType({
        type: 'object',
        properties: { name: { type: 'string' } },
        required: ['name'],
        additionalProperties: false
      }, ctx);
      expect(printNode(result)).toBe(dedent`
        {
            type: "object",
            additionalProperties: false,
            properties: {
                "name": {
                    required: true,
                    value: {
                        type: "string"
                    }
                }
            }
        }
      `);
    });

    it('generates object reflection with propertyNameMapper', () => {
      const ctx = createTestContext({
        propertyNameMapper: (name) => name === 'snake_case' ? 'snakeCase' : name
      });
      const result = generateReflectionType({
        type: 'object',
        properties: { snake_case: { type: 'string' } },
        required: ['snake_case']
      }, ctx);
      expect(printNode(result)).toBe(dedent`
        {
            type: "object",
            additionalProperties: true,
            properties: {
                "snakeCase": {
                    required: true,
                    networkName: "snake_case",
                    value: {
                        type: "string"
                    }
                }
            }
        }
      `);
    });

    it('generates union reflection for oneOf', () => {
      const ctx = createTestContext();
      const result = generateReflectionType({
        oneOf: [{ type: 'string' }, { type: 'number' }]
      }, ctx);
      expect(printNode(result)).toBe(dedent`
        {
            type: "union",
            options: [
                {
                    type: "string"
                },
                {
                    type: "number"
                }
            ]
        }
      `);
    });

    it('generates intersection reflection for allOf', () => {
      const ctx = createTestContext();
      const result = generateReflectionType({
        allOf: [{ type: 'string' }, { type: 'number' }]
      }, ctx);
      expect(printNode(result)).toBe(dedent`
        {
            type: "intersection",
            options: [
                {
                    type: "string"
                },
                {
                    type: "number"
                }
            ]
        }
      `);
    });

    it('generates named reference reflection', () => {
      const ctx = createTestContext();
      const result = generateReflectionType({ $ref: '#/components/schemas/User' }, ctx);
      expect(printNode(result)).toBe(dedent`
        {
            type: "named",
            reference: () => { return typeUser; }
        }
      `);
    });

    it('generates nullable reflection as union', () => {
      const ctx = createTestContext();
      const result = generateReflectionType({ type: 'string', nullable: true }, ctx);
      expect(printNode(result)).toBe(dedent`
        {
            type: "union",
            options: [
                {
                    type: "string"
                },
                {
                    type: "null"
                }
            ]
        }
      `);
    });

    it('generates void reflection', () => {
      const ctx = createTestContext();
      const result = generateReflectionType({ type: 'void' as any }, ctx);
      expect(printNode(result)).toBe(dedent`
        {
            type: "void"
        }
      `);
    });

    it('generates null reflection', () => {
      const ctx = createTestContext();
      const result = generateReflectionType({ type: 'null' }, ctx);
      expect(printNode(result)).toBe(dedent`
        {
            type: "null"
        }
      `);
    });

    it('generates unknown reflection for missing type', () => {
      const ctx = createTestContext();
      const result = generateReflectionType({}, ctx);
      expect(printNode(result)).toBe(dedent`
        {
            type: "unknown"
        }
      `);
    });
  });

  describe('generateAdditionalPropsReflectionType', () => {
    it('returns false for additionalProperties: false', () => {
      const ctx = createTestContext();
      const result = generateAdditionalPropsReflectionType(false, ctx);
      expect(printNode(result)).toBe('false');
    });

    it('returns true for additionalProperties: true', () => {
      const ctx = createTestContext();
      const result = generateAdditionalPropsReflectionType(true, ctx);
      expect(printNode(result)).toBe('true');
    });

    it('returns true for undefined', () => {
      const ctx = createTestContext();
      const result = generateAdditionalPropsReflectionType(undefined, ctx);
      expect(printNode(result)).toBe('true');
    });

    it('returns true for empty object', () => {
      const ctx = createTestContext();
      const result = generateAdditionalPropsReflectionType({}, ctx);
      expect(printNode(result)).toBe('true');
    });

    it('returns reflection type for schema', () => {
      const ctx = createTestContext();
      const result = generateAdditionalPropsReflectionType({ type: 'string' }, ctx);
      expect(printNode(result)).toBe(dedent`
        {
            type: "string"
        }
      `);
    });
  });

  describe('generateIsA', () => {
    it('generates instanceof check', () => {
      const result = generateIsA('MyClass');
      expect(printNode(result)).toBe('(value: any) => value instanceof MyClass');
    });

    it('generates arrow function', () => {
      const result = generateIsA('MyClass');
      expect(ts.isArrowFunction(result)).toBe(true);
    });
  });

  describe('inventIsA', () => {
    it('returns undefined for reference types', () => {
      const ctx = createTestContext();
      const result = inventIsA('User', { $ref: '#/components/schemas/Other' }, ctx);
      expect(result).toBeUndefined();
    });

    it('generates instanceof isA for object types', () => {
      const ctx = createTestContext();
      const result = inventIsA('User', { type: 'object' }, ctx);
      expect(printNode(result!)).toBe('(value: any) => value instanceof User');
    });

    it('generates maker-based isA for scalar types', () => {
      const ctx = createTestContext();
      const result = inventIsA('UserId', { type: 'string' }, ctx);
      expect(printNode(result!)).toBe('(value: any) => makeUserId(value).isSuccess()');
    });

    it('generates maker-based isA for integer types', () => {
      const ctx = createTestContext();
      const result = inventIsA('Count', { type: 'integer' }, ctx);
      expect(printNode(result!)).toBe('(value: any) => makeCount(value).isSuccess()');
    });

    it('returns undefined for array types', () => {
      const ctx = createTestContext();
      const result = inventIsA('Items', { type: 'array', items: { type: 'string' } }, ctx);
      expect(result).toBeUndefined();
    });

    it('returns undefined for union types', () => {
      const ctx = createTestContext();
      const result = inventIsA('Mixed', { oneOf: [{ type: 'string' }, { type: 'number' }] }, ctx);
      expect(result).toBeUndefined();
    });
  });
});
