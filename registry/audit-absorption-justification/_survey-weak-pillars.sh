#!/bin/bash
# Quick P2/P3/P4 weak-pillar survey across all 8 audits
AUDIT_DIR=/mnt/c/Users/koosh/phenotype-registry/audits/absorption-justifications

for f in $AUDIT_DIR/*-2026-06-23.md; do
    name=$(basename "$f" .md)
    echo "=== $name ==="

    # P2: count rows with citation in tables containing 'Target Evidence'
    p2_cited=$(awk '/^\|/ {in_table=1; next} in_table && /^$/ {in_table=0} in_table' "$f" \
        | awk -F'|' '{
            for (i=1; i<=NF; i++) {
                cell=$i; gsub(/^ +| +$/, "", cell)
                if (cell ~ /[A-Za-z0-9_.\/-]+\.[A-Za-z0-9]+:[0-9]+/ \
                 || cell ~ /[0-9a-f]{7,40}/ \
                 || cell ~ /[A-Za-z0-9_.\/-]+\.(rs|ts|py|sh|md|json|toml|ps1|js|go|cs)([^A-Za-z0-9]|$)/) {
                    print "CITE"; next
                }
            }
        }' | wc -l)
    echo "  P2 cited-rows: $p2_cited (need >=5 for pass, >=1 for partial)"

    # P3: count branch-like rows
    p3_rows=$(grep -ciE '^\|[[:space:]]*[A-Za-z0-9_.-]+(/[A-Za-z0-9_.-]+)+' "$f" 2>/dev/null || echo 0)
    echo "  P3 branch-rows: $p3_rows (need >=3 for pass)"

    # P4: count rebuttal markers
    rebuttals=0
    grep -qiE 'Rebuttal|rebuttal:|Rebutted' "$f" 2>/dev/null && rebuttals=$((rebuttals + 1))
    prose=$(grep -ciE '\b(however|nonetheless|nevertheless|unresolved|outstanding|trade-?off|residual|remain[s]?)\b' "$f" 2>/dev/null | head -1 | tr -d ' \n\r' || echo 0)
    prose=${prose:-0}
    if [[ $prose -ge 1 ]]; then rebuttals=$((rebuttals + 1)); fi
    absorb=$(grep -ciE 'not[[:space:]]+absorb|cannot[[:space:]]+absorb|can.t[[:space:]]+absorb' "$f" 2>/dev/null | head -1 | tr -d ' \n\r' || echo 0)
    absorb=${absorb:-0}
    if [[ $absorb -ge 1 ]]; then rebuttals=$((rebuttals + 1)); fi
    echo "  P4 rebuttals: $rebuttals (need >=3 for pass; currently: Rebuttal-marker=$((rebuttals>0?1:0)) prose-hits=$prose absorb-hits=$absorb)"
done
