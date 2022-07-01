import { driver } from '@smartlyio/oats';
import * as process from 'process';

process.chdir(__dirname);
function camelCaser(openapiProp: string): string {
  const [head, ...tail] = openapiProp.split('_');
  return [...head, ...tail.map(t => `${t[0].toUpperCase()}${t.slice(1)}`)].join('');
}

driver.generate({
  generatedValueClassFile: './tmp/client/types.generated.ts',
  generatedClientFile: './tmp/client/generated.ts',
  header: '/* tslint:disable variable-name only-arrow-functions*/',
  openapiFilePath: './api.yml',
  propertyNameMapper: camelCaser,
  resolve: driver.compose(driver.generateFile(), driver.localResolve)
});

driver.generate({
  generatedValueClassFile: './tmp/server/types.generated.ts',
  generatedServerFile: './tmp/server/generated.ts',
  header: '/* tslint:disable variable-name only-arrow-functions*/',
  openapiFilePath: './api.yml',
  propertyNameMapper: camelCaser,
  resolve: driver.compose(driver.generateFile(), driver.localResolve)
});
