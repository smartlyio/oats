# Oats

Oats is a generator for TypeScript clients and servers using OpenAPI 3 specs.

For some more context on why Oats came to be, and a more descriptive way of how to use it, check out our blogpost:
https://medium.com/smartly-io/oats-how-we-learned-to-stop-worrying-and-love-types-aa0041aaa9cc

This package provides the tooling for generating the type definitions. A separate package provides 
the [runtime](https://github.com/smartlyio/oats-runtime) that contains the code and base types 
needed for actually using the generated definitions.

## Generating type definitions

Oats exposes `driver.generate` for configuring and running the generator. 

As an example here we are generating a client and server definitions from an api specification 
in `example.yaml` that uses additional component schemas defined in `common.yaml`. 

```ts
// yarn ts-node examples/driver.ts
import { driver, util } from '../index';

// define how references to outside the example.yaml file are resolved
const externals = {
  externalOpenApiImports: [{ importFile: './tmp/common.types.generated', importAs: 'common' }],
  externalOpenApiSpecs: (url: string) => {
    if (url.startsWith('common.yaml')) {
      return 'common.' + util.refToTypeName(url.replace(/^common.yaml/, ''));
    }
    return;
  }
};

// generate type definitions for schemas from an external openapi spec
driver.generate({
  generatedValueClassFile: './tmp/common.types.generated.ts',
  header: '/* tslint:disable variable-name only-arrow-functions*/',
  openapiFilePath: './test/common.yaml'
});

// generate server from the shared openapi spec
driver.generate({
  ...externals,
  generatedValueClassFile: './tmp/server.types.generated.ts',
  generatedServerFile: './tmp/server.generated.ts',
  header: '/* tslint:disable variable-name only-arrow-functions*/',
  openapiFilePath: './test/example.yaml'
});

// generate client from the shared openapi spec
driver.generate({
  ...externals,
  generatedValueClassFile: './tmp/client.types.generated.ts',
  generatedClientFile: './tmp/client.generated.ts',
  header: '/* tslint:disable variable-name only-arrow-functions*/',
  openapiFilePath: './test/example.yaml',
  // Omit error responses  from the client response types
  emitStatusCode: (code: number) => [200, 201, 204].indexOf(code) >= 0
});

```

The generated typescript types contain a type for all named components defined in the Openapi 
spec `components/schemas`.  So for a component `named_component: ...`
 - For top level `type: object` definitions oats generates a proper 
javascript class `NamedComponent`
 - For other types oats generates a typescript `type NamedComponent`. 
 - For scalar types oats adds typescript branding to differentiate between various kinds of 
 named scalar types
 
 For `type: object` schemas that are `nullable: true` the type is split to a `type NamedComponent = null | NonNullableNamedComponent` 
 where `NonNullableNamedComponent` is the actual class as class instances really cannot be `null`.
 
 See [runtime](https://github.com/smartlyio/oats-runtime) for details on working with the types.
 
 The rest of the generated type definitions consist of the apis for clients and servers for actually 
 implementing or interacting with the service.

## Server usage

The generated server definition can be adapted to http servers backends for node. 
See for example the [koa adapter](https://github.com/smartlyio/oats-koa-adapter). 

For each Openapi3 definition `get: /path/subpath` the generated server requires the user to provide a 
value of type
```
{ 'path/subpath': { get: ctx => Promise<response> }}
```

for handling the requests to the server.

The generated server definition enforces *strict* data validation for both input and output for all 
defined paths. 

```ts
// yarn ts-node examples/server.ts
import * as api from '../tmp/server.generated';
import * as common from '../tmp/common.types.generated';
import * as runtime from '@smartlyio/oats-runtime';
import * as koaAdapter from '@smartlyio/oats-koa-adapter';
import * as Koa from 'koa';
import * as koaBody from 'koa-body';

// setup a db :)
const values: { [key: string]: common.Item } = {};

interface RequestContext {
  messageIndex: number;
}

// 'api.EndpointsWithContext' is the generated type of the server
const spec: api.EndpointsWithContext<RequestContext> = {
  '/item': {
    post: async ctx => {
      if (ctx.headers.authorization !== 'Bearer ^-^') {
        return runtime.json(403, {
          message: 'Unauthorized',
          messageIndex: ctx.requestContext.messageIndex
        });
      }
      values[ctx.body.value.id] = common.Item.make({
        id: ctx.body.value.id,
        name: ctx.body.value.name
      }).success();
      return runtime.json(201, values[ctx.body.value.id]);
    }
  },
  '/item/{id}': {
    head: async ctx => {
      const item = values[ctx.params.id];
      if (item) {
        return {
          status: 200,
          value: {
            contentType: 'noContent',
            value: null
          }
        };
      }
      return runtime.json(400, {
        message: 'not found',
        messageIndex: ctx.requestContext.messageIndex
      });
    },
    delete: async ctx => {
      delete values[ctx.params.id];
      return runtime.text(204, '');
    },
    get: async ctx => {
      const item = values[ctx.params.id];
      if (item) {
        return runtime.json(200, item);
      }
      return runtime.json(400, {
        message: 'not found',
        messageIndex: ctx.requestContext.messageIndex
      });
    }
  }
};

let index = 0;

// 'koaAdapter.bind'  binds the endpoint implemantion in'spec' to
// koa-router routes using a koa adapter
const routes = koaAdapter.bind<api.EndpointsWithContext<RequestContext>, RequestContext>(
  runtime.server.createHandlerFactory<api.EndpointsWithContext<RequestContext>>(
    api.endpointHandlers
  ),
  spec,
  () => ({ messageIndex: index++ })
);

// finally we can create a Koa app from the routes
export function createApp() {
  const app = new Koa();
  // we need a bodyparser to make body contain json and deal with multipart
  // requests
  app.use(
    koaBody({
      multipart: true
    })
  );
  app.use(routes.routes());
  return app;
}

```

## Client usage

Oats generates also client side definitions that can be adapted to http client backends for node.
See for example the [axios adapter](https://github.com/smartlyio/oats-axios-adapter). The 
generated client provides a fluent interface so that for each Openapi3 definition 
`get: /path/subpath/{pathParameter}` the 
generated  api client can be called with `api.path.subpath(pathParameter).get()`. The generated 
client will enforce *strict* data validation for both input and output of the calls.

```ts
// yarn ts-node examples/client.ts
import * as api from '../tmp/client.generated';
import * as axiosAdapter from '@smartlyio/oats-axios-adapter';
import * as runtime from '@smartlyio/oats-runtime';
import * as app from './server';
import * as assert from 'assert';

// 'api.client' is the abstract implementation of the client which is then
// mapped to axios requests using 'axiosAdapter'
const apiClient = api.client(axiosAdapter.bind);
async function runClient() {
  const posted = await apiClient.item.post({
    headers: {
      authorization: 'Bearer ^-^'
    },
    body: runtime.client.json({ id: 'id', name: 'name' })
  });
  if (posted.status !== 201) {
    return assert.fail('wrong response');
  }
  const stored = await apiClient.item(posted.value.value.id).get();
  if (stored.status !== 200) {
    return assert.fail('wrong response');
  }
  assert(stored.value.value.id === 'id');
  const deleted = await apiClient.item(posted.value.value.id).delete();
  assert(deleted.status === 204);
  return;
}

// spin up the server
const port = 12000;
app.createApp().listen(port, async () => {
  try {
    await runClient();
    process.exit(0);
  } catch (e) {
    console.log(e);
    process.exit(1);
  }
});

```

## Testing

We support also property based testing and test data generation with 
[fast-check](https://github.com/dubzzz/fast-check) through 
[oats-fast-check](https://github.com/smartlyio/oats-fast-check)
