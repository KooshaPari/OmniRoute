#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, relative, sep } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const manifestPath = resolve(root, 'ci/integrity-manifest.sha256');
const trackedRoots = [
  '.woodpecker.yml',
  'lefthook.yml',
  'package.json',
  'apps/bff',
  'apps/web',
  'packages/api-contracts',
  'packages/design-tokens',
  'scripts/check',
];
const requiredRoots = new Set(trackedRoots);
const ignoredDirectories = new Set(['node_modules', 'dist', 'build', '.svelte-kit', 'coverage']);

async function collectFiles(path) {
  const fullPath = resolve(root, path);
  const entries = await readdir(fullPath, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const child = `${path}/${entry.name}`.replaceAll('/', sep);
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) files.push(...await collectFiles(child));
    } else if (entry.isFile()) {
      files.push(relative(root, resolve(root, child)).replaceAll(sep, '/'));
    }
  }
  return files;
}

async function manifest() {
  const files = [];
  for (const item of trackedRoots) {
    try {
      await readdir(resolve(root, item), { withFileTypes: true });
      files.push(...(await collectFiles(item)));
    } catch (error) {
      if (error.code === 'ENOENT' && requiredRoots.has(item)) {
        throw new Error(`Missing required integrity manifest root: ${item}`);
      }
      if (error.code !== 'ENOTDIR') throw error;
      files.push(item);
    }
  }

  return (await Promise.all(files.sort().map(async (file) => {
    const digest = createHash('sha256').update(await readFile(resolve(root, file))).digest('hex');
    return `${digest}  ${file}`;
  }))).join('\n') + '\n';
}

const actual = await manifest();
if (process.argv.includes('--write')) {
  await writeFile(manifestPath, actual);
  console.log(`Wrote ${relative(root, manifestPath)} (${actual.trim().split('\n').length} files).`);
} else {
  const expected = await readFile(manifestPath, 'utf8');
  if (expected !== actual) {
    console.error('Integrity manifest is stale. Run: bun run integrity:manifest:write');
    process.exitCode = 1;
  } else {
    console.log(`Integrity manifest verified (${actual.trim().split('\n').length} files).`);
  }
}
