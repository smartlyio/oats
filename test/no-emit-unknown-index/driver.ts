import { driver } from '@smartlyio/oats';
import * as process from 'process';

process.chdir(__dirname);

driver.generate({
  generatedValueClassFile: './tmp/server/types.generated.ts',
  generatedServerFile: './tmp/server/generated.ts',
  header: '/* tslint:disable variable-name only-arrow-functions*/',
  openapiFilePath: './api.yml',
  resolve: driver.compose(driver.generateFile(), driver.localResolve),
  emitUndefinedForIndexTypes: false,
  unknownAdditionalPropertiesIndexSignature: driver.AdditionalPropertiesIndexSignature.omit
});
