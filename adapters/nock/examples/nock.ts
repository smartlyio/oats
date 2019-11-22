import * as nockAdapter from '../nock';
import * as axiosClient from '@smartlyio/oats-axios-adapter';
import * as api from '../tmp/client.generated';
import * as common from '../tmp/common.types.generated';
import * as runtime from '@smartlyio/oats-runtime';
import * as assert from 'assert';

const client = api.client(axiosClient.bind);

async function test_request() {
  nockAdapter.bind(api.router, {
    '/item': {
      post: async ctx => {
        return runtime.json(
          201,
          common.Item.make({
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
  assert(response.value.value.id === 'some-id response');
  process.exit(0);
}
test_request();
