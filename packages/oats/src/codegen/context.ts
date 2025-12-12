/**
 * Generation context that replaces closure-based access to options and state.
 * Passed explicitly to all code generation functions.
 */

import * as ts from 'typescript';
import * as oas from 'openapi3-ts';
import * as path from 'path';
import { NameKind, NameMapper, UnsupportedFeatureBehaviour } from '../util';

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

export type Resolve = (
  ref: string,
  options: Options,
  kind: NameKind
) =>
  | { importAs: string; importFrom: string; name: string; generate?: () => Promise<void> }
  | { name: string }
  | undefined;

export enum AdditionalPropertiesIndexSignature {
  emit = 'emit',
  omit = 'omit'
}

export interface GenerationState {
  cwd: string;
  imports: Record<string, string>;
  actions: Array<() => Promise<void>>;
}

/**
 * Context passed to all generation functions, providing access to options
 * and state management functions.
 */
export interface GenerationContext {
  readonly options: Options;

  /**
   * Add an import to the generated file.
   */
  addImport(importAs: string, importFile: string | undefined, action?: () => Promise<void>): void;

  /**
   * Resolve a $ref to a type name, potentially from an external module.
   */
  resolveRefToTypeName(ref: string, kind: NameKind): { qualified?: ts.Identifier; member: string };
}

/**
 * Creates a generation context from options and state.
 */
export function createContext(
  options: Options,
  state: GenerationState,
  generatedFiles: Set<string>
): GenerationContext {
  return {
    options,

    addImport(
      importAs: string,
      importFile: string | undefined,
      action?: () => Promise<void>
    ): void {
      if (!state.imports[importAs]) {
        if (importFile) {
          importFile = /^(\.|\/)/.test(importFile)
            ? './' + path.normalize(importFile)
            : importFile;
          state.imports[importAs] = importFile;
          if (action) {
            if (generatedFiles.has(importFile)) {
              return;
            }
            generatedFiles.add(importFile);
            state.actions.push(action);
          }
        }
      }
    },

    resolveRefToTypeName(
      ref: string,
      kind: NameKind
    ): { qualified?: ts.Identifier; member: string } {
      const external = options.resolve(ref, options, kind);
      if (external) {
        if ('importAs' in external) {
          const importAs = external.importAs;
          this.addImport(importAs, external.importFrom, external.generate);
          return { member: external.name, qualified: ts.factory.createIdentifier(importAs) };
        }
        return { member: external.name };
      }
      if (ref[0] === '#') {
        const refToTypeName = (r: string) => {
          const name = r.split('/').reverse()[0];
          return name[0].toUpperCase() + name.slice(1);
        };
        return { member: options.nameMapper(refToTypeName(ref), kind) };
      }
      throw new Error('could not resolve typename for ' + ref);
    }
  };
}

