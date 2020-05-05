import { driver } from '@smartlyio/oats';

driver.generate({
  generatedValueClassFile: './tmp/openapi.types.generated.ts',
  header: '/* tslint:disable variable-name only-arrow-functions*/',
  openapiFilePath: './test/openapi.yaml',
  generatedClientFile: './tmp/client.types.generated.ts',
  generatedServerFile: './tmp/server.types.generated.ts'
});
