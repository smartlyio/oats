import * as runtime from "@smartlyio/oats-runtime";
import * as mirageAdapter from "@smartlyio/oats-mirage-adapter"
import * as api from "./server.generated"

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
  return mirageAdapter.bind({
    // a mock service without namespacing
    service: mirageAdapter.service(runtime.server.createHandlerFactory<api.Endpoints>(
      api.endpointHandlers
      ),
      spec),
      // two services under namespaces api and api2
      namespaces: {
        api: mirageAdapter.service(runtime.server.createHandlerFactory<api.Endpoints>(
          api.endpointHandlers
          ),
          spec),
        api2: mirageAdapter.service(runtime.server.createHandlerFactory<api.Endpoints>(
          api.endpointHandlers
          ),
          spec)
      },
    // rest of the mirage createServer configuration
    config: {}
    }
  );
}
