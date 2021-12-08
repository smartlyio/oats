import { driver } from '@smartlyio/oats';

import * as process from 'process';
process.chdir(__dirname);

driver.generate({
  generatedValueClassFile: './tmp/first.types.generated.ts',
  header: '/* tslint:disable variable-name only-arrow-functions*/',
  openapiFilePath: './first.yaml',
  resolve: driver.compose(driver.generateFile(), driver.localResolve)
});
