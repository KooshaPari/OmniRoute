#!/usr/bin/env node
// W9.04 — Pin floating action references to commit SHAs across .github/workflows/.
// Run from repo root. Idempotent: only rewrites lines that match a floating tag.
//
// Last verified SHAs (Sept 2026):
const SHA = {
  // v7 (current major)
  'actions/checkout@v7':         'actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd',
  'actions/setup-node@v7':       'actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38',
  'actions/upload-artifact@v7':  'actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a',
  'actions/download-artifact@v8':'actions/download-artifact@fa0a91b85d4f404e444e00e005971372dc801d16',
  'actions/cache@v6':            'actions/cache@2c8a9bd7457de244a408f35966fab2fb45fda9c8',
  'actions/setup-python@v7':     'actions/setup-python@5fda3b95a4ea91299a34e894583c3862153e4b97',
  'actions/dependency-review-action@v4':
                                  'actions/dependency-review-action@a1d282b36b6f3519aa1f3fc636f609c47dddb294',
  'actions/github-script@v9':    'actions/github-script@3a2844b7e9c422d3c10d287c895573f7108da1b3',
  // v6 (older LTS)
  'actions/checkout@v6':         'actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0',
  'actions/setup-node@v6':       'actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e',
  'actions/setup-node@v4':       'actions/setup-node@820762786026740c76f36085b0efc47a31fe5020',
  'actions/checkout@v4':         'actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683',
  'actions/upload-artifact@v4':  'actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02',
  'actions/download-artifact@v4':'actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c',
};

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const wfDir = '.github/workflows';
let totalReplacements = 0;
let touched = 0;

for (const f of readdirSync(wfDir)) {
  const p = join(wfDir, f);
  if (!statSync(p).isFile()) continue;
  if (!/\.ya?ml$/.test(f)) continue;
  let text = readFileSync(p, 'utf8');
  let count = 0;
  for (const [tag, sha] of Object.entries(SHA)) {
    // Match `uses: name@tag` where tag is a floating semver (no leading hex).
    const re = new RegExp('(uses:\\s+)' + tag.replace(/[.+*?^$()|[\]\\]/g, '\\$&') + '(?=\\s|$)', 'g');
    text = text.replace(re, (m, prefix) => {
      count++;
      return prefix + sha;
    });
  }
  if (count) {
    writeFileSync(p, text);
    console.log(`${f}: ${count} pin(s)`);
    totalReplacements += count;
    touched++;
  }
}
console.log(`\nDone. ${totalReplacements} pin(s) across ${touched} workflow file(s).`);
