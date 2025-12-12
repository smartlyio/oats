/**
 * Query, parameter, and response type generators for API endpoints.
 */

import * as oas from 'openapi3-ts';
import * as assert from 'assert';
import { deref, isReferenceObject, endpointTypeName, errorTag } from '../util';
import { resolvedStatusCodes } from '../status-codes';
import { GenerationContext } from './context';
import { generateTopLevelType } from './makers';

/** Schema representing void type (used for empty responses/requests). */
const voidSchema: oas.SchemaObject = { type: 'void' as unknown as 'string' };

/**
 * Generates the schema type for content types (request body, response).
 */
export function generateContentSchemaType(content: oas.ContentObject): oas.SchemaObject {
  const contentTypeSchemas = Object.keys(content).map(contentType =>
    errorTag(`contentType '${contentType}'`, () => {
      const mediaObject: oas.MediaTypeObject = content[contentType];
      const schema: oas.SchemaObject = {
        type: 'object',
        properties: {
          contentType: {
            type: 'string',
            enum: [contentType]
          },
          value: mediaObject.schema || assert.fail('missing schema')
        },
        required: ['contentType', 'value'],
        additionalProperties: false
      };
      return schema;
    })
  );

  return { oneOf: contentTypeSchemas };
}

/**
 * Generates the schema type for response headers.
 */
export function generateHeadersSchemaType(headers: oas.HeadersObject): oas.SchemaObject {
  const required: string[] = [];
  const properties = Object.entries(headers).reduce((memo, [headerName, headerObject]) => {
    if (isReferenceObject(headerObject)) {
      required.push(headerName);
      return { ...memo, [headerName]: headerObject };
    } else if (headerObject.schema) {
      if (headerObject.required) required.push(headerName);
      return { ...memo, [headerName]: headerObject.schema };
    }
    return memo;
  }, {} as { [key: string]: oas.SchemaObject | oas.ReferenceObject });

  return {
    type: 'object',
    properties,
    required,
    additionalProperties: { type: 'string' }
  };
}

/**
 * Generates query parameter types for an endpoint.
 */
export function generateQueryType(
  op: string,
  paramSchema: undefined | ReadonlyArray<oas.ParameterObject | oas.ReferenceObject>,
  oasSchema: oas.OpenAPIObject,
  ctx: GenerationContext
): readonly string[] {
  const noQueryParams = { type: 'object' as const, additionalProperties: false };

  if (!paramSchema) {
    return generateTopLevelType(op, noQueryParams, ctx);
  }

  const schema = deref(paramSchema, oasSchema);
  const queryParams = schema.map(s => deref(s, oasSchema)).filter(s => s.in === 'query');

  if (queryParams.length === 0) {
    return generateTopLevelType(op, noQueryParams, ctx);
  }

  if (
    queryParams.some(
      param =>
        !!param.explode &&
        (isReferenceObject(param.schema) ||
          param.schema?.type === 'object' ||
          param.schema?.allOf ||
          param.schema?.oneOf ||
          param.schema?.anyOf)
    )
  ) {
    assert(
      queryParams.length === 1,
      'only one query parameter is supported when the query parameter schema is a reference, object or compound'
    );
    const param = queryParams[0];
    return generateTopLevelType(op, param.schema || {}, ctx);
  }

  const jointSchema: oas.SchemaObject = {
    type: 'object',
    additionalProperties: false,
    required: queryParams.filter(param => param.required).map(param => param.name),
    properties: queryParams.reduce(
      (memo: Record<string, oas.SchemaObject | oas.ReferenceObject>, param) => {
        if (param.schema) {
          memo[param.name] = param.schema;
        }
        return memo;
      },
      {}
    )
  };

  return generateTopLevelType(op, jointSchema, ctx);
}

/**
 * Generates path or header parameter types for an endpoint.
 */
export function generateParameterType(
  type: 'path' | 'header',
  op: string,
  paramSchema: undefined | ReadonlyArray<oas.ParameterObject | oas.ReferenceObject>,
  oasSchema: oas.OpenAPIObject,
  ctx: GenerationContext,
  normalize = (name: string) => name
): readonly string[] {
  const empty = generateTopLevelType(op, voidSchema, ctx);

  if (!paramSchema) {
    return empty;
  }

  const schema = deref(paramSchema, oasSchema);
  const pathParams = schema.map(s => deref(s, oasSchema)).filter(s => s.in === type);

  if (pathParams.length === 0) {
    return empty;
  }

  const required: string[] = [];
  pathParams.forEach(paramOrRef => {
    const param = deref(paramOrRef, oasSchema);
    if (param.required) {
      required.push(normalize(param.name));
    }
  });

  const jointSchema: oas.SchemaObject = {
    type: 'object',
    additionalProperties: false,
    required,
    properties: pathParams.reduce(
      (memo: Record<string, oas.SchemaObject | oas.ReferenceObject>, param) => {
        if (param.schema) {
          memo[normalize(param.name)] = param.schema;
        }
        return memo;
      },
      {}
    )
  };

  return generateTopLevelType(op, jointSchema, ctx);
}

