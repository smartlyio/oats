import { createContext, GenerationState, Options } from '../../src/codegen/context';

function createTestOptions(overrides: Partial<Options> = {}): Options {
  return {
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
    ...overrides
  };
}

function createTestState(): GenerationState {
  return {
    cwd: '.',
    imports: {},
    actions: []
  };
}

describe('codegen/context', () => {
  describe('createContext', () => {
    it('creates context with options accessible', () => {
      const options = createTestOptions();
      const state = createTestState();
      const generatedFiles = new Set<string>();

      const ctx = createContext(options, state, generatedFiles);

      expect(ctx.options).toBe(options);
    });

    describe('addImport', () => {
      it('adds import to state', () => {
        const options = createTestOptions();
        const state = createTestState();
        const generatedFiles = new Set<string>();
        const ctx = createContext(options, state, generatedFiles);

        ctx.addImport('types', './types.generated.ts');

        expect(state.imports['types']).toBe('./types.generated.ts');
      });

      it('normalizes relative paths', () => {
        const options = createTestOptions();
        const state = createTestState();
        const generatedFiles = new Set<string>();
        const ctx = createContext(options, state, generatedFiles);

        ctx.addImport('types', './foo/../types.ts');

        // path.normalize removes the ../
        expect(state.imports['types']).toBe('./types.ts');
      });

      it('does not overwrite existing import', () => {
        const options = createTestOptions();
        const state = createTestState();
        state.imports['types'] = './original.ts';
        const generatedFiles = new Set<string>();
        const ctx = createContext(options, state, generatedFiles);

        ctx.addImport('types', './new.ts');

        expect(state.imports['types']).toBe('./original.ts');
      });

      it('ignores undefined import file', () => {
        const options = createTestOptions();
        const state = createTestState();
        const generatedFiles = new Set<string>();
        const ctx = createContext(options, state, generatedFiles);

        ctx.addImport('types', undefined);

        expect(state.imports['types']).toBeUndefined();
      });

      it('adds action for new imports with generator', () => {
        const options = createTestOptions();
        const state = createTestState();
        const generatedFiles = new Set<string>();
        const ctx = createContext(options, state, generatedFiles);
        const action = jest.fn().mockResolvedValue(undefined);

        ctx.addImport('types', './types.ts', action);

        expect(state.actions).toHaveLength(1);
        expect(generatedFiles.has('./types.ts')).toBe(true);
      });

      it('does not add action for already generated files', () => {
        const options = createTestOptions();
        const state = createTestState();
        const generatedFiles = new Set<string>(['./types.ts']);
        const ctx = createContext(options, state, generatedFiles);
        const action = jest.fn().mockResolvedValue(undefined);

        ctx.addImport('types', './types.ts', action);

        expect(state.actions).toHaveLength(0);
      });
    });

    describe('resolveRefToTypeName', () => {
      it('resolves local reference', () => {
        const options = createTestOptions();
        const state = createTestState();
        const generatedFiles = new Set<string>();
        const ctx = createContext(options, state, generatedFiles);

        const result = ctx.resolveRefToTypeName('#/components/schemas/User', 'value');

        expect(result.member).toBe('User');
        expect(result.qualified).toBeUndefined();
      });

      it('uses nameMapper for local references', () => {
        const options = createTestOptions({
          nameMapper: (name, kind) => kind === 'shape' ? 'Shape' + name : name
        });
        const state = createTestState();
        const generatedFiles = new Set<string>();
        const ctx = createContext(options, state, generatedFiles);

        const result = ctx.resolveRefToTypeName('#/components/schemas/User', 'shape');

        expect(result.member).toBe('ShapeUser');
      });

      it('resolves external reference via resolve function', () => {
        const options = createTestOptions({
          resolve: (ref, opts, kind) => {
            if (ref.startsWith('./external')) {
              return {
                importAs: 'external',
                importFrom: './external.generated.ts',
                name: 'ExternalType'
              };
            }
            return undefined;
          }
        });
        const state = createTestState();
        const generatedFiles = new Set<string>();
        const ctx = createContext(options, state, generatedFiles);

        const result = ctx.resolveRefToTypeName('./external.yaml#/components/schemas/Foo', 'value');

        expect(result.member).toBe('ExternalType');
        expect(result.qualified).toBe('external');
        expect(state.imports['external']).toBe('./external.generated.ts');
      });

      it('resolves reference with name only (no import)', () => {
        const options = createTestOptions({
          resolve: (ref) => {
            if (ref === '#/components/schemas/Local') {
              return { name: 'LocalType' };
            }
            return undefined;
          }
        });
        const state = createTestState();
        const generatedFiles = new Set<string>();
        const ctx = createContext(options, state, generatedFiles);

        const result = ctx.resolveRefToTypeName('#/components/schemas/Local', 'value');

        expect(result.member).toBe('LocalType');
        expect(result.qualified).toBeUndefined();
      });

      it('throws for unresolvable non-local reference', () => {
        const options = createTestOptions();
        const state = createTestState();
        const generatedFiles = new Set<string>();
        const ctx = createContext(options, state, generatedFiles);

        expect(() => {
          ctx.resolveRefToTypeName('./unknown.yaml#/schemas/Foo', 'value');
        }).toThrow('could not resolve typename');
      });
    });
  });
});
