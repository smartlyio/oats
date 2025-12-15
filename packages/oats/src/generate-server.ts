import * as oas from 'openapi3-ts';
import * as assert from 'assert';
import * as oautil from './util';
import { server, client } from '@smartlyio/oats-runtime';
import { NameMapper, UnsupportedFeatureBehaviour } from './util';
import { ts, quoteProp, str, join } from './template';

/**
 * Generates an import statement for the runtime module.
 */
function generateRuntimeImport(runtimeModule: string): string {
  return ts`
    import * as oar from ${str(runtimeModule)};
  `;
}

/**
 * Generates a namespace import statement.
 */
function generateImport(as: string, module: string): string {
  return ts`
    import * as ${as} from ${str(module)};
  `;
}

/**
 * Generates a type reference for a server endpoint method.
 */
function generateMethod<S extends oas.OperationObject>(
  path: string,
  method: string,
  schema: S,
  opts: Options
): string {
  if (
    (opts?.unsupportedFeatures?.security ?? UnsupportedFeatureBehaviour.reject) ===
    UnsupportedFeatureBehaviour.reject
  ) {
    assert(!schema.security, 'security not supported');
  }

  const kind = opts.shapesAsRequests ? 'shape' : 'value';
  const responseKind = opts.shapesAsResponses ? 'shape' : 'value';

  const headers = `types.${opts.nameMapper(
    oautil.endpointTypeName(schema, path, method, 'headers'),
    kind
  )}`;
  const params = `types.${opts.nameMapper(
    oautil.endpointTypeName(schema, path, method, 'parameters'),
    kind
  )}`;
  const query = `types.${opts.nameMapper(
    oautil.endpointTypeName(schema, path, method, 'query'),
    kind
  )}`;
  const body = `types.${opts.nameMapper(
    oautil.endpointTypeName(schema, path, method, 'requestBody'),
    kind
  )}`;
  const response = `types.${opts.nameMapper(
    oautil.endpointTypeName(schema, path, method, 'response'),
    responseKind
  )}`;

  return `oar.server.Endpoint<${headers}, ${params}, ${query}, ${body}, ${response}, RequestContext>`;
}

/**
 * Generates the type literal for an endpoint path containing method handlers.
 */
function generateEndpoint(path: string, schema: oas.PathItemObject, opts: Options): string {
  assert(!schema.$ref, '$ref in path not supported');
  assert(!schema.parameters, 'parameters in path not supported');

  const signatures: string[] = [];
  server.supportedMethods.forEach(method =>
    oautil.errorTag('in method ' + method.toUpperCase(), () => {
      const methodHandler = schema[method];
      if (methodHandler) {
        const methodType = generateMethod(path, method, methodHandler, opts);
        signatures.push(`readonly ${str(method)}?: ${methodType};`);
      }
    })
  );

  return ts`{ ${signatures.join(' ')} }`;
}

/**
 * Generates a type reference for a client endpoint method.
 */
function generateClientMethod(
  opts: Options,
  path: string,
  method: string,
  op: oas.OperationObject
): string {
  if (
    (opts?.unsupportedFeatures?.security ?? UnsupportedFeatureBehaviour.reject) ===
    UnsupportedFeatureBehaviour.reject
  ) {
    assert(!op.security, 'security not supported');
  }

  const kind = opts.shapesAsRequests ? 'shape' : 'value';
  const responseKind = opts.shapesAsResponses ? 'shape' : 'value';

  const headers = `types.${opts.nameMapper(
    oautil.endpointTypeName(op, path, method, 'headers'),
    kind
  )}`;
  const query = `types.${opts.nameMapper(
    oautil.endpointTypeName(op, path, method, 'query'),
    kind
  )}`;
  const body = `types.${opts.nameMapper(
    oautil.endpointTypeName(op, path, method, 'requestBody'),
    kind
  )}`;
  const response = `types.${opts.nameMapper(
    oautil.endpointTypeName(op, path, method, 'response'),
    responseKind
  )}`;

  return `oar.client.ClientEndpoint<${headers}, ${query}, ${body}, ${response}>`;
}

/**
 * Recursively generates the client tree type members.
 */
function generateClientTree(opts: Options, tree: client.OpTree<string>): string[] {
  const members: string[] = [];

  if (tree.param) {
    const innerType = generateClientSpecType(opts, tree.param.tree);
    members.push(`(${tree.param.name}: string | number): ${innerType};`);
  }

  Object.keys(tree.methods).forEach(method => {
    const type = tree.methods[method];
    members.push(`readonly ${method}: ${type};`);
  });

  Object.keys(tree.parts).forEach(part => {
    const pathPart = quoteProp(part);
    const innerType = generateClientSpecType(opts, tree.parts[part]);
    members.push(`readonly ${pathPart}: ${innerType};`);
  });

  return members;
}

/**
 * Generates a type literal for a client spec tree node.
 */
function generateClientSpecType(opts: Options, tree: client.OpTree<string>): string {
  const members = generateClientTree(opts, tree);
  return ts`{ ${members.join(' ')} }`;
}

/**
 * Generates the ClientSpec type alias.
 */
function generateClientSpec(opts: Options): string {
  const tree: client.OpTree<string> = Object.keys(opts.oas.paths).reduce((memo, path) => {
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
  }, client.emptyTree<string>());

  const members = generateClientTree(opts, tree);
  return ts`
    export type ClientSpec = {
      ${members}
    };
  `;
}

/**
 * Generates the EndpointsWithContext and Endpoints type aliases.
 */
