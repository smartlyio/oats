import * as oas from 'openapi3-ts';
import * as ts from 'typescript';
import safe from '@smartlyio/safe-navigation';
import * as _ from 'lodash';
import * as assert from 'assert';
import * as oautil from './util';

const valueClassIndexSignatureKey = 'instanceIndexSignatureKey';

function generateClassMembers(
  properties: oas.SchemaObject['properties'],
  required: oas.SchemaObject['required'],
  additional: oas.SchemaObject['additionalProperties']
): ReadonlyArray<ts.ClassElement> {
  const proptypes = _.map(properties, (value, key) =>
    ts.createProperty(
      undefined,
      [ts.createToken(ts.SyntaxKind.ReadonlyKeyword)],
      quotedProp(key),
      required && required.indexOf(key) >= 0
        ? undefined
        : ts.createToken(ts.SyntaxKind.QuestionToken),
      generateType(value),
      undefined
    )
  );
  if (additional !== false) {
    const type =
      additional === true || additional == null
        ? ts.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword)
        : ts.createUnionTypeNode([
            generateType(additional),
            ts.createKeywordTypeNode(ts.SyntaxKind.UndefinedKeyword)
          ]);
    proptypes.push(ts.createIndexSignature(
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
    ) as any);
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
    proptypes.push(ts.createIndexSignature(
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
    ) as any);
  }
  return proptypes;
}

function generateQueryType(
  op: string,
  paramSchema: undefined | ReadonlyArray<oas.ParameterObject | oas.ReferenceObject>,
  oasSchema: oas.OpenAPIObject
) {
  if (!paramSchema) {
    return generateTopLevelType(op, { type: 'void' });
  }
  const schema = oautil.deref(paramSchema, oasSchema);
  const queryParams = schema
    .map(schema => oautil.deref(schema, oasSchema))
    .filter(schema => schema.in === 'query');
  if (queryParams.length === 0) {
    return generateTopLevelType(op, { type: 'void' });
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
  const empty = generateTopLevelType(op, { type: 'void' });
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
  const jointSchema: oas.SchemaObject = {
    type: 'object',
    additionalProperties: false,
    required: pathParams.map(param => param.name),
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

function generateRequestBodyType(
  op: string,
  requestBody: undefined | oas.ReferenceObject | oas.RequestBodyObject
) {
  if (requestBody == null) {
    return generateTopLevelType(op, {
      type: 'void'
    });
  }
  if (oautil.isReferenceObject(requestBody)) {
    return generateTopLevelType(op, { $ref: requestBody.$ref });
  }
  // requestBody is not required by default https://swagger.io/docs/specification/describing-request-body/
  if (requestBody.required === true) {
    return generateTopLevelType(op, generateContentSchemaType(requestBody.content));
  }
  return generateTopLevelType(op, {
    oneOf: [generateContentSchemaType(requestBody.content), { type: 'void' }]
  });
}

const statusCodes = [
  100,
  200,
  201,
  204,
  206,
  301,
  302,
  303,
  304,
  307,
  308,
  400,
  401,
  403,
  404,
  406,
  407,
  410,
  412,
  416,
  418,
  425,
  451,
  500,
  501,
  502,
  503,
  504
];

function expandedWildcardCode(code: string): number[] {
  if (code === 'default') {
    return [];
  }
  const wildcard = new RegExp(code.replace(/X/g, '.'));
  return statusCodes.filter(code => wildcard.test('' + code));
}

function generateResponseType(opt: Options, op: string, responses: oas.ResponsesObject) {
  if (!responses) {
    return assert.fail('missing responses');
  }
  const allSpecifiedStatuses: number[] = [];
  Object.keys(responses)
    .map(expandedWildcardCode)
    .map(codes =>
      codes.map(code => {
        assert(allSpecifiedStatuses.indexOf(code) < 0, 'duplicate status code ' + code);
        allSpecifiedStatuses.push(code);
      })
    );
  const defaultStatuses = statusCodes.filter(code => allSpecifiedStatuses.indexOf(code) < 0);
  const responseSchemas: oas.SchemaObject[] = [];
  Object.keys(responses).map(status => {
    const response: oas.ReferenceObject | oas.ResponseObject = responses[status];
    const statuses = (status === 'default' ? defaultStatuses : expandedWildcardCode(status)).filter(
      opt.emitStatusCode
    );
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
            : generateContentSchemaType(response.content || {})
        },
        required: ['status', 'value'],
        additionalProperties: false
      };
      responseSchemas.push(schema);
    }
  });
  if (responseSchemas.length === 0) {
    return generateTopLevelType(op, { type: 'void' });
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
          ...generateQueryType(
            oautil.endpointTypeName(endpoint, path, method, 'query'),
            endpoint.parameters,
            schema
          )
        )
      );
      oautil.errorTag(`in ${method.toUpperCase()} ${path} header`, () =>
        response.push(
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
          ...generateRequestBodyType(
            oautil.endpointTypeName(endpoint, path, method, 'requestBody'),
            endpoint.requestBody
          )
        )
      );
      oautil.errorTag(`in ${method.toUpperCase()} ${path} response`, () =>
        response.push(
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
    return ts.createTypeReferenceNode(typeMapper(oautil.refToTypeName(schema.$ref)), undefined);
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
      ts.createNull()
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
  if (schema.type === 'void') {
    return ts.createKeywordTypeNode(ts.SyntaxKind.VoidKeyword);
  }
  if (!schema.type) {
    return ts.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword);
  }
  return assert.fail('unknown schema type: ' + schema.type);
}

