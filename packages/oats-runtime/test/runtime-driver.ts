import { driver } from '@smartlyio/oats';

// generate type definitions for schemas from an external openapi spec
driver.generate({
  generatedValueClassFile: './tmp/fixture.types.generated.ts',
  runtimeFilePath: './src/runtime',
  header: '/* tslint:disable variable-name only-arrow-functions*/',
  openapiFilePath: './test/fixture.yaml'
});
