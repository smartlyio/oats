import * as nockAdapter from '../src/nock';
import * as axiosClient from '@smartlyio/oats-axios-adapter';
import * as runtime from '@smartlyio/oats-runtime';

import * as api from '../tmp/client.types.generated';
import * as types from '../tmp/openapi.types.generated';

import * as api2 from '../tmp/client2.types.generated';
import * as types2 from '../tmp/openapi2.types.generated';
import * as nock from 'nock';

describe('server', () => {
  const client = api.client(axiosClient.bind);
  const client2 = api2.client(axiosClient.bind);

  beforeEach(() => nock.cleanAll());

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
});
