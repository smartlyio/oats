import * as fs from 'fs';
import * as yaml from 'js-yaml';
import * as types from './generate-types';
import * as server from './generate-server';
import * as path from 'path';
import * as oas from 'openapi3-ts';
import { UnsupportedFeatureBehaviour, refToTypeName, capitalize } from './util';
import { Resolve } from './generate-types';

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
  externalOpenApiImports?: readonly ImportDefinition[];
  externalOpenApiSpecs?: (url: string) => string | undefined;
  header: string;
  generatedServerFile?: string;
  generatedClientFile?: string;
  runtimeFilePath?: string; // set path to runtime directly for testing
  emitStatusCode?: (statusCode: number) => boolean;
  unsupportedFeatures?: {
    security?: UnsupportedFeatureBehaviour;
  };
}

function emitAllStatusCodes() {
  return true;
}

function defaultResolve() {
  return undefined;
}

export function localResolve(ref: string) {
  if (ref[0] === '#') {
    return { name: refToTypeName(ref) };
  }
}

export function compose(...fns: types.Resolve[]): types.Resolve {
  return (ref, options) => {
    for (const f of fns) {
      const match = f(ref, options);
      if (match) {
        return match;
      }
    }
  };
}

function makeModuleName(filename: string): string {
  const parts = path
    .basename(filename)
    .replace(/\.[^.]*$/, '')
    .split(/[^a-zA-Z0-9]/);
  return [parts[0], ...parts.slice(1).map(capitalize)].join('');
}

export function generateFile(): types.Resolve {
  return (ref: string, options: types.Options) => {
    if (ref[0] === '#') {
      return;
    }
    const localName = ref.replace(/^[^#]+/, '');
    const fileName = ref.replace(/#.+$/, '');
    const ymlFile = path.resolve(path.dirname(options.sourceFile), fileName);
    const generatedFileName = `${path.basename(ymlFile).replace(/\.[^.]*$/, '')}.types.generated`;
    const moduleName = makeModuleName(fileName);
    const generatedFile = path.dirname(options.targetFile) + '/' + generatedFileName;

    return {
      importAs: moduleName,
      importFrom: generatedFile,
      name: refToTypeName(localName),
      generate: () => {
        generate({
          openapiFilePath: ymlFile,
          header: options.header,
          generatedValueClassFile: generatedFile + '.ts',
          resolve: options.resolve,
          externalOpenApiSpecs: options.externalOpenApiSpecs,
          externalOpenApiImports: options.externalOpenApiImports,
          emitStatusCode: options.emitStatusCode,
          unsupportedFeatures: options.unsupportedFeatures
        });
      }
    };
  };
}

export function generate(driver: Driver) {
  const file = fs.readFileSync(driver.openapiFilePath, 'utf8');
  const spec: oas.OpenAPIObject = yaml.load(file);

  types.deprecated(
    driver.generatedServerFile && driver.generatedClientFile,
    'generating both server and client files from the same definition is frowned upon and will be prevented later on'
  );
  fs.writeFileSync(
    driver.generatedValueClassFile,
    driver.header +
      '\n' +
      types.run({
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
        emitStatusCode: driver.emitStatusCode || emitAllStatusCodes
      })
  );

  if (driver.generatedClientFile) {
    fs.writeFileSync(
      driver.generatedClientFile,
      server.run({
        oas: spec,
        runtimePath: modulePath(driver.generatedClientFile, driver.runtimeFilePath),
        typePath: modulePath(driver.generatedClientFile, driver.generatedValueClassFile),
        shapesAsResponses: false,
        shapesAsRequests: true,
        unsupportedFeatures: {
          security: driver.unsupportedFeatures?.security ?? UnsupportedFeatureBehaviour.reject
        }
      })
    );
  }
  if (driver.generatedServerFile) {
    fs.writeFileSync(
      driver.generatedServerFile,
      server.run({
        oas: spec,
        runtimePath: modulePath(driver.generatedServerFile, driver.runtimeFilePath),
        typePath: modulePath(driver.generatedServerFile, driver.generatedValueClassFile),
        shapesAsRequests: false,
        shapesAsResponses: true,
        unsupportedFeatures: {
          security: driver.unsupportedFeatures?.security ?? UnsupportedFeatureBehaviour.reject
        }
      })
    );
  }
}

// Re-exporting to expose a more unified  API via the 'driver' module.
//  People are free to import straight out of 'util' but that's up to them.
export { UnsupportedFeatureBehaviour };
