const fs = require('fs');
const path = require('path');

const packagesDir = path.resolve(__dirname, '..', 'packages');
const configPath = path.resolve(__dirname, '..', '.changeset', 'config.json');

const packageNames = fs
  .readdirSync(packagesDir, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => {
    const pkgJsonPath = path.join(packagesDir, entry.name, 'package.json');
    if (!fs.existsSync(pkgJsonPath)) return null;
    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    if (pkg.private) return null;
    return pkg.name;
  })
  .filter(Boolean)
  .sort();

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const currentFixed = config.fixed?.[0] ? [...config.fixed[0]].sort() : [];

if (JSON.stringify(currentFixed) === JSON.stringify(packageNames)) {
  console.log('changeset config is up to date');
  process.exit(0);
}

if (process.argv.includes('--check')) {
  console.error('changeset config is out of date');
  console.error('  current:', currentFixed);
  console.error('  expected:', packageNames);
  console.error('run "node scripts/sync-changeset-config.js" to fix');
  process.exit(1);
}

config.fixed = [packageNames];
fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
console.log('updated .changeset/config.json with packages:', packageNames);