function generateStringType(format: string | undefined) {
  if (format === 'binary') {
    return ts.createTypeReferenceNode(ts.createQualifiedName(runtimeLibrary, 'Binary'), []);
  }
  return ts.createKeywordTypeNode(ts.SyntaxKind.StringKeyword);
}

function generateValueClass(key: string, schema: oas.SchemaObject) {
  const members = generateClassMembers(
    schema.properties,
    schema.required,
    schema.additionalProperties
  );
  const brand = ts.createExpressionWithTypeArguments(
    [
      ts.createTypeReferenceNode(ts.createIdentifier(oautil.typenamify(key)), []),
      ts.createTypeReferenceNode(ts.createIdentifier('ShapeOf' + oautil.typenamify(key)), []),
      ts.createTypeReferenceNode(ts.createIdentifier('BrandOf' + oautil.typenamify(key)), [])
    ],
    ts.createPropertyAccess(runtimeLibrary, 'ValueClass')
  );
  const shape = ts.createExpressionWithTypeArguments(
    [],
    ts.createIdentifier('ShapeOf' + oautil.typenamify(key))
  );
  const builtinMembers = [
    ts.createMethod(
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
          ts.createTypeReferenceNode(ts.createQualifiedName(runtimeLibrary, 'MakeOptions'), [])
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
              ts.createIdentifier('this'),
              ts.createCall(
                ts.createPropertyAccess(
                  ts.createCall(ts.createIdentifier('build' + oautil.typenamify(key)), undefined, [
                    ts.createIdentifier('value'),
                    ts.createIdentifier('opts')
                  ]),
                  ts.createIdentifier('success')
                ),
                undefined,
                []
              )
            ]
          )
        )
      ])
    ),
    ts.createMethod(
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
          ts.createTypeReferenceNode(ts.createQualifiedName(runtimeLibrary, 'MakeOptions'), [])
        )
      ],
      ts.createTypeReferenceNode(fromLib(makeTypeTypeName), [
        ts.createTypeReferenceNode(oautil.typenamify(key), [])
      ]),
      ts.createBlock([
        ts.createReturn(
          ts.createCall(ts.createIdentifier('make' + oautil.typenamify(key)), undefined, [
            ts.createIdentifier('value'),
            ts.createIdentifier('opts')
          ])
        )
      ])
    )
  ];
  return ts.createClassDeclaration(
    undefined,
    [ts.createModifier(ts.SyntaxKind.ExportKeyword)],
    oautil.typenamify(key),
    [],
    [
      ts.createHeritageClause(ts.SyntaxKind.ExtendsKeyword, [brand]),
      ts.createHeritageClause(ts.SyntaxKind.ImplementsKeyword, [shape])
    ],
    [...members, ...builtinMembers]
  );
}

function makeCall(fun: string, args: ReadonlyArray<ts.Expression>) {
  return ts.createCall(ts.createPropertyAccess(runtimeLibrary, fun), undefined, args);
}

function generateAdditionalPropertiesMaker(
  schema: oas.ReferenceObject | oas.SchemaObject | boolean | undefined
) {
  if (schema === false) {
    return [];
  }
  if (schema === true || schema == null) {
    return [makeCall('makeAny', [])];
  }
  return [generateMakerExpression(schema)];
}

function quotedProp(prop: string) {
  if (/\W/.test(prop)) {
    return ts.createStringLiteral(prop);
  }
  return ts.createIdentifier(prop);
}

