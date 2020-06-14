import * as nockAdapter from '../src/nock';
import * as axiosClient from '@smartlyio/oats-axios-adapter';
import * as runtime from '@smartlyio/oats-runtime';
import safe from '@smartlyio/safe-navigation';

import * as api from '../tmp/client.types.generated';
import * as types from '../tmp/openapi.types.generated';

import * as api2 from '../tmp/client2.types.generated';
import * as types2 from '../tmp/openapi2.types.generated';
import * as nock from 'nock';
import * as assert from 'assert';

describe('server', () => {
  const client = api.client(axiosClient.bind);
  const client2 = api2.client(axiosClient.bind);

  beforeEach(() => nock.cleanAll());

  it('allows extending routes', async () => {
    const server = nockAdapter.bind(api.router);
    server.mock({
      '/item': {
        post: async ctx => {
          return runtime.json(
            201,
            types.Item.make({
              id: ctx.body.value.id + ' response',
              name: ctx.body.value.name
            }).success()
          );
        }
      }
    });
    const response = await client.item.post({
      headers: {
        authorization: 'xxx'
      },
      body: runtime.client.json({ id: 'some-id', name: 'some-name' })
    });
    expect(response.value.value.id).toEqual('some-id response');
  });

  describe('overlaying routes', () => {
    it('allows overlaying routes', async () => {
      const server = nockAdapter.bind(api.router);
      server.mock({
        '/item': {
          post: async ctx => {
            return runtime.json(
              201,
              types.Item.make({
                id: 'initial response',
                name: ctx.body.value.name
              }).success()
            );
          }
        }
      });
      server.mock({
        '/item': {
          post: async ctx => {
            return runtime.json(
              201,
              types.Item.make({
                id: 'overlayed response',
                name: ctx.body.value.name
              }).success()
            );
          }
        }
      });
      const response = await client.item.post({
        headers: {
          authorization: 'xxx'
        },
        body: runtime.client.json({ id: 'some-id', name: 'some-name' })
      });
      expect(response.value.value.id).toEqual('overlayed response');
    });

    it('allows skipping to next handler  by throwing Next', async () => {
      const server = nockAdapter.bind(api.router);
      server.mock({
        '/item': {
          post: async ctx => {
            return runtime.json(
              201,
              types.Item.make({
                id: 'initial response',
                name: ctx.body.value.name
              }).success()
            );
          }
        }
      });
      server.mock({
        '/item': {
          post: async _ctx => {
            throw new nockAdapter.Next();
          }
        }
      });
      const response = await client.item.post({
        headers: {
          authorization: 'xxx'
        },
        body: runtime.client.json({ id: 'some-id', name: 'some-name' })
      });
      expect(response.value.value.id).toEqual('initial response');
    });
  });

  it('binds routes', async () => {
    nockAdapter.bind(api.router, {
      '/item': {
        post: async ctx => {
          return runtime.json(
            201,
            types.Item.make({
              id: ctx.body.value.id + ' response',
              name: ctx.body.value.name
            }).success()
          );
        }
      }
    });
    const response = await client.item.post({
      headers: {
        authorization: 'xxx'
      },
      body: runtime.client.json({ id: 'some-id', name: 'some-name' })
    });
    expect(response.value.value.id).toEqual('some-id response');
  });

  it('binds routes with wonky path params', async () => {
    nockAdapter.bind(api.router, {
      '/item/something_{id}': {
        get: async ctx => {
          return runtime.json(
            200,
            types.Item.make({
              id: ctx.params.id + ' ' + ctx.query.query!
            }).success()
          );
        }
      }
    });
    const response = await client.item.something_('some-id').get({ query: { query: 'abc' } });
    expect(response.value.value.id).toEqual('some-id abc');
  });

  it('persists routes', async () => {
    nockAdapter.bind(api.router, {
      '/item': {
        post: async ctx => {
          return runtime.json(
            201,
            types.Item.make({
              id: ctx.body.value.id + ' response',
              name: ctx.body.value.name
            }).success()
          );
        }
      }
    });
    await client.item.post({
      headers: {
        authorization: 'xxx'
      },
      body: runtime.client.json({ id: 'some-id', name: 'some-name' })
    });
    const response = await client.item.post({
      headers: {
        authorization: 'xxx'
      },
      body: runtime.client.json({ id: 'some-id', name: 'some-name' })
    });
    expect(response.value.value.id).toEqual('some-id response');
  });

  it('distinguishes between mock servers', async () => {
    nockAdapter.bind(api.router, {
      '/item': {
        post: async ctx => {
          return runtime.json(
            201,
            types.Item.make({
              id: '1 server',
              name: ctx.body.value.name
            }).success()
          );
        }
      }
    });
    nockAdapter.bind(api2.router, {
      '/item': {
        post: async ctx => {
          return runtime.json(
            201,
            types2.Item.make({
              id: '2 server',
              name: ctx.body.value.name
            }).success()
          );
        }
      }
    });
    const response = await client.item.post({
      headers: {
        authorization: 'xxx'
      },
      body: runtime.client.json({ id: 'some-id', name: 'some-name' })
    });
    expect(response.value.value.id).toEqual('1 server');
    const response2 = await client2.item.post({
      headers: {
        authorization: 'xxx'
      },
      body: runtime.client.json({ id: 'some-id', name: 'some-name' })
    });
    expect(response2.value.value.id).toEqual('2 server');
  });

  describe('content types handling', () => {
    describe('form-data', () => {
      it('handles multiple string', async () => {
        nockAdapter.bind(api.router, {
          '/item/formdata': {
            post: async ctx => {
              return runtime.json(
                200,
                types.Item.make({
                  id: ctx.body.value.someValue + ' ' + safe(ctx).body.value.blob.options.$
                }).success()
              );
            }
          }
        });
        const formData = {
          someValue: 'some value',
          blob: new runtime.make.FormBinary(Buffer.from('abc'), 'some blob')
        };
        const response = await client.item.formdata.post({
          body: runtime.client.formData(formData)
        });
        expect(response.value.value.id).toEqual('some value some blob');
      });

      it('handles string values', async () => {
        nockAdapter.bind(api.router, {
          '/item/formdata': {
            post: async ctx => {
              return runtime.json(
                200,
                types.Item.make({
                  id: ctx.body.value.someValue!
                }).success()
              );
            }
          }
        });
        const formData = { someValue: 'some value' };
        const response = await client.item.formdata.post({
          body: runtime.client.formData(formData)
        });
        expect(response.value.value.id).toEqual('some value');
      });

      it('handles files', async () => {
        nockAdapter.bind(api.router, {
          '/item/formdata': {
            post: async ctx => {
              const binary = ctx.body.value.blob;
              if (!(binary instanceof runtime.make.FormBinary)) {
                return assert.fail('expected formbinary');
              }
              return runtime.json(
                200,
                types.Item.make({
                  id: `${binary.binary} ${binary.options as string}`
                }).success()
              );
            }
          }
        });
        const data = Buffer.from('some data');
        const formData = { blob: new runtime.make.FormBinary(data, 'some blob') };
        const response = await client.item.formdata.post({
          body: runtime.client.formData(formData)
        });
        expect(response.value.value.id).toEqual(data + ' some blob');
      });
    });
  });
});
