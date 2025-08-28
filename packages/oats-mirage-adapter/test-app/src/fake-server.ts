import * as runtime from '@smartlyio/oats-runtime';
import * as mirageAdapter from '@smartlyio/oats-mirage-adapter';
import * as api from './server.generated';
import * as mirage from 'miragejs';

// the implementation for the endpoints from example.yml
const spec: api.Endpoints = {
  '/example/{id}': {
    get: async ctx => {
      // @ts-expect-error -- params is not typed
      void ctx.params.nonExisting; // <- ctx is a typesafe object containing the request

      return runtime.json(200, { message: 'get ' + ctx.params.id + ' ' + ctx.query.foo });
    },
    post: async ctx => {
      return runtime.json(200, { message: 'post ' + ctx.params.id + ' ' + ctx.body.value.message });
    }
  }
};

export function fake() {
  return mirage.createServer({
    routes() {
      // non openapi route
      this.get('/non-openapi-route', () => ({ ok: true }));

      // bind example.yml endpoints under namespace "api"
      this.namespace = 'api';
      mirageAdapter.bind({
        server: this,
        handler: runtime.server.createHandlerFactory<api.Endpoints>(api.endpointHandlers),
        spec
      });
    }
  });
}
