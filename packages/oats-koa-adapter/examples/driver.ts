// yarn ts-node examples/driver.ts
import * as driver from '../src/driver';

// generate server
driver.generate({
  generatedValueClassFile: './tmp/server.types.generated.ts',
  generatedServerFile: './tmp/server.generated.ts',
  runtimeFilePath: './src/runtime.ts',
  header: '/* tslint:disable variable-name only-arrow-functions*/',
  openapiFilePath: './test/example.yaml'
});

// generate client
driver.generate({
  generatedValueClassFile: './tmp/client.types.generated.ts',
  runtimeFilePath: './src/runtime.ts',
  generatedClientFile: './tmp/client.generated.ts',
  header: '/* tslint:disable variable-name only-arrow-functions*/',
  openapiFilePath: './test/example.yaml',
    //Omit error responses  from the client response types
  emitStatusCode: (code: number) => [200, 201].indexOf(code) >= 0
});
