// yarn ts-node examples/driver.ts
import { driver, util } from '../index';
import { UnsupportedFeatureBehaviour } from '../src/driver';

// define how references to outside the example.yaml file are resolved
const externals = {
  externalOpenApiImports: [{ importFile: './tmp/common.types.generated', importAs: 'common' }],
  externalOpenApiSpecs: (url: string) => {
    if (url.startsWith('common.yaml')) {
      return 'common.' + util.refToTypeName(url.replace(/^common.yaml/, ''));
    }
    return;
  }
};

// generate type definitions for schemas from an external openapi spec
driver.generate({
  generatedValueClassFile: './tmp/common.types.generated.ts',
  header: '/* tslint:disable variable-name only-arrow-functions*/',
  openapiFilePath: './test/common.yaml'
});

// generate server from the shared openapi spec
driver.generate({
  ...externals,
  generatedValueClassFile: './tmp/server.types.generated.ts',
  generatedServerFile: './tmp/server.generated.ts',
  header: '/* tslint:disable variable-name only-arrow-functions*/',
  openapiFilePath: './test/example.yaml'
});

// generate server from the shared openapi spec
// This example uses a specification file that contains compliant but unsupported nodes,
// such as 'securitySchemes' and 'security'
driver.generate({
  ...externals,
  generatedValueClassFile: './tmp/server.types.generated.ts',
  generatedServerFile: './tmp/server.generated.ts',
  header: '/* tslint:disable variable-name only-arrow-functions*/',
  openapiFilePath: './test/example-with-security-nodes.yaml',
  unsupportedFeatures: {
    security: UnsupportedFeatureBehaviour.ignore
  }
});

// generate client from the shared openapi spec
driver.generate({
  ...externals,
  generatedValueClassFile: './tmp/client.types.generated.ts',
  generatedClientFile: './tmp/client.generated.ts',
  header: '/* tslint:disable variable-name only-arrow-functions*/',
  openapiFilePath: './test/example.yaml',
  // Omit error responses  from the client response types
  emitStatusCode: (code: number) => [200, 201, 204].indexOf(code) >= 0
});

