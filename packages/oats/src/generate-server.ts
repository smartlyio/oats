import * as oas from 'openapi3-ts';
import * as ts from 'typescript';
import * as assert from 'assert';
import * as oautil from './util';
import { server, client } from '@smartlyio/oats-runtime';
import safe from '@smartlyio/safe-navigation';
import { NameMapper, UnsupportedFeatureBehaviour } from './util';

function generateRuntimeImport(runtimeModule: string) {
  return ts.createNodeArray([
    ts.factory.createImportDeclaration(
      undefined,
      ts.createImportClause(undefined, ts.createNamespaceImport(ts.createIdentifier('oar'))),
      ts.createStringLiteral(runtimeModule)
    )
  ]);
}

function generateImport(as: string, module: string) {
  return ts.createNodeArray([
    ts.factory.createImportDeclaration(
      undefined,
      ts.createImportClause(undefined, ts.createNamespaceImport(ts.createIdentifier(as))),
      ts.createStringLiteral(module)
    )
  ]);
}

function fromRuntime(name: string) {
  return ts.createQualifiedName(ts.createIdentifier('oar'), name);
}

function fromTypes(name: string) {
  return ts.createQualifiedName(ts.createIdentifier('types'), name);
}

const readonly = [ts.createModifier(ts.SyntaxKind.ReadonlyKeyword)];

function generateMethod<S extends oas.OperationObject>(
  path: string,
  method: string,
  schema: S,
  opts: Options
) {
  if (
    (safe(opts).unsupportedFeatures.security.$ ?? UnsupportedFeatureBehaviour.reject) ===
    UnsupportedFeatureBehaviour.reject
  ) {
    assert(!schema.security, 'security not supported');
  }

  const headers = ts.createTypeReferenceNode(
    fromTypes(
      opts.nameMapper(
        oautil.endpointTypeName(schema, path, method, 'headers'),
        opts.shapesAsRequests ? 'shape' : 'value'
      )
    ),
    []
  );
  const params = ts.createTypeReferenceNode(
    fromTypes(
      opts.nameMapper(
        oautil.endpointTypeName(schema, path, method, 'parameters'),
        opts.shapesAsRequests ? 'shape' : 'value'
      )
    ),
    []
  );
  const query = ts.createTypeReferenceNode(
    fromTypes(
      opts.nameMapper(
        oautil.endpointTypeName(schema, path, method, 'query'),
        opts.shapesAsRequests ? 'shape' : 'value'
      )
    ),
    []
  );
  const body = ts.createTypeReferenceNode(
    fromTypes(
      opts.nameMapper(
        oautil.endpointTypeName(schema, path, method, 'requestBody'),
        opts.shapesAsRequests ? 'shape' : 'value'
      )
    ),
    []
  );
  const response = ts.createTypeReferenceNode(
    fromTypes(
      opts.nameMapper(
        oautil.endpointTypeName(schema, path, method, 'response'),
        opts.shapesAsResponses ? 'shape' : 'value'
      )
    ),
    []
  );
  return ts.createTypeReferenceNode(fromRuntime('server.Endpoint'), [
    headers,
    params,
    query,
    body,
    response,
    ts.createTypeReferenceNode('RequestContext', undefined)
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
          const endpoint = ts.createPropertySignature(
            readonly,
            ts.createStringLiteral(method),
            undefined,
            generateMethod(path, method, methodHandler, opts),
            undefined
          );
          signatures.push(endpoint);
        }
      }),
    []
  );
  return ts.createTypeLiteralNode(signatures);
}

function generateClientMethod(
  opts: Options,
  path: string,
  method: string,
  op: oas.OperationObject
): ts.TypeNode {
  if (
    (safe(opts).unsupportedFeatures.security.$ ?? UnsupportedFeatureBehaviour.reject) ===
    UnsupportedFeatureBehaviour.reject
  ) {
    assert(!op.security, 'security not supported');
  }
  const headers = ts.createTypeReferenceNode(
    fromTypes(
      opts.nameMapper(
        oautil.endpointTypeName(op, path, method, 'headers'),
        opts.shapesAsRequests ? 'shape' : 'value'
      )
    ),
    []
  );
  const query = ts.createTypeReferenceNode(
    fromTypes(
      opts.nameMapper(
        oautil.endpointTypeName(op, path, method, 'query'),
        opts.shapesAsRequests ? 'shape' : 'value'
      )
    ),
    []
  );
  const body = ts.createTypeReferenceNode(
    fromTypes(
      opts.nameMapper(
        oautil.endpointTypeName(op, path, method, 'requestBody'),
        opts.shapesAsRequests ? 'shape' : 'value'
      )
    ),
    []
  );
  const response = ts.createTypeReferenceNode(
    fromTypes(
      opts.nameMapper(
        oautil.endpointTypeName(op, path, method, 'response'),
        opts.shapesAsResponses ? 'shape' : 'value'
      )
    ),
    []
  );
  return ts.createTypeReferenceNode(fromRuntime('client.ClientEndpoint'), [
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
      ts.createCallSignature(
        undefined,
        [
          ts.createParameter(
            undefined,
            undefined,
            undefined,
            tree.param.name,
            undefined,
            ts.createUnionTypeNode([
              ts.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
              ts.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword)
            ])
          )
        ],
        generateClientSpecType(opts, tree.param.tree)
      )
    );
  }
  Object.keys(tree.methods).forEach(method => {
    const type: ts.TypeNode = tree.methods[method];
    members.push(ts.createPropertySignature(readonly, method, undefined, type, undefined));
  });
  Object.keys(tree.parts).forEach(part => {
    const pathPart = /[^a-zA-Z_0-9]/.test(part) ? ts.createStringLiteral(part) : part;
    members.push(
      ts.createPropertySignature(
        readonly,
        pathPart,
        undefined,
        generateClientSpecType(opts, tree.parts[part]),
        undefined
      )
    );
  });
  return members;
}

