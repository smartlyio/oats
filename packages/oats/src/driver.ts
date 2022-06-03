import * as fs from 'fs';
import * as yaml from 'js-yaml';
import * as types from './generate-types';
import { AdditionalPropertiesIndexSignature, Resolve } from './generate-types';
import * as server from './generate-server';
import * as path from 'path';
import * as oas from 'openapi3-ts';
import {
  capitalize,
  NameKind,
  NameMapper,
  refToTypeName,
  UnsupportedFeatureBehaviour
} from './util';

export { AdditionalPropertiesIndexSignature } from './generate-types';

function modulePath(importer: string, module: string | undefined) {
  if (!module) {
    return '@smartlyio/oats-runtime';
  }
  let p = path.relative(path.dirname(importer), path.dirname(module));
  if (p[0] !== '.') {
    p = './' + p;
  }
  if (p[p.length - 1] !== '/') {
    p = p + '/';
  }
  p = p + path.basename(module, '.ts');
  return p;
}

export interface ImportDefinition {
  importFile: string;
  importAs: string;
}

export interface Driver {
  openapiFilePath: string;
  generatedValueClassFile: string;
  resolve?: Resolve;
  /** @deprecated Consider using 'resolve' instead */
  externalOpenApiImports?: readonly ImportDefinition[];
  /** @deprecated Consider using 'resolve' instead */
  externalOpenApiSpecs?: (url: string) => string | undefined;
  header?: string;
  generatedServerFile?: string;
  generatedClientFile?: string;
  runtimeFilePath?: string; // set path to runtime directly for testing
  emitStatusCode?: (statusCode: number) => boolean;
  unsupportedFeatures?: {
    security?: UnsupportedFeatureBehaviour;
  };
  forceGenerateTypes?: boolean; // output the type file even if it would have been already generated
  /** property name mapper for object properties
   *  ex. to map 'snake_case' property in network format to property 'camelCase' usable in ts code provide mapper
   *  > propertyNameMapper: (p) => p === 'snake_case ? 'camelCase' : p
   * */
  propertyNameMapper?: (openapiPropertyName: string) => string;
  nameMapper?: NameMapper; // mapping function to customize generated shape/value/reflect names
  /** if true emit union type with undefined for additionalProperties. Default is *true*.
   *  Note! Likely the default will be set to false later. Now like this to avoid
   *  breaking typechecking for existing projects.
   *
   * Typescript can be {@link https://www.typescriptlang.org/tsconfig#noUncheckedIndexedAccess configured } to consider
   *  index signature accesses to have implicit undefined type so we can let the caller decide on the level of safety they want.
   * */
  emitUndefinedForIndexTypes?: boolean;
  /** If 'AdditionalPropertiesIndexSignature.emit' or not set emit
   * `[key: string]: unknown`
   * for objects with `additionalProperties: true` or no additionalProperties set
   * NOTE: the resulting runtime value may still have extra properties even if those are not visible in the type
   * */
  unknownAdditionalPropertiesIndexSignature?: AdditionalPropertiesIndexSignature;
}

interface GenerateFileOptions {
  preservePathStructure?: boolean;
}

function emitAllStatusCodes() {
  return true;
}

function defaultResolve() {
  return undefined;
}

export function localResolve(ref: string, options: types.Options, kind: NameKind) {
  if (ref[0] === '#') {
    return {
      name: options.nameMapper(refToTypeName(ref), kind)
    };
  }
  return;
}

export function compose(...fns: types.Resolve[]): types.Resolve {
  return (ref, options, kind) => {
    for (const f of fns) {
      const match = f(ref, options, kind);
      if (match) {
        return match;
      }
    }
    return;
  };
}

function localNameMapper(name: string, nameKind: NameKind): string {
  // name begins with non-alphabet is prefixed with 'Type'
  const sanitizedName = name.match(/^[^a-zA-Z]/) ? 'Type' + name : name;
  const capitalizedName = capitalize(sanitizedName);
  switch (nameKind) {
    case 'shape':
      return 'ShapeOf' + capitalizedName;
    case 'value':
      return capitalizedName;
    case 'reflection':
      return 'type' + capitalizedName;
    default:
      return capitalizedName;
  }
}

function makeModuleName(filename: string, keepDirectoryName = false): string {
  const filePath = keepDirectoryName ? filename : path.basename(filename);
  const parts = filePath.replace(/\.[^.]*$/, '').split(/[^a-zA-Z0-9]/);
  return [
    parts[0],
    ...parts
      .slice(1)
      .filter(str => str.length > 0)
      .map(capitalize)
  ].join('');
}

