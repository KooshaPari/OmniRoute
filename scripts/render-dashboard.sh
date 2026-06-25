#!/usr/bin/env bash
# render-dashboard.sh — Read .grade-reports/cross-repo/*.json and render dashboard artifacts
# Usage: ./scripts/render-dashboard.sh
#
# This script reads all JSON grade reports from .grade-reports/cross-repo/,
# generates:
#   - dashboard/index.html          (interactive card dashboard)
#   - dashboard/cross-repo-summary.json  (machine-readable summary)
#   - docs/grades/README.md         (VitePress grade index page)
#   - docs/grades/pillar-trends.md  (71-pillar breakdown)
#   - docs/grades/per-repo.md       (per-repo detail)
#   - docs/grades/tier-0.md         (Tier-0 gauge)
#   - docs/grades/tier-1.md         (Tier-1 security gate)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REPORT_DIR="$REPO_ROOT/.grade-reports/cross-repo"
DASHBOARD_DIR="$REPO_ROOT/dashboard"
DOCS_GRADES_DIR="$REPO_ROOT/docs/grades"

mkdir -p "$DASHBOARD_DIR" "$DOCS_GRADES_DIR"

# Bail if no reports found
if ! ls "$REPORT_DIR"/*.json 1>/dev/null 2>&1; then
  echo "ERROR: No grade reports found in $REPORT_DIR"
  echo "Run: for repo in phenotype-infra PhenoCompose BytePort nanovms; do"
  echo "  (cd ../\$repo && bash \"$REPO_ROOT/grade.sh\" --json)"
  echo "  cp ../\$repo/.grade-reports/grade.json \"$REPORT_DIR/\$repo.json\""
  echo "done"
  exit 1
fi

# --- Helper: read all repos into a JSON array ---
{
  echo '['
  first=true
  for f in "$REPORT_DIR"/*.json; do
    $first || echo ','
    first=false
    cat "$f"
  done
  echo ']'
} > "$DASHBOARD_DIR/_repos.json"

# --- Generate cross-repo-summary.json ---
python3 -c "
import json, os, sys

reports_dir = os.path.join('$REPORT_DIR')
repos = []
for f in sorted(os.listdir(reports_dir)):
    if not f.endswith('.json'):
        continue
    with open(os.path.join(reports_dir, f)) as fp:
        repos.append(json.load(fp))

tier_0_checks = ['build', 'test-unit', 'fmt', 'clippy', 'lint', 'typecheck']
summary = {
    'generated': '$(date -u +%Y-%m-%dT%H:%M:%SZ)',
    'generator': 'render-dashboard.sh',
    'source': '.grade-reports/cross-repo/*.json',
    'repos': [],
    'metrics': {},
    'stacks': {}
}

total_score = 0
total_pct = 0
t0_pass = 0
t1_pass = 0

for r in repos:
    checks = {c['name']: c['status'] for c in r.get('checks', [])}
    t0_ok = any(checks.get(c) == 'pass' for c in tier_0_checks if c in checks)
    t1_audit = checks.get('audit', 'missing')
    pillars_passed = sum(1 for c in r.get('checks', []) if c['status'] == 'pass')
    pillars_total = len(r.get('checks', []))

    entry = {
        'project': r['project'],
        'stack': r.get('stack', 'unknown'),
        'mode': r.get('mode', 'full'),
        'score': r.get('score', 0),
        'max': r.get('max', 0),
        'percentage': r.get('percentage', 0),
        'grade': r.get('grade', 'F'),
        'timestamp': r.get('timestamp', ''),
        'tier_0_pass': t0_ok,
        'tier_0_checks': {c: checks.get(c, 'missing') for c in tier_0_checks if c in checks},
        'tier_1_audit': t1_audit,
        'pillars_passed': pillars_passed,
        'pillars_total': pillars_total,
    }
    summary['repos'].append(entry)
    total_score += r.get('score', 0)
    total_pct += r.get('percentage', 0)
    if t0_ok: t0_pass += 1
    if checks.get('audit') == 'pass': t1_pass += 1

    stack = r.get('stack', 'unknown')
    summary['stacks'].setdefault(stack, []).append(r['project'])

n = len(repos) or 1
summary['metrics'] = {
    'avg_score': round(total_score / n, 2),
    'avg_percentage': round(total_pct / n, 2),
    'total_repos': len(repos),
    'passing_tier_0': t0_pass,
    'passing_tier_1': t1_pass,
}

with open(os.path.join('$DASHBOARD_DIR', 'cross-repo-summary.json'), 'w') as fp:
    json.dump(summary, fp, indent=2)

print(f'Written cross-repo-summary.json with {len(repos)} repos')
"

# --- Generate dashboard/index.html (inline, self-contained) ---
python3 -c "
import json, os

repos_file = os.path.join('$DASHBOARD_DIR', '_repos.json')
with open(repos_file) as fp:
    repos = json.load(fp)

html = '''<!DOCTYPE html>
<html lang=\"en\">
<head>
<meta charset=\"UTF-8\">
<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">
<title>Cross-Repro Grade Dashboard — Phenotype Registry</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,-apple-system,sans-serif;background:#f8fafc;color:#1e293b;padding:2rem}
h1{font-size:1.75rem;margin-bottom:.25rem;color:#0f172a}
.subtitle{color:#64748b;margin-bottom:2rem;font-size:.9rem}
.dashboard{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:1.25rem}
.card{border-radius:12px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.08),0 1px 2px rgba(0,0,0,.06);padding:1.5rem;transition:box-shadow .2s}
.card:hover{box-shadow:0 4px 12px rgba(0,0,0,.12)}
.card-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:1rem}
.repo-name{font-size:1.15rem;font-weight:600;color:#0f172a}
.stack-tag{font-size:.7rem;background:#e2e8f0;padding:2px 8px;border-radius:4px;color:#475569;text-transform:uppercase;font-weight:500}
.score-row{display:flex;align-items:baseline;gap:.5rem;margin-bottom:.75rem}
.score-number{font-size:2.5rem;font-weight:700}
.score-max{color:#94a3b8;font-size:1rem}
.grade-badge{display:inline-block;padding:2px 10px;border-radius:6px;font-weight:700;font-size:.85rem}
.grade-Ap,.grade-A{background:#dcfce7;color:#166534}
.grade-Bp,.grade-B{background:#fef9c3;color:#854d0e}
.grade-C{background:#fed7aa;color:#9a3412}
.grade-D{background:#fecaca;color:#991b1b}
.grade-F{background:#fee2e2;color:#991b1b}
.meta{margin-bottom:1rem;font-size:.8rem;color:#64748b}
.meta span{display:inline-block;margin-right:1rem}
.pillars{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:1rem}
.pillar{font-size:.7rem;padding:2px 6px;border-radius:4px;font-weight:500}
.pillar.pass{background:#dcfce7;color:#166534}
.pillar.fail{background:#fee2e2;color:#991b1b}
.pillar.skip{background:#f1f5f9;color:#94a3b8}
.detail-link{margin-top:.75rem;display:inline-block;font-size:.85rem;color:#3b82f6;text-decoration:none;font-weight:500}
.detail-link:hover{text-decoration:underline}
.summary-bar{display:flex;gap:1.5rem;margin-bottom:2rem;flex-wrap:wrap}
.stat-box{background:#fff;border-radius:10px;padding:1rem 1.5rem;box-shadow:0 1px 2px rgba(0,0,0,.06);flex:1;min-width:140px}
.stat-label{font-size:.75rem;text-transform:uppercase;color:#64748b;font-weight:600;letter-spacing:.05em}
.stat-value{font-size:1.75rem;font-weight:700;color:#0f172a;margin-top:2px}
.generated{text-align:center;margin-top:3rem;font-size:.8rem;color:#94a3b8}
</style>
</head>
<body>
<h1>Cross-Repro Grade Dashboard</h1>
<p class=\"subtitle\">Phenotype Registry — compute/infra fleet</p>
<div class=\"summary-bar\" id=\"summary\"></div>
<div class=\"dashboard\" id=\"dashboard\"></div>
<p class=\"generated\">Generated by <strong>render-dashboard.sh</strong> &middot; Source: <code>.grade-reports/cross-repo/</code></p>
<script>
'''

repos_json = json.dumps(repos)
html += f'const REPOS = {repos_json};\\n'

html += '''
function render() {
  const tier0Checks = ['build','test-unit','fmt','clippy','lint','typecheck'];
  let t0Pass=0, t1Pass=0, totalPct=0;
  const container = document.getElementById('dashboard');
  container.innerHTML = REPOS.map(r => {
    const checks = Object.fromEntries((r.checks||[]).map(c => [c.name, c.status]));
    const t0ok = tier0Checks.some(c => checks[c] === 'pass');
    if (t0ok) t0Pass++;
    if (checks.audit === 'pass') t1Pass++;
    totalPct += r.percentage || 0;

    const pillarsHtml = (r.checks||[]).map(c =>
      `<span class="pillar ${c.status}">${c.name}</span>`
    ).join('');
    const gradeClass = r.grade ? `grade-${r.grade.replace('+','p')}` : 'grade-F';
    return `<div class=\"card\">
      <div class=\"card-header\">
        <span class=\"repo-name\">${r.project}</span>
        <span class=\"stack-tag\">${r.stack||'?'}</span>
      </div>
      <div class=\"score-row\">
        <span class=\"score-number\">${r.percentage||0}%</span>
        <span class=\"score-max\">(${r.score||0}/${r.max||0})</span>
        <span class=\"grade-badge ${gradeClass}\">${r.grade||'?'}</span>
      </div>
      <div class=\"meta\">
        <span>Mode: ${r.mode||'?'}</span>
        <span>${r.timestamp||''}</span>
      </div>
      <div class=\"pillars\">${pillarsHtml}</div>
      <a class=\"detail-link\" href=\"../docs/grades/per-repo.html?repo=${r.project}\">Details &rarr;</a>
    </div>`;
  }).join('');

  const avgPct = REPOS.length ? Math.round(totalPct / REPOS.length) : 0;
  document.getElementById('summary').innerHTML = `
    <div class=\"stat-box\"><div class=\"stat-label\">Repos</div><div class=\"stat-value\">${REPOS.length}</div></div>
    <div class=\"stat-box\"><div class=\"stat-label\">Tier-0 Passing</div><div class=\"stat-value\">${t0Pass} / ${REPOS.length}</div></div>
    <div class=\"stat-box\"><div class=\"stat-label\">Tier-1 Passing</div><div class=\"stat-value\">${t1Pass} / ${REPOS.length}</div></div>
    <div class=\"stat-box\"><div class=\"stat-label\">Avg %</div><div class=\"stat-value\">${avgPct}%</div></div>`;
}
render();
</script>
</body>
</html>'''

with open(os.path.join('$DASHBOARD_DIR', 'index.html'), 'w') as fp:
    fp.write(html)

print('Written dashboard/index.html')
"

# --- Generate docs/grades pages (VitePress-compatible) ---
python3 -c "
import json, os

repos_file = os.path.join('$DASHBOARD_DIR', '_repos.json')
with open(repos_file) as fp:
    repos = json.load(fp)

docs_dir = '$DOCS_GRADES_DIR'

# Tier-0 checks
T0 = ['build','test-unit','fmt','clippy','lint','typecheck']
# Tier-1 checks
T1 = ['audit','deny','security']

# =============================================
# docs/grades/README.md (VitePress index)
# =============================================
lines = ['# Cross-Repro Grade Dashboard\\n']
lines.append('> Fleet-wide grade report for the Phenotype compute/infra ecosystem.\\n')
lines.append('Generated by `render-dashboard.sh` from `.grade-reports/cross-repo/*.json`.\\n')
lines.append('## Overview\\n')
lines.append('| Repo | Stack | Mode | Score | Max | % | Grade | Tier-0 | Tier-1 | Timestamp |')
lines.append('|------|-------|------|-------|-----|----|-------|--------|--------|-----------|')
for r in repos:
    c = {x['name']:x['status'] for x in r.get('checks',[])}
    t0 = 'PASS' if any(c.get(t)=='pass' for t in T0) else 'FAIL'
    t1 = 'PASS' if c.get('audit')=='pass' else ('SKIP' if c.get('audit')=='skipped' else 'FAIL')
    lines.append(f'| {r[\"project\"]} | {r.get(\"stack\",\"?\")} | {r.get(\"mode\",\"?\")} | {r.get(\"score\",0)} | {r.get(\"max\",0)} | {r.get(\"percentage\",0)}% | {r.get(\"grade\",\"?\")} | {t0} | {t1} | {r.get(\"timestamp\",\"\")} |')
lines.append('')
lines.append('## Per-Repo Details\\n')
lines.append('- [phenotype-infra](per-repo.md#phenotype-infra)')
lines.append('- [PhenoCompose](per-repo.md#phenocompose)')
lines.append('- [BytePort](per-repo.md#byteport)')
lines.append('- [nanovms](per-repo.md#nanovms)')
lines.append('')
lines.append('## Drilldowns\\n')
lines.append('- [Pillar Trends](pillar-trends.md) — 71-pillar breakdown across all repos')
lines.append('- [Per-Repro Breakdown](per-repo.md) — detailed check-by-check view')
lines.append('- [Tier-0 Pass-Rate Gauge](tier-0.md) — build/test-unit/fmt/clippy status')
lines.append('- [Tier-1 Security Gate](tier-1.md) — audit/security/deny status')
with open(os.path.join(docs_dir, 'README.md'), 'w') as fp:
    fp.write('\\n'.join(lines))
print('Written docs/grades/README.md')

# =============================================
# docs/grades/pillar-trends.md
# =============================================
# Gather all unique pillar names across repos
all_pillars = set()
for r in repos:
    for c in r.get('checks',[]):
        all_pillars.add(c['name'])
all_pillars = sorted(all_pillars)

plines = ['# Pillar Trends — 71-Pillar Breakdown\\n']
plines.append('> Per-pillar status across all compute/infra repos.\\n')
plines.append('## All Pillars\\n')
plines.append('| Pillar | ' + ' | '.join(r['project'] for r in repos) + ' | Pass Count |')
plines.append('|' + '|'.join('---' for _ in range(len(repos)+2)) + '|')
for p in all_pillars:
    row = [p]
    pass_count = 0
    for r in repos:
        c = {x['name']:x['status'] for x in r.get('checks',[])}
        status = c.get(p, 'missing')
        icon = {'pass':'PASS','fail':'FAIL','skipped':'SKIP'}.get(status, status)
        if status == 'pass':
            pass_count += 1
        row.append(icon)
    row.append(str(pass_count))
    plines.append('| ' + ' | '.join(row) + ' |')
plines.append('')
plines.append('## Summary\\n')
plines.append(f'- Total unique pillars: {len(all_pillars)}')
plines.append(f'- Repos graded: {len(repos)}')
plines.append(f'- \\\"Pass\\\" = pillar status is \\\"pass\\\" on a given repo.')
plines.append(f'- \\\"Skip\\\" = pillar was skipped (fast mode or not applicable).')
plines.append(f'- \\\"Missing\\\" = pillar does not exist in that repo\\'s grade report.')
with open(os.path.join(docs_dir, 'pillar-trends.md'), 'w') as fp:
    fp.write('\\n'.join(plines))
print('Written docs/grades/pillar-trends.md')

# =============================================
# docs/grades/per-repo.md
# =============================================
rlines = ['# Per-Repro Breakdown\\n']
rlines.append('> Detailed check-by-check grade for each compute/infra repo.\\n')
for r in repos:
    rlines.append(f'## {r[\"project\"]}\\n')
    rlines.append(f'- **Stack:** {r.get(\"stack\",\"?\")} | **Mode:** {r.get(\"mode\",\"?\")} | **Score:** {r.get(\"score\",0)}/{r.get(\"max\",0)} ({r.get(\"percentage\",0)}%) | **Grade:** {r.get(\"grade\",\"?\")}')
    rlines.append(f'- **Timestamp:** {r.get(\"timestamp\",\"?\")}\\n')
    rlines.append('| Check | Status | Score | Max | Detail |')
    rlines.append('|-------|--------|-------|-----|--------|')
    for c in r.get('checks',[]):
        detail = c.get('detail','')[:80].replace('|','/') if c.get('detail') else ''
        rlines.append(f'| {c[\"name\"]} | {c[\"status\"]} | {c.get(\"score\",0)} | {c.get(\"max\",0)} | {detail} |')
    rlines.append('')
with open(os.path.join(docs_dir, 'per-repo.md'), 'w') as fp:
    fp.write('\\n'.join(rlines))
print('Written docs/grades/per-repo.md')

# =============================================
# docs/grades/tier-0.md
# =============================================
t0lines = ['# Tier-0 Pass-Rate Gauge\\n']
t0lines.append('> Tier-0 gates: **build**, **test-unit**, **fmt**, **clippy**/**lint**, **typecheck**.\\n')
t0lines.append('These are the non-negotiable gates that must be green on every PR.\\n')
t0lines.append('## Per-Repro Tier-0 Status\\n')
t0lines.append('| Repo | build | test-unit | fmt | clippy/lint | typecheck | Overall |')
t0lines.append('|------|-------|-----------|-----|-------------|-----------|---------|')
t0_pass_total = 0
for r in repos:
    c = {x['name']:x['status'] for x in r.get('checks',[])}
    b = c.get('build','?')
    tu = c.get('test-unit','?')
    fm = c.get('fmt','?')
    cl = c.get('clippy', c.get('lint', '?'))
    tc = c.get('typecheck', 'N/A')
    t0ok = all(x=='pass' for x in [b,tu,fm,cl] if x != 'N/A')
    if t0ok: t0_pass_total += 1
    overall = 'PASS' if t0ok else 'FAIL'
    t0lines.append(f'| {r[\"project\"]} | {b} | {tu} | {fm} | {cl} | {tc} | {overall} |')
