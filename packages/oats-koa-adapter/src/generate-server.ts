import * as oas from 'openapi3-ts';
import * as ts from 'typescript';
import * as assert from 'assert';
import * as oautil from './util';
import { server, client } from '@smartlyio/oats-runtime';
import safe from '@smartlyio/safe-navigation';

function generateRuntimeImport(runtimeModule: string) {
  return ts.createNodeArray([
    ts.createImportDeclaration(
      undefined,
      undefined,
      ts.createImportClause(undefined, ts.createNamespaceImport(ts.createIdentifier('oar'))),
      ts.createStringLiteral(runtimeModule)
    )
  ]);
}

function generateImport(as: string, module: string) {
  return ts.createNodeArray([
    ts.createImportDeclaration(
      undefined,
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

function generateMethod<S extends oas.OperationObject, K extends keyof S>(
  path: string,
  method: string,
  schema: S,
  opts: Options
) {
  assert(!schema.security, 'security not supported');
  const headers = ts.createTypeReferenceNode(
    fromTypes(
      (opts.shapesAsRequests ? 'ShapeOf' : '') +
        oautil.typenamify(oautil.endpointTypeName(schema, path, method, 'headers'))
    ),
    []
  );
  const params = ts.createTypeReferenceNode(
    fromTypes(
      (opts.shapesAsRequests ? 'ShapeOf' : '') +
        oautil.typenamify(oautil.endpointTypeName(schema, path, method, 'parameters'))
    ),
    []
  );
  const query = ts.createTypeReferenceNode(
    fromTypes(
      (opts.shapesAsRequests ? 'ShapeOf' : '') +
        oautil.typenamify(oautil.endpointTypeName(schema, path, method, 'query'))
    ),
    []
  );
  const body = ts.createTypeReferenceNode(
    fromTypes(
      (opts.shapesAsRequests ? 'ShapeOf' : '') +
        oautil.typenamify(oautil.endpointTypeName(schema, path, method, 'requestBody'))
    ),
    []
  );
  const response = ts.createTypeReferenceNode(
    fromTypes(
      (opts.shapesAsResponses ? 'ShapeOf' : '') +
        oautil.typenamify(oautil.endpointTypeName(schema, path, method, 'response'))
    ),
    []
  );
  return ts.createTypeReferenceNode(fromRuntime('server.Endpoint'), [
    headers,
    params,
    query,
    body,
    response
  ]);
}

function generateEndpoint(path: string, schema: oas.PathItemObject, opts: Options) {
  assert(!schema.$ref, '$ref in path not supported');
  assert(!schema.parameters, 'parameters in path not supported');
  return ts.createTypeLiteralNode(
    server.supportedMethods.reduce(
      (memo, method) =>
        oautil.errorTag('in method ' + method.toUpperCase(), () => {
          const methodHandler = schema[method];
          if (!methodHandler) {
            return memo;
          }
          const endpoint = ts.createPropertySignature(
            readonly,
            ts.createStringLiteral(method),
            undefined,
            generateMethod(path, method, methodHandler, opts),
            undefined
          );
          return [...memo, endpoint];
        }),
      []
    )
  );
}

function generateClientMethod(
  opts: Options,
  path: string,
  method: string,
  op: oas.OperationObject
): ts.TypeNode {
  assert(!op.security, 'security not supported');
  const headers = ts.createTypeReferenceNode(
    fromTypes(
      (opts.shapesAsRequests ? 'ShapeOf' : '') +
        oautil.typenamify(oautil.endpointTypeName(op, path, method, 'headers'))
    ),
    []
  );
  const query = ts.createTypeReferenceNode(
    fromTypes(
      (opts.shapesAsRequests ? 'ShapeOf' : '') +
        oautil.typenamify(oautil.endpointTypeName(op, path, method, 'query'))
    ),
    []
  );
  const body = ts.createTypeReferenceNode(
    fromTypes(
      (opts.shapesAsRequests ? 'ShapeOf' : '') +
        oautil.typenamify(oautil.endpointTypeName(op, path, method, 'requestBody'))
    ),
    []
  );
  const response = ts.createTypeReferenceNode(
    fromTypes(
      (opts.shapesAsResponses ? 'ShapeOf' : '') +
        oautil.typenamify(oautil.endpointTypeName(op, path, method, 'response'))
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
            ts.createKeywordTypeNode(ts.SyntaxKind.StringKeyword)
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
    ts.createInterfaceDeclaration(
      undefined,
      [ts.createModifier(ts.SyntaxKind.ExportKeyword)],
      'ClientSpec',
      undefined,
      undefined,
      generateClientTree(opts, tree)
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
    ts.createInterfaceDeclaration(
      undefined,
      [ts.createModifier(ts.SyntaxKind.ExportKeyword)],
      'Endpoints',
      undefined,
      undefined,
      members
    )
  ]);
}
function makeMaker(type: string): ts.Expression {
  return ts.createPropertyAccess(ts.createIdentifier('types'), 'make' + oautil.typenamify(type));
}

function generateMaker(
  servers: string[],
  path: string,
  method: string,
  object: oas.OperationObject,
  oasSchema: oas.OpenAPIObject,
  opts: Options
): ts.Expression {
  if (object.servers) {
    servers = object.servers.map(server => server.url);
  }
  const headers = makeMaker(oautil.endpointTypeName(object, path, method, 'headers'));
  const params = makeMaker(oautil.endpointTypeName(object, path, method, 'parameters'));
  const query = makeMaker(oautil.endpointTypeName(object, path, method, 'query'));
  const body = makeMaker(oautil.endpointTypeName(object, path, method, 'requestBody'));
  const response = makeMaker(oautil.endpointTypeName(object, path, method, 'response'));
  return ts.createObjectLiteral(
    [
      ts.createPropertyAssignment('path', ts.createStringLiteral(path)),
      ts.createPropertyAssignment('method', ts.createStringLiteral(method)),
      ts.createPropertyAssignment(
        'servers',
        ts.createArrayLiteral(servers.map(ts.createStringLiteral))
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

function generateHandler(schema: oas.OpenAPIObject, opts: Options) {
  const servers = (safe(schema).servers.$ || []).map(server => server.url);
  return ts.createVariableStatement(
    undefined,
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
              generateMaker(servers, p.path, p.method, p.object, schema, opts)
            )
          )
        )
      ],
      ts.NodeFlags.Const
    )
  );
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
}

export function run(opts: Options) {
  const runtimeModule = opts.runtimePath;
  const typemodule = opts.typePath;

  const runtime = generateRuntimeImport(runtimeModule);
  const types = generateImport('types', typemodule);
  const endpoints = generateEndpointsType(opts);
  const clientSpec = generateClientSpec(opts);
  const handler = generateHandler(opts.oas, opts);
  const router = generateRouter();
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
        router,
        client
      ]),
      sourceFile
    );
}
