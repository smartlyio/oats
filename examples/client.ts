// yarn ts-node examples/client.ts
import * as api from "../tmp/client.generated";
import { client } from "../index";
import * as app from "./server";

// 'api.client' is the abstract implementation of the client which is then
// mapped to axios requests using 'axiosAdapter'
const apiClient = api.client(client.axiosAdapter);
async function runClient() {
  try {
      const posted = await apiClient.item.post({
          headers: {
              authorization: 'Bearer ^-^'
          },
          body: client.json({ id: "id", name: "name" })
    });
    if (posted.status === 201) {
      const got = await apiClient.item(posted.value.value.id).get();
      if (got.status === 200 && got.value.value.id === "id") {
        process.exit(0);
      }
    }
  } catch (e) {
      console.log('Got error', e);
  }
  process.exit(1);
}

// spin up the server
const port = 12000;
app.createApp().listen(port, runClient);
