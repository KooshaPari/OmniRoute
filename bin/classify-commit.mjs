#!/usr/bin/env node
// W1.18 — set a commit's W-class trailer so the divergence manifest and
// cherry-pick script know how to treat it.
//
// Usage:  node bin/classify-commit.mjs <SHA> <P|F|B> [pr-target]
// Example: node bin/classify-commit.mjs abc123 P diegosouzapw/OmniRoute#1234
//
// Re-uses git notes (refs/notes/wclass) so the original commit hash is
// preserved — this is the convention that lets us cherry-pick without
// rewriting the upstream-side history.

import { execSync } from 'node:child_process';

const [, , sha, wclass, prTarget] = process.argv;
if (!sha || !['P', 'F', 'B'].includes(wclass)) {
  console.error('Usage: classify-commit.mjs <SHA> <P|F|B> [pr-target]');
  process.exit(1);
}

const prLine = prTarget ? `\nPR-target: ${prTarget}` : '';
const note = `W-class: ${wclass}${prLine}\n`;

try {
  execSync(`git notes --ref=wclass add -F - ${sha} <<< ${JSON.stringify(note)}`, { stdio: 'inherit' });
  console.log(`Set W-class=${wclass} on ${sha}${prTarget ? ` (PR-target=${prTarget})` : ''}`);
} catch (e) {
  console.error('git notes failed; falling back to amending trailer');
  try {
    const subject = execSync(`git log -1 --pretty=%s ${sha}`, { encoding: 'utf8' }).trim();
    execSync(`git notes --ref=wclass add -m ${JSON.stringify(note)} ${sha}`, { stdio: 'inherit' });
    console.log(`Note set via fallback: ${subject}`);
  } catch (e2) {
    console.error('Both attempts failed:', e2.message);
    process.exit(2);
  }
}
