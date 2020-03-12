import { driver } from '../../index';

// generate type definitions for schemas from an external openapi spec
driver.generate({
  generatedValueClassFile: './runtime/tmp/fixture.types.generated.ts',
  header: '/* tslint:disable variable-name only-arrow-functions*/',
  openapiFilePath: './test/fixture.yaml',
  runtimeFilePath: './runtime/src/runtime'
});
