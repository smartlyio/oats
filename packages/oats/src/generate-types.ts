/**
 * Type generation entry point for OpenAPI schemas.
 */

import { debuglog } from 'node:util';
import * as oas from 'openapi3-ts';
import * as ts from 'typescript';
import * as path from 'path';
import { errorTag, isReferenceObject, NameKind, NameMapper, UnsupportedFeatureBehaviour } from './util';
import {
  createContext,
  GenerationState,
  AdditionalPropertiesIndexSignature,
  runtimeLibrary,
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
function generateExternalImport(external: { importAs: string; importFile: string }): ts.ImportDeclaration {
  return ts.factory.createImportDeclaration(
    undefined,
    ts.factory.createImportClause(
      false,
      undefined,
      ts.factory.createNamespaceImport(ts.factory.createIdentifier(external.importAs))
    ),
    ts.factory.createStringLiteral(external.importFile)
  );
}

/**
 * Generates builtin imports and types.
 */
function generateBuiltins(options: Options): ts.Node[] {
  return [
    ts.factory.createImportDeclaration(
      undefined,
      ts.factory.createImportClause(
        false,
        undefined,
        ts.factory.createNamespaceImport(runtimeLibrary)
      ),
      ts.factory.createStringLiteral(options.runtimeModule)
    ),
    ts.factory.createTypeAliasDeclaration(
      undefined,
      'InternalUnsafeConstructorOption',
      undefined,
      ts.factory.createTypeLiteralNode([
        ts.factory.createPropertySignature(
          undefined,
          ts.factory.createIdentifier('unSafeSet'),
          undefined,
          ts.factory.createLiteralTypeNode(ts.factory.createTrue())
        )
      ])
    )
  ];
}

/**
 * Generates component schemas from the OpenAPI spec.
 */
function generateComponentSchemas(ctx: ReturnType<typeof createContext>): ts.Node[] {
  const { options } = ctx;
  const schemas = options.oas.components?.schemas;

  if (!schemas) {
    return [];
  }

  const nodes: ts.Node[] = [];
  Object.keys(schemas).forEach(key => {
    const schema = schemas[key];
    const types = generateTopLevelType(key, schema, ctx);
    types.forEach(t => nodes.push(t));
  });

  return nodes;
}

/**
 * Generates component request bodies and responses.
 */
function generateComponentRequestsAndResponses(
  components: { [key: string]: oas.ResponseObject | oas.RequestBodyObject | oas.ReferenceObject } | undefined,
  ctx: ReturnType<typeof createContext>
): ts.Node[] {
  const nodes: ts.Node[] = [];

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

      nodes.push(...generateTopLevelType(key, schema, ctx));
    });
  }

  return nodes;
}

/**
 * Generates all components from the OpenAPI spec.
 */
function generateComponents(ctx: ReturnType<typeof createContext>): ts.Node[] {
  const { options } = ctx;
  const nodes: ts.Node[] = [];

  nodes.push(...errorTag('in component.schemas', () => generateComponentSchemas(ctx)));
  nodes.push(
    ...errorTag('in component.responses', () =>
      generateComponentRequestsAndResponses(options.oas.components?.responses, ctx)
    )
  );
  nodes.push(
    ...errorTag('in component.requestBodies', () =>
      generateComponentRequestsAndResponses(options.oas.components?.requestBodies, ctx)
    )
  );

  return nodes;
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

  const sourceFile: ts.SourceFile = ts.createSourceFile(
    'test.ts',
    '',
    ts.ScriptTarget.ES2015,
    true,
    ts.ScriptKind.TS
  );

  const src = ts
    .createPrinter()
    .printList(
      ts.ListFormat.MultiLine,
      ts.factory.createNodeArray([...builtins, ...externals, ...types, ...queryTypes]),
      sourceFile
    );

  return addIndexSignatureIgnores(src);
}
