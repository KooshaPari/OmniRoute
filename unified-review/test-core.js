// Standalone test runner — no jest required
// Run with: node test-core.js
const path = require('path');

async function run() {
  // Use ts-node if available; else try compiling
  let tsNode;
  try { tsNode = require('ts-node'); } catch { /* not present */ }

  if (tsNode) {
    tsNode.register({
      transpileOnly: true,
      compilerOptions: { module: 'commonjs', target: 'es2020', esModuleInterop: true, moduleResolution: 'node' },
    });
  } else {
    // Fallback: load the source and strip types manually
    const fs = require('fs');
    const { transpileModule, ScriptTarget, ModuleKind } = require('typescript');
    const files = [
      'src/lib/aggregator.ts',
      'src/lib/quota.ts',
      'src/lib/selector.ts',
      'src/lib/poster.ts',
    ];
    for (const f of files) {
      const src = fs.readFileSync(f, 'utf8');
      const out = transpileModule(src, {
        compilerOptions: {
          module: ModuleKind.CommonJS,
          target: ScriptTarget.ES2020,
          esModuleInterop: true,
          moduleResolution: 'node',
        },
        fileName: f,
      });
      const outPath = f.replace('.ts', '.js');
      fs.writeFileSync(outPath, out.outputText);
      require(path.resolve(outPath));
    }
  }

  const { normalizeSeverity, normalizeCategory, deduplicateFindings, aggregateReports, getConclusion, formatMarkdownReport } = require('./src/lib/aggregator');
  const { selectReviewerForPR, getOrAssignTool, assignTool, getAssignedTool, clearAssignment } = require('./src/lib/selector');
  const { getQuotaState, consumeQuota, getDefaultQuota, markDegraded, recordFailure, enqueueReview, dequeueReview, getQueueSize } = require('./src/lib/quota');
  const { applyDelta, extractChangedLines, getLastReviewedCommit, setLastReviewedCommit } = require('./src/lib/poster');

  let pass = 0, fail = 0;
  function assert(name, cond) {
    if (cond) { pass++; console.log('  ✓', name); }
    else { fail++; console.log('  ✗', name); }
  }

  console.log('\n--- aggregator ---');
  assert('P0 critical', normalizeSeverity('critical') === 'P0');
  assert('P0 high', normalizeSeverity('high') === 'P0');
  assert('P1 warning', normalizeSeverity('warning') === 'P1');
  assert('P2 info', normalizeSeverity('info') === 'P2');
  assert('P3 suggestion', normalizeSeverity('suggestion') === 'P3');

  assert('cat security', normalizeCategory('security') === 'security');
  assert('cat performance', normalizeCategory('performance') === 'performance');
  assert('cat test', normalizeCategory('test coverage') === 'test');

  const f1 = { id: '1', tool: 'copilot', severity: 'P0', category: 'security', file: 'a.ts', line_start: 1, line_end: 1, message: 'Hardcoded key', original_severity: 'critical', confidence: 'high', commit_sha: 'abc' };
  const f2 = { id: '2', tool: 'coderabbit', severity: 'P0', category: 'security', file: 'a.ts', line_start: 1, line_end: 1, message: 'hardcoded key!!!', original_severity: 'high', confidence: 'high', commit_sha: 'abc' };
  const f3 = { id: '3', tool: 'cursor', severity: 'P2', category: 'style', file: 'b.ts', line_start: 2, line_end: 2, message: 'Indent', original_severity: 'low', confidence: 'medium', commit_sha: 'abc' };
  const deduped = deduplicateFindings([f1, f2, f3]);
  assert('dedup keeps unique', deduped.length === 2);

  const r = aggregateReports([{
    pr_id: '1', commit_sha: 'abc', tool: 'unified',
    findings: [f1, { ...f3, tool: 'cursor' }],
    summary: { total: 2, by_severity: {}, by_category: {}, new_findings: 0, resolved_findings: 0 },
    generated_at: new Date().toISOString(),
  }]);
  assert('aggregate total', r.summary.total === 2);
  assert('aggregate P0', r.summary.by_severity.P0 === 1);

  assert('conclusion P0', getConclusion({ ...r, summary: { ...r.summary, by_severity: { P0: 1 } } }) === 'failure');
  assert('conclusion P2', getConclusion({ ...r, summary: { ...r.summary, by_severity: { P2: 1 } } }) === 'neutral');
  assert('conclusion success', getConclusion({ ...r, summary: { ...r.summary, by_severity: {} } }) === 'success');

  const md = formatMarkdownReport({
    pr_id: '1', commit_sha: 'abc123', tool: 'copilot',
    findings: [f1],
    summary: { total: 1, by_severity: { P0: 1 }, by_category: { security: 1 }, new_findings: 0, resolved_findings: 0 },
    generated_at: '',
  });
  assert('markdown has Critical', md.includes('Critical'));
  assert('markdown has file', md.includes('auth.ts') || md.includes('a.ts'));
  assert('markdown has message', md.includes('Hardcoded key'));

  console.log('\n--- quota ---');
  const s1 = await getQuotaState('forge', getDefaultQuota('forge'), 'test-org-A');
  assert('quota state', s1.tool === 'forge');
  const s2 = await consumeQuota('kilocode', getDefaultQuota('kilocode'), 'test-org-B');
  assert('consume returns state', s2.tool === 'kilocode');

  console.log('\n--- selector ---');
  const tool = await getOrAssignTool({
    pr: { owner: 'test-org-C', repo: 'r', number: 1, head_sha: 'a', base_sha: 'b' },
    event: 'opened',
  });
  assert('selector returns valid', ['copilot', 'coderabbit', 'cursor', 'forge', 'kilocode', 'codeql', 'codeql-autofix'].includes(tool));

  const req = { pr: { owner: 'test-org-D', repo: 'r', number: 2, head_sha: 'a', base_sha: 'b' }, event: 'opened' };
  const t1 = await getOrAssignTool(req);
  const t2 = await getOrAssignTool(req);
  assert('sticky assignment', t1 === t2);

  await assignTool('test-org-E', 'r', 3, 'coderabbit');
  const got = await getAssignedTool('test-org-E', 'r', 3);
  assert('assign/get round-trip', got === 'coderabbit');
  await clearAssignment('test-org-E', 'r', 3);
  const cleared = await getAssignedTool('test-org-E', 'r', 3);
  assert('clear removes', cleared === null);

  console.log('\n--- delta engine ---');
  const diff = [{ filename: 'src/a.ts', patch: '@@ -1,3 +1,4 @@\n unchanged1\n+added1\n unchanged2\n+added2\n unchanged3\n' }];
  const lines = extractChangedLines(diff);
  const set = lines.get('src/a.ts');
  assert('extractChangedLines 2', set && set.has(2));
  assert('extractChangedLines 4', set && set.has(4));

  const changed = new Map();
  changed.set('a.ts', new Set([10]));
  const prev = [
    { ...f1, file: 'a.ts', line_start: 5, line_end: 5, message: 'preserved' },
    { ...f1, file: 'a.ts', line_start: 10, line_end: 10, message: 'dropped' },
  ];
  const curr = [
    { ...f1, file: 'a.ts', line_start: 11, line_end: 11, message: 'new' },
  ];
  const merged = applyDelta(prev, curr, changed);
  assert('delta preserves unchanged', merged.some(x => x.message === 'preserved'));
  assert('delta drops changed', !merged.some(x => x.message === 'dropped'));
  assert('delta adds new', merged.some(x => x.message === 'new'));

  await setLastReviewedCommit('test-org-F', 'r', 4, 'sha-abc');
  const lastSha = await getLastReviewedCommit('test-org-F', 'r', 4);
  assert('last commit round-trip', lastSha === 'sha-abc');

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

run().catch((e) => { console.error('FATAL:', e); process.exit(2); });
