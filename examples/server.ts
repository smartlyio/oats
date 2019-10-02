// yarn ts-node examples/server.ts
import * as api from "../tmp/server.generated";
import * as types from "../tmp/server.types.generated";
import * as runtime from "../src/runtime";
import * as Koa from "koa";
import * as koaBody from "koa-body";
import { koaBindRoutes } from '../src/koa-adapter';

// setup a db :)
const values: { [key: string]: types.Item } = {};

// 'api.Endpoints' is the generated type of the server
const spec: api.Endpoints = {
  "/item": {
    post: async ctx => {
      if (ctx.headers.authorization !== 'Bearer ^-^') {
          return runtime.json(403, { message: 'Unauthorized'})
      }
      values[ctx.body.value.id] = types.Item.make({
        id: ctx.body.value.id,
        name: ctx.body.value.name
      }).success();
      return runtime.json(201, values[ctx.body.value.id]);
    }
  },
  "/item/{id}": {
    delete: async ctx => {
      delete values[ctx.params.id];
      return runtime.text(204, '');
    },
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
const routes = koaBindRoutes<api.Endpoints>(api.router, spec);

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
