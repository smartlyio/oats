const { driver } = require('@smartlyio/oats');

driver.generate({
  generatedValueClassFile: './src/types.generated.ts',
  generatedServerFile: './src/server.generated.ts',
  header: '/* tslint:disable variable-name only-arrow-functions*/',
  openapiFilePath: './example.yml',
  resolve: driver.compose(driver.generateFile(), driver.localResolve),
});
