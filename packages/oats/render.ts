/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-floating-promises */

import * as fs from 'fs';
import * as child from 'child_process';
import * as assert from 'assert';
import * as util from 'util';

const md: string = fs.readFileSync('README.template.md', 'utf8');
const examples: string[] = [];
fs.writeFileSync(
  'README.md',
  md.replace(/^>>(.*)/gm, (match, file) => {
    const m = file.trim();
    const example: any = fs.readFileSync('./' + m, 'utf8');
    const runner = example.split('\n')[0].match(/\/\/(.*)/)[1];
    assert(runner, 'missing runner command');
    examples.push(runner.trim());
    return example;
  })
);

Promise.all(
  examples.map(async example => {
    console.log('testing ' + example);
    try {
      await util.promisify(child.exec)(example);
      return example + ': ok';
    } catch (e) {
      return example + ': error ' + e.message;
    }
  })
).then(results => {
  const errors = results.filter(result => /: error/.test(result));
  if (errors.length > 0) {
    console.error('errors in rendering');
    errors.map(error => console.error(error));
    process.exit(1);
  }
  results.map(result => console.log(result));
});
