import * as oas from 'openapi3-ts';
import * as ts from 'typescript';
import safe from '@smartlyio/safe-navigation';
import * as _ from 'lodash';
import * as assert from 'assert';
import * as oautil from './util';
import { UnsupportedFeatureBehaviour } from './util';
import * as path from 'path';
import { resolvedStatusCodes } from './status-codes';

const valueClassIndexSignatureKey = 'instanceIndexSignatureKey';

interface ImportDefinition {
  importAs: string;
  importFile: string;
}

// bit of a lie here really
const voidSchema: oas.SchemaObject = { type: 'void' as any };

export type Resolve = (
  ref: string,
  options: Options
) =>
  | { importAs: string; importFrom: string; name: string; generate?: () => Promise<void> }
  | { name: string }
  | undefined;

export interface Options {
  forceGenerateTypes?: boolean;
  header: string;
  sourceFile: string;
  /** @deprecated Consider using 'resolve' instead */
  externalOpenApiImports: readonly ImportDefinition[];
  targetFile: string;
  resolve: Resolve;
  /** @deprecated Consider using 'resolve' instead */
  externalOpenApiSpecs?: (url: string) => string | undefined;
  oas: oas.OpenAPIObject;
  runtimeModule: string;
  emitStatusCode: (status: number) => boolean;
  unsupportedFeatures?: {
    security?: UnsupportedFeatureBehaviour;
  };
}

export function info(message: string) {
  // eslint-disable-next-line no-console
  console.log('info: ' + message);
}

export function deprecated(condition: any, message: string) {
  if (condition) {
    // eslint-disable-next-line no-console
    console.log('deprecation warning: ' + message);
  }
}
const oatsBrandFieldName = '__oats_value_class_brand_tag';
const makeTypeTypeName = 'Make';
const runtimeLibrary = ts.createIdentifier('oar');
const readonly = [ts.createModifier(ts.SyntaxKind.ReadonlyKeyword)];
// list of files for which we have an action to generate it already
// to prevent calling an action to generate it again and causing maybe some race conditions
const generatedFiles: Set<string> = new Set();

// query to figure out whether the file is being already generated
function isGenerating(file: string): boolean {
  return generatedFiles.has(file);
}

