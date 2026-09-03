#!/usr/bin/env node
// W1.18/W1.19 — emit a machine-readable manifest of the fork's divergence
// from upstream: which commits, what files, what classification, what
// rebase-conflict risk. Writes JSON to upstream/divergence-manifest.json
// and a human-readable summary to upstream/divergence-summary.md.
//
// Run from repo root:  node bin/divergence-manifest.mjs

import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const REMOTE = process.env.UPSTREAM_REMOTE || 'upstream';
const BRANCH = process.env.UPSTREAM_BRANCH || 'main';

function sh(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (e) {
    return e.stdout?.toString().trim() || '';
  }
}

const upstreamRef = `${REMOTE}/${BRANCH}`;
const aheadRange  = `${upstreamRef}..HEAD`;

// 1. Per-commit classification from the W-class trailer or git notes.
const log = sh(`git log --no-merges --pretty=format:'%H%n%an%n%ai%n%s%n%b%n--END--' ${aheadRange}`);
const blocks = log.split('--END--').map(b => b.trim()).filter(Boolean);

const commits = blocks.map(b => {
  const lines = b.split('\n');
  const sha    = lines[0] || '';
  const author = lines[1] || '';
  const date   = lines[2] || '';
  const subject= lines[3] || '';
  const body   = lines.slice(4).join('\n');
  // Try git notes (refs/notes/wclass) first; fall back to body trailer.
  const note = sh(`git notes --ref=wclass show ${sha} 2>/dev/null`).trim();
  const noteMatch = note.match(/W-class:\s*([PFB])/i);
  // Trailers (last empty-line-separated block of the body).
  const trailerLines = body.split('\n').filter(l => /^[A-Z][A-Za-z0-9-]*:/.test(l));
  const trailer = Object.fromEntries(
    trailerLines.map(l => {
      const [k, ...rest] = l.split(':');
      return [k.trim(), rest.join(':').trim()];
    })
  );
  const wClass = noteMatch ? noteMatch[1].toUpperCase() : (trailer['W-class'] || 'unclassified');
  // Files changed.
  const files = sh(`git show --name-only --pretty='' ${sha}`).split('\n').filter(Boolean);
  return {
    sha: sha.slice(0, 12),
    author, date, subject,
    files,
    wClass,
    prTarget: trailer['PR-target'] || null,
    portable: wClass === 'P',
    forkOnly: wClass === 'F',
    blocking: wClass === 'B',
  };
});

// 2. Aggregate stats.
const counts = {
  total: commits.length,
  portable: commits.filter(c => c.portable).length,
  forkOnly: commits.filter(c => c.forkOnly).length,
  blocking: commits.filter(c => c.blocking).length,
  unclassified: commits.filter(c => c.wClass === 'unclassified').length,
};

const byFile = new Map();
for (const c of commits) for (const f of c.files) {
  byFile.set(f, (byFile.get(f) || 0) + 1);
}
const topFiles = [...byFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25);

// 3. Diff stats.
const diffStat = sh(`git diff --stat ${upstreamRef}..HEAD`);
const insertionCount = (diffStat.match(/(\d+) insertions?/i) || [])[1] || '0';
const deletionCount  = (diffStat.match(/(\d+) deletions?/i)  || [])[1] || '0';
const fileCount      = (diffStat.match(/(\d+) files? changed/i) || [])[1] || '0';

const manifest = {
  generated: new Date().toISOString(),
  upstream: { remote: REMOTE, branch: BRANCH, ref: upstreamRef },
  fork: { branch: 'HEAD', commitCount: counts.total },
  diff: { filesChanged: +fileCount, insertions: +insertionCount, deletions: +deletionCount },
  classification: counts,
  topTouchedFiles: topFiles.map(([path, hits]) => ({ path, hits })),
  commits,
};

mkdirSync('upstream', { recursive: true });
writeFileSync('upstream/divergence-manifest.json', JSON.stringify(manifest, null, 2));

// 4. Human-readable summary.
const md = [
  `# Fork divergence summary — ${manifest.generated.slice(0, 19)}Z`,
  ``,
  `## Counts`,
  ``,
  `| Property | Value |`,
  `|---|---|`,
  `| Upstream | \`${upstreamRef}\` |`,
  `| Fork commits ahead | **${counts.total}** |`,
  `| Portable (\`W-class: P\`) | ${counts.portable} |`,
  `| Fork-only (\`W-class: F\`) | ${counts.forkOnly} |`,
  `| Blocking (\`W-class: B\`) | ${counts.blocking} |`,
  `| Unclassified | **${counts.unclassified}** (action: classify or rewrite trailer) |`,
  `| Files changed | ${fileCount} |`,
  `| Insertions / deletions | +${insertionCount} / -${deletionCount} |`,
  ``,
  `## Top touched files`,
  ``,
  `| Hits | Path |`,
  `|---|---|`,
  ...topFiles.map(([p, h]) => `| ${h} | \`${p}\` |`),
  ``,
  `## Portable commits (cherry-pick candidates)`,
  ``,
  ...commits.filter(c => c.portable).map(c =>
    `- \`${c.sha}\` ${c.subject}${c.prTarget ? `  → ${c.prTarget}` : ''}`
  ) || [`_none classified yet_`],
  ``,
  `## All commits (unclassified at top)`,
  ``,
  ...[...commits].sort((a, b) => +a.portable - +b.portable).map(c =>
    `- \`${c.sha}\` [${c.wClass}] ${c.subject}`
  ),
  ``,
  `## How to use this manifest`,
  ``,
  `- \`node bin/cherry-pick-portable.mjs\` — replay the portable set onto \`upstream/main\``,
  `- \`node bin/classify-commit.mjs <SHA> <P|F|B>\` — set a commit's W-class trailer`,
  `- \`node bin/upstream-intel.mjs\` — refresh the daily intelligence digest`,
].join('\n');
writeFileSync('upstream/divergence-summary.md', md);

console.log(`Wrote upstream/divergence-manifest.json (${manifest.commits.length} commits)`);
console.log(`Wrote upstream/divergence-summary.md`);
console.log(`Classification: portable=${counts.portable} fork-only=${counts.forkOnly} blocking=${counts.blocking} unclassified=${counts.unclassified}`);
