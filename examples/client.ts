// yarn ts-node -r tsconfig-paths/register examples/client.ts
import * as api from '../tmp/client/generated';
import * as axiosAdapter from '@smartlyio/oats-axios-adapter';
import * as runtime from '@smartlyio/oats-runtime';
import * as app from './server';
import * as assert from 'assert';

// 'api.client' is the abstract implementation of the client which is then
// mapped to axios requests using 'axiosAdapter'
const apiClient = api.client(axiosAdapter.bind);
async function runClient() {
  const posted = await apiClient.item.post({
    headers: {
      authorization: 'Bearer ^-^'
    },
    body: runtime.client.json({ id: 'id', name: 'name' })
  });
  if (posted.status !== 201) {
    return assert.fail('wrong response');
  }
  const stored = await apiClient.item(posted.value.value.id).get();
  if (stored.status !== 200) {
    return assert.fail('wrong response');
  }
  assert(stored.value.value.id === 'id');
  const deleted = await apiClient.item(posted.value.value.id).delete();
  assert(deleted.status === 204);
  return;
}

// spin up the server
const port = 12000;
app.createApp().listen(port, async () => {
  try {
    await runClient();
    process.exit(0);
  } catch (e) {
    console.log(e);
    process.exit(1);
  }
});
