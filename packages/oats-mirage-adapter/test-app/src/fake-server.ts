import * as mirage from "miragejs";

mirage.createServer({
  routes() {
    this.namespace = "api"

    this.get("/example", () => {
      return {
        message: "got example"
      }
    })
  },
})
