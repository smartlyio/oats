# oats

Generator for typescript clients and servers from openapi3 specs

## Server usage

```js
// yarn ts-node examples/server.ts
import * as api from "../tmp/server.generated";
import * as types from "../tmp/server.types.generated";
import * as server from "../src/server";
import * as runtime from "../src/runtime";
import * as Koa from "koa";
import * as koaBody from "koa-body";

// setup a db :)
const values: { [key: string]: types.Item } = {};

// 'api.Endpoints' is the generated type of the server
const spec: api.Endpoints = {
  "/item": {
    post: async ctx => {
      values[ctx.body.value.id] = types.Item.make({
        id: ctx.body.value.id,
        name: ctx.body.value.name
      }).success();
      return runtime.json(201, values[ctx.body.value.id]);
    }
  },
  "/item/{id}": {
    get: async ctx => {
      const item = values[ctx.params.id];
      if (item) {
        return runtime.json(200, item);
      }
      return runtime.json(400, { message: "not found" });
    }
  }
};

// 'server.koaBindRoutes'  binds the endpoint implemantion in'spec' to
// koa-router routes using a koa adapter
const routes = server.koaBindRoutes<api.Endpoints>(api.router, spec);

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

```js
// yarn ts-node examples/client.ts
import * as api from "../tmp/client.generated";
import { json, axiosAdapter } from "../src/client";
import * as app from "./server";

// 'api.client' is the abstract implementation of the client which is then
// mapped to axios requests using 'axiosAdapter'
const client = api.client(axiosAdapter);
async function runClient() {
  try {
    const posted = await client.item.post({
      body: json({ id: "id", name: "name" })
    });
    if (posted.status === 201) {
      const got = await client.item(posted.value.value.id).get({});
      if (got.status === 200 && got.value.value.id === "id") {
        process.exit(0);
      }
    }
  } catch (e) {}
  process.exit(1);
}

// spin up the server
const port = 12000;
app.createApp().listen(port, runClient);

```

## Generating clients and servers

```
// yarn ts-node examples/driver.ts
import * as driver from '../src/driver';

// generate server
driver.generate({
  generatedValueClassFile: './tmp/server.types.generated.ts',
  generatedServerFile: './tmp/server.generated.ts',
  runtimeFilePath: './src/runtime.ts',
  header: '/* tslint:disable variable-name only-arrow-functions*/',
  openapiFilePath: './test/example.yaml'
});

// generate client
driver.generate({
  generatedValueClassFile: './tmp/client.types.generated.ts',
  runtimeFilePath: './src/runtime.ts',
  generatedClientFile: './tmp/client.generated.ts',
  header: '/* tslint:disable variable-name only-arrow-functions*/',
  openapiFilePath: './test/example.yaml',
    //Omit error responses  from the client response types
  emitStatusCode: (code: number) => [200, 201].indexOf(code) >= 0
});

```

