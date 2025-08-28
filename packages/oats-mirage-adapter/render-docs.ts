// eslint-disable-next-line import/no-nodejs-modules
import * as fs from 'fs';

const md: string = fs.readFileSync('README.template.md', 'utf8');
fs.writeFileSync(
  'README.md',
  md.replace(/^>>(.*)/gm, (match, file) => {
    const m = file.trim();
    const example: any = fs.readFileSync('./' + m, 'utf8');
    return example;
  })
);