export function run(options: Options) {
  options.targetFile = './' + path.normalize(options.targetFile);
  if (isGenerating(options.targetFile) && !options.forceGenerateTypes) {
    return;
  }
  generatedFiles.add(options.targetFile);
  deprecated(
    options.externalOpenApiImports.length > 0,
    "'externalOpenApiImports' is deprecated. Consider using 'resolve' instead"
  );
  deprecated(
    options.externalOpenApiSpecs,
    "'externalOpenApiSpecs' is deprecated. Consider using 'resolve' instead"
  );

  const state = {
    cwd: path.dirname(options.sourceFile),
    imports: {} as Record<string, string>,
    actions: [] as Array<() => Promise<void>>
  };
  const builtins = generateBuiltins();
  const types = generateComponents(options);
  const queryTypes = generateQueryTypes(options);

  const externals = generateExternals(
    Object.entries(state.imports).map(([importAs, importFile]) => ({
      importAs,
      importFile: resolveModule(options.targetFile, importFile)
    }))
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
      ts.createNodeArray([...builtins, ...externals, ...types, ...queryTypes]),
      sourceFile
    );
  const finished = addIndexSignatureIgnores(src);
  return finished;

  function generateOatsBrandProperty() {
    return ts.createProperty(
      undefined,
      [ts.createToken(ts.SyntaxKind.PrivateKeyword), ts.createToken(ts.SyntaxKind.ReadonlyKeyword)],
      quotedProp(oatsBrandFieldName),
      ts.createToken(ts.SyntaxKind.ExclamationToken),
      ts.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
      undefined
    );
  }

  function generateClassMembers(
    properties: oas.SchemaObject['properties'],
    required: oas.SchemaObject['required'],
    additional: oas.SchemaObject['additionalProperties']
  ): readonly ts.ClassElement[] {
    const proptypes = _.map(properties, (value, key) => {
      return ts.createProperty(
        undefined,
        [ts.createToken(ts.SyntaxKind.ReadonlyKeyword)],
        quotedProp(key),
        required && required.indexOf(key) >= 0
          ? ts.createToken(ts.SyntaxKind.ExclamationToken)
          : ts.createToken(ts.SyntaxKind.QuestionToken),
        generateType(value),
        undefined
      );
    });

    proptypes.push(generateOatsBrandProperty());

    if (additional !== false) {
      const type =
        additional === true || additional == null
          ? ts.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword)
          : ts.createUnionTypeNode([
              generateType(additional),
              ts.createKeywordTypeNode(ts.SyntaxKind.UndefinedKeyword)
            ]);
      proptypes.push(
        ts.createIndexSignature(
          undefined,
          [ts.createToken(ts.SyntaxKind.ReadonlyKeyword)],
          [
            ts.createParameter(
              undefined,
              undefined,
              undefined,
              valueClassIndexSignatureKey,
              undefined,
              ts.createKeywordTypeNode(ts.SyntaxKind.StringKeyword)
            )
          ],
          type
        ) as any
      );
    }
    return proptypes;
  }

  function generateObjectMembers(
    properties: oas.SchemaObject['properties'],
    required: oas.SchemaObject['required'],
    additional: oas.SchemaObject['additionalProperties'],
    typeMapper: (typeName: string) => string
  ): ts.TypeElement[] {
    const proptypes = _.map(properties, (value, key) =>
      oautil.errorTag(`property '${key}'`, () =>
        ts.createPropertySignature(
          readonly,
          quotedProp(key),
          required && required.indexOf(key) >= 0
            ? undefined
            : ts.createToken(ts.SyntaxKind.QuestionToken),
          generateType(value, typeMapper),
          undefined
        )
      )
    );
    if (additional !== false) {
      const type =
        additional === true || additional == null
          ? ts.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword)
          : ts.createUnionTypeNode([
              generateType(additional, typeMapper),
              ts.createKeywordTypeNode(ts.SyntaxKind.UndefinedKeyword)
            ]);
      proptypes.push(
        ts.createIndexSignature(
          undefined,
          readonly,
          [
            ts.createParameter(
              undefined,
              undefined,
              undefined,
              'key',
              undefined,
              ts.createKeywordTypeNode(ts.SyntaxKind.StringKeyword)
            )
          ],
          type
        ) as any
      );
    }
    return proptypes;
  }

  function generateQueryType(
    op: string,
    paramSchema: undefined | ReadonlyArray<oas.ParameterObject | oas.ReferenceObject>,
    oasSchema: oas.OpenAPIObject
  ) {
    const noQueryParams = { type: 'object' as const, additionalProperties: false };
    if (!paramSchema) {
      return generateTopLevelType(op, noQueryParams);
    }
    const schema = oautil.deref(paramSchema, oasSchema);
    const queryParams = schema
      .map(schema => oautil.deref(schema, oasSchema))
      .filter(schema => schema.in === 'query');
    if (queryParams.length === 0) {
      return generateTopLevelType(op, noQueryParams);
    }
    if (queryParams.some(param => !!param.explode)) {
      assert(queryParams.length === 1, 'only one explode: true parameter is supported');
      const param = queryParams[0];
      return generateTopLevelType(op, param.schema || {});
    }
    const jointSchema: oas.SchemaObject = {
      type: 'object',
      additionalProperties: false,
      required: queryParams.filter(param => param.required).map(param => param.name),
      properties: queryParams.reduce((memo: any, param) => {
        memo[param.name] = param.schema;
        return memo;
      }, {})
    };
    return generateTopLevelType(op, jointSchema);
  }

  function generateParameterType(
    type: 'path' | 'header',
    op: string,
    paramSchema: undefined | ReadonlyArray<oas.ParameterObject | oas.ReferenceObject>,
    oasSchema: oas.OpenAPIObject,
    normalize = (name: string) => name
  ) {
    const empty = generateTopLevelType(op, voidSchema);
    if (!paramSchema) {
      return empty;
    }
    const schema = oautil.deref(paramSchema, oasSchema);
    const pathParams = schema
      .map(schema => oautil.deref(schema, oasSchema))
      .filter(schema => schema.in === type);
    if (pathParams.length === 0) {
      return empty;
    }
    const required: string[] = [];
    pathParams.map(paramOrRef => {
      const param = oautil.deref(paramOrRef, oasSchema);
      if (param.required) {
        required.push(normalize(param.name));
      }
    });
    const jointSchema: oas.SchemaObject = {
      type: 'object',
      additionalProperties: false,
      required,
      properties: pathParams.reduce((memo: any, param) => {
        memo[normalize(param.name)] = param.schema;
        return memo;
      }, {})
    };
    return generateTopLevelType(op, jointSchema);
  }

  function generateContentSchemaType(content: oas.ContentObject) {
    const contentTypeSchemas = Object.keys(content).map(contentType =>
      oautil.errorTag(`contentType '${contentType}'`, () => {
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
    return {
      oneOf: contentTypeSchemas
    };
  }

  function generateHeadersSchemaType(headers: oas.HeadersObject): oas.SchemaObject {
    const required: string[] = [];
    const properties = Object.entries(headers).reduce((memo, [headerName, headerObject]) => {
      if (oautil.isReferenceObject(headerObject)) {
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
      additionalProperties: {
        type: 'string'
      }
    };
  }

  function generateRequestBodyType(
    op: string,
    requestBody: undefined | oas.ReferenceObject | oas.RequestBodyObject
  ) {
    if (requestBody == null) {
      return generateTopLevelType(op, voidSchema);
    }
    if (oautil.isReferenceObject(requestBody)) {
      return generateTopLevelType(op, { $ref: requestBody.$ref });
    }
    // requestBody is not required by default https://swagger.io/docs/specification/describing-request-body/
    if (requestBody.required === true) {
      return generateTopLevelType(op, generateContentSchemaType(requestBody.content));
    }
    return generateTopLevelType(op, {
      oneOf: [generateContentSchemaType(requestBody.content), voidSchema]
    });
  }

  function generateResponseType(opt: Options, op: string, responses: oas.ResponsesObject) {
    if (!responses) {
      return assert.fail('missing responses');
    }
    const statusesByCode = resolvedStatusCodes(Object.keys(responses));
    const responseSchemas: oas.SchemaObject[] = [];
    Object.keys(responses).map(status => {
      const response: oas.ReferenceObject | oas.ResponseObject = responses[status];
      const statuses = (statusesByCode.get(status) || []).filter(opt.emitStatusCode);
      if (statuses.length > 0) {
        const schema: oas.SchemaObject = {
          type: 'object',
          properties: {
            status: {
              type: 'integer',
              enum: statuses
            },
            value: oautil.isReferenceObject(response)
              ? { $ref: response.$ref }
              : generateContentSchemaType(
                  response.content || {
                    oatsNoContent: {
                      schema: {
                        type: 'null'
                      }
                    }
                  }
                ),
            headers: { type: 'object' }
          },
          required: ['status', 'value', 'headers'],
          additionalProperties: false
        };
        if (!oautil.isReferenceObject(response) && response.headers) {
          schema.properties!.headers = generateHeadersSchemaType(response.headers);
        }
        responseSchemas.push(schema);
      }
    });
    if (responseSchemas.length === 0) {
      return generateTopLevelType(op, voidSchema);
    }
    return generateTopLevelType(op, {
      oneOf: responseSchemas
    });
  }

  function generateQueryTypes(opt: Options): ts.NodeArray<ts.Node> {
    const response: ts.Node[] = [];
    const schema = opt.oas;
    Object.keys(schema.paths).forEach(path => {
      Object.keys(schema.paths[path]).forEach(method => {
        const endpoint: oas.OperationObject = schema.paths[path][method];
        oautil.errorTag(`in ${method.toUpperCase()} ${path} query`, () =>
          response.push(
            generateNamedTypeDefinitionDeclaration(
              oautil.endpointTypeName(endpoint, path, method, 'query')
            ),
            ...generateQueryType(
              oautil.endpointTypeName(endpoint, path, method, 'query'),
              endpoint.parameters,
              schema
            )
          )
        );
        oautil.errorTag(`in ${method.toUpperCase()} ${path} header`, () =>
          response.push(
            generateNamedTypeDefinitionDeclaration(
              oautil.endpointTypeName(endpoint, path, method, 'headers')
            ),
            ...generateParameterType(
              'header',
              oautil.endpointTypeName(endpoint, path, method, 'headers'),
              endpoint.parameters,
              schema,
              name => name.toLowerCase()
            )
          )
        );
        oautil.errorTag(`in ${method.toUpperCase()} ${path} parameters`, () =>
          response.push(
            generateNamedTypeDefinitionDeclaration(
              oautil.endpointTypeName(endpoint, path, method, 'parameters')
            ),
            ...generateParameterType(
              'path',
              oautil.endpointTypeName(endpoint, path, method, 'parameters'),
              endpoint.parameters,
              schema
            )
          )
        );
        oautil.errorTag(`in ${method.toUpperCase()} ${path} requestBody`, () =>
          response.push(
            generateNamedTypeDefinitionDeclaration(
              oautil.endpointTypeName(endpoint, path, method, 'requestBody')
            ),
            ...generateRequestBodyType(
              oautil.endpointTypeName(endpoint, path, method, 'requestBody'),
              endpoint.requestBody
            )
          )
        );
        oautil.errorTag(`in ${method.toUpperCase()} ${path} response`, () =>
          response.push(
            generateNamedTypeDefinitionDeclaration(
              oautil.endpointTypeName(endpoint, path, method, 'response')
            ),
            ...generateResponseType(
              opt,
              oautil.endpointTypeName(endpoint, path, method, 'response'),
              endpoint.responses
            )
          )
        );
      });
    });
    return ts.createNodeArray(response);
  }

  function generateType(
    schema: oautil.SchemaObject,
    typeMapper: (name: string) => string = n => n
  ): ts.TypeNode {
    assert(schema, 'missing schema');
    if (oautil.isReferenceObject(schema)) {
      const resolved = resolveRefToTypeName(schema.$ref);
      const type = resolved.qualified
        ? ts.createQualifiedName(resolved.qualified, typeMapper(resolved.member))
        : typeMapper(resolved.member);
      return ts.createTypeReferenceNode(type, undefined);
    }
    if (schema.oneOf) {
      return ts.createUnionTypeNode(schema.oneOf.map(schema => generateType(schema, typeMapper)));
    }

    if (schema.allOf) {
      return ts.createIntersectionTypeNode(
        schema.allOf.map(schema => generateType(schema, typeMapper))
      );
    }

    assert(!schema.anyOf, 'anyOf is not supported');

    if (schema.nullable) {
      return ts.createUnionTypeNode([
        generateType({ ...schema, nullable: false }, typeMapper),
        ts.factory.createLiteralTypeNode(ts.factory.createNull())
      ]);
    }

    if (schema.type === 'object') {
      return ts.createTypeLiteralNode(
        generateObjectMembers(
          schema.properties,
          schema.required,
          schema.additionalProperties,
          typeMapper
        )
      );
    }

    if (schema.enum) {
      return ts.createUnionTypeNode(
        schema.enum.map(e => {
          return ts.createLiteralTypeNode(ts.createLiteral(e));
        })
      );
    }

    if (schema.type === 'array') {
      const itemType = generateType(schema.items || {}, typeMapper);
      return ts.createTypeReferenceNode('ReadonlyArray', [itemType]);
    }

    if (schema.type === 'string') {
      return generateStringType(schema.format);
    }
    if (schema.type === 'integer' || schema.type === 'number') {
      return ts.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword);
    }
    if (schema.type === 'boolean') {
      return ts.createKeywordTypeNode(ts.SyntaxKind.BooleanKeyword);
    }
    // @ts-expect-error schemas really do not have void type. but we do
    if (schema.type === 'void') {
      return ts.createKeywordTypeNode(ts.SyntaxKind.VoidKeyword);
    }
    if (schema.type === 'null') {
      return ts.factory.createLiteralTypeNode(ts.factory.createNull());
    }
    if (!schema.type) {
      return ts.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword);
    }
    return assert.fail('unknown schema type: ' + schema.type);
  }

  function generateStringType(format: string | undefined) {
    if (format === 'binary') {
      return ts.createTypeReferenceNode(fromLib('make', 'Binary'), []);
    }
    return ts.createKeywordTypeNode(ts.SyntaxKind.StringKeyword);
  }

  function generateReflectionProperty(key: string) {
    return ts.createProperty(
      undefined,
      [
        ts.createModifier(ts.SyntaxKind.PublicKeyword),
        ts.createModifier(ts.SyntaxKind.StaticKeyword)
      ],
      ts.createIdentifier('reflection'),
      undefined,
      ts.createTypeReferenceNode(fromLib('reflection', 'NamedTypeDefinition'), [
        ts.createTypeReferenceNode(ts.createIdentifier(oautil.typenamify(key)), [])
      ]),
      ts.createIdentifier('type' + oautil.typenamify(key))
    );
  }

  function generateClassConstructor(key: string) {
    return ts.createMethod(
      undefined,
      [ts.createModifier(ts.SyntaxKind.PublicKeyword)],
      undefined,
      'constructor',
      undefined,
      undefined,
      [
        ts.createParameter(
          undefined,
          undefined,
          undefined,
          'value',
          undefined,
          ts.createTypeReferenceNode('ShapeOf' + oautil.typenamify(key), [])
        ),
        ts.createParameter(
          undefined,
          undefined,
          undefined,
          'opts',
          ts.createToken(ts.SyntaxKind.QuestionToken),
          ts.createUnionTypeNode([
            ts.createTypeReferenceNode(fromLib('make', 'MakeOptions'), []),
            ts.createTypeReferenceNode(
              ts.createIdentifier('InternalUnsafeConstructorOption'),
              undefined
            )
          ])
        )
      ],
      undefined,
      ts.createBlock([
        ts.createExpressionStatement(ts.createCall(ts.createIdentifier('super'), [], [])),
        ts.createExpressionStatement(
          ts.createCall(
            ts.createPropertyAccess(ts.createIdentifier('Object'), 'assign'),
            [],
            [
              ts.createThis(),
              ts.createConditional(
                ts.createBinary(
                  ts.createIdentifier('opts'),
                  ts.createToken(ts.SyntaxKind.AmpersandAmpersandToken),
                  ts.createBinary(
                    ts.createStringLiteral('unSafeSet'),
                    ts.createToken(ts.SyntaxKind.InKeyword),
                    ts.createIdentifier('opts')
                  )
                ),
                ts.createIdentifier('value'),
                ts.createCall(
                  ts.createPropertyAccess(
                    ts.createCall(
                      ts.createIdentifier('build' + oautil.typenamify(key)),
                      undefined,
                      [ts.createIdentifier('value'), ts.createIdentifier('opts')]
                    ),
                    ts.createIdentifier('success')
                  ),
                  undefined,
                  []
                )
              )
            ]
          )
        )
      ])
    );
  }

  function generateClassMakeMethod(key: string) {
    return ts.createMethod(
      undefined,
      [ts.createModifier(ts.SyntaxKind.StaticKeyword)],
      undefined,
      'make',
      undefined,
      undefined,
      [
        ts.createParameter(
          undefined,
          undefined,
          undefined,
          'value',
          undefined,
          ts.createTypeReferenceNode('ShapeOf' + oautil.typenamify(key), [])
        ),
        ts.createParameter(
          undefined,
          undefined,
          undefined,
          'opts',
          ts.createToken(ts.SyntaxKind.QuestionToken),
          ts.createTypeReferenceNode(fromLib('make', 'MakeOptions'), [])
        )
      ],
      ts.createTypeReferenceNode(fromLib('make', makeTypeTypeName), [
        ts.createTypeReferenceNode(oautil.typenamify(key), [])
      ]),
      ts.createBlock([
        ts.createVariableStatement(
          [],
          ts.createVariableDeclarationList(
            [
              ts.createVariableDeclaration(
                'make',
                undefined,
                ts.createCall(ts.createIdentifier('build' + oautil.typenamify(key)), undefined, [
                  ts.createIdentifier('value'),
                  ts.createIdentifier('opts')
                ])
              )
            ],
            ts.NodeFlags.Const
          )
        ),
        ts.createReturn(
          ts.createConditional(
            ts.createCall(
              ts.createPropertyAccess(ts.createIdentifier('make'), ts.createIdentifier('isError')),
              [],
              []
            ),
            ts.createCall(
              ts.createPropertyAccess(
                ts.createPropertyAccess(ts.createPropertyAccess(runtimeLibrary, 'make'), 'Make'),
                'error'
              ),
              undefined,
              [ts.createPropertyAccess(ts.createIdentifier('make'), 'errors')]
            ),
            ts.createCall(
              ts.createPropertyAccess(
                ts.createPropertyAccess(ts.createPropertyAccess(runtimeLibrary, 'make'), 'Make'),
                'ok'
              ),
              undefined,
              [
                ts.createCall(ts.createIdentifier('new ' + oautil.typenamify(key)), undefined, [
                  ts.createCall(
                    ts.createPropertyAccess(
                      ts.createIdentifier('make'),
                      ts.createIdentifier('success')
                    ),
                    undefined,
                    undefined
                  ),
                  ts.createObjectLiteral([
                    ts.createPropertyAssignment('unSafeSet', ts.createTrue())
                  ])
                ])
              ]
            )
          )
        )
      ])
    );
  }

  function generateClassBuiltindMembers(key: string) {
    return [
      generateClassConstructor(key),
      generateReflectionProperty(key),
      generateClassMakeMethod(key)
    ];
  }

  function generateValueClass(key: string, schema: oas.SchemaObject) {
    const members = generateClassMembers(
      schema.properties,
      schema.required,
      schema.additionalProperties
    );
    const brand = ts.createExpressionWithTypeArguments(
      [],
      ts.createPropertyAccess(runtimeLibrary, 'valueClass.ValueClass')
    );
    return ts.createClassDeclaration(
      undefined,
      [ts.createModifier(ts.SyntaxKind.ExportKeyword)],
      oautil.typenamify(key),
      [],
      [ts.createHeritageClause(ts.SyntaxKind.ExtendsKeyword, [brand])],
      [...members, ...generateClassBuiltindMembers(key)]
    );
  }

  function makeCall(fun: string, args: readonly ts.Expression[]) {
    return ts.createCall(ts.createPropertyAccess(runtimeLibrary, 'make.' + fun), undefined, args);
  }

  function makeAnyProperty(name: string) {
    return ts.createParameter(
      undefined,
      undefined,
      undefined,
      ts.createIdentifier(name),
      undefined,
      ts.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword),
      undefined
    );
  }

  function quotedProp(prop: string) {
    if (/\W/.test(prop)) {
      return ts.createStringLiteral(prop);
    }
    return ts.createIdentifier(prop);
  }

  function generateReflectionMaker(key: string): ts.Expression {
    return ts.factory.createCallExpression(
      ts.factory.createPropertyAccessExpression(
        ts.factory.createIdentifier('oar'),
        ts.factory.createIdentifier('fromReflection')
      ),
      undefined,
      [
        ts.factory.createPropertyAccessExpression(
          ts.factory.createIdentifier(`type${oautil.typenamify(key)}`),
          ts.factory.createIdentifier('definition')
        )
      ]
    );
  }

  function generateTopLevelClassBuilder(key: string, schema: oas.SchemaObject) {
    return generateTopLevelMaker(key, schema, 'build', 'ShapeOf' + oautil.typenamify(key));
  }

  function generateReflectionType(
    schema: oas.SchemaObject | oas.ReferenceObject
  ): ts.ObjectLiteralExpression {
    if (oautil.isReferenceObject(schema)) {
      const resolved = resolveRefToTypeName(schema.$ref);
      const type: ts.Expression = resolved.qualified
        ? ts.createPropertyAccess(resolved.qualified, 'type' + resolved.member)
        : ts.createIdentifier('type' + resolved.member);
      return ts.createObjectLiteral(
        [
          ts.createPropertyAssignment('type', ts.createStringLiteral('named')),
          ts.createPropertyAssignment('reference', type)
        ],
        true
      );
    }
    if (schema.oneOf) {
      return ts.createObjectLiteral(
        [
          ts.createPropertyAssignment('type', ts.createStringLiteral('union')),
          ts.createPropertyAssignment(
            'options',
            ts.createArrayLiteral(schema.oneOf.map(generateReflectionType), true)
          )
        ],
        true
      );
    }
    if (schema.allOf) {
      return ts.createObjectLiteral(
        [
          ts.createPropertyAssignment('type', ts.createStringLiteral('intersection')),
          ts.createPropertyAssignment(
            'options',
            ts.createArrayLiteral(schema.allOf.map(generateReflectionType), true)
          )
        ],
        true
      );
    }

    assert(!schema.anyOf, 'anyOf is not supported');

    if (schema.nullable) {
      return generateReflectionType({ oneOf: [{ ...schema, nullable: false }, { type: 'null' }] });
    }

    // @ts-expect-error schemas really do not have void type. but we do
    if (schema.type === 'void') {
      return ts.createObjectLiteral(
        [ts.createPropertyAssignment('type', ts.createStringLiteral('void'))],
        true
      );
    }
    if (schema.type === 'null') {
      return ts.createObjectLiteral(
        [ts.createPropertyAssignment('type', ts.createStringLiteral('null'))],
        true
      );
    }

    if (schema.type === 'string') {
      const enumValues = schema.enum
        ? [
            ts.createPropertyAssignment(
              'enum',
              ts.createArrayLiteral(schema.enum.map(value => ts.factory.createStringLiteral(value)))
            )
          ]
        : [];
      if (schema.format === 'binary') {
        return ts.createObjectLiteral(
          [ts.createPropertyAssignment('type', ts.createStringLiteral('binary'))],
          true
        );
      }
      const format = schema.format
        ? [ts.createPropertyAssignment('format', ts.createStringLiteral(schema.format))]
        : [];
      const pattern = schema.pattern
        ? [ts.createPropertyAssignment('pattern', ts.createStringLiteral(schema.pattern))]
        : [];
      const minLength =
        schema.minLength != null
          ? [ts.createPropertyAssignment('minLength', ts.createNumericLiteral(schema.minLength))]
          : [];
      const maxLength =
        schema.maxLength != null
          ? [ts.createPropertyAssignment('maxLength', ts.createNumericLiteral(schema.maxLength))]
          : [];

      return ts.createObjectLiteral(
        [
          ts.createPropertyAssignment('type', ts.createStringLiteral('string')),
          ...enumValues,
          ...format,
          ...pattern,
          ...minLength,
          ...maxLength
        ],
        true
      );
    }
    if (schema.type === 'number') {
      const enumValues = schema.enum
        ? [
            ts.createPropertyAssignment(
              'enum',
              ts.createArrayLiteral(schema.enum.map(i => ts.createNumericLiteral('' + i)))
            )
          ]
        : [];
      const properties = [
        ts.createPropertyAssignment('type', ts.createStringLiteral('number')),
        ...enumValues
      ];
      if (schema.minimum != null) {
        properties.push(
          ts.createPropertyAssignment('minimum', ts.createNumericLiteral(schema.minimum + ''))
        );
      }
      if (schema.maximum != null) {
        properties.push(
          ts.createPropertyAssignment('maximum', ts.createNumericLiteral(schema.maximum + ''))
        );
      }
      return ts.createObjectLiteral(properties, true);
    }
    if (schema.type === 'integer') {
      const enumValues = schema.enum
        ? [
            ts.createPropertyAssignment(
              'enum',
              ts.createArrayLiteral(schema.enum.map(i => ts.createNumericLiteral('' + i)))
            )
          ]
        : [];
      const properties = [
        ts.createPropertyAssignment('type', ts.createStringLiteral('integer')),
        ...enumValues
      ];
      if (schema.minimum != null) {
        properties.push(
          ts.createPropertyAssignment('minimum', ts.createNumericLiteral(schema.minimum + ''))
        );
      }
      if (schema.maximum != null) {
        properties.push(
          ts.createPropertyAssignment('maximum', ts.createNumericLiteral(schema.maximum + ''))
        );
      }

      return ts.createObjectLiteral(properties, true);
    }
    if (schema.type === 'boolean') {
      const enumValues = schema.enum
        ? [
            ts.createPropertyAssignment(
              'enum',
              ts.createArrayLiteral(
                schema.enum.map(i =>
                  i === true
                    ? ts.createTrue()
                    : i === false
                    ? ts.createFalse()
                    : assert.fail('unknown enum ' + i)
                )
              )
            )
          ]
        : [];
      return ts.createObjectLiteral(
        [ts.createPropertyAssignment('type', ts.createStringLiteral('boolean')), ...enumValues],
        true
      );
    }
    if (schema.type === 'array') {
      const properties = [
        ts.createPropertyAssignment('type', ts.createStringLiteral('array')),
        ts.createPropertyAssignment('items', generateReflectionType(schema.items || {}))
      ];
      if (schema.minItems != null) {
        properties.push(
          ts.createPropertyAssignment('minItems', ts.createNumericLiteral(schema.minItems + ''))
        );
      }
      if (schema.maxItems != null) {
        properties.push(
          ts.createPropertyAssignment('maxItems', ts.createNumericLiteral(schema.maxItems + ''))
        );
      }
      return ts.createObjectLiteral(properties, true);
    }
    if (schema.type === 'object') {
      return generateObjectReflectionType(schema);
    }
    if (!schema.type) {
      return ts.createObjectLiteral(
        [ts.createPropertyAssignment('type', ts.createStringLiteral('unknown'))],
        true
      );
    }
    assert.fail('todo generateReflectionType', schema);
    throw new Error();
  }

  function generateAdditionalPropsReflectionType(props: oas.SchemaObject['additionalProperties']) {
    if (props === false) {
      return ts.factory.createFalse();
    }
    if (
      props === true ||
      !props ||
      (props && typeof props === 'object' && Object.keys(props).length === 0)
    ) {
      return ts.factory.createTrue();
    }
    return generateReflectionType(props);
  }

  function generateObjectReflectionType(schema: oas.SchemaObject) {
    const additionalProps = generateAdditionalPropsReflectionType(schema.additionalProperties);
    return ts.createObjectLiteral(
      [
        ts.createPropertyAssignment('type', ts.createStringLiteral('object')),
        ts.createPropertyAssignment('additionalProperties', additionalProps),
        ts.createPropertyAssignment(
          'properties',
          ts.createObjectLiteral(
            Object.keys(schema.properties || {}).map((propertyName: string) => {
              return ts.createPropertyAssignment(
                ts.createStringLiteral(propertyName),
                ts.createObjectLiteral(
                  [
                    ts.createPropertyAssignment(
                      'required',
                      (schema.required || []).indexOf(propertyName) >= 0
                        ? ts.createTrue()
                        : ts.createFalse()
                    ),
                    ts.createPropertyAssignment(
                      'value',
                      generateReflectionType((schema.properties as any)[propertyName])
                    )
                  ],
                  true
                )
              );
            }),
            true
          )
        )
      ],
      true
    );
  }

  function generateNamedTypeDefinitionDeclaration(key: string) {
    return ts.createVariableStatement(
      [ts.createModifier(ts.SyntaxKind.ExportKeyword)],
      ts.createVariableDeclarationList(
        [
          ts.createVariableDeclaration(
            'type' + oautil.typenamify(key),
            ts.createTypeReferenceNode(fromLib('reflection', 'NamedTypeDefinition'), [
              ts.createTypeReferenceNode(oautil.typenamify(key), []),
              ts.createTypeReferenceNode('ShapeOf' + oautil.typenamify(key), [])
            ]),
            ts.createAsExpression(
              ts.createObjectLiteral([], false),
              ts.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword)
            )
          )
        ],
        ts.NodeFlags.Const
      )
    );
  }

  function generateIsA(type: string) {
    return ts.createArrowFunction(
      undefined,
      undefined,
      [makeAnyProperty('value')],
      undefined,
      ts.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
      ts.createBinary(
        ts.createIdentifier('value'),
        ts.createToken(ts.SyntaxKind.InstanceOfKeyword),
        ts.createIdentifier(type)
      )
    );
  }

  function generateNamedTypeDefinitionAssignment(
    key: string,
    schema: oas.SchemaObject,
    isA?: ts.ArrowFunction
  ) {
    return ts.createCall(
      ts.createPropertyAccess(ts.createIdentifier('Object'), 'assign'),
      undefined,
      [
        ts.createIdentifier('type' + oautil.typenamify(key)),
        ts.createObjectLiteral(
          [
            ts.createPropertyAssignment('name', ts.createStringLiteral(oautil.typenamify(key))),
            ts.createPropertyAssignment('definition', generateReflectionType(schema)),
            ts.createPropertyAssignment(
              'maker',
              ts.createIdentifier('make' + oautil.typenamify(key))
            ),
            ts.createPropertyAssignment('isA', isA ?? ts.createNull())
          ],
          true
        )
      ]
    );
  }

  function generateTopLevelClassMaker(key: string) {
    const shape = 'ShapeOf' + oautil.typenamify(key);
    return ts.createVariableStatement(
      [ts.createModifier(ts.SyntaxKind.ExportKeyword)],
      ts.createVariableDeclarationList(
        [
          ts.createVariableDeclaration(
            'make' + oautil.typenamify(key),
            ts.createTypeReferenceNode(fromLib('make', 'Maker'), [
              ts.createTypeReferenceNode(shape, []),
              ts.createTypeReferenceNode(oautil.typenamify(key), [])
            ]),
            ts.createPropertyAccess(ts.createIdentifier(oautil.typenamify(key)), 'make')
          )
        ],
        ts.NodeFlags.Const
      )
    );
  }

  function generateTopLevelMaker(
    key: string,
    schema: oas.SchemaObject,
    name = 'make',
    resultType?: string
  ) {
    const makerFun = 'createMaker';
    const shape = 'ShapeOf' + oautil.typenamify(key);
    resultType = resultType || oautil.typenamify(key);
    return ts.createVariableStatement(
      [ts.createModifier(ts.SyntaxKind.ExportKeyword)],
      ts.createVariableDeclarationList(
        [
          ts.createVariableDeclaration(
            name + oautil.typenamify(key),
            ts.createTypeReferenceNode(fromLib('make', 'Maker'), [
              ts.createTypeReferenceNode(shape, []),
              ts.createTypeReferenceNode(resultType, [])
            ]),
            makeCall(makerFun, [
              ts.createFunctionExpression(
                undefined,
                undefined,
                undefined,
                undefined,
                [],
                undefined,
                ts.createBlock([ts.createReturn(generateReflectionMaker(key))])
              )
            ])
          )
        ],
        ts.NodeFlags.Const
      )
    );
  }

  function brandTypeName(key: string): string {
    return 'BrandOf' + oautil.typenamify(key);
  }

  function generateBrand(key: string) {
    return ts.createEnumDeclaration(undefined, undefined, brandTypeName(key), []);
  }

  function generateTypeShape(key: string) {
    return ts.createTypeAliasDeclaration(
      undefined,
      [ts.createModifier(ts.SyntaxKind.ExportKeyword)],
      'ShapeOf' + oautil.typenamify(key),
      undefined,
      ts.createTypeReferenceNode(fromLib('ShapeOf'), [
        ts.createTypeReferenceNode(oautil.typenamify(key), [])
      ])
    );
  }

  function generateTopLevelClass(key: string, schema: oas.SchemaObject): readonly ts.Node[] {
    if (schema.nullable) {
      const classKey = oautil.nonNullableClass(key);
      const proxy = generateTopLevelType(key, {
        oneOf: [
          {
            type: 'null'
          },
          {
            $ref: '#/components/schemas/' + classKey
          }
        ]
      });
      return [...generateTopLevelClass(classKey, { ...schema, nullable: false }), ...proxy];
    }
    return [
      generateTypeShape(key),
      generateValueClass(key, schema),
      generateTopLevelClassBuilder(key, schema),
      generateTopLevelClassMaker(key),
      generateNamedTypeDefinitionAssignment(key, schema, generateIsA(oautil.typenamify(key)))
    ];
  }

  function generateTopLevelType(
    key: string,
    schema: oas.SchemaObject | oas.ReferenceObject
  ): readonly ts.Node[] {
    if (oautil.isReferenceObject(schema)) {
      const resolved = resolveRefToTypeName(schema.$ref);
      const type = resolved.qualified
        ? ts.createQualifiedName(resolved.qualified, resolved.member)
        : resolved.member;
      return [
        ts.createTypeAliasDeclaration(
          undefined,
          [ts.createModifier(ts.SyntaxKind.ExportKeyword)],
          oautil.typenamify(key),
          undefined,
          ts.createTypeReferenceNode(type, undefined)
        ),
        generateTypeShape(key),
        generateTopLevelMaker(key, schema),
        generateNamedTypeDefinitionAssignment(key, schema)
      ];
    }
    if (schema.type === 'object') {
      return generateTopLevelClass(key, schema);
    }

    if (isScalar(schema)) {
      return [
        generateBrand(key),
        ts.createTypeAliasDeclaration(
          undefined,
          [ts.createModifier(ts.SyntaxKind.ExportKeyword)],
          oautil.typenamify(key),
          undefined,
          scalarTypeWithBrand(key, generateType(schema))
        ),
        generateTypeShape(key),
        generateTopLevelMaker(key, schema),
        generateNamedTypeDefinitionAssignment(key, schema, generateIsAForScalar(key))
      ];
    }

    return [
      ts.createTypeAliasDeclaration(
        undefined,
        [ts.createModifier(ts.SyntaxKind.ExportKeyword)],
        oautil.typenamify(key),
        undefined,
        generateType(schema)
      ),
      generateTypeShape(key),
      generateTopLevelMaker(key, schema),
      generateNamedTypeDefinitionAssignment(key, schema)
    ];
  }

  function generateIsAForScalar(key: string) {
    return ts.createArrowFunction(
      undefined,
      undefined,
      [makeAnyProperty('value')],
      undefined,
      ts.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
      ts.createCall(
        ts.createPropertyAccess(
          ts.createCall(ts.createIdentifier('make' + oautil.typenamify(key)), undefined, [
            ts.createIdentifier('value')
          ]),
          'isSuccess'
        ),
        undefined,
        []
      )
    );
  }

  function scalarTypeWithBrand(key: string, type: ts.TypeNode): ts.TypeNode {
    return ts.createTypeReferenceNode(fromLib('BrandedScalar'), [
      type,
      ts.createTypeReferenceNode(brandTypeName(key), [])
    ]);
  }

  function isScalar(schema: oas.SchemaObject): boolean {
    return ['string', 'integer', 'number', 'boolean'].indexOf(schema.type || '') >= 0;
  }

  function generateComponentSchemas(opts: Options): ts.Node[] {
    const oas = opts.oas;
    const schemas = safe(oas).components.schemas.$;
    if (!schemas) {
      return [];
    }
    const nodes: ts.Node[] = [];
    Object.keys(schemas).map(key => {
      const schema: oas.SchemaObject = schemas[key];
      if (schema.nullable && schema.type === 'object') {
        nodes.push(generateNamedTypeDefinitionDeclaration(oautil.nonNullableClass(key)));
      }
      nodes.push(generateNamedTypeDefinitionDeclaration(key));
    });
    Object.keys(schemas).map(key => {
      const schema = schemas[key];
      const types = generateTopLevelType(key, schema);
      types.map(t => nodes.push(t));
    });
    return nodes;
  }

  function generateComponentRequestsAndResponses(components?: {
    [key: string]: oas.ResponseObject | oas.RequestBodyObject | oas.ReferenceObject;
  }): ts.Node[] {
    const nodes: ts.Node[] = [];
    if (components) {
      Object.keys(components).map(key => {
        nodes.push(generateNamedTypeDefinitionDeclaration(key));
      });
      Object.keys(components).map(key => {
        const component = components[key];
        generateTopLevelType(
          key,
          oautil.isReferenceObject(component)
            ? { $ref: component.$ref }
            : generateContentSchemaType(component.content || assert.fail('missing content'))
        ).map(t => nodes.push(t));
      });
    }
    return nodes;
  }

  function generateComponents(opts: Options): ts.NodeArray<ts.Node> {
    const oas = safe(opts.oas);
    const nodes = [];
    nodes.push(...oautil.errorTag('in component.schemas', () => generateComponentSchemas(opts)));
    nodes.push(
      ...oautil.errorTag('in component.responses', () =>
        generateComponentRequestsAndResponses(oas.components.responses.$)
      )
    );
    nodes.push(
      ...oautil.errorTag('in component.requestBodies', () =>
        generateComponentRequestsAndResponses(oas.components.requestBodies.$)
      )
    );
    return ts.createNodeArray(nodes);
  }

  function fromLib(...names: string[]): ts.QualifiedName {
    return ts.createQualifiedName(runtimeLibrary, names.join('.'));
  }

  function generateExternals(imports: readonly ImportDefinition[]) {
    return imports.map(external => {
      return ts.createImportDeclaration(
        undefined,
        undefined,
        ts.createImportClause(
          undefined,
          ts.createNamespaceImport(ts.createIdentifier(external.importAs))
        ),
        ts.createStringLiteral(external.importFile)
      );
    });
  }

  function generateBuiltins() {
    return ts.createNodeArray([
      ts.createImportDeclaration(
        undefined,
        undefined,
        ts.createImportClause(undefined, ts.createNamespaceImport(runtimeLibrary)),
        ts.createStringLiteral(options.runtimeModule)
      ),
      ts.createTypeAliasDeclaration(
        undefined,
        undefined,
        'InternalUnsafeConstructorOption',
        undefined,
        ts.createTypeLiteralNode([
          ts.createPropertySignature(
            undefined,
            ts.createIdentifier('unSafeSet'),
            undefined,
            ts.createLiteralTypeNode(ts.createTrue()),
            undefined
          )
        ])
      )
    ]);
  }

  function addIndexSignatureIgnores(src: string) {
    const result: string[] = [];
    src.split('\n').forEach(line => {
      const m = line.match(new RegExp('\\[\\s*' + valueClassIndexSignatureKey));
      if (m) {
        if (!/\b(unknown|any)\b/.test(line)) {
          result.push('    // @ts-ignore tsc does not like the branding type in index signatures');
          result.push(line);
          return;
        }
      }
      const brandMatch = line.match(new RegExp('\\s*private readonly ' + oatsBrandFieldName));
      if (brandMatch) {
        result.push('    // @ts-ignore tsc does not like unused privates');
        result.push(line);
        return;
      }
      result.push(line);
    });
    return result.join('\n');
  }

  function addToImports(
    importAs: string,
    importFile: string | undefined,
    action?: (() => Promise<void>) | undefined
  ) {
    if (!state.imports[importAs]) {
      if (importFile) {
        importFile = /^(\.|\/)/.test(importFile) ? './' + path.normalize(importFile) : importFile;
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
  }

  function resolveRefToTypeName(ref: string): { qualified?: ts.Identifier; member: string } {
    const external = options.resolve(ref, options);
    if (external) {
      const importAs = safe(external).importAs.$;
      if (importAs) {
        addToImports(importAs, safe(external).importFrom.$, safe(external).generate.$);
        return { member: external.name, qualified: ts.createIdentifier(importAs) };
      }
      return { member: external.name };
    }
    if (ref[0] === '#') {
      return { member: oautil.refToTypeName(ref) };
    }
    if (options.externalOpenApiSpecs) {
      const name = options.externalOpenApiSpecs(ref);
      if (name) {
        const [qualified, member] = name.split('.');
        const file = options.externalOpenApiImports.find(
          def => def.importAs === qualified
        )?.importFile;
        addToImports(qualified, file);
        return { member, qualified: ts.createIdentifier(qualified) };
      }
    }
    return assert.fail('could not resolve typename for ' + ref);
  }

  function resolveModule(fromModule: string, toModule: string): string {
    if (!toModule.startsWith('.')) {
      info(`importing ${toModule} to ${fromModule} as a package import`);
      return toModule;
    }
    const p = path.relative(path.dirname(fromModule), toModule);
    info(`importing ${toModule} to ${fromModule} as a relative import`);
    if (p[0] === '.') {
      return p;
    }
    return './' + p;
  }
}
