# Oats Mirage Adapter

Typesafe Typescript OpenaApi3 support for [Mirage.js](https://github.com/miragejs/miragejs) mock http servers
using [Oats](https://github.com/smartlyio/oats).

## What is Oats?

[Oats](https://github.com/smartlyio/oats) is a library that parses OpenAPI specifications and 
generates client and server definitions in TypeScript.

## Installation

Use `npm` or `yarn` to install `oats-mirage-adapter`.

```bash
npm install oats-mirage-adapter
```

## Usage

Oats Mirage Adapter exports a single `bind` function that can be used to 
bind the routes defined in an openapi spec to the mirage routes.


```ts
import * as runtime from "@smartlyio/oats-runtime";
import * as mirageAdapter from "@smartlyio/oats-mirage-adapter"
import * as api from "./server.generated"
import * as mirage from "miragejs";

// the implementation for the endpoints from example.yml
const spec: api.Endpoints = {
  '/example/{id}': {
    get: async (ctx) => {

      // @ts-expect-error
      void ctx.params.nonExisting // <- ctx is a typesafe object containing the request

      return runtime.json(200, { message: 'get '  + ctx.params.id + ' ' + ctx.query.foo });
    },
    post: async (ctx) => {
      return runtime.json(200, { message: 'post ' + ctx.params.id + ' ' + ctx.body.value.message});
    }
  }
}

export function fake() {
  return mirage.createServer({
    routes() {
      // non openapi route
      this.get("/non-openapi-route", () => ({ ok: true}));

      // bind example.yml endpoints under namespace "api"
      this.namespace = "api";
      mirageAdapter.bind({
        server: this,
        handler: runtime.server.createHandlerFactory<api.Endpoints>(
          api.endpointHandlers
        ),
        spec})
    }
  });
}

```

For a working example see [test-app](https://github.com/smartlyio/oats-mirage-adapter/tree/master/test-app) which contains a standard create-react-app using the generated mirage mock.