/**
 * Generates request body type for an endpoint.
 */
export function generateRequestBodyType(
  op: string,
  requestBody: undefined | oas.ReferenceObject | oas.RequestBodyObject,
  ctx: GenerationContext
): readonly string[] {
  if (requestBody == null) {
    return generateTopLevelType(op, voidSchema, ctx);
  }

  if (isReferenceObject(requestBody)) {
    return generateTopLevelType(op, { $ref: requestBody.$ref }, ctx);
  }

  // requestBody is not required by default https://swagger.io/docs/specification/describing-request-body/
  if (requestBody.required === true) {
    return generateTopLevelType(op, generateContentSchemaType(requestBody.content), ctx);
  }

  return generateTopLevelType(
    op,
    {
      oneOf: [generateContentSchemaType(requestBody.content), voidSchema]
    },
    ctx
  );
}

/**
 * Generates response type for an endpoint.
 */
export function generateResponseType(
  op: string,
  responses: oas.ResponsesObject,
  ctx: GenerationContext
): readonly string[] {
  const { options } = ctx;

  if (!responses) {
    return assert.fail('missing responses');
  }

  const statusesByCode = resolvedStatusCodes(Object.keys(responses));
  const responseSchemas: oas.SchemaObject[] = [];

  Object.keys(responses).forEach(status => {
    const response: oas.ReferenceObject | oas.ResponseObject = responses[status];
    const statuses = (statusesByCode.get(status) || []).filter(options.emitStatusCode);

    if (statuses.length > 0) {
      const schema: oas.SchemaObject = {
        type: 'object',
        properties: {
          status: {
            type: 'integer',
            enum: statuses
          },
          value: isReferenceObject(response)
            ? { $ref: response.$ref }
            : generateContentSchemaType(
                response.content || {
                  oatsNoContent: {
                    schema: { type: 'null' }
                  }
                }
              ),
          headers: {
            type: 'object',
            additionalProperties: { type: 'string' }
          }
        },
        required: ['status', 'value', 'headers'],
        additionalProperties: false
      };

      if (!isReferenceObject(response) && response.headers) {
        schema.properties!.headers = generateHeadersSchemaType(response.headers);
      }

      responseSchemas.push(schema);
    }
  });

  if (responseSchemas.length === 0) {
    return generateTopLevelType(op, voidSchema, ctx);
  }

  return generateTopLevelType(op, { oneOf: responseSchemas }, ctx);
}

/**
 * Generates all query/parameter/body/response types for all endpoints.
 */
export function generateQueryTypes(ctx: GenerationContext): string[] {
  const { options } = ctx;
  const schema = options.oas;
  const response: string[] = [];

  Object.keys(schema.paths).forEach(path => {
    Object.keys(schema.paths[path]).forEach(method => {
      const endpoint: oas.OperationObject = schema.paths[path][method];

      errorTag(`in ${method.toUpperCase()} ${path} query`, () =>
        response.push(
          ...generateQueryType(
            endpointTypeName(endpoint, path, method, 'query'),
            endpoint.parameters,
            schema,
            ctx
          )
        )
      );

      errorTag(`in ${method.toUpperCase()} ${path} header`, () =>
        response.push(
          ...generateParameterType(
            'header',
            endpointTypeName(endpoint, path, method, 'headers'),
            endpoint.parameters,
            schema,
            ctx,
            name => name.toLowerCase()
          )
        )
      );

      errorTag(`in ${method.toUpperCase()} ${path} parameters`, () =>
        response.push(
          ...generateParameterType(
            'path',
            endpointTypeName(endpoint, path, method, 'parameters'),
            endpoint.parameters,
            schema,
            ctx
          )
        )
      );

      errorTag(`in ${method.toUpperCase()} ${path} requestBody`, () =>
        response.push(
          ...generateRequestBodyType(
            endpointTypeName(endpoint, path, method, 'requestBody'),
            endpoint.requestBody,
            ctx
          )
        )
      );

      errorTag(`in ${method.toUpperCase()} ${path} response`, () =>
        response.push(
          ...generateResponseType(
            endpointTypeName(endpoint, path, method, 'response'),
            endpoint.responses,
            ctx
          )
        )
      );
    });
  });

  return response;
}
