// yarn ts-node -r tsconfig-paths/register examples/server.ts
import * as api from '../tmp/server/generated';
import * as common from '../tmp/server/common.types.generated';
import * as runtime from '@smartlyio/oats-runtime';
import * as koaAdapter from '@smartlyio/oats-koa-adapter';
import * as Koa from 'koa';
import { koaBody } from 'koa-body';

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
        return runtime.noContent(200);
      }
      return runtime.json(400, {
        message: 'not found',
        messageIndex: ctx.requestContext.messageIndex
      });
    },
    delete: async ctx => {
      delete values[ctx.params.id];
      return runtime.noContent(204);
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

// 'koaAdapter.bind' binds the endpoint implemantion in 'spec' to
// koa-router routes using a koa adapter
const routes = koaAdapter.bind(api.createRouter<RequestContext>(), spec, () => ({
  messageIndex: index++
}));

// finally we can create a Koa app from the routes
export function createApp() {
  // we need a bodyparser to make body contain json and deal with multipart requests
  return new Koa().use(koaBody({ multipart: true })).use(routes.routes());
}
