# Oats Mirage Adapter

Oats Mirage Adapter is a library that [Oats](https://github.com/smartlyio/oats) to [Mirage.js](https://github.com/miragejs/miragejs) fake Servers.

## What is Oats?

[Oats](https://github.com/smartlyio/oats) is a library that parses OpenAPI specifications and generates client and server code in TypeScript.

## Installation

Use `npm` or `yarn` to install `oats-mirage-adapter`.

```bash
npm install oats-mirage-adapter
```

## Usage

Oats Mirage Adapter exports a single `bind` function that creates a Mirage fake server from the passed in endpoint definitions.


```ts
import * as runtime from "@smartlyio/oats-runtime";
import * as mirageAdapter from "@smartlyio/oats-mirage-adapter"
import * as api from "./server.generated"

const spec: api.Endpoints = {
  '/example/{id}': {
    get: async (ctx) => {
      return runtime.json(200, { message: 'get '  + ctx.params.id + ' ' + ctx.query.foo });
    },
    post: async (ctx) => {
      return runtime.json(200, { message: 'post ' + ctx.params.id + ' ' + ctx.body.value.message});
    }
  }
}

export function fake() {
  return mirageAdapter.bind<api.Endpoints>({
      handler: runtime.server.createHandlerFactory<api.Endpoints>(
        api.endpointHandlers
      ),
      spec,
      namespace: 'api',
      config:{ }
    }
  );
}

fake();

```

For a working example see [test-app](https://github.com/smartlyio/oats-mirage-adapter/tree/master/test-app) which contains a standard create-react-app using the generated mirage mock.
