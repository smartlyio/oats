// yarn ts-node examples/driver.ts
import { driver, util } from '../index';
import { generateNPMRelativePaths, UnsupportedFeatureBehaviour } from '../src/driver';
import { devDependencies } from '../package.json';

// generate server from the shared openapi spec
// This example uses a specification file that contains compliant but unsupported nodes,
// such as 'securitySchemes' and 'security'
driver.generate({
  generatedValueClassFile: './tmp/server/types.generated.ts',
  generatedServerFile: './tmp/server/generated.ts',
  header: '/* tslint:disable variable-name only-arrow-functions*/',
  openapiFilePath: './test/example-with-security-nodes.yaml',
  resolve: driver.compose(
    driver.resolveModuleRef(Object.keys(devDependencies)),
    driver.generateFile(),
    driver.localResolve
  ),
  unsupportedFeatures: {
    security: UnsupportedFeatureBehaviour.ignore
  }
});

// Generating valid OpenAPI specs file with relative path references for
// $ref: 'npm://<npm package name>#<type name>'
generateNPMRelativePaths(
  './test/example-with-security-nodes.yaml',
  devDependencies,
  './test/example-with-security-nodes.gen.yml'
);

// generate client from the shared openapi spec
driver.generate({
  generatedValueClassFile: './tmp/client/types.generated.ts',
  generatedClientFile: './tmp/client/generated.ts',
  header: '/* tslint:disable variable-name only-arrow-functions*/',
  openapiFilePath: './test/example.yaml',
  resolve: driver.compose(
    driver.resolveModuleRef(Object.keys(devDependencies)),
    driver.generateFile(),
    driver.localResolve
  ),
  // Omit error responses  from the client response types
  emitStatusCode: (code: number) => [200, 201, 204].indexOf(code) >= 0
});