t0lines.append('')
t0lines.append(f'## Gate Summary\\n')
t0lines.append(f'- **Repos passing Tier-0:** {t0_pass_total} / {len(repos)}')
t0lines.append(f'- **All Tier-0 gates must be PASS for merge.**')
t0lines.append(f'- **Action:** Run `cargo build && cargo test && cargo fmt --check && cargo clippy` on failing repos.')
with open(os.path.join(docs_dir, 'tier-0.md'), 'w') as fp:
    fp.write('\\n'.join(t0lines))
print('Written docs/grades/tier-0.md')

# =============================================
# docs/grades/tier-1.md
# =============================================
t1lines = ['# Tier-1 Security Gate Status\\n']
t1lines.append('> Tier-1 gates: **security scan** (cargo audit / npm audit / trufflehog), **SBOM** produced, **LICENSE** present, **CHANGELOG** updated.\\n')
t1lines.append('These gates must pass before merging to main.\\n')
t1lines.append('## Per-Repro Tier-1 Status\\n')
t1lines.append('| Repo | audit/security | deny | Status |')
t1lines.append('|------|----------------|------|--------|')
t1_pass_count = 0
for r in repos:
    c = {x['name']:x['status'] for x in r.get('checks',[])}
    aud = c.get('audit', c.get('security', 'N/A'))
    deny = c.get('deny', 'N/A')
    t1ok = aud == 'pass'
    if t1ok: t1_pass_count += 1
    status = 'PASS' if t1ok else ('SKIP' if aud=='skipped' else 'FAIL')
    t1lines.append(f'| {r[\"project\"]} | {aud} | {deny} | {status} |')
