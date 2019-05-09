// yarn ts-node examples/driver.ts
import { driver } from "../index";

// generate server
driver.generate({
  generatedValueClassFile: "./tmp/server.types.generated.ts",
  generatedServerFile: "./tmp/server.generated.ts",
  runtimeFilePath: "./index.ts",
  header: "/* tslint:disable variable-name only-arrow-functions*/",
  openapiFilePath: "./test/example.yaml"
});

// generate client
driver.generate({
  generatedValueClassFile: "./tmp/client.types.generated.ts",
  runtimeFilePath: "./index.ts",
  generatedClientFile: "./tmp/client.generated.ts",
  header: "/* tslint:disable variable-name only-arrow-functions*/",
  openapiFilePath: "./test/example.yaml",
  // Omit error responses  from the client response types
  emitStatusCode: (code: number) => [200, 201].indexOf(code) >= 0
});
