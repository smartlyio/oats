import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type * as oas from 'openapi3-ts';
import * as yaml from 'js-yaml';
import { filterEndpointsInSpec } from '../src/util';

const exampleSpecFile = readFileSync(join(__dirname, './example.yaml'), 'utf8');
const getExampleSpec = () => yaml.load(exampleSpecFile) as oas.OpenAPIObject;

describe('filterEndpointsInSpec()', () => {
  it('returns same spec if no includeEndpoints is provided', () => {
    const resultSpec = filterEndpointsInSpec(getExampleSpec(), { includeEndpoints: undefined });

    expect(resultSpec).toStrictEqual(getExampleSpec());
  });

  it('throws an error if the included endpoint does not exist', () => {
    expect(() =>
      filterEndpointsInSpec(getExampleSpec(), {
        includeEndpoints: {
          '/item/{id}': ['POST']
        }
      })
    ).toThrow(
      new Error(
        'Cannot include endpoint "POST /item/{id}" - not found in the provided OpenApi spec.'
      )
    );
  });

  it('includes only given methods in the spec', () => {
    const resultSpec = filterEndpointsInSpec(getExampleSpec(), {
      includeEndpoints: {
        '/item/{id}': ['HEAD', 'GET']
      }
    });
    const { paths: originalPaths, ...originalSpec } = getExampleSpec();

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
    const resultSpec = filterEndpointsInSpec(getExampleSpec(), {
      includeEndpoints: {
        '/item': ['POST'],
        '/item/{id}': ['DELETE']
      }
    });
    const { paths: originalPaths, ...originalSpec } = getExampleSpec();

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
    const inputSpec = getExampleSpec();
    const resultSpec = filterEndpointsInSpec(inputSpec, {
      includeEndpoints: {
        '/item': []
      }
    });
    const originalSpec = getExampleSpec();

    expect(inputSpec).toStrictEqual(originalSpec);
    expect(resultSpec).toStrictEqual({ ...originalSpec, paths: {} });
  });
});
