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
