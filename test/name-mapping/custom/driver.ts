import { driver, util } from '@smartlyio/oats';
import * as process from 'process';
import * as assert from 'assert';

process.chdir(__dirname);
const nameMapper = (name: string, kind: util.NameKind) => {
  if (kind === 'value') {
    return 'Value' + name;
  } else if (kind === 'reflection') {
    return 'Reflection' + name;
  } else if (kind === 'shape') {
    return 'ShapeOf' + name;
  } else {
    assert(false, 'unknown name kind');
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
