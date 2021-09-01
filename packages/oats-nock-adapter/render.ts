// tslint:disable: no-floating-promises no-console

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

// eslint-disable-next-line @typescript-eslint/no-floating-promises
Promise.all(
  examples.map(async example => {
    // eslint-disable-next-line no-console
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
    // eslint-disable-next-line no-console
    console.error('errors in rendering');
    // eslint-disable-next-line no-console
    errors.map(error => console.error(error));
    process.exit(1);
  }
  // eslint-disable-next-line no-console
  results.map(result => console.log(result));
});