export function generateFile(opts?: GenerateFileOptions): types.Resolve {
  const preservePathStructure = opts && opts.preservePathStructure;
  return (ref: string, options: types.Options, kind: NameKind) => {
    if (ref[0] === '#') {
      return;
    }
    const localName = ref.replace(/^[^#]+/, '');
    const fileName = ref.replace(/#.+$/, '');
    const ymlFile = path.resolve(path.dirname(options.sourceFile), fileName);
    const generatedFilePath = preservePathStructure ? fileName : path.basename(ymlFile);
    const generatedFileName = `${generatedFilePath.replace(/\.[^.]*$/, '')}.types.generated`;
    const moduleName = makeModuleName(fileName, preservePathStructure);
    const generatedFile = './' + path.dirname(options.targetFile) + '/' + generatedFileName;
    if (preservePathStructure) {
      fs.mkdirSync(path.dirname(generatedFile), { recursive: true });
    }
    return {
      importAs: moduleName,
      importFrom: generatedFile,
      name: options.nameMapper(refToTypeName(localName), kind),
      generate: () => {
        generate({
          forceGenerateTypes: true,
          openapiFilePath: ymlFile,
          header: options.header,
          generatedValueClassFile: generatedFile + '.ts',
          resolve: options.resolve,
          externalOpenApiSpecs: options.externalOpenApiSpecs,
          externalOpenApiImports: options.externalOpenApiImports,
          emitStatusCode: options.emitStatusCode,
          emitUndefinedForIndexTypes: options.emitUndefinedForIndexTypes,
          unknownAdditionalPropertiesIndexSignature:
            options.unknownAdditionalPropertiesIndexSignature,
          unsupportedFeatures: options.unsupportedFeatures,
          nameMapper: options.nameMapper,
          propertyNameMapper: options.propertyNameMapper
        });
      }
    };
  };
}

export function generate(driver: Driver) {
  const file = fs.readFileSync(driver.openapiFilePath, 'utf8');
  const spec: oas.OpenAPIObject = yaml.load(file) as any;
  const header = driver.header ? driver.header + '\n' : '';

  types.deprecated(
    driver.generatedServerFile && driver.generatedClientFile,
    'generating both server and client files from the same definition is frowned upon and will be prevented later on'
  );
  fs.mkdirSync(path.dirname(driver.generatedValueClassFile), { recursive: true });
  const typeSource = types.run({
    forceGenerateTypes: driver.forceGenerateTypes,
    header: driver.header || '',
    sourceFile: driver.openapiFilePath,
    targetFile: driver.generatedValueClassFile,
    resolve: driver.resolve || defaultResolve,
    externalOpenApiImports: (driver.externalOpenApiImports || []).map(i => ({
      importFile: i.importFile,
      importAs: i.importAs
    })),
    externalOpenApiSpecs: driver.externalOpenApiSpecs,
    oas: spec,
    runtimeModule: modulePath(driver.generatedValueClassFile, driver.runtimeFilePath),
    emitStatusCode: driver.emitStatusCode || emitAllStatusCodes,
    nameMapper: driver.nameMapper || localNameMapper,
    propertyNameMapper: driver.propertyNameMapper,
    emitUndefinedForIndexTypes: driver.emitUndefinedForIndexTypes ?? true,
    unknownAdditionalPropertiesIndexSignature:
      driver.unknownAdditionalPropertiesIndexSignature ?? AdditionalPropertiesIndexSignature.emit
  });
  if (typeSource) {
    fs.writeFileSync(driver.generatedValueClassFile, header + typeSource);
  }

  if (driver.generatedClientFile) {
    fs.mkdirSync(path.dirname(driver.generatedClientFile), { recursive: true });
    fs.writeFileSync(
      driver.generatedClientFile,
      header +
        server.run({
          oas: spec,
          runtimePath: modulePath(driver.generatedClientFile, driver.runtimeFilePath),
          typePath: modulePath(driver.generatedClientFile, driver.generatedValueClassFile),
          shapesAsResponses: false,
          shapesAsRequests: true,
          unsupportedFeatures: {
            security: driver.unsupportedFeatures?.security ?? UnsupportedFeatureBehaviour.reject
          },
          nameMapper: driver.nameMapper || localNameMapper
        })
    );
  }
  if (driver.generatedServerFile) {
    fs.mkdirSync(path.dirname(driver.generatedServerFile), { recursive: true });
    fs.writeFileSync(
      driver.generatedServerFile,
      header +
        server.run({
          oas: spec,
          runtimePath: modulePath(driver.generatedServerFile, driver.runtimeFilePath),
          typePath: modulePath(driver.generatedServerFile, driver.generatedValueClassFile),
          shapesAsRequests: false,
          shapesAsResponses: true,
          unsupportedFeatures: {
            security: driver.unsupportedFeatures?.security ?? UnsupportedFeatureBehaviour.reject
          },
          nameMapper: driver.nameMapper || localNameMapper
        })
    );
  }
}

// Re-exporting to expose a more unified  API via the 'driver' module.
//  People are free to import straight out of 'util' but that's up to them.
export { UnsupportedFeatureBehaviour };