function generateClientSpecType(opts: Options, tree: client.OpTree<ts.TypeNode>) {
  return ts.createTypeLiteralNode(generateClientTree(opts, tree));
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
  return ts.createNodeArray([
    ts.factory.createTypeAliasDeclaration(
      [ts.createModifier(ts.SyntaxKind.ExportKeyword)],
      'ClientSpec',
      undefined,
      ts.createTypeLiteralNode(generateClientTree(opts, tree))
    )
  ]);
}

function generateEndpointsType(opts: Options) {
  const members = Object.keys(opts.oas.paths).map(path => {
    const endpoint: oas.PathItemObject = opts.oas.paths[path];
    return oautil.errorTag('in endpoint ' + path, () => {
      const type = generateEndpoint(path, endpoint, opts);
      return ts.createPropertySignature(
        readonly,
        ts.createStringLiteral(path),
        ts.createToken(ts.SyntaxKind.QuestionToken),
        type,
        undefined
      );
    });
  });
  return ts.createNodeArray([
    ts.factory.createTypeAliasDeclaration(
      [ts.createModifier(ts.SyntaxKind.ExportKeyword)],
      'EndpointsWithContext',
      [ts.createTypeParameterDeclaration('RequestContext', undefined, undefined)],
      ts.createTypeLiteralNode(members)
    ),
    ts.factory.createTypeAliasDeclaration(
      [ts.createModifier(ts.SyntaxKind.ExportKeyword)],
      'Endpoints',
      undefined,
      ts.createTypeReferenceNode('EndpointsWithContext', [
        ts.createTypeReferenceNode('void', undefined)
      ])
    )
  ]);
}
function makeMaker(type: string, opts: Options): ts.Expression {
  return ts.createPropertyAccess(
    ts.createIdentifier('types'),
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
  return ts.createObjectLiteral(
    [
      ts.createPropertyAssignment('path', ts.createStringLiteral(path)),
      ts.createPropertyAssignment('method', ts.createStringLiteral(method)),
      ts.createPropertyAssignment(
        'servers',
        ts.createArrayLiteral(servers.map(value => ts.factory.createStringLiteral(value)))
      ),
      ts.createPropertyAssignment('headers', headers),
      ts.createPropertyAssignment('query', query),
      ts.createPropertyAssignment('body', body),
      ts.createPropertyAssignment('params', params),
      ts.createPropertyAssignment('response', response)
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
  const servers = (safe(schema).servers.$ || []).map(server => server.url);
  return ts.createVariableStatement(
    [ts.createModifier(ts.SyntaxKind.ExportKeyword)],
    ts.createVariableDeclarationList(
      [
        ts.createVariableDeclaration(
          'endpointHandlers',
          ts.createArrayTypeNode(
            ts.createTypeReferenceNode(
              ts.createQualifiedName(ts.createIdentifier('oar'), 'server.Handler'),
              []
            )
          ),
          ts.createArrayLiteral(
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
  return ts.createJSDocComment(undefined, [
    ts.createJSDocTag(
      ts.createIdentifier('deprecated'),
      'Use `createRouter()` instead. ' +
        'It supports "number", "integer", "boolean" and "array" types in query parameters ' +
        'and numeric types in path parameters.'
    )
  ]);
}

export function generateRouter() {
  return ts.createVariableStatement(
    [ts.createModifier(ts.SyntaxKind.ExportKeyword)],
    ts.createVariableDeclarationList(
      [
        ts.createVariableDeclaration(
          'router',
          ts.createTypeReferenceNode(
            ts.createQualifiedName(ts.createIdentifier('oar'), 'server.HandlerFactory'),
            [ts.createTypeReferenceNode('Endpoints', [])]
          ),
          ts.createCall(
            ts.createPropertyAccess(ts.createIdentifier('oar'), 'server.createHandlerFactory'),
            undefined,
            [ts.createIdentifier('endpointHandlers')]
          )
        )
      ],
      ts.NodeFlags.Const
    )
  );
}
export function generateCreateRouter() {
  return ts.createFunctionDeclaration(
    undefined,
    [ts.createModifier(ts.SyntaxKind.ExportKeyword)],
    undefined,
    'createRouter',
    [ts.createTypeParameterDeclaration('TRequestContext')],
    [
      ts.createParameter(
        undefined,
        undefined,
        undefined,
        'handlerOptions',
        undefined,
        ts.createTypeReferenceNode(ts.createIdentifier('oar.server.HandlerOptions')),
        ts.createObjectLiteral()
      )
    ],
    ts.createTypeReferenceNode(ts.createIdentifier('oar.server.HandlerFactory'), [
      ts.createTypeReferenceNode('EndpointsWithContext', [
        ts.createTypeReferenceNode('TRequestContext')
      ])
    ]),
    ts.createBlock(
      [
        ts.createVariableStatement(
          undefined,
          ts.createVariableDeclarationList(
            [
              ts.createVariableDeclaration(
                ts.createObjectBindingPattern([
                  ts.createBindingElement(
                    undefined,
                    'validationOptions',
                    ts.createObjectBindingPattern([
                      ts.createBindingElement(
                        undefined,
                        'query',
                        ts.createObjectBindingPattern([
                          ts.createBindingElement(
                            undefined,
                            'parseBooleanStrings',
                            'queryParseBooleanStrings',
                            ts.createTrue()
                          ),
                          ts.createBindingElement(
                            undefined,
                            'parseNumericStrings',
                            'queryParseNumericStrings',
                            ts.createTrue()
                          ),
                          ts.createBindingElement(
                            undefined,
                            'allowConvertForArrayType',
                            'queryAllowConvertForArrayType',
                            ts.createTrue()
                          ),
                          ts.createBindingElement(
                            ts.createToken(ts.SyntaxKind.DotDotDotToken),
                            undefined,
                            'queryRest'
                          )
                        ]),
                        ts.createObjectLiteral()
                      ),
                      ts.createBindingElement(
                        undefined,
                        'params',
                        ts.createObjectBindingPattern([
                          ts.createBindingElement(
                            undefined,
                            'parseNumericStrings',
                            'paramsParseNumericStrings',
                            ts.createTrue()
                          ),
                          ts.createBindingElement(
                            ts.createToken(ts.SyntaxKind.DotDotDotToken),
                            undefined,
                            'paramsRest'
                          )
                        ]),
                        ts.createObjectLiteral()
                      ),
                      ts.createBindingElement(
                        ts.createToken(ts.SyntaxKind.DotDotDotToken),
                        undefined,
                        'validationOptionsRest'
                      )
                    ]),
                    ts.createObjectLiteral()
                  ),
                  ts.createBindingElement(
                    ts.createToken(ts.SyntaxKind.DotDotDotToken),
                    undefined,
                    'handlerOptionsRest'
                  )
                ]),
                undefined,
                ts.createIdentifier('handlerOptions')
              )
            ],
            ts.NodeFlags.Const
          )
        ),
        ts.createReturn(
          ts.createCall(ts.createIdentifier('oar.server.createHandlerFactory'), undefined, [
            ts.createIdentifier('endpointHandlers'),
            ts.createObjectLiteral([
              ts.createSpreadAssignment(ts.createIdentifier('handlerOptionsRest')),
              ts.createPropertyAssignment(
                'validationOptions',
                ts.createObjectLiteral([
                  ts.createSpreadAssignment(ts.createIdentifier('validationOptionsRest')),
                  ts.createPropertyAssignment(
                    'query',
                    ts.createObjectLiteral([
                      ts.createSpreadAssignment(ts.createIdentifier('queryRest')),
                      ts.createPropertyAssignment(
                        'parseBooleanStrings',
                        ts.createIdentifier('queryParseBooleanStrings')
                      ),
                      ts.createPropertyAssignment(
                        'parseNumericStrings',
                        ts.createIdentifier('queryParseNumericStrings')
                      ),
                      ts.createPropertyAssignment(
                        'allowConvertForArrayType',
                        ts.createIdentifier('queryAllowConvertForArrayType')
                      )
                    ])
                  ),
                  ts.createPropertyAssignment(
                    'params',
                    ts.createObjectLiteral([
                      ts.createSpreadAssignment(ts.createIdentifier('paramsRest')),
                      ts.createPropertyAssignment(
                        'parseNumericStrings',
                        ts.createIdentifier('paramsParseNumericStrings')
                      )
                    ])
                  )
                ])
              )
            ])
          ])
        )
      ],
      true
    )
  );
}

export function generateClient() {
  return ts.createVariableStatement(
    [ts.createModifier(ts.SyntaxKind.ExportKeyword)],
    ts.createVariableDeclarationList(
      [
        ts.createVariableDeclaration(
          'client',
          ts.createTypeReferenceNode(
            ts.createQualifiedName(ts.createIdentifier('oar'), 'client.ClientFactory'),
            [ts.createTypeReferenceNode('ClientSpec', [])]
          ),
          ts.createCall(
            ts.createPropertyAccess(ts.createIdentifier('oar'), 'client.createClientFactory'),
            undefined,
            [ts.createIdentifier('endpointHandlers')]
          )
        )
      ],
      ts.NodeFlags.Const
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
      ts.createNodeArray([
        ...runtime,
        ...types,
        ...endpoints,
        ...clientSpec,
        handler,
        routerJSDoc,
        router,
        createRouter,
        client
      ]),
      sourceFile
    );
}
