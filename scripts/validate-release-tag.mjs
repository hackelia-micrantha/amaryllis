import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tag = process.argv[2];

if (!tag) {
  throw new Error('Usage: node scripts/validate-release-tag.mjs <tag>');
}

const manifest = JSON.parse(
  await readFile(resolve(repositoryRoot, 'package.json'), 'utf8')
);
const expectedTag = `v${manifest.version}`;

if (tag !== expectedTag) {
  throw new Error(
    `Release tag ${tag} does not match root package version ${manifest.version}; expected ${expectedTag}`
  );
}

console.log(`Validated release tag ${tag} for ${manifest.name}@${manifest.version}`);
