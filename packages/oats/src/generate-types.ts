/**
 * Type generation entry point for OpenAPI schemas.
 */

import { debuglog } from 'node:util';
import * as oas from 'openapi3-ts';
import * as path from 'path';
import { errorTag, isReferenceObject, NameKind, NameMapper, UnsupportedFeatureBehaviour } from './util';
import { ts } from './template';
import {
  createContext,
  GenerationState,
  AdditionalPropertiesIndexSignature,
  runtime,
  addIndexSignatureIgnores,
  resolveModule,
  generateTopLevelType,
  generateQueryTypes,
  generateContentSchemaType
} from './codegen';

const info = debuglog('oats');

// Re-export types that are part of the public API
export { AdditionalPropertiesIndexSignature };

export type Resolve = (
  ref: string,
  options: Options,
  kind: NameKind
) =>
  | { importAs: string; importFrom: string; name: string; generate?: () => Promise<void> }
  | { name: string }
  | undefined;

export interface Options {
  forceGenerateTypes?: boolean;
  header: string;
  sourceFile: string;
  targetFile: string;
  resolve: Resolve;
  oas: oas.OpenAPIObject;
  runtimeModule: string;
  emitStatusCode: (status: number) => boolean;
  unsupportedFeatures?: {
    security?: UnsupportedFeatureBehaviour;
  };
  emitUndefinedForIndexTypes?: boolean;
  unknownAdditionalPropertiesIndexSignature?: AdditionalPropertiesIndexSignature;
  propertyNameMapper?: (openapiPropertyName: string) => string;
  nameMapper: NameMapper;
}

export function deprecated(condition: unknown, message: string): void {
  if (condition) {
    // eslint-disable-next-line no-console
    console.log('deprecation warning: ' + message);
  }
}

// Track files being generated to prevent race conditions
const generatedFiles: Set<string> = new Set();

function isGenerating(file: string): boolean {
  return generatedFiles.has(file);
}

/**
 * Generates an import declaration for external modules.
 */
function generateExternalImport(external: { importAs: string; importFile: string }): string {
  return `import * as ${external.importAs} from ${JSON.stringify(external.importFile)};`;
}

/**
 * Generates builtin imports and types.
 */
function generateBuiltins(options: Options): string[] {
  return [
    `import * as ${runtime} from ${JSON.stringify(options.runtimeModule)};`,
    ts`
      type InternalUnsafeConstructorOption = {
          unSafeSet: true;
      };
    `
  ];
}

/**
 * Generates component schemas from the OpenAPI spec.
 */
function generateComponentSchemas(ctx: ReturnType<typeof createContext>): string[] {
  const { options } = ctx;
  const schemas = options.oas.components?.schemas;

  if (!schemas) {
    return [];
  }

  const result: string[] = [];
  Object.keys(schemas).forEach(key => {
    const schema = schemas[key];
    const types = generateTopLevelType(key, schema, ctx);
    result.push(...types);
  });

  return result;
}

/**
 * Generates component request bodies and responses.
 */
function generateComponentRequestsAndResponses(
  components: { [key: string]: oas.ResponseObject | oas.RequestBodyObject | oas.ReferenceObject } | undefined,
  ctx: ReturnType<typeof createContext>
): string[] {
  const result: string[] = [];

  if (components) {
    Object.keys(components).forEach(key => {
      const component = components[key];
      let schema: oas.SchemaObject | oas.ReferenceObject;

      if (isReferenceObject(component)) {
        schema = { $ref: component.$ref };
      } else {
        const content = (component as oas.ResponseObject | oas.RequestBodyObject).content;
        if (!content) {
          throw new Error('missing content');
        }
        schema = generateContentSchemaType(content);
      }

      result.push(...generateTopLevelType(key, schema, ctx));
    });
  }

  return result;
}

/**
 * Generates all components from the OpenAPI spec.
 */
function generateComponents(ctx: ReturnType<typeof createContext>): string[] {
  const { options } = ctx;
  const result: string[] = [];

  result.push(...errorTag('in component.schemas', () => generateComponentSchemas(ctx)));
  result.push(
    ...errorTag('in component.responses', () =>
      generateComponentRequestsAndResponses(options.oas.components?.responses, ctx)
    )
  );
  result.push(
    ...errorTag('in component.requestBodies', () =>
      generateComponentRequestsAndResponses(options.oas.components?.requestBodies, ctx)
    )
  );

  return result;
}

/**
 * Main entry point for type generation.
 */
export function run(options: Options): string | undefined {
  options.targetFile = './' + path.normalize(options.targetFile);

  if (isGenerating(options.targetFile) && !options.forceGenerateTypes) {
    return;
  }
  generatedFiles.add(options.targetFile);

  const state: GenerationState = {
    cwd: path.dirname(options.sourceFile),
    imports: {} as Record<string, string>,
    actions: [] as Array<() => Promise<void>>
  };

  const ctx = createContext(options, state, generatedFiles);

  const builtins = generateBuiltins(options);
  const types = generateComponents(ctx);
  const queryTypes = generateQueryTypes(ctx);

  const externals = Object.entries(state.imports).map(([importAs, importFile]) =>
    generateExternalImport({
      importAs,
      importFile: resolveModule(options.targetFile, importFile)
    })
  );

  state.actions.forEach(action => action());

  const src = [...builtins, ...externals, ...types, ...queryTypes].join('\n');

  return addIndexSignatureIgnores(src);
}
