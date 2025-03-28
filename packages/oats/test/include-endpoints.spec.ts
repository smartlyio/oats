import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type * as oas from 'openapi3-ts';
import * as yaml from 'js-yaml';
import {
  assertEndpointsAreInSpec,
  createIncludeEndpointFilter,
  filterEndpointsInSpec
} from '../src/util';

const exampleSpecFile = readFileSync(join(__dirname, './example.yaml'), 'utf8');
const loadExampleSpec = () => yaml.load(exampleSpecFile) as oas.OpenAPIObject;

describe('filterEndpointsInSpec()', () => {
  it('returns same spec if filter always returns true', () => {
    const resultSpec = filterEndpointsInSpec(loadExampleSpec(), () => true);

    expect(resultSpec).toStrictEqual(loadExampleSpec());
  });

  it('returns empty paths if filter always returns false', () => {
    const resultSpec = filterEndpointsInSpec(loadExampleSpec(), () => false);

    expect(resultSpec).toStrictEqual({ ...loadExampleSpec(), paths: {} });
  });

  it('includes only given methods in the spec', () => {
    const resultSpec = filterEndpointsInSpec(
      loadExampleSpec(),
      createIncludeEndpointFilter({
        '/item/{id}': ['GET', 'HEAD']
      })
    );
    const { paths: originalPaths, ...originalSpec } = loadExampleSpec();

    expect(resultSpec).toStrictEqual({
      ...originalSpec,
      paths: {
        '/item/{id}': {
          head: originalPaths['/item/{id}'].head,
          get: originalPaths['/item/{id}'].get
        }
      }
    });
  });

  it('includes endpoints for multiple paths', () => {
    const resultSpec = filterEndpointsInSpec(
      loadExampleSpec(),
      createIncludeEndpointFilter({
        '/item': ['POST'],
        '/item/{id}': ['DELETE']
      })
    );
    const { paths: originalPaths, ...originalSpec } = loadExampleSpec();

    expect(resultSpec).toStrictEqual({
      ...originalSpec,
      paths: {
        '/item': {
          post: originalPaths['/item'].post
        },
        '/item/{id}': {
          delete: originalPaths['/item/{id}'].delete
        }
      }
    });
  });

  it('does not mutate the input spec', () => {
    const inputSpec = loadExampleSpec();
    filterEndpointsInSpec(inputSpec, () => false);

    expect(inputSpec).toStrictEqual(loadExampleSpec());
  });
});

describe('assertEndpointsAreInSpec()', () => {
  it('throws an error if the included endpoint does not exist', () => {
    expect(() => assertEndpointsAreInSpec({ '/item/{id}': ['POST'] }, loadExampleSpec())).toThrow(
      new Error('Endpoint "POST /item/{id}" not found in the provided OpenApi spec.')
    );
  });

  it('does not throw an error for existing endpoints', () => {
    expect(
      assertEndpointsAreInSpec(
        {
          '/item': ['POST'],
          '/item/{id}': ['GET', 'DELETE', 'HEAD']
        },
        loadExampleSpec()
      )
    ).toBeUndefined();
  });
});