t1lines.append('')
t1lines.append(f'## Gate Summary\\n')
t1lines.append(f'- **Repos passing Tier-1 (audit):** {t1_pass_count} / {len(repos)}')
t1lines.append(f'- **Next steps for failing repos:**')
t1lines.append(f'  1. Run `cargo audit` (Rust) or `npm audit` (Node) to identify CVEs')
t1lines.append(f'  2. Run `cargo deny check` to verify license/ban policy')
t1lines.append(f'  3. Ensure SBOM is produced on release (CycloneDX)')
t1lines.append(f'  4. Verify Apache-2.0 OR MIT LICENSE file exists')
t1lines.append(f'  5. Ensure CHANGELOG is updated for the release')
with open(os.path.join(docs_dir, 'tier-1.md'), 'w') as fp:
    fp.write('\\n'.join(t1lines))
print('Written docs/grades/tier-1.md')

print('\\nAll docs/grades/ pages regenerated.')
"

# Cleanup
rm -f "$DASHBOARD_DIR/_repos.json"

echo ""
echo "============================================"
echo "  Dashboard render complete!"
echo "  - dashboard/index.html"
echo "  - dashboard/cross-repo-summary.json"
echo "  - docs/grades/README.md"
echo "  - docs/grades/pillar-trends.md"
echo "  - docs/grades/per-repo.md"
echo "  - docs/grades/tier-0.md"
echo "  - docs/grades/tier-1.md"
echo "============================================"
