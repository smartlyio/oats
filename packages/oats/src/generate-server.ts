import * as oas from 'openapi3-ts';
import * as ts from 'typescript';
import * as assert from 'assert';
import * as oautil from './util';
import { server, client } from '@smartlyio/oats-runtime';
import { NameMapper, UnsupportedFeatureBehaviour } from './util';

function generateRuntimeImport(runtimeModule: string) {
  return ts.factory.createNodeArray([
    ts.factory.createImportDeclaration(
      undefined,
      ts.factory.createImportClause(
        false,
        undefined,
        ts.factory.createNamespaceImport(ts.factory.createIdentifier('oar'))
      ),
      ts.factory.createStringLiteral(runtimeModule)
    )
  ]);
}

function generateImport(as: string, module: string) {
  return ts.factory.createNodeArray([
    ts.factory.createImportDeclaration(
      undefined,
      ts.factory.createImportClause(
        false,
        undefined,
        ts.factory.createNamespaceImport(ts.factory.createIdentifier(as))
      ),
      ts.factory.createStringLiteral(module)
    )
  ]);
}

function fromRuntime(name: string) {
  return ts.factory.createQualifiedName(ts.factory.createIdentifier('oar'), name);
}

function fromTypes(name: string) {
  return ts.factory.createQualifiedName(ts.factory.createIdentifier('types'), name);
}

const readonly = [ts.factory.createModifier(ts.SyntaxKind.ReadonlyKeyword)];

function generateMethod<S extends oas.OperationObject>(
  path: string,
  method: string,
  schema: S,
  opts: Options
) {
  if (
    (opts?.unsupportedFeatures?.security ?? UnsupportedFeatureBehaviour.reject) ===
    UnsupportedFeatureBehaviour.reject
  ) {
    assert(!schema.security, 'security not supported');
  }

  const headers = ts.factory.createTypeReferenceNode(
    fromTypes(
      opts.nameMapper(
        oautil.endpointTypeName(schema, path, method, 'headers'),
        opts.shapesAsRequests ? 'shape' : 'value'
      )
    ),
    []
  );
  const params = ts.factory.createTypeReferenceNode(
    fromTypes(
      opts.nameMapper(
        oautil.endpointTypeName(schema, path, method, 'parameters'),
        opts.shapesAsRequests ? 'shape' : 'value'
      )
    ),
    []
  );
  const query = ts.factory.createTypeReferenceNode(
    fromTypes(
      opts.nameMapper(
        oautil.endpointTypeName(schema, path, method, 'query'),
        opts.shapesAsRequests ? 'shape' : 'value'
      )
    ),
    []
  );
  const body = ts.factory.createTypeReferenceNode(
    fromTypes(
      opts.nameMapper(
        oautil.endpointTypeName(schema, path, method, 'requestBody'),
        opts.shapesAsRequests ? 'shape' : 'value'
      )
    ),
    []
  );
  const response = ts.factory.createTypeReferenceNode(
    fromTypes(
      opts.nameMapper(
        oautil.endpointTypeName(schema, path, method, 'response'),
        opts.shapesAsResponses ? 'shape' : 'value'
      )
    ),
    []
  );
  return ts.factory.createTypeReferenceNode(fromRuntime('server.Endpoint'), [
    headers,
    params,
    query,
    body,
    response,
    ts.factory.createTypeReferenceNode('RequestContext', undefined)
  ]);
}

function generateEndpoint(path: string, schema: oas.PathItemObject, opts: Options) {
  assert(!schema.$ref, '$ref in path not supported');
  assert(!schema.parameters, 'parameters in path not supported');
  const signatures: ts.PropertySignature[] = [];
  server.supportedMethods.forEach(
    method =>
      oautil.errorTag('in method ' + method.toUpperCase(), () => {
        const methodHandler = schema[method];
        if (methodHandler) {
          const endpoint = ts.factory.createPropertySignature(
            readonly,
            ts.factory.createStringLiteral(method),
            undefined,
            generateMethod(path, method, methodHandler, opts)
          );
          signatures.push(endpoint);
        }
      }),
    []
  );
  return ts.factory.createTypeLiteralNode(signatures);
}

