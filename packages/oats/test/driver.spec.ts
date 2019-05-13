import * as child from 'child_process';
import * as fs from 'fs';
import * as driver from '../src/driver';
import * as path from 'path';

function randomString() {
    return (
        Math.random()
            .toString(36)
            .substring(2, 15) +
        Math.random()
            .toString(36)
            .substring(2, 15)
    );
}
describe('type generation', () => {
  let config: driver.Driver;
  beforeEach(() => {
    child.execSync('rm -f ./tmp/*.ts');
    child.execSync('rm -f ./tmp/*.js');
    const generatedValueClassFile = './tmp/' + randomString() + '.ts';
    const generatedServerFile = './tmp/' + randomString() + '.ts';
    config = {
      header: '/* tslint:disable variable-name only-arrow-functions*/',
      runtimeFilePath: './index.ts',
      openapiFilePath: './test/example.yaml',
      generatedServerFile,
      generatedValueClassFile
    };
  });

  function typecheck(...srcFiles: string[]) {
    srcFiles.push(config.generatedValueClassFile);
    if (config.generatedServerFile) {
      srcFiles.push(config.generatedServerFile);
    }
    const opts =
      '--noEmit --moduleResolution node --noImplicitAny --typeRoots ./node_modules/@types --alwaysStrict --target es2017';

    child.execSync(`node_modules/.bin/tsc ${opts} ${srcFiles.join(' ')}`);
  }
  function runFile(file: string) {
    child.execSync('node_modules/.bin/ts-node ' + file);
  }

  it('generates validly typed files', () => {
    driver.generate(config);
    typecheck();
  });

  it('allows setting values', () => {
    driver.generate(config);
    const srcFile = './tmp/' + randomString() + '.ts';
    fs.writeFileSync(
      srcFile,
      `
    import * as validator from './${path.basename(config.generatedValueClassFile, '.ts')}'; 
    import * as assert from 'assert';
    import * as _ from 'lodash';
    import * as runtime from '../src/runtime';
    const json = { id: 'id', name: 'item name' };
    const value = validator.Item.make(json).success();
    assert(_.isEqual(runtime.toJSON(value), json));
    assert(runtime.set(value, { name: "new name" }).success().name === 'new name', 'new value should have updated field');
    assert(value.name === "item name", 'original value should not have changed');
    `
    );
    runFile(srcFile);
    typecheck(srcFile);
  });
});
