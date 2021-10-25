import { driver, util } from '@smartlyio/oats';
import * as process from 'process';
import * as assert from 'assert';

process.chdir(__dirname);
const nameMapper = (name: string, kind: util.NameKind) => {
  const sanitizedName = name.match(/^[^a-zA-Z]/) ? 'Type' + name : name;
  const capitalizedName = util.capitalize(sanitizedName);
  if (kind === 'value') {
    return 'Value' + capitalizedName + 'WithSuffix';
  } else if (kind === 'reflection') {
    return 'Reflection' + capitalizedName + 'WithSuffix';
  } else if (kind === 'shape') {
    return 'ShapeOf' + capitalizedName + 'WithSuffix';
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
