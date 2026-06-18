// Pure-JS verification of core algorithms
// (no TypeScript/dependencies needed)
// Run with: node test-pure.js

const SEVERITY_LABELS = {
  P0: { emoji: "🔴", label: "Critical" },
  P1: { emoji: "🟠", label: "Warning" },
  P2: { emoji: "🟡", label: "Info" },
  P3: { emoji: "🟢", label: "Suggestion" },
};

function normalizeSeverity(original) {
  const lower = original.toLowerCase();
  if (["critical", "blocker", "severe", "high"].some((s) => lower.includes(s))) return "P0";
  if (["warning", "major", "medium", "important"].some((s) => lower.includes(s))) return "P1";
  if (["info", "minor", "low", "note"].some((s) => lower.includes(s))) return "P2";
  return "P3";
}

function normalizeCategory(original) {
  const lower = original.toLowerCase();
  if (lower.includes("security")) return "security";
  if (lower.includes("performance")) return "performance";
  if (lower.includes("maintainability") || lower.includes("code smell") || lower.includes("complexity")) return "maintainability";
  if (lower.includes("style") || lower.includes("format")) return "style";
  if (lower.includes("bug") || lower.includes("defect")) return "bug";
  if (lower.includes("test") || lower.includes("coverage")) return "test";
  if (lower.includes("doc")) return "documentation";
  return "maintainability";
}

function normalizeMessage(m) {
  return m.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

function deduplicateFindings(findings) {
  const seen = new Set();
  const result = [];
  for (const f of findings) {
    const key = `${f.file}:${f.line_start}:${normalizeMessage(f.message)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(f);
  }
  return result;
}

function extractChangedLines(diff) {
  const out = new Map();
  for (const f of diff) {
    if (!f.filename || !f.patch) continue;
    const lines = new Set();
    let currentLine = 0;
    for (const raw of f.patch.split("\n")) {
      if (raw.startsWith("@@")) {
        const m = raw.match(/\+(\d+)/);
        if (m) currentLine = parseInt(m[1], 10) - 1;
      } else if (raw.startsWith("+") && !raw.startsWith("+++")) {
        currentLine++;
        lines.add(currentLine);
      } else if (!raw.startsWith("-")) {
        currentLine++;
      }
    }
    out.set(f.filename, lines);
  }
  return out;
}

function applyDelta(previous, current, changed) {
  const isOnChangedLine = (f) => {
    const lines = changed.get(f.file);
    if (!lines) return false;
    for (let l = f.line_start; l <= f.line_end; l++) if (lines.has(l)) return true;
    return false;
  };
  const preserved = previous.filter((f) => !isOnChangedLine(f));
  return deduplicateFindings([...preserved, ...current]);
}

function getConclusion(report) {
  const p0 = report.summary.by_severity.P0 || 0;
  const p1 = report.summary.by_severity.P1 || 0;
  if (p0 > 0 || p1 > 0) return "failure";
  if ((report.summary.by_severity.P2 || 0) > 0 || (report.summary.by_severity.P3 || 0) > 0) return "neutral";
  return "success";
}

// ─── Tests ─────────────────────────────────────────────────────────
let pass = 0, fail = 0;
function assert(name, cond) {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name); }
}

console.log('\n--- severity normalization ---');
assert('critical → P0', normalizeSeverity('critical') === 'P0');
assert('blocker → P0', normalizeSeverity('blocker') === 'P0');
assert('severe → P0', normalizeSeverity('severe') === 'P0');
assert('high → P0', normalizeSeverity('high') === 'P0');
assert('warning → P1', normalizeSeverity('warning') === 'P1');
assert('major → P1', normalizeSeverity('major') === 'P1');
assert('medium → P1', normalizeSeverity('medium') === 'P1');
assert('important → P1', normalizeSeverity('important') === 'P1');
assert('info → P2', normalizeSeverity('info') === 'P2');
assert('minor → P2', normalizeSeverity('minor') === 'P2');
assert('low → P2', normalizeSeverity('low') === 'P2');
assert('note → P2', normalizeSeverity('note') === 'P2');
assert('suggestion → P3', normalizeSeverity('suggestion') === 'P3');

console.log('\n--- category normalization ---');
assert('security', normalizeCategory('security') === 'security');
assert('performance', normalizeCategory('performance') === 'performance');
assert('style', normalizeCategory('style') === 'style');
assert('formatting', normalizeCategory('formatting') === 'style');
assert('bug', normalizeCategory('bug') === 'bug');
assert('defect', normalizeCategory('defect') === 'bug');
assert('test', normalizeCategory('test') === 'test');
assert('coverage', normalizeCategory('coverage') === 'test');
assert('doc', normalizeCategory('docstring') === 'documentation');
assert('code smell', normalizeCategory('code smell') === 'maintainability');
assert('complexity', normalizeCategory('cyclomatic complexity') === 'maintainability');
assert('misc', normalizeCategory('misc') === 'maintainability');

console.log('\n--- deduplication ---');
const f1 = { file: 'a.ts', line_start: 1, message: 'Hardcoded key' };
const f2 = { file: 'a.ts', line_start: 1, message: 'hardcoded key!!!' };
const f3 = { file: 'b.ts', line_start: 2, message: 'Indent' };
const deduped = deduplicateFindings([f1, f2, f3]);
assert('dup on file+line+msg is removed', deduped.length === 2);
assert('kept f1 or f2', deduped.some(f => f === f1 || f === f2));
assert('kept f3', deduped.some(f => f === f3));

console.log('\n--- delta diff parser ---');
const diff = [{
  filename: 'src/a.ts',
  patch: '@@ -1,3 +1,4 @@\n unchanged1\n+added1\n unchanged2\n+added2\n unchanged3\n',
}];
const lines = extractChangedLines(diff);
const set = lines.get('src/a.ts');
assert('parsed line 2', set && set.has(2));
assert('parsed line 4', set && set.has(4));
assert('did not parse context line 1', set && !set.has(1));
assert('did not parse context line 3', set && !set.has(3));
assert('did not parse context line 5', set && !set.has(5));

console.log('\n--- delta review ---');
const changed = new Map();
changed.set('a.ts', new Set([10]));
const prev = [
  { file: 'a.ts', line_start: 5, line_end: 5, message: 'preserved' },
  { file: 'a.ts', line_start: 10, line_end: 10, message: 'dropped' },
];
const curr = [
  { file: 'a.ts', line_start: 11, line_end: 11, message: 'new' },
];
const merged = applyDelta(prev, curr, changed);
assert('preserved unchanged-line finding', merged.some(x => x.message === 'preserved'));
assert('dropped changed-line finding', !merged.some(x => x.message === 'dropped'));
assert('added new finding', merged.some(x => x.message === 'new'));

console.log('\n--- conclusion mapping ---');
const base = { summary: { by_severity: {} } };
assert('P0 → failure', getConclusion({ ...base, summary: { by_severity: { P0: 1 } } }) === 'failure');
assert('P1 → failure', getConclusion({ ...base, summary: { by_severity: { P1: 1 } } }) === 'failure');
assert('P2 → neutral', getConclusion({ ...base, summary: { by_severity: { P2: 1 } } }) === 'neutral');
assert('P3 → neutral', getConclusion({ ...base, summary: { by_severity: { P3: 1 } } }) === 'neutral');
assert('empty → success', getConclusion({ ...base, summary: { by_severity: {} } }) === 'success');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
