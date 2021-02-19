import * as fs from 'fs';
import * as yaml from 'js-yaml';
import * as runtime from '@smartlyio/oats-runtime';
import * as glob from 'fast-glob';
import * as _ from 'lodash';
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
  header?: string;
  generatedServerFile?: string;
  generatedClientFile?: string;
  runtimeFilePath?: string; // set path to runtime directly for testing
  emitStatusCode?: (statusCode: number) => boolean;
  unsupportedFeatures?: {
    security?: UnsupportedFeatureBehaviour;
  };
  forceGenerateTypes?: boolean; // output the type file even if it would have been already generated
}

export interface GenerateNPMRelativePatsOptions {
  refScheme: string;
  openapiDir: string;
  outputFormat?: 'json' | 'yaml';
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
  return;
}

export function compose(...fns: types.Resolve[]): types.Resolve {
  return (ref, options) => {
    for (const f of fns) {
      const match = f(ref, options);
      if (match) {
        return match;
      }
    }
    return;
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
    const generatedFile = './' + path.dirname(options.targetFile) + '/' + generatedFileName;
    return {
      importAs: moduleName,
      importFrom: generatedFile,
      name: refToTypeName(localName),
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
          unsupportedFeatures: options.unsupportedFeatures
        });
      }
    };
  };
}

export function generate(driver: Driver) {
  const file = fs.readFileSync(driver.openapiFilePath, 'utf8');
  const spec: oas.OpenAPIObject = yaml.load(file);
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
    emitStatusCode: driver.emitStatusCode || emitAllStatusCodes
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
          }
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
          }
        })
    );
  }
}

export function resolveModuleRef(dependencyPackages: string[], scheme = 'npm://'): Resolve {
  return (ref: string) => {
    if (!ref.startsWith(scheme)) {
      return;
    }
    const cleanRef = ref.replace(scheme, '');
    for (let i = 0; i < dependencyPackages.length; i++) {
      const dependency = dependencyPackages[i];
      if (cleanRef.startsWith(dependency)) {
        const packageNamePath = dependency.split('/');
        return {
          importAs: packageNamePath
            .pop()!
            .toLowerCase()
            .replace(/-(.)/g, (value, group) => group.toUpperCase()),
          importFrom: dependency,
          name: cleanRef.split('#').pop()!
        };
      }
    }
  };
}

export function generateNPMRelativePaths(
  baseFile: string,
  dependencies: { [key: string]: string },
  outputFile: string,
  opts: GenerateNPMRelativePatsOptions = {
    refScheme: 'npm://',
    openapiDir: 'openapi',
    outputFormat: 'yaml'
  }
) {
  const openAPIYamlString = fs.readFileSync(baseFile).toString();
  let openAPIData = yaml.load(openAPIYamlString);
  if (!openAPIData) return;
  openAPIData = runtime.map(openAPIData, _.isString, (npmReference, traversalPath) => {
    if (
      traversalPath[traversalPath.length - 1] !== '$ref' ||
      !npmReference.startsWith(opts.refScheme)
    ) {
      return npmReference;
    }
    const [packageName, schemaName] = npmReference.replace(opts.refScheme, '').split('#');
    if (!dependencies[packageName]) {
      throw new Error(`NPM package reference ${packageName} not found in project dependencies!`);
    }
    const packageOpenAPIDirectory = path.join('node_modules', packageName, opts.openapiDir);
    const cleanLibName = packageName.split('/').pop();
    const targetOpenAPIDirectory = path.join(opts.openapiDir, cleanLibName!);
    let schemaOpenApiFile: string | undefined;
    const globPath = path.join(packageOpenAPIDirectory, '**', '*.{yml,yaml}');
    glob.sync([globPath]).map((filePath: string) => {
      const targetFilePath = filePath.replace(packageOpenAPIDirectory, targetOpenAPIDirectory);
      if (!fs.existsSync(path.dirname(targetFilePath))) {
        fs.mkdirSync(path.dirname(targetFilePath), { recursive: true });
      }
      fs.copyFileSync(filePath, targetFilePath);
      const ymlData = yaml.load(fs.readFileSync(targetFilePath).toString());
      if (_.has(ymlData, ['components', 'schemas', schemaName])) {
        schemaOpenApiFile = targetFilePath;
      }
    });

    if (!schemaOpenApiFile) {
      throw new Error(`Referenced ${schemaName} wasn't found inside ${packageName}/openapi files`);
    }

    return `${path.relative('openapi', schemaOpenApiFile)}#/components/schemas/${schemaName}`;
  });
  const outputText =
    opts.outputFormat === 'json'
      ? JSON.stringify(openAPIData, null, 2)
      : yaml.dump(openAPIData, { indent: 2 });
  fs.writeFileSync(outputFile, outputText);
}

// Re-exporting to expose a more unified  API via the 'driver' module.
//  People are free to import straight out of 'util' but that's up to them.
export { UnsupportedFeatureBehaviour };
