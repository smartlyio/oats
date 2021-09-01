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
