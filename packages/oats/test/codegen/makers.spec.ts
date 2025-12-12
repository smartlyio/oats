import * as ts from 'typescript';
import { createContext, GenerationState, Options } from '../../src/codegen/context';
import {
  generateTypeShape,
  generateBrand,
  generateTopLevelMaker,
  generateTopLevelClassMaker,
  generateTopLevelClassBuilder,
  generateTopLevelType
} from '../../src/codegen/makers';
import { ts as dedent } from '../../src/template';

function printNode(node: ts.Node): string {
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  const sourceFile = ts.createSourceFile('test.ts', '', ts.ScriptTarget.Latest);
  return printer.printNode(ts.EmitHint.Unspecified, node, sourceFile);
}

function printNodes(nodes: readonly ts.Node[]): string {
  return nodes.map(printNode).join('\n');
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
        nameMapper: (name, kind) => kind === 'shape' ? `${name}Shape` : name
      });
      const result = generateTypeShape('User', 'User', ctx);
      expect(printNode(result)).toBe('export type UserShape = oar.ShapeOf<User>;');
    });
  });

  describe('generateBrand', () => {
    it('generates empty enum for branding', () => {
      const ctx = createTestContext();
      const result = generateBrand('UserId', ctx);
      expect(printNode(result)).toBe('enum BrandOfUserId {\n}');
    });
  });

  describe('generateTopLevelMaker', () => {
    it('generates maker function', () => {
      const ctx = createTestContext();
      const result = generateTopLevelMaker('User', ctx);
      expect(printNode(result)).toBe(
        'export const makeUser: oar.make.Maker<ShapeOfUser, User> = oar.make.createMaker(function () { return oar.fromReflection(typeUser.definition); });'
      );
    });

    it('generates builder function with custom name', () => {
      const ctx = createTestContext();
      const result = generateTopLevelMaker('User', ctx, 'build', 'User');
      expect(printNode(result)).toBe(
        'export const buildUser: oar.make.Maker<ShapeOfUser, User> = oar.make.createMaker(function () { return oar.fromReflection(typeUser.definition); });'
      );
    });
  });

  describe('generateTopLevelClassMaker', () => {
    it('generates class maker referencing static make method', () => {
      const ctx = createTestContext();
      const result = generateTopLevelClassMaker('User', 'User', ctx);
      expect(printNode(result)).toBe('export const makeUser: oar.make.Maker<ShapeOfUser, User> = User.make;');
    });
  });

  describe('generateTopLevelClassBuilder', () => {
    it('generates class builder function', () => {
      const ctx = createTestContext();
      const result = generateTopLevelClassBuilder('User', 'User', ctx);
      expect(printNode(result)).toBe(
        'export const buildUser: oar.make.Maker<ShapeOfUser, User> = oar.make.createMaker(function () { return oar.fromReflection(typeUser.definition); });'
      );
    });
  });

  describe('generateTopLevelType', () => {
    it('generates type alias for reference', () => {
      const ctx = createTestContext();
      const result = generateTopLevelType('MyUser', { $ref: '#/components/schemas/User' }, ctx);
      expect(printNodes(result)).toBe(dedent`
        export type MyUser = User;
        export type ShapeOfMyUser = oar.ShapeOf<MyUser>;
        export const makeMyUser: oar.make.Maker<ShapeOfMyUser, MyUser> = oar.make.createMaker(function () { return oar.fromReflection(typeMyUser.definition); });
        export const typeMyUser: oar.reflection.NamedTypeDefinition<MyUser, ShapeOfMyUser> = {
            name: "MyUser",
            definition: {
                type: "named",
                reference: () => { return typeUser; }
            },
            maker: makeMyUser,
            isA: null
        } as any;
      `);
    });

    it('generates branded scalar type for string', () => {
      const ctx = createTestContext();
      const result = generateTopLevelType('UserId', { type: 'string' }, ctx);
      expect(printNodes(result)).toBe(dedent`
        enum BrandOfUserId {
        }
        export type UserId = oar.BrandedScalar<string, BrandOfUserId>;
        export type ShapeOfUserId = oar.ShapeOf<UserId>;
        export const makeUserId: oar.make.Maker<ShapeOfUserId, UserId> = oar.make.createMaker(function () { return oar.fromReflection(typeUserId.definition); });
        export const typeUserId: oar.reflection.NamedTypeDefinition<UserId, ShapeOfUserId> = {
            name: "UserId",
            definition: {
                type: "string"
            },
            maker: makeUserId,
            isA: (value: any) => makeUserId(value).isSuccess()
        } as any;
      `);
    });

    it('generates branded scalar type for integer', () => {
      const ctx = createTestContext();
      const result = generateTopLevelType('Count', { type: 'integer' }, ctx);
      expect(printNodes(result)).toBe(dedent`
        enum BrandOfCount {
        }
        export type Count = oar.BrandedScalar<number, BrandOfCount>;
        export type ShapeOfCount = oar.ShapeOf<Count>;
        export const makeCount: oar.make.Maker<ShapeOfCount, Count> = oar.make.createMaker(function () { return oar.fromReflection(typeCount.definition); });
        export const typeCount: oar.reflection.NamedTypeDefinition<Count, ShapeOfCount> = {
            name: "Count",
            definition: {
                type: "integer"
            },
            maker: makeCount,
            isA: (value: any) => makeCount(value).isSuccess()
        } as any;
      `);
    });

    it('generates plain type alias for array', () => {
      const ctx = createTestContext();
      const result = generateTopLevelType('Items', { type: 'array', items: { type: 'string' } }, ctx);
      expect(printNodes(result)).toBe(dedent`
        export type Items = ReadonlyArray<string>;
        export type ShapeOfItems = oar.ShapeOf<Items>;
        export const makeItems: oar.make.Maker<ShapeOfItems, Items> = oar.make.createMaker(function () { return oar.fromReflection(typeItems.definition); });
        export const typeItems: oar.reflection.NamedTypeDefinition<Items, ShapeOfItems> = {
            name: "Items",
            definition: {
                type: "array",
                items: {
                    type: "string"
                }
            },
            maker: makeItems,
            isA: null
        } as any;
      `);
    });

    it('generates plain type alias for union', () => {
      const ctx = createTestContext();
      const result = generateTopLevelType('Mixed', { oneOf: [{ type: 'string' }, { type: 'number' }] }, ctx);
      expect(printNodes(result)).toBe(dedent`
        export type Mixed = string | number;
        export type ShapeOfMixed = oar.ShapeOf<Mixed>;
        export const makeMixed: oar.make.Maker<ShapeOfMixed, Mixed> = oar.make.createMaker(function () { return oar.fromReflection(typeMixed.definition); });
        export const typeMixed: oar.reflection.NamedTypeDefinition<Mixed, ShapeOfMixed> = {
            name: "Mixed",
            definition: {
                type: "union",
                options: [
                    {
                        type: "string"
                    },
                    {
                        type: "number"
                    }
                ]
            },
            maker: makeMixed,
            isA: null
        } as any;
      `);
    });

    it('generates class for object type', () => {
      const ctx = createTestContext();
      const result = generateTopLevelType('User', {
        type: 'object',
        properties: { name: { type: 'string' } },
        required: ['name'],
        additionalProperties: false
      }, ctx);
      const printed = printNodes(result);
      expect(printed).toContain('export type ShapeOfUser = oar.ShapeOf<User>;');
      expect(printed).toContain('export class User extends oar.valueClass.ValueClass');
      expect(printed).toContain('readonly name!: string;');
      expect(printed).toContain('export const buildUser');
      expect(printed).toContain('export const makeUser');
    });
  });
});