function generateClientMethod(
  opts: Options,
  path: string,
  method: string,
  op: oas.OperationObject
): ts.TypeNode {
  if (
    (opts?.unsupportedFeatures?.security ?? UnsupportedFeatureBehaviour.reject) ===
    UnsupportedFeatureBehaviour.reject
  ) {
    assert(!op.security, 'security not supported');
  }
  const headers = ts.factory.createTypeReferenceNode(
    fromTypes(
      opts.nameMapper(
        oautil.endpointTypeName(op, path, method, 'headers'),
        opts.shapesAsRequests ? 'shape' : 'value'
      )
    ),
    []
  );
  const query = ts.factory.createTypeReferenceNode(
    fromTypes(
      opts.nameMapper(
        oautil.endpointTypeName(op, path, method, 'query'),
        opts.shapesAsRequests ? 'shape' : 'value'
      )
    ),
    []
  );
  const body = ts.factory.createTypeReferenceNode(
    fromTypes(
      opts.nameMapper(
        oautil.endpointTypeName(op, path, method, 'requestBody'),
        opts.shapesAsRequests ? 'shape' : 'value'
      )
    ),
    []
  );
  const response = ts.factory.createTypeReferenceNode(
    fromTypes(
      opts.nameMapper(
        oautil.endpointTypeName(op, path, method, 'response'),
        opts.shapesAsResponses ? 'shape' : 'value'
      )
    ),
    []
  );
  return ts.factory.createTypeReferenceNode(fromRuntime('client.ClientEndpoint'), [
    headers,
    query,
    body,
    response
  ]);
}

function generateClientTree(
  opts: Options,
  tree: client.OpTree<ts.TypeNode>
): readonly ts.TypeElement[] {
  const members = [];
  if (tree.param) {
    members.push(
      ts.factory.createCallSignature(
        undefined,
        [
          ts.factory.createParameterDeclaration(
            undefined,
            undefined,
            tree.param.name,
            undefined,
            ts.factory.createUnionTypeNode([
              ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
              ts.factory.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword)
            ])
          )
        ],
        generateClientSpecType(opts, tree.param.tree)
      )
    );
  }
  Object.keys(tree.methods).forEach(method => {
    const type: ts.TypeNode = tree.methods[method];
    members.push(ts.factory.createPropertySignature(readonly, method, undefined, type));
  });
  Object.keys(tree.parts).forEach(part => {
    const pathPart = /[^a-zA-Z_0-9]/.test(part) ? ts.factory.createStringLiteral(part) : part;
    members.push(
      ts.factory.createPropertySignature(
        readonly,
        pathPart,
        undefined,
        generateClientSpecType(opts, tree.parts[part])
      )
    );
  });
  return members;
}

function generateClientSpecType(opts: Options, tree: client.OpTree<ts.TypeNode>) {
  return ts.factory.createTypeLiteralNode(generateClientTree(opts, tree));
}

