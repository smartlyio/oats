import * as oas from 'openapi3-ts';
import * as assert from 'assert';
import * as _ from 'lodash';
import type { Driver } from './driver';
import { server } from '@smartlyio/oats-runtime';

export type SchemaObject = oas.ReferenceObject | oas.SchemaObject;

export function filterEndpointsInSpec(
  spec: oas.OpenAPIObject,
  includeEndpoints: Driver['includeEndpoints']
): oas.OpenAPIObject {
  if (includeEndpoints === undefined) {
    return spec;
  }
  const { paths, ...restSpec } = spec;
  const filteredPathEntries = Object.entries(includeEndpoints).flatMap(
    ([path, methodsUpperCase]): [string, oas.PathItemObject][] => {
      const pathObject: oas.PathItemObject = spec.paths[path];
      const includeMethods = methodsUpperCase.map(
        method => method.toLowerCase() as Lowercase<typeof method>
      );

      for (const method of includeMethods) {
        if (!pathObject?.[method]?.responses) {
          throw new Error(
            `Cannot include endpoint "${method.toUpperCase()} ${path}" - not found in the provided OpenApi spec.`
          );
        }
      }
      const filteredPathObjectEntries = Object.entries(pathObject).filter(
        ([key]) =>
          !server.supportedMethods.includes(key as server.Methods) ||
          includeMethods.includes(key as server.Methods)
      );

      if (filteredPathObjectEntries.length === 0) {
        return [];
      }

      return [[path, Object.fromEntries(filteredPathObjectEntries)]];
    }
  );
  return { ...restSpec, paths: Object.fromEntries(filteredPathEntries) };
}

export function isReferenceObject(schema: any): schema is oas.ReferenceObject {
  return !!schema.$ref;
}

export function capitalize(str: string) {
  return str[0].toUpperCase() + str.slice(1);
}

export function nonNullableClass(name: string) {
  return 'nonNullable' + typenamify(name);
}

export type NameKind = 'shape' | 'value' | 'reflection';
export type NameMapper = (name: string, kind: NameKind) => string;

export function typenamify(name: string) {
  return capitalize(name);
}

export function refToTypeName(ref: string) {
  assert(ref[0] === '#', 'Resolving only local names is allowed. Tried: ' + ref);
  return typenamify(ref.split('/').reverse()[0]);
}

function resolveRef(ref: string, schema: oas.OpenAPIObject): oas.SchemaObject | undefined {
  const name = refToTypeName(ref);
  return resolve(name, schema);
}

export function errorTag<T>(tag: string, fn: () => T): T {
  try {
    return fn();
  } catch (e: any) {
    e.message = tag + ' ' + e.message;
    throw e;
  }
}

type QueryTags = 'query' | 'parameters' | 'requestBody' | 'response' | 'response' | 'headers';
export function endpointTypeName(
  op: oas.OperationObject,
  path: string,
  method: string,
  tag: QueryTags
): string {
  return (
    tag +
    path
      .split('/')
      .map(n =>
        n
          .split(/[^0-9a-zA-Z]/)
          .filter(n => n.trim().length > 0)
          .map(capitalize)
          .join('')
      )
      .join('$') +
    '$' +
    capitalize(method)
  );
}

export function deref<T>(
  object: T | oas.ReferenceObject,
  schema: oas.OpenAPIObject,
  visited: string[] = []
): T {
  assert(object, 'null object for deref');
  if (!isReferenceObject(object)) {
    return object;
  }
  assert(
    visited.indexOf(object.$ref) < 0,
    'cycle on $ref: ' + visited.join(' -> ') + ' with ' + object.$ref
  );
  const path = object.$ref.split('/');
  assert(path[0] === '#', 'only references rooted in current document are supported');
  const nextObject = _.get(schema, path.slice(1));
  assert(nextObject, 'could not find object with $ref ' + object.$ref);
  return deref(nextObject, schema, [...visited, object.$ref]);
}

export enum UnsupportedFeatureBehaviour {
  ignore = 'ignore',
  reject = 'reject'
}

function resolve(key: string, schema: oas.OpenAPIObject): oas.SchemaObject | undefined {
  const hit = schema.components?.schemas?.[key];
  if (!hit) {
    return undefined;
  }
  if (isReferenceObject(hit)) {
    return resolveRef(hit.$ref, schema);
  }
  return hit;
}
