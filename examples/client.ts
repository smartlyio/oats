// yarn ts-node examples/client.ts
import * as api from "../tmp/client.generated";
import { json, axiosAdapter } from "../src/client";
import * as app from "./server";

// 'api.client' is the abstract implementation of the client which is then
// mapped to axios requests using 'axiosAdapter'
const client = api.client(axiosAdapter);
async function runClient() {
  try {
    const posted = await client.item.post({
      body: json({ id: "id", name: "name" })
    });
    if (posted.status === 201) {
      const got = await client.item(posted.value.value.id).get({});
      if (got.status === 200 && got.value.value.id === "id") {
        process.exit(0);
      }
    }
  } catch (e) {}
  process.exit(1);
}

// spin up the server
const port = 12000;
app.createApp().listen(port, runClient);
