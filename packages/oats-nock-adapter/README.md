# Nock server adapter for smartlyio/oats

Nock adapter for creating mock servers from openapi definitions using oats.

```
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
