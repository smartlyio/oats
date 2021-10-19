import { driver, util } from '@smartlyio/oats';
import * as process from 'process';

process.chdir(__dirname);
const nameMapper = (name: string, kind: util.NameKind) => {
  if (kind === 'value') {
    return 'Value' + name;
  } else if (kind === 'reflection') {
    return 'Reflection' + name;
  } else {
    return name;
  }
};
driver.generate({
  generatedValueClassFile: './tmp/client/types.generated.ts',
  generatedClientFile: './tmp/client/generated.ts',
  header: '/* tslint:disable variable-name only-arrow-functions*/',
  openapiFilePath: './api.yml',
  resolve: driver.compose(driver.generateFile(), driver.localResolve),
  nameMapper
});

driver.generate({
  generatedValueClassFile: './tmp/server/types.generated.ts',
  generatedServerFile: './tmp/server/generated.ts',
  header: '/* tslint:disable variable-name only-arrow-functions*/',
  openapiFilePath: './api.yml',
  resolve: driver.compose(driver.generateFile(), driver.localResolve),
  nameMapper
});