function generateMakerExpression(schema: oas.ReferenceObject | oas.SchemaObject): ts.Expression {
  if (oautil.isReferenceObject(schema)) {
    return generateMakerReference(oautil.refToTypeName(schema.$ref));
  }
  if (schema.oneOf) {
    return makeCall('makeOneOf', schema.oneOf.map(generateMakerExpression));
  }

  if (schema.allOf) {
    return makeCall('makeAllOf', schema.allOf.map(generateMakerExpression));
  }

  assert(!schema.anyOf, 'anyOf is not supported');

  if (schema.nullable) {
    return makeCall('makeNullable', [generateMakerExpression({ ...schema, nullable: false })]);
  }

  if (schema.type === 'object') {
    const props = ts.createObjectLiteral(
      _.map(schema.properties, (propSchema, prop) => {
        const propMaker =
          schema.required && schema.required.indexOf(prop) >= 0
            ? generateMakerExpression(propSchema)
            : makeCall('makeOptional', [generateMakerExpression(propSchema)]);
        return ts.createPropertyAssignment(quotedProp(prop), propMaker);
      }),
      true
    );
    return makeCall('makeObject', [
      props,
      ...generateAdditionalPropertiesMaker(schema.additionalProperties)
    ]);
  }

  if (schema.enum) {
    return makeCall('makeEnum', schema.enum.map(value => ts.createLiteral(value)));
  }

  if (schema.type === 'array') {
    if (schema.items) {
      return makeCall('makeArray', [generateMakerExpression(schema.items)]);
    } else {
      return makeCall('makeArray', []);
    }
  }

  if (schema.type === 'void') {
    return makeCall('makeVoid', []);
  }
  if (schema.type === 'string') {
    return generateMakeString(schema.format);
  }
  if (schema.type === 'integer' || schema.type === 'number') {
    return makeCall('makeNumber', []);
  }
  if (schema.type === 'boolean') {
    return makeCall('makeBoolean', []);
  }
  if (!schema.type) {
    return makeCall('makeAny', []);
  }
  return assert.fail('unknown schema type: ' + schema.type);
}

function generateMakeString(format: string | undefined) {
  if (format === 'binary') {
    return makeCall('makeBinary', []);
  }
  return makeCall('makeString', []);
}

function generateMakerReference(key: string) {
  return ts.createIdentifier('make' + oautil.typenamify(key));
}

function generateTopLevelClassBuilder(key: string, schema: oas.SchemaObject) {
  return generateTopLevelMaker(key, schema, 'build', 'ShapeOf' + oautil.typenamify(key));
}

function generateTopLevelClassMaker(key: string, schema: oas.SchemaObject, constructor: string) {
  const makerFun = 'createMakerWith';
  const shape = 'ShapeOf' + oautil.typenamify(key);
  return ts.createVariableStatement(
    [ts.createModifier(ts.SyntaxKind.ExportKeyword)],
    ts.createVariableDeclarationList(
      [
        ts.createVariableDeclaration(
          'make' + oautil.typenamify(key),
          ts.createTypeReferenceNode(fromLib('Maker'), [
            ts.createTypeReferenceNode(shape, []),
            ts.createTypeReferenceNode(oautil.typenamify(key), [])
          ]),
          makeCall(makerFun, [ts.createIdentifier(constructor)])
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
          ts.createTypeReferenceNode(fromLib('Maker'), [
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
              ts.createBlock([ts.createReturn(generateMakerExpression(schema))])
            )
          ])
        )
      ],
      ts.NodeFlags.Const
    )
  );
}

function generateObjectShape(key: string, schema: oas.SchemaObject) {
  const members = generateObjectMembers(
    schema.properties,
    schema.required,
    schema.additionalProperties,
    (typeName: string) => 'ShapeOf' + typeName
  );
  return ts.createInterfaceDeclaration(
    undefined,
    [ts.createModifier(ts.SyntaxKind.ExportKeyword)],
    'ShapeOf' + oautil.typenamify(key),
    undefined,
    undefined,
    members
  );
}

function brandTypeName(key: string): string {
  return 'BrandOf' + oautil.typenamify(key);
}

function generateBrand(key: string) {
  return ts.createEnumDeclaration(undefined, undefined, brandTypeName(key), []);
}

function generateTypeShape(key: string, schema: oas.SchemaObject) {
  return ts.createTypeAliasDeclaration(
    undefined,
    [ts.createModifier(ts.SyntaxKind.ExportKeyword)],
    'ShapeOf' + oautil.typenamify(key),
    undefined,
    generateType(schema, name => 'ShapeOf' + name)
  );
}

