import * as nockAdapter from '../src/nock';
import * as axiosClient from '@smartlyio/oats-axios-adapter';
import * as api from '../tmp/client.types.generated';
import * as types from '../tmp/openapi.types.generated';
import * as runtime from '@smartlyio/oats-runtime';

describe('server', () => {
  const client = api.client(axiosClient.bind);
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
});
