import { createContext, GenerationState, Options } from '../../src/codegen/context';
import {
  generateTypeShape,
  generateBrand,
  generateTopLevelMaker,
  generateTopLevelClassMaker,
  generateTopLevelClassBuilder,
  generateTopLevelType
} from '../../src/codegen/makers';

function printNode(node: string): string {
  return node;
}

function printNodes(nodes: readonly string[]): string {
  return nodes.join('\n');
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
      if (kind === 'maker') return 'make' + capitalized;
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

describe('codegen/makers', () => {
  describe('generateTypeShape', () => {
    it('generates shape type alias', () => {
      const ctx = createTestContext();
      const result = generateTypeShape('User', 'User', ctx);
      expect(printNode(result)).toBe('export type ShapeOfUser = oar.ShapeOf<User>;');
    });

    it('uses custom name mapper', () => {
      const ctx = createTestContext({
        nameMapper: (name, kind) => (kind === 'shape' ? `${name}Shape` : name)
      });
      const result = generateTypeShape('User', 'User', ctx);
      expect(printNode(result)).toBe('export type UserShape = oar.ShapeOf<User>;');
    });
  });

  describe('generateBrand', () => {
    it('generates empty enum for branding', () => {
      const ctx = createTestContext();
      const result = generateBrand('UserId', ctx);
      expect(printNode(result)).toBe('enum BrandOfUserId {}');
    });
  });

  describe('generateTopLevelMaker', () => {
    it('generates maker function', () => {
      const ctx = createTestContext();
      const result = generateTopLevelMaker('User', ctx);
      expect(printNode(result)).toContain(
        'export const makeUser: oar.make.Maker<ShapeOfUser, User>'
      );
      expect(printNode(result)).toContain('oar.make.createMaker');
      expect(printNode(result)).toContain('return oar.fromReflection(typeUser.definition);');
    });

    it('generates builder function with custom name', () => {
      const ctx = createTestContext();
      const result = generateTopLevelMaker('User', ctx, 'build', 'User');
      expect(printNode(result)).toContain(
        'export const buildUser: oar.make.Maker<ShapeOfUser, User>'
      );
      expect(printNode(result)).toContain('return oar.fromReflection(typeUser.definition);');
    });
  });

  describe('generateTopLevelClassMaker', () => {
    it('generates class maker referencing static make method', () => {
      const ctx = createTestContext();
      const result = generateTopLevelClassMaker('User', 'User', ctx);
      expect(printNode(result)).toBe(
        'export const makeUser: oar.make.Maker<ShapeOfUser, User> = User.make;'
      );
    });
  });

  describe('generateTopLevelClassBuilder', () => {
    it('generates class builder function', () => {
      const ctx = createTestContext();
      const result = generateTopLevelClassBuilder('User', 'User', ctx);
      expect(printNode(result)).toContain(
        'export const buildUser: oar.make.Maker<ShapeOfUser, User>'
      );
      expect(printNode(result)).toContain('return oar.fromReflection(typeUser.definition);');
    });
  });

  describe('generateTopLevelType', () => {
    it('generates type alias for reference', () => {
      const ctx = createTestContext();
      const result = generateTopLevelType('MyUser', { $ref: '#/components/schemas/User' }, ctx);
      const printed = printNodes(result);
      expect(printed).toContain('export type MyUser = User;');
      expect(printed).toContain('export type ShapeOfMyUser = oar.ShapeOf<MyUser>;');
      expect(printed).toContain('export const makeMyUser');
      expect(printed).toContain('export const typeMyUser');
    });

    it('generates branded scalar type for string', () => {
      const ctx = createTestContext();
      const result = generateTopLevelType('UserId', { type: 'string' }, ctx);
      const printed = printNodes(result);
      expect(printed).toContain('enum BrandOfUserId {}');
      expect(printed).toContain('export type UserId = oar.BrandedScalar<string, BrandOfUserId>;');
      expect(printed).toContain('export type ShapeOfUserId = oar.ShapeOf<UserId>;');
      expect(printed).toContain('export const makeUserId');
      expect(printed).toContain('isA: (value: any) => makeUserId(value).isSuccess()');
    });

    it('generates branded scalar type for integer', () => {
      const ctx = createTestContext();
      const result = generateTopLevelType('Count', { type: 'integer' }, ctx);
      const printed = printNodes(result);
      expect(printed).toContain('enum BrandOfCount {}');
      expect(printed).toContain('export type Count = oar.BrandedScalar<number, BrandOfCount>;');
    });

    it('generates plain type alias for array', () => {
      const ctx = createTestContext();
      const result = generateTopLevelType(
        'Items',
        { type: 'array', items: { type: 'string' } },
        ctx
      );
      const printed = printNodes(result);
      expect(printed).toContain('export type Items = ReadonlyArray<string>;');
      expect(printed).toContain('export type ShapeOfItems = oar.ShapeOf<Items>;');
      expect(printed).toContain('type: "array"');
      expect(printed).toContain('type: "string"');
    });

    it('generates plain type alias for union', () => {
      const ctx = createTestContext();
      const result = generateTopLevelType(
        'Mixed',
        { oneOf: [{ type: 'string' }, { type: 'number' }] },
        ctx
      );
      const printed = printNodes(result);
      expect(printed).toContain('export type Mixed = string | number;');
      expect(printed).toContain('type: "union"');
    });

    it('generates class for object type', () => {
      const ctx = createTestContext();
      const result = generateTopLevelType(
        'User',
        {
          type: 'object',
          properties: { name: { type: 'string' } },
          required: ['name'],
          additionalProperties: false
        },
        ctx
      );
      const printed = printNodes(result);
      expect(printed).toContain('export type ShapeOfUser = oar.ShapeOf<User>;');
      expect(printed).toContain('export class User extends oar.valueClass.ValueClass');
      expect(printed).toContain('readonly name!: string');
      expect(printed).toContain('export const buildUser');
      expect(printed).toContain('export const makeUser');
    });
  });
});
