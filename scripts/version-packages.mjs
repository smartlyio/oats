#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const rootPackagePath = path.join(rootDir, 'package.json');
const packagesDir = path.join(rootDir, 'packages');
const bumpType = process.argv[2];
const validBumps = new Set(['major', 'minor', 'patch']);

if (!validBumps.has(bumpType)) {
  console.error('Usage: node scripts/version-packages.mjs <major|minor|patch>');
  process.exit(1);
}

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const writeJson = (filePath, data) => {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
};

const bumpVersion = (version, type) => {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) {
    throw new Error(`Unsupported version format: ${version}`);
  }
  const [major, minor, patch] = match.slice(1).map(Number);
  if (type === 'major') {
    return `${major + 1}.0.0`;
  }
  if (type === 'minor') {
    return `${major}.${minor + 1}.0`;
  }
  return `${major}.${minor}.${patch + 1}`;
};

const packageDirs = fs
  .readdirSync(packagesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

const packageJsonPaths = packageDirs
  .map((dir) => path.join(packagesDir, dir, 'package.json'))
  .filter((filePath) => fs.existsSync(filePath));

const rootPackage = readJson(rootPackagePath);
const workspacePackages = packageJsonPaths.map((filePath) => ({
  filePath,
  pkg: readJson(filePath),
}));
const workspaceNames = new Set(workspacePackages.map(({ pkg }) => pkg.name));
const currentVersion = rootPackage.version;
const nextVersion = bumpVersion(rootPackage.version, bumpType);

const updateDependencyGroup = (group) => {
  if (!group) {
    return;
  }
  for (const [name, range] of Object.entries(group)) {
    if (!workspaceNames.has(name) || typeof range !== 'string') {
      continue;
    }
    group[name] = range.replaceAll(currentVersion, nextVersion);
  }
};

rootPackage.version = nextVersion;
writeJson(rootPackagePath, rootPackage);

for (const workspacePackage of workspacePackages) {
  workspacePackage.pkg.version = nextVersion;
  updateDependencyGroup(workspacePackage.pkg.dependencies);
  updateDependencyGroup(workspacePackage.pkg.devDependencies);
  updateDependencyGroup(workspacePackage.pkg.peerDependencies);
  updateDependencyGroup(workspacePackage.pkg.optionalDependencies);
  writeJson(workspacePackage.filePath, workspacePackage.pkg);
}

console.log(nextVersion);
