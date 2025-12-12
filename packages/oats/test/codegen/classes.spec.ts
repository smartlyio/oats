import { createContext, GenerationState, Options } from '../../src/codegen/context';
import {
  generateValueClass,
  generateClassConstructor,
  generateReflectionProperty,
  generateClassMakeMethod,
  generateClassBuiltinMembers
} from '../../src/codegen/classes';

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

describe('codegen/classes', () => {
  describe('generateClassConstructor', () => {
    it('generates constructor method', () => {
      const ctx = createTestContext();
      const result = generateClassConstructor('User', ctx);
      expect(printNode(result)).toBe(
        'public constructor(value: ShapeOfUser, opts?: oar.make.MakeOptions | InternalUnsafeConstructorOption) { super(); oar.instanceAssign(this, value, opts, buildUser); }'
      );
    });

    it('uses name mapper for shape type', () => {
      const ctx = createTestContext({
        nameMapper: (name, kind) => kind === 'shape' ? `${name}Input` : name
      });
      const result = generateClassConstructor('User', ctx);
      expect(printNode(result)).toContain('value: UserInput');
    });
  });

  describe('generateReflectionProperty', () => {
    it('generates static reflection property', () => {
      const ctx = createTestContext();
      const result = generateReflectionProperty('User', ctx);
      expect(printNode(result)).toBe(
        'public static reflection: oar.reflection.NamedTypeDefinitionDeferred<User> = () => { return typeUser; };'
      );
    });
  });

  describe('generateClassMakeMethod', () => {
    it('generates static make method', () => {
      const ctx = createTestContext();
      const result = generateClassMakeMethod('User', ctx);
      // Prettier formats this - check key parts
      expect(printNode(result)).toContain('static make(value: ShapeOfUser');
      expect(printNode(result)).toContain('if (value instanceof User)');
      expect(printNode(result)).toContain('return oar.make.Make.ok(value)');
      expect(printNode(result)).toContain('const make = buildUser(value, opts)');
    });
  });

  describe('generateClassBuiltinMembers', () => {
    it('generates all three builtin members', () => {
      const ctx = createTestContext();
      const result = generateClassBuiltinMembers('User', ctx);
      expect(result).toHaveLength(3);
      
      const printed = result.map(printNode);
      expect(printed[0]).toContain('constructor');
      expect(printed[1]).toContain('static reflection');
      expect(printed[2]).toContain('static make');
    });
  });

  describe('generateValueClass', () => {
    it('generates class with single required property', () => {
      const ctx = createTestContext();
      const result = generateValueClass('User', 'User', {
        type: 'object',
        properties: { name: { type: 'string' } },
        required: ['name'],
        additionalProperties: false
      }, ctx);
      const printed = printNode(result);
      expect(printed).toContain('export class User extends oar.valueClass.ValueClass');
      expect(printed).toContain('readonly name!: string');
      expect(printed).toContain('constructor');
      expect(printed).toContain('static reflection');
      expect(printed).toContain('static make');
    });

    it('generates class with optional property', () => {
      const ctx = createTestContext();
      const result = generateValueClass('User', 'User', {
        type: 'object',
        properties: { name: { type: 'string' } },
        additionalProperties: false
      }, ctx);
      const printed = printNode(result);
      expect(printed).toContain('readonly name?: string');
    });

    it('generates class with multiple properties', () => {
      const ctx = createTestContext();
      const result = generateValueClass('User', 'User', {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          active: { type: 'boolean' }
        },
        required: ['id', 'name'],
        additionalProperties: false
      }, ctx);
      const printed = printNode(result);
      expect(printed).toContain('readonly id!: number');
      expect(printed).toContain('readonly name!: string');
      expect(printed).toContain('readonly active?: boolean');
    });

    it('generates class with index signature for additionalProperties', () => {
      const ctx = createTestContext();
      const result = generateValueClass('User', 'User', {
        type: 'object',
        properties: { name: { type: 'string' } },
        required: ['name'],
        additionalProperties: true
      }, ctx);
      const printed = printNode(result);
      expect(printed).toContain('readonly name!: string');
      expect(printed).toContain('[instanceIndexSignatureKey: string]: unknown');
    });

    it('generates class with no properties', () => {
      const ctx = createTestContext();
      const result = generateValueClass('Empty', 'Empty', {
        type: 'object',
        additionalProperties: false
      }, ctx);
      const printed = printNode(result);
      expect(printed).toContain('export class Empty extends oar.valueClass.ValueClass');
      expect(printed).toContain('constructor');
    });

    it('includes brand tag property', () => {
      const ctx = createTestContext();
      const result = generateValueClass('User', 'User', {
        type: 'object',
        properties: { name: { type: 'string' } },
        additionalProperties: false
      }, ctx);
      const printed = printNode(result);
      expect(printed).toContain('#__oats_value_class_brand_tag');
    });
  });
});
