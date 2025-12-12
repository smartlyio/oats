import * as ts from 'typescript';
import { createContext, GenerationState, Options } from '../../src/codegen/context';
import {
  generateValueClass,
  generateClassConstructor,
  generateReflectionProperty,
  generateClassMakeMethod,
  generateClassBuiltinMembers
} from '../../src/codegen/classes';
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
      expect(printNode(result)).toBe(dedent`
        static make(value: ShapeOfUser, opts?: oar.make.MakeOptions): oar.make.Make<User> {
            if (value instanceof User) {
                return oar.make.Make.ok(value);
            }
            const make = buildUser(value, opts);
            if (make.isError()) {
                return oar.make.Make.error(make.errors);
            }
            else {
                return oar.make.Make.ok(new User(make.success(), { unSafeSet: true }));
            }
        }
      `);
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
      expect(printed).toContain('readonly name!: string;');
      expect(printed).toContain('public constructor');
      expect(printed).toContain('public static reflection');
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
      expect(printed).toContain('readonly name?: string;');
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
      expect(printed).toContain('readonly id!: number;');
      expect(printed).toContain('readonly name!: string;');
      expect(printed).toContain('readonly active?: boolean;');
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
      expect(printed).toContain('readonly name!: string;');
      expect(printed).toContain('readonly [instanceIndexSignatureKey: string]: unknown;');
    });

    it('generates class with typed index signature', () => {
      const ctx = createTestContext({ emitUndefinedForIndexTypes: false });
      const result = generateValueClass('Metadata', 'Metadata', {
        type: 'object',
        properties: {},
        additionalProperties: { type: 'string' }
      }, ctx);
      const printed = printNode(result);
      expect(printed).toContain('readonly [instanceIndexSignatureKey: string]: string;');
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

    it('generates class with complex property types', () => {
      const ctx = createTestContext();
      const result = generateValueClass('User', 'User', {
        type: 'object',
        properties: {
          tags: { type: 'array', items: { type: 'string' } },
          metadata: { type: 'object', additionalProperties: true }
        },
        required: ['tags'],
        additionalProperties: false
      }, ctx);
      const printed = printNode(result);
      expect(printed).toContain('readonly tags!: ReadonlyArray<string>;');
      expect(printed).toContain('readonly metadata?:');
    });

    it('includes brand tag property', () => {
      const ctx = createTestContext();
      const result = generateValueClass('User', 'User', {
        type: 'object',
        properties: { name: { type: 'string' } },
        additionalProperties: false
      }, ctx);
      const printed = printNode(result);
      expect(printed).toContain('readonly #__oats_value_class_brand_tag!: string;');
    });
  });
});
