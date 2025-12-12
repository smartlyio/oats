import * as ts from 'typescript';
import * as oas from 'openapi3-ts';
import { createContext, GenerationState, Options } from '../../src/codegen/context';
import {
  generateContentSchemaType,
  generateHeadersSchemaType,
  generateQueryType,
  generateParameterType,
  generateRequestBodyType,
  generateResponseType
} from '../../src/codegen/query-types';

function printNode(node: ts.Node): string {
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  const sourceFile = ts.createSourceFile('test.ts', '', ts.ScriptTarget.Latest);
  return printer.printNode(ts.EmitHint.Unspecified, node, sourceFile);
}

function printNodes(nodes: readonly ts.Node[]): string {
  return nodes.map(printNode).join('\n');
}

function createTestContext(optionOverrides: Partial<Options> = {}) {
  const oasSpec: oas.OpenAPIObject = {
    openapi: '3.0.0',
    info: { title: 'Test', version: '1.0.0' },
    paths: {}
  };

  const options: Options = {
    header: '',
    sourceFile: './test.yaml',
    targetFile: './test.generated.ts',
    resolve: () => undefined,
    oas: oasSpec,
    runtimeModule: '@smartlyio/oats-runtime',
    emitStatusCode: () => true,
    nameMapper: (name, kind) => {
      const capitalized = name.charAt(0).toUpperCase() + name.slice(1);
      if (kind === 'shape') return 'ShapeOf' + capitalized;
      if (kind === 'reflection') return 'type' + capitalized;
      return capitalized;
    },
    ...optionOverrides
  };

  const state: GenerationState = {
    cwd: '.',
    imports: {},
    actions: []
  };

  return createContext(options, state, new Set());
}

