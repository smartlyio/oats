#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const rootDir = process.cwd();
const packagesDir = path.join(rootDir, 'packages');
const scriptName = process.argv[2];

if (!scriptName) {
  console.error('Usage: node scripts/run-workspace-script.mjs <script>');
  process.exit(1);
}

const dependencyFields = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
];

const packageInfos = fs
  .readdirSync(packagesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => path.join(packagesDir, entry.name, 'package.json'))
  .filter((filePath) => fs.existsSync(filePath))
  .map((filePath) => {
    const pkg = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return {
      dir: path.dirname(filePath),
      name: pkg.name,
      scripts: pkg.scripts ?? {},
      deps: dependencyFields.flatMap((field) => Object.keys(pkg[field] ?? {})),
    };
  })
  .filter((pkg) => pkg.scripts[scriptName]);

const packageNames = new Set(packageInfos.map((pkg) => pkg.name));
const packageMap = new Map(
  packageInfos.map((pkg) => [
    pkg.name,
    {
      ...pkg,
      internalDeps: pkg.deps.filter((dep) => packageNames.has(dep)),
    },
  ]),
);

const ordered = [];
const visiting = new Set();
const visited = new Set();

const visit = (name) => {
  if (visited.has(name)) {
    return;
  }
  if (visiting.has(name)) {
    throw new Error(`Cycle detected while ordering workspace ${scriptName} at ${name}`);
  }

  visiting.add(name);
  for (const dep of packageMap.get(name).internalDeps) {
    visit(dep);
  }
  visiting.delete(name);
  visited.add(name);
  ordered.push(name);
};

for (const name of packageMap.keys()) {
  visit(name);
}

for (const name of ordered) {
  const result = spawnSync('pnpm', ['--filter', name, 'run', scriptName], {
    cwd: rootDir,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
