# Nock server adapter for smartlyio/oats

Nock adapter for creating mock servers from openapi definitions using oats.

To mock the request `POST /item` define the route as for any oats server adapter 
and then bind the route defining object to the nock adapter. The bound mock 
servers are namespaced using the OpenApi server strings as nock basepaths  so that 
multiple nock mocks can be used simultanenously so long as the basepaths differ. 
All of the mocked routes are persisted so any number of requests are served.

```ts
// yarn ts-node examples/example.ts
import * as nockAdapter from '../src/nock';
import * as api from '../tmp/client.types.generated'
import * as types from '../tmp/openapi.types.generated';
import * as runtime from '@smartlyio/oats-runtime';

nockAdapter.bind(api.router, {
  '/item': {
    post: async ctx => {
      return runtime.json(
        201,
        types.typeItem.maker({
          id: ctx.body.value.id + ' response',
          name: ctx.body.value.name
        }).success()
      );
    }
  }
});

```

The `bind` call is just a constructor for a `Server` class that provides a `mock` method for 
adding new mocked routes or overlaying new handlers on top of already mocked routes. 
If the overlaying mock throws `Next` the previous mock for the route is called instead.

```ts
// yarn ts-node examples/server.ts
import * as nockAdapter from '../src/nock';
import * as api from '../tmp/client.types.generated'
import * as types from '../tmp/openapi.types.generated';
import * as runtime from '@smartlyio/oats-runtime';

const server = nockAdapter.bind(api.router, {
  '/item': {
    post: async ctx => {
      return runtime.json(
        201,
        types.typeItem.maker(ctx.body.value).success()
      );
    }
  }
});

server.mock({
  '/item': {
    post: async () => {
      throw new nockAdapter.Next();
    }
  }
});

```