describe('codegen/query-types', () => {
  describe('generateContentSchemaType', () => {
    it('generates schema for single content type', () => {
      const result = generateContentSchemaType({
        'application/json': { schema: { type: 'object' } }
      });
      expect(result).toEqual({
        oneOf: [{
          type: 'object',
          properties: {
            contentType: { type: 'string', enum: ['application/json'] },
            value: { type: 'object' }
          },
          required: ['contentType', 'value'],
          additionalProperties: false
        }]
      });
    });

    it('generates union schema for multiple content types', () => {
      const result = generateContentSchemaType({
        'application/json': { schema: { type: 'object' } },
        'text/plain': { schema: { type: 'string' } }
      });
      expect(result.oneOf).toHaveLength(2);
      expect(result.oneOf![0].properties?.contentType.enum).toEqual(['application/json']);
      expect(result.oneOf![1].properties?.contentType.enum).toEqual(['text/plain']);
    });
  });

  describe('generateHeadersSchemaType', () => {
    it('generates schema for required header', () => {
      const result = generateHeadersSchemaType({
        'X-Request-Id': { schema: { type: 'string' }, required: true }
      });
      expect(result).toEqual({
        type: 'object',
        properties: { 'X-Request-Id': { type: 'string' } },
        required: ['X-Request-Id'],
        additionalProperties: { type: 'string' }
      });
    });

    it('generates schema for optional header', () => {
      const result = generateHeadersSchemaType({
        'X-Request-Id': { schema: { type: 'string' } }
      });
      expect(result.required).toEqual([]);
    });

    it('generates schema for reference header', () => {
      const result = generateHeadersSchemaType({
        'X-Request-Id': { $ref: '#/components/headers/RequestId' }
      });
      expect(result.properties?.['X-Request-Id']).toEqual({ $ref: '#/components/headers/RequestId' });
      expect(result.required).toContain('X-Request-Id');
    });
  });

  describe('generateQueryType', () => {
    it('generates empty object for no parameters', () => {
      const ctx = createTestContext();
      const result = generateQueryType('GetUsersQuery', undefined, ctx.options.oas, ctx);
      const printed = printNodes(result);
      expect(printed).toContain('export type ShapeOfGetUsersQuery');
      expect(printed).toContain('export class GetUsersQuery');
    });

    it('generates empty object for parameters with no query params', () => {
      const ctx = createTestContext();
      const params: oas.ParameterObject[] = [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
      ];
      const result = generateQueryType('GetUserQuery', params, ctx.options.oas, ctx);
      const printed = printNodes(result);
      expect(printed).toContain('export class GetUserQuery');
    });

    it('generates type for query parameters', () => {
      const ctx = createTestContext();
      const params: oas.ParameterObject[] = [
        { name: 'limit', in: 'query', required: true, schema: { type: 'integer' } },
        { name: 'offset', in: 'query', schema: { type: 'integer' } }
      ];
      const result = generateQueryType('ListUsersQuery', params, ctx.options.oas, ctx);
      const printed = printNodes(result);
      expect(printed).toContain('readonly limit!: number;');
      expect(printed).toContain('readonly offset?: number;');
    });

    it('handles exploded object parameter', () => {
      const ctx = createTestContext();
      const params: oas.ParameterObject[] = [{
        name: 'filter',
        in: 'query',
        explode: true,
        schema: {
          type: 'object',
          properties: { name: { type: 'string' } },
          additionalProperties: false
        }
      }];
      const result = generateQueryType('SearchQuery', params, ctx.options.oas, ctx);
      const printed = printNodes(result);
      expect(printed).toContain('readonly name?: string;');
    });
  });

  describe('generateParameterType', () => {
    it('generates void for no parameters', () => {
      const ctx = createTestContext();
      const result = generateParameterType('path', 'GetUsersParams', undefined, ctx.options.oas, ctx);
      const printed = printNodes(result);
      expect(printed).toContain('export type GetUsersParams = void;');
    });

    it('generates void for parameters with no matching type', () => {
      const ctx = createTestContext();
      const params: oas.ParameterObject[] = [
        { name: 'limit', in: 'query', schema: { type: 'integer' } }
      ];
      const result = generateParameterType('path', 'GetUsersParams', params, ctx.options.oas, ctx);
      const printed = printNodes(result);
      expect(printed).toContain('export type GetUsersParams = void;');
    });

    it('generates type for path parameters', () => {
      const ctx = createTestContext();
      const params: oas.ParameterObject[] = [
        { name: 'userId', in: 'path', required: true, schema: { type: 'string' } },
        { name: 'postId', in: 'path', required: true, schema: { type: 'integer' } }
      ];
      const result = generateParameterType('path', 'GetPostParams', params, ctx.options.oas, ctx);
      const printed = printNodes(result);
      expect(printed).toContain('readonly userId!: string;');
      expect(printed).toContain('readonly postId!: number;');
    });

    it('generates type for header parameters', () => {
      const ctx = createTestContext();
      const params: oas.ParameterObject[] = [
        { name: 'X-Api-Key', in: 'header', required: true, schema: { type: 'string' } }
      ];
      const result = generateParameterType('header', 'AuthHeaders', params, ctx.options.oas, ctx);
      const printed = printNodes(result);
      expect(printed).toContain('readonly "X-Api-Key"!: string;');
    });

    it('applies normalize function to header names', () => {
      const ctx = createTestContext();
      const params: oas.ParameterObject[] = [
        { name: 'X-Api-Key', in: 'header', required: true, schema: { type: 'string' } }
      ];
      const result = generateParameterType(
        'header',
        'AuthHeaders',
        params,
        ctx.options.oas,
        ctx,
        name => name.toLowerCase()
      );
      const printed = printNodes(result);
      expect(printed).toContain('readonly "x-api-key"!: string;');
    });
  });

  describe('generateRequestBodyType', () => {
    it('generates void for no request body', () => {
      const ctx = createTestContext();
      const result = generateRequestBodyType('CreateUserBody', undefined, ctx);
      const printed = printNodes(result);
      expect(printed).toContain('export type CreateUserBody = void;');
    });

    it('generates reference type for reference request body', () => {
      const ctx = createTestContext();
      const result = generateRequestBodyType('CreateUserBody', { $ref: '#/components/requestBodies/UserInput' }, ctx);
      const printed = printNodes(result);
      expect(printed).toContain('export type CreateUserBody = UserInput;');
    });

    it('generates content schema for required request body', () => {
      const ctx = createTestContext();
      const result = generateRequestBodyType('CreateUserBody', {
        required: true,
        content: {
          'application/json': { schema: { type: 'object', properties: { name: { type: 'string' } } } }
        }
      }, ctx);
      const printed = printNodes(result);
      expect(printed).toContain('readonly contentType');
      expect(printed).toContain('"application/json"');
    });

    it('generates optional union for non-required request body', () => {
      const ctx = createTestContext();
      const result = generateRequestBodyType('UpdateUserBody', {
        content: {
          'application/json': { schema: { type: 'object' } }
        }
      }, ctx);
      const printed = printNodes(result);
      expect(printed).toContain('type: "union"');
    });
  });

  describe('generateResponseType', () => {
    it('generates response type for single status code', () => {
      const ctx = createTestContext();
      const result = generateResponseType('GetUserResponse', {
        '200': {
          description: 'Success',
          content: {
            'application/json': { schema: { type: 'object', properties: { id: { type: 'string' } } } }
          }
        }
      }, ctx);
      const printed = printNodes(result);
      expect(printed).toContain('readonly status');
      expect(printed).toContain('readonly value');
      expect(printed).toContain('readonly headers');
    });

    it('generates union response type for multiple status codes', () => {
      const ctx = createTestContext();
      const result = generateResponseType('CreateUserResponse', {
        '200': {
          description: 'Success',
          content: { 'application/json': { schema: { type: 'object' } } }
        },
        '400': {
          description: 'Bad request',
          content: { 'application/json': { schema: { type: 'object', properties: { error: { type: 'string' } } } } }
        }
      }, ctx);
      const printed = printNodes(result);
      expect(printed).toContain('type: "union"');
    });

    it('generates void for empty responses', () => {
      const ctx = createTestContext({ emitStatusCode: () => false });
      const result = generateResponseType('DeleteUserResponse', {
        '204': { description: 'No content' }
      }, ctx);
      const printed = printNodes(result);
      expect(printed).toContain('export type DeleteUserResponse = void;');
    });

    it('generates null content for response without content', () => {
      const ctx = createTestContext();
      const result = generateResponseType('NoContentResponse', {
        '204': { description: 'No content' }
      }, ctx);
      const printed = printNodes(result);
      expect(printed).toContain('oatsNoContent');
    });

    it('includes response headers in schema', () => {
      const ctx = createTestContext();
      const result = generateResponseType('GetUserResponse', {
        '200': {
          description: 'Success',
          content: { 'application/json': { schema: { type: 'object' } } },
          headers: {
            'X-Request-Id': { schema: { type: 'string' }, required: true }
          }
        }
      }, ctx);
      const printed = printNodes(result);
      expect(printed).toContain('X-Request-Id');
    });

    it('handles reference response', () => {
      const ctx = createTestContext();
      const result = generateResponseType('GetUserResponse', {
        '200': { $ref: '#/components/responses/UserResponse' }
      }, ctx);
      const printed = printNodes(result);
      expect(printed).toContain('type: "named"');
    });

    it('respects emitStatusCode filter', () => {
      const ctx = createTestContext({ emitStatusCode: code => code < 400 });
      const result = generateResponseType('GetUserResponse', {
        '200': {
          description: 'Success',
          content: { 'application/json': { schema: { type: 'object' } } }
        },
        '500': {
          description: 'Error',
          content: { 'application/json': { schema: { type: 'object' } } }
        }
      }, ctx);
      const printed = printNodes(result);
      expect(printed).toContain('200');
      expect(printed).not.toContain('500');
    });
  });
});