function generateEndpointsType(opts: Options): string {
  const members = Object.keys(opts.oas.paths).map(path => {
    const endpoint: oas.PathItemObject = opts.oas.paths[path];
    return oautil.errorTag('in endpoint ' + path, () => {
      const type = generateEndpoint(path, endpoint, opts);
      return `readonly ${str(path)}?: ${type};`;
    });
  });

  return ts`
    export type EndpointsWithContext<RequestContext> = {
      ${members}
    };
    export type Endpoints = EndpointsWithContext<void>;
  `;
}

/**
 * Generates a maker property access expression string.
 */
function makeMaker(type: string, opts: Options): string {
  return `types.make${opts.nameMapper(type, 'value')}`;
}

/**
 * Generates a handler object for a single endpoint.
 */
function generateMaker(
  servers: string[],
  opts: Options,
  path: string,
  method: string,
  object: oas.OperationObject
): string {
  if (object.servers) {
    servers = object.servers.map(server => server.url);
  }

  const headers = makeMaker(oautil.endpointTypeName(object, path, method, 'headers'), opts);
  const params = makeMaker(oautil.endpointTypeName(object, path, method, 'parameters'), opts);
  const query = makeMaker(oautil.endpointTypeName(object, path, method, 'query'), opts);
  const body = makeMaker(oautil.endpointTypeName(object, path, method, 'requestBody'), opts);
  const response = makeMaker(oautil.endpointTypeName(object, path, method, 'response'), opts);
  const serversStr = servers.map(s => str(s)).join(', ');

  return ts`{ path: ${str(path)}, method: ${str(
    method
  )}, servers: [${serversStr}], headers: ${headers}, query: ${query}, body: ${body}, params: ${params}, response: ${response} }`;
}

/**
 * Flattens paths into an array of {path, method, object} tuples.
 */
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

/**
 * Generates the endpointHandlers array declaration.
 */
function generateHandler(opts: Options): string {
  const schema = opts.oas;
  const servers = (schema?.servers ?? []).map(server => server.url);
  const handlers = flattenPathAndMethod(schema.paths).map(p =>
    generateMaker(servers, opts, p.path, p.method, p.object)
  );

  return ts`
    export const endpointHandlers: oar.server.Handler[] = [${handlers.join(', ')}];
  `;
}

/**
 * Generates a JSDoc deprecation comment for the router.
 */
function generateRouterJSDoc(): string {
  return ts`
    /**
     * @deprecated Use \`createRouter()\` instead. It supports "number", "integer", "boolean" and "array" types in query parameters and numeric types in path parameters.
     */
  `;
}

/**
 * Generates the router variable declaration.
 */
export function generateRouter(): string {
  return ts`
    export const router: oar.server.HandlerFactory<Endpoints> = oar.server.createHandlerFactory(endpointHandlers);
  `;
}

/**
 * Generates the createRouter function declaration.
 */
export function generateCreateRouter(): string {
  return ts`
    export function createRouter<TRequestContext>(
      handlerOptions: oar.server.HandlerOptions = {}
    ): oar.server.HandlerFactory<EndpointsWithContext<TRequestContext>> {
      const {
        validationOptions: {
          query: {
            parseBooleanStrings: queryParseBooleanStrings = true,
            parseNumericStrings: queryParseNumericStrings = true,
            allowConvertForArrayType: queryAllowConvertForArrayType = true,
            ...queryRest
          } = {},
          params: {
            parseNumericStrings: paramsParseNumericStrings = true,
            ...paramsRest
          } = {},
          body: {
            unknownField: bodyUnknownField = 'fail',
            ...bodyRest
          } = {},
          ...validationOptionsRest
        } = {},
        ...handlerOptionsRest
      } = handlerOptions;
      return oar.server.createHandlerFactory(endpointHandlers, {
        ...handlerOptionsRest,
        validationOptions: {
          ...validationOptionsRest,
          query: {
            ...queryRest,
            parseBooleanStrings: queryParseBooleanStrings,
            parseNumericStrings: queryParseNumericStrings,
            allowConvertForArrayType: queryAllowConvertForArrayType
          },
          params: {
            ...paramsRest,
            parseNumericStrings: paramsParseNumericStrings
          },
          body: {
            ...bodyRest,
            unknownField: bodyUnknownField
          }
        }
      });
    }
  `;
}

/**
 * Generates the client variable declaration.
 */
export function generateClient(): string {
  return ts`
    export const client: oar.client.ClientFactory<ClientSpec> = oar.client.createClientFactory(endpointHandlers);
  `;
}

/**
 * Generates the createClient function declaration.
 */
export function generateCreateClient(): string {
  return ts`
    export function createClient(
      handlerOptions: oar.server.HandlerOptions = {}
    ): oar.client.ClientFactory<ClientSpec> {
      return oar.client.createClientFactory(endpointHandlers, handlerOptions);
    }
  `;
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

/**
 * Main entry point: generates the complete server/client module from an OpenAPI spec.
 */
export function run(opts: Options): string {
  const runtimeModule = opts.runtimePath;
  const typemodule = opts.typePath;

  const parts = [
    generateRuntimeImport(runtimeModule),
    generateImport('types', typemodule),
    generateEndpointsType(opts),
    generateClientSpec(opts),
    generateHandler(opts),
    generateRouterJSDoc(),
    generateRouter(),
    generateCreateRouter(),
    generateClient(),
    generateCreateClient()
  ];

  return join(parts, '\n');
}