function generateTopLevelType(key: string, schema: oas.SchemaObject | oas.ReferenceObject) {
  if (oautil.isReferenceObject(schema)) {
    return [
      ts.createTypeAliasDeclaration(
        undefined,
        [ts.createModifier(ts.SyntaxKind.ExportKeyword)],
        oautil.typenamify(key),
        undefined,
        ts.createTypeReferenceNode(oautil.refToTypeName(schema.$ref), undefined)
      ),
      generateTypeShape(key, schema),
      generateTopLevelMaker(key, schema)
    ];
  }
  if (schema.type === 'object') {
    return [
      generateObjectShape(key, schema),
      generateBrand(key),
      generateValueClass(key, schema),
      generateTopLevelClassBuilder(key, schema),
      generateTopLevelClassMaker(key, schema, oautil.typenamify(key))
    ];
  }
  if (isScalar(schema)) {
    return [
      generateBrand(key),
      ts.createTypeAliasDeclaration(
        undefined,
        [ts.createModifier(ts.SyntaxKind.ExportKeyword)],
        oautil.typenamify(key),
        undefined,
        typeWithBrand(key, generateType(schema))
      ),
      generateTypeShape(key, schema),
      generateTopLevelMaker(key, schema)
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
    generateTypeShape(key, schema),
    generateTopLevelMaker(key, schema)
  ];
}

function typeWithBrand(key: string, type: ts.TypeNode): ts.TypeNode {
  return ts.createTypeReferenceNode(ts.createQualifiedName(runtimeLibrary, 'Branded'), [
    type,
    ts.createTypeReferenceNode(brandTypeName(key), [])
  ]);
}

function isScalar(schema: oas.SchemaObject): boolean {
  return ['string', 'integer', 'number', 'boolean'].indexOf(schema.type || '') >= 0;
}

function generateComponentSchemas(oas: oas.OpenAPIObject): ts.Node[] {
  const schemas = safe(oas).components.schemas.$;
  if (!schemas) {
    return [];
  }
  return Object.keys(schemas).reduce((memo, key) => {
    const schema = schemas[key];
    return [...memo, ...generateTopLevelType(key, schema)];
  }, []);
}

function generateComponentResponses(oas: oas.OpenAPIObject): ts.Node[] {
  const responses = safe(oas).components.responses.$;
  if (!responses) {
    return [];
  }
  return Object.keys(responses).reduce((memo, key) => {
    const response = responses[key];
    return [
      ...memo,
      ...generateTopLevelType(
        key,
        oautil.isReferenceObject(response)
          ? { $ref: response.$ref }
          : generateContentSchemaType(response.content || assert.fail('missing content'))
      )
    ];
  }, []);
}

function generateComponents(oas: oas.OpenAPIObject): ts.NodeArray<ts.Node> {
  const nodes = [];
  nodes.push(...oautil.errorTag('in component.schemas', () => generateComponentSchemas(oas)));
  nodes.push(...oautil.errorTag('in component.responses', () => generateComponentResponses(oas)));
  return ts.createNodeArray(nodes);
}

const makeTypeTypeName = 'Make';

function fromLib(name: string) {
  return ts.createQualifiedName(runtimeLibrary, name);
}

const runtimeLibrary = ts.createIdentifier('oar');
const readonly = [ts.createModifier(ts.SyntaxKind.ReadonlyKeyword)];

function generateBuiltins(runtimeModule: string) {
  return ts.createNodeArray([
    ts.createImportDeclaration(
      undefined,
      undefined,
      ts.createImportClause(
        undefined,
        ts.createNamedImports([
          ts.createImportSpecifier(ts.createIdentifier('runtime'), runtimeLibrary)
        ])
      ),
      ts.createStringLiteral(runtimeModule)
    )
  ]);
}

export interface Options {
  oas: oas.OpenAPIObject;
  runtimeModule: string;
  emitStatusCode: (status: number) => boolean;
}

function addIndexSignatureIgnores(src: string) {
  const result: string[] = [];
  src.split('\n').forEach(line => {
    const m = line.match(new RegExp('\\[\\s*' + valueClassIndexSignatureKey));
    if (m) {
      if (!/\b(unknown|any)\b/.test(line)) {
        result.push('// @ts-ignore tsc does not like the branding type in index signatures');
        result.push(line);
        return;
      }
    }
    result.push(line);
  });
  return result.join('\n');
}

export function run(opts: Options) {
  const builtins = generateBuiltins(opts.runtimeModule);
  const types = generateComponents(opts.oas);
  const queryTypes = generateQueryTypes(opts);

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
      ts.createNodeArray([...builtins, ...types, ...queryTypes]),
      sourceFile
    );
  return addIndexSignatureIgnores(src);
}