function generateClientSpec(opts: Options) {
  const tree: client.OpTree<ts.TypeNode> = Object.keys(opts.oas.paths).reduce((memo, path) => {
    const endpoint = opts.oas.paths[path];
    return server.supportedMethods.reduce((memo, method) => {
      if (endpoint[method]) {
        return client.addPath(
          memo,
          path,
          method,
          generateClientMethod(opts, path, method, endpoint[method])
        );
      }
      return memo;
    }, memo);
  }, client.emptyTree<ts.TypeNode>());
  return ts.factory.createNodeArray([
    ts.factory.createTypeAliasDeclaration(
      [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
      'ClientSpec',
      undefined,
      ts.factory.createTypeLiteralNode(generateClientTree(opts, tree))
    )
  ]);
}

function generateEndpointsType(opts: Options) {
  const members = Object.keys(opts.oas.paths).map(path => {
    const endpoint: oas.PathItemObject = opts.oas.paths[path];
    return oautil.errorTag('in endpoint ' + path, () => {
      const type = generateEndpoint(path, endpoint, opts);
      return ts.factory.createPropertySignature(
        readonly,
        ts.factory.createStringLiteral(path),
        ts.factory.createToken(ts.SyntaxKind.QuestionToken),
        type
      );
    });
  });
  return ts.factory.createNodeArray([
    ts.factory.createTypeAliasDeclaration(
      [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
      'EndpointsWithContext',
      [ts.factory.createTypeParameterDeclaration([], 'RequestContext')],
      ts.factory.createTypeLiteralNode(members)
    ),
    ts.factory.createTypeAliasDeclaration(
      [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
      'Endpoints',
      undefined,
      ts.factory.createTypeReferenceNode('EndpointsWithContext', [
        ts.factory.createTypeReferenceNode('void', undefined)
      ])
    )
  ]);
}
function makeMaker(type: string, opts: Options): ts.Expression {
  return ts.factory.createPropertyAccessExpression(
    ts.factory.createIdentifier('types'),
    'make' + opts.nameMapper(type, 'value')
  );
}

function generateMaker(
  servers: string[],
  opts: Options,
  path: string,
  method: string,
  object: oas.OperationObject
): ts.Expression {
  if (object.servers) {
    servers = object.servers.map(server => server.url);
  }
  const headers = makeMaker(oautil.endpointTypeName(object, path, method, 'headers'), opts);
  const params = makeMaker(oautil.endpointTypeName(object, path, method, 'parameters'), opts);
  const query = makeMaker(oautil.endpointTypeName(object, path, method, 'query'), opts);
  const body = makeMaker(oautil.endpointTypeName(object, path, method, 'requestBody'), opts);
  const response = makeMaker(oautil.endpointTypeName(object, path, method, 'response'), opts);
  return ts.factory.createObjectLiteralExpression(
    [
      ts.factory.createPropertyAssignment('path', ts.factory.createStringLiteral(path)),
      ts.factory.createPropertyAssignment('method', ts.factory.createStringLiteral(method)),
      ts.factory.createPropertyAssignment(
        'servers',
        ts.factory.createArrayLiteralExpression(
          servers.map(value => ts.factory.createStringLiteral(value))
        )
      ),
      ts.factory.createPropertyAssignment('headers', headers),
      ts.factory.createPropertyAssignment('query', query),
      ts.factory.createPropertyAssignment('body', body),
      ts.factory.createPropertyAssignment('params', params),
      ts.factory.createPropertyAssignment('response', response)
    ],
    true
  );
}

function flattenPathAndMethod(paths: oas.PathsObject) {
  const flattened = [];
  for (const path of Object.keys(paths)) {
    for (const method of server.supportedMethods) {
      const object = paths[path][method];
      if (object) {
        flattened.push({ path, method, object });
      }
    }
  }
  return flattened;
}

function generateHandler(opts: Options) {
  const schema = opts.oas;
  const servers = (schema?.servers ?? []).map(server => server.url);
  return ts.factory.createVariableStatement(
    [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
    ts.factory.createVariableDeclarationList(
      [
        ts.factory.createVariableDeclaration(
          'endpointHandlers',
          undefined,
          ts.factory.createArrayTypeNode(
            ts.factory.createTypeReferenceNode(
              ts.factory.createQualifiedName(ts.factory.createIdentifier('oar'), 'server.Handler'),
              []
            )
          ),
          ts.factory.createArrayLiteralExpression(
            flattenPathAndMethod(schema.paths).map(p =>
              generateMaker(servers, opts, p.path, p.method, p.object)
            )
          )
        )
      ],
      ts.NodeFlags.Const
    )
  );
}

function generateRouterJSDoc() {
  return ts.factory.createJSDocComment(undefined, [
    ts.factory.createJSDocUnknownTag(
      ts.factory.createIdentifier('deprecated'),
      'Use `createRouter()` instead. ' +
        'It supports "number", "integer", "boolean" and "array" types in query parameters ' +
        'and numeric types in path parameters.'
    )
  ]);
}

export function generateRouter() {
  return ts.factory.createVariableStatement(
    [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
    ts.factory.createVariableDeclarationList(
      [
        ts.factory.createVariableDeclaration(
          'router',
          undefined,
          ts.factory.createTypeReferenceNode(
            ts.factory.createQualifiedName(
              ts.factory.createIdentifier('oar'),
              'server.HandlerFactory'
            ),
            [ts.factory.createTypeReferenceNode('Endpoints', [])]
          ),
          ts.factory.createCallExpression(
            ts.factory.createPropertyAccessExpression(
              ts.factory.createIdentifier('oar'),
              'server.createHandlerFactory'
            ),
            undefined,
            [ts.factory.createIdentifier('endpointHandlers')]
          )
        )
      ],
      ts.NodeFlags.Const
    )
  );
}
export function generateCreateRouter() {
  return ts.factory.createFunctionDeclaration(
    [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
    undefined,
    'createRouter',
    [ts.factory.createTypeParameterDeclaration([], 'TRequestContext')],
    [
      ts.factory.createParameterDeclaration(
        undefined,
        undefined,
        'handlerOptions',
        undefined,
        ts.factory.createTypeReferenceNode(
          ts.factory.createIdentifier('oar.server.HandlerOptions')
        ),
        ts.factory.createObjectLiteralExpression()
      )
    ],
    ts.factory.createTypeReferenceNode(ts.factory.createIdentifier('oar.server.HandlerFactory'), [
      ts.factory.createTypeReferenceNode('EndpointsWithContext', [
        ts.factory.createTypeReferenceNode('TRequestContext')
      ])
    ]),
    ts.factory.createBlock(
      [
        ts.factory.createVariableStatement(
          undefined,
          ts.factory.createVariableDeclarationList(
            [
              ts.factory.createVariableDeclaration(
                ts.factory.createObjectBindingPattern([
                  ts.factory.createBindingElement(
                    undefined,
                    'validationOptions',
                    ts.factory.createObjectBindingPattern([
                      ts.factory.createBindingElement(
                        undefined,
                        'query',
                        ts.factory.createObjectBindingPattern([
                          ts.factory.createBindingElement(
                            undefined,
                            'parseBooleanStrings',
                            'queryParseBooleanStrings',
                            ts.factory.createTrue()
                          ),
                          ts.factory.createBindingElement(
                            undefined,
                            'parseNumericStrings',
                            'queryParseNumericStrings',
                            ts.factory.createTrue()
                          ),
                          ts.factory.createBindingElement(
                            undefined,
                            'allowConvertForArrayType',
                            'queryAllowConvertForArrayType',
                            ts.factory.createTrue()
                          ),
                          ts.factory.createBindingElement(
                            ts.factory.createToken(ts.SyntaxKind.DotDotDotToken),
                            undefined,
                            'queryRest'
                          )
                        ]),
                        ts.factory.createObjectLiteralExpression()
                      ),
                      ts.factory.createBindingElement(
                        undefined,
                        'params',
                        ts.factory.createObjectBindingPattern([
                          ts.factory.createBindingElement(
                            undefined,
                            'parseNumericStrings',
                            'paramsParseNumericStrings',
                            ts.factory.createTrue()
                          ),
                          ts.factory.createBindingElement(
                            ts.factory.createToken(ts.SyntaxKind.DotDotDotToken),
                            undefined,
                            'paramsRest'
                          )
                        ]),
                        ts.factory.createObjectLiteralExpression()
                      ),
                      ts.factory.createBindingElement(
                        undefined,
                        'body',
                        ts.factory.createObjectBindingPattern([
                          ts.factory.createBindingElement(
                            undefined,
                            'unknownField',
                            'bodyUnknownField',
                            ts.factory.createStringLiteral('fail')
                          ),
                          ts.factory.createBindingElement(
                            undefined,
                            'parseBooleanStrings',
                            'bodyParseBooleanStrings',
                            ts.factory.createTrue()
                          ),
                          ts.factory.createBindingElement(
                            undefined,
                            'parseNumericStrings',
                            'bodyParseNumericStrings',
                            ts.factory.createTrue()
                          ),
                          ts.factory.createBindingElement(
                            undefined,
                            'allowConvertForArrayType',
                            'bodyAllowConvertForArrayType',
                            ts.factory.createTrue()
                          ),
                          ts.factory.createBindingElement(
                            ts.factory.createToken(ts.SyntaxKind.DotDotDotToken),
                            undefined,
                            'bodyRest'
                          )
                        ]),
                        ts.factory.createObjectLiteralExpression()
                      ),
                      ts.factory.createBindingElement(
                        ts.factory.createToken(ts.SyntaxKind.DotDotDotToken),
                        undefined,
                        'validationOptionsRest'
                      )
                    ]),
                    ts.factory.createObjectLiteralExpression()
                  ),
                  ts.factory.createBindingElement(
                    ts.factory.createToken(ts.SyntaxKind.DotDotDotToken),
                    undefined,
                    'handlerOptionsRest'
                  )
                ]),
                undefined,
                undefined,
                ts.factory.createIdentifier('handlerOptions')
              )
            ],
            ts.NodeFlags.Const
          )
        ),
        ts.factory.createReturnStatement(
          ts.factory.createCallExpression(
            ts.factory.createIdentifier('oar.server.createHandlerFactory'),
            undefined,
            [
              ts.factory.createIdentifier('endpointHandlers'),
              ts.factory.createObjectLiteralExpression([
                ts.factory.createSpreadAssignment(
                  ts.factory.createIdentifier('handlerOptionsRest')
                ),
                ts.factory.createPropertyAssignment(
                  'validationOptions',
                  ts.factory.createObjectLiteralExpression([
                    ts.factory.createSpreadAssignment(
                      ts.factory.createIdentifier('validationOptionsRest')
                    ),
                    ts.factory.createPropertyAssignment(
                      'query',
                      ts.factory.createObjectLiteralExpression([
                        ts.factory.createSpreadAssignment(ts.factory.createIdentifier('queryRest')),
                        ts.factory.createPropertyAssignment(
                          'parseBooleanStrings',
                          ts.factory.createIdentifier('queryParseBooleanStrings')
                        ),
                        ts.factory.createPropertyAssignment(
                          'parseNumericStrings',
                          ts.factory.createIdentifier('queryParseNumericStrings')
                        ),
                        ts.factory.createPropertyAssignment(
                          'allowConvertForArrayType',
                          ts.factory.createIdentifier('queryAllowConvertForArrayType')
                        )
                      ])
                    ),
                    ts.factory.createPropertyAssignment(
                      'params',
                      ts.factory.createObjectLiteralExpression([
                        ts.factory.createSpreadAssignment(
                          ts.factory.createIdentifier('paramsRest')
                        ),
                        ts.factory.createPropertyAssignment(
                          'parseNumericStrings',
                          ts.factory.createIdentifier('paramsParseNumericStrings')
                        )
                      ])
                    ),
                    ts.factory.createPropertyAssignment(
                      'body',
                      ts.factory.createObjectLiteralExpression([
                        ts.factory.createSpreadAssignment(ts.factory.createIdentifier('bodyRest')),
                        ts.factory.createPropertyAssignment(
                          'unknownField',
                          ts.factory.createIdentifier('bodyUnknownField')
                        ),
                        ts.factory.createPropertyAssignment(
                          'parseBooleanStrings',
                          ts.factory.createIdentifier('bodyParseBooleanStrings')
                        ),
                        ts.factory.createPropertyAssignment(
                          'parseNumericStrings',
                          ts.factory.createIdentifier('bodyParseNumericStrings')
                        ),
                        ts.factory.createPropertyAssignment(
                          'allowConvertForArrayType',
                          ts.factory.createIdentifier('bodyAllowConvertForArrayType')
                        )
                      ])
                    ),
                  ])
                )
              ])
            ]
          )
        )
      ],
      true
    )
  );
}

export function generateClient() {
  return ts.factory.createVariableStatement(
    [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
    ts.factory.createVariableDeclarationList(
      [
        ts.factory.createVariableDeclaration(
          'client',
          undefined,
          ts.factory.createTypeReferenceNode(
            ts.factory.createQualifiedName(
              ts.factory.createIdentifier('oar'),
              'client.ClientFactory'
            ),
            [ts.factory.createTypeReferenceNode('ClientSpec', [])]
          ),
          ts.factory.createCallExpression(
            ts.factory.createPropertyAccessExpression(
              ts.factory.createIdentifier('oar'),
              'client.createClientFactory'
            ),
            undefined,
            [ts.factory.createIdentifier('endpointHandlers')]
          )
        )
      ],
      ts.NodeFlags.Const
    )
  );
}

export function generateCreateClient() {
  return ts.factory.createFunctionDeclaration(
    [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
    undefined,
    'createClient',
    [],
    [
      ts.factory.createParameterDeclaration(
        undefined,
        undefined,
        'handlerOptions',
        undefined,
        ts.factory.createTypeReferenceNode(
          ts.factory.createIdentifier('oar.server.HandlerOptions')
        ),
        ts.factory.createObjectLiteralExpression()
      )
    ],
    ts.factory.createTypeReferenceNode(ts.factory.createIdentifier('oar.client.ClientFactory'),
      [ts.factory.createTypeReferenceNode('ClientSpec', [])] 
    ),
    ts.factory.createBlock(
      [
        ts.factory.createReturnStatement(
          ts.factory.createCallExpression(
            ts.factory.createPropertyAccessExpression(
              ts.factory.createIdentifier('oar'),
              'client.createClientFactory'
            ),
            undefined,
            [
              ts.factory.createIdentifier('endpointHandlers'),
              ts.factory.createIdentifier('handlerOptions')
            ]
          )
        )
      ],
      false
    )
  );
}

interface Options {
  oas: oas.OpenAPIObject;
  runtimePath: string;
  typePath: string;
  shapesAsRequests: boolean;
  shapesAsResponses: boolean;
  unsupportedFeatures: {
    security?: UnsupportedFeatureBehaviour;
  };
  nameMapper: NameMapper;
}

export function run(opts: Options) {
  const runtimeModule = opts.runtimePath;
  const typemodule = opts.typePath;

  const runtime = generateRuntimeImport(runtimeModule);
  const types = generateImport('types', typemodule);
  const endpoints = generateEndpointsType(opts);
  const clientSpec = generateClientSpec(opts);
  const handler = generateHandler(opts);
  const routerJSDoc = generateRouterJSDoc();
  const router = generateRouter();
  const createRouter = generateCreateRouter();
  const client = generateClient();
  const createClient = generateCreateClient();

  const sourceFile: ts.SourceFile = ts.createSourceFile(
    'test.ts',
    '',
    ts.ScriptTarget.ES2015,
    true,
    ts.ScriptKind.TS
  );
  return ts
    .createPrinter()
    .printList(
      ts.ListFormat.MultiLine,
      ts.factory.createNodeArray([
        ...runtime,
        ...types,
        ...endpoints,
        ...clientSpec,
        handler,
        routerJSDoc,
        router,
        createRouter,
        client,
        createClient
      ]),
      sourceFile
    );
}
