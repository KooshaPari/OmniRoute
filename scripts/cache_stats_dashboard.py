#!/usr/bin/env python3
"""scripts/cache_stats_dashboard.py — v15 L31 cache-stats dashboard viewer.

Aggregates per-repo cache-stats JSON (as emitted by
scripts/cache_stats_wrapper.sh) and prints a human-readable dashboard
summary: hit/miss counts, hit rate, fleet-wide totals, and tier
classification (good / warn / bad).

Input formats accepted (auto-detected):
  1. Single JSON object:  {"repo": "...", "hit_count": N, "miss_count": M, "hit_rate": 0.0..1.0}
  2. JSON array of (1):  [ { ... }, { ... }, ... ]
  3. JSONL:               one (1) per line
  4. Aggregated (1) with nested per-repo: {"fleet": {repo: stats, ...}, "totals": {...}}

Usage:
  python3 scripts/cache_stats_dashboard.py --input stats.json
  python3 scripts/cache_stats_dashboard.py --input stats.jsonl
  cat stats.json | python3 scripts/cache_stats_dashboard.py
  python3 scripts/cache_stats_dashboard.py --input cache_stats_pages.json --tier-good 0.85 --tier-warn 0.60
  python3 scripts/cache_stats_dashboard.py --markdown                  # emit markdown table

Tier classification (per L31 budget table in perf-budgets.toml):
  good  : hit_rate >= tier_good  (default 0.85)
  warn  : hit_rate >= tier_warn  (default 0.60)
  bad   : hit_rate <  tier_warn
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Iterable


# ---------------------------------------------------------------------------
# I/O
# ---------------------------------------------------------------------------

def load_records(path: Path | None) -> list[dict]:
    """Load cache-stats records from a file path or stdin.

    Auto-detects single JSON object, JSON array, JSONL, or the aggregated
    shape emitted by `.github/workflows/cache-stats-pages.yml`.
    """
    if path is None or str(path) == "-":
        text = sys.stdin.read()
    else:
        text = path.read_text(encoding="utf-8")

    text = text.strip()
    if not text:
        return []

    # Try single JSON object first.
    try:
        obj = json.loads(text)
    except json.JSONDecodeError:
        # Fallback: JSONL.
        records = []
        for line in text.splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                records.append(json.loads(line))
            except json.JSONDecodeError as exc:
                print(f"WARN: skipping malformed line: {exc}", file=sys.stderr)
        return records

    # Unwrap the aggregated `cache-stats-pages.yml` shape if present.
    if isinstance(obj, dict) and "fleet" in obj and isinstance(obj["fleet"], dict):
        return [
            {"repo": repo, **stats}
            for repo, stats in obj["fleet"].items()
            if isinstance(stats, dict)
        ]
    if isinstance(obj, list):
        return obj
    return [obj]


# ---------------------------------------------------------------------------
# Aggregation
# ---------------------------------------------------------------------------

def fleet_totals(records: list[dict]) -> dict:
    hits = sum(int(r.get("hit_count", 0)) for r in records)
    misses = sum(int(r.get("miss_count", 0)) for r in records)
    total = hits + misses
    rate = (hits / total) if total > 0 else 0.0
    return {
        "repos": len(records),
        "hit_count": hits,
        "miss_count": misses,
        "total": total,
        "hit_rate": round(rate, 4),
    }


def classify(rate: float, tier_good: float, tier_warn: float) -> str:
    if rate >= tier_good:
        return "good"
    if rate >= tier_warn:
        return "warn"
    return "bad"


# ---------------------------------------------------------------------------
# Renderers
# ---------------------------------------------------------------------------

ANSI = {
    "good": "\033[1;32m",
    "warn": "\033[1;33m",
    "bad":  "\033[1;31m",
    "reset": "\033[0m",
    "bold": "\033[1m",
    "dim": "\033[2m",
}


def render_text(records: list[dict], totals: dict, tier_good: float, tier_warn: float, use_color: bool) -> str:
    out = []
    out.append("═══════════════════════════════════════════════════════════")
    out.append("  Cache Stats Dashboard (L31)")
    out.append("═══════════════════════════════════════════════════════════")
    out.append(f"  Repos: {totals['repos']}")
    out.append(f"  Hits:  {totals['hit_count']}")
    out.append(f"  Miss:  {totals['miss_count']}")
    out.append(f"  Total: {totals['total']}")
    out.append(f"  Fleet hit rate: {totals['hit_rate']:.1%}")
    out.append("")
    out.append("  Per-repo:")
    out.append("  " + "─" * 55)
    out.append(f"  {'repo':<32} {'hits':>6} {'misses':>7} {'rate':>7}  tier")
    out.append("  " + "─" * 55)

    # Sort: bad first (so they stand out), then warn, then good.
    severity = {"bad": 0, "warn": 1, "good": 2}
    sorted_records = sorted(
        records,
        key=lambda r: (
            severity[classify(float(r.get("hit_rate", 0.0)), tier_good, tier_warn)],
            -(float(r.get("hit_rate", 0.0))),
            str(r.get("repo", "")),
        ),
    )

    for r in sorted_records:
        repo = str(r.get("repo", "<unknown>"))
        hits = int(r.get("hit_count", 0))
        misses = int(r.get("miss_count", 0))
        rate = float(r.get("hit_rate", 0.0))
        tier = classify(rate, tier_good, tier_warn)
        color = ANSI[tier] if use_color else ""
        reset = ANSI["reset"] if use_color else ""
        out.append(
            f"  {repo:<32} {hits:>6} {misses:>7} {rate:>6.1%}  {color}{tier}{reset}"
        )

    out.append("  " + "─" * 55)
    out.append("")
    out.append(f"  Tiers: good >= {tier_good:.0%}, warn >= {tier_warn:.0%}, bad < {tier_warn:.0%}")
    return "\n".join(out)


def render_markdown(records: list[dict], totals: dict, tier_good: float, tier_warn: float) -> str:
    out = []
    out.append("# Cache Stats Dashboard (L31)")
    out.append("")
    out.append(f"- **Repos:** {totals['repos']}")
    out.append(f"- **Hits:** {totals['hit_count']}")
    out.append(f"- **Misses:** {totals['miss_count']}")
    out.append(f"- **Total:** {totals['total']}")
    out.append(f"- **Fleet hit rate:** {totals['hit_rate']:.1%}")
    out.append("")
    out.append("## Per-repo")
    out.append("")
    out.append("| repo | hits | misses | rate | tier |")
    out.append("|---|---:|---:|---:|:--:|")
    for r in records:
        repo = r.get("repo", "<unknown>")
        hits = int(r.get("hit_count", 0))
        misses = int(r.get("miss_count", 0))
        rate = float(r.get("hit_rate", 0.0))
        tier = classify(rate, tier_good, tier_warn)
        out.append(f"| `{repo}` | {hits} | {misses} | {rate:.1%} | {tier} |")
    out.append("")
    out.append(f"_Tiers: good >= {tier_good:.0%}, warn >= {tier_warn:.0%}, bad < {tier_warn:.0%}_")
    return "\n".join(out)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument(
        "--input", "-i",
        help="Path to a JSON/JSONL file (or '-' for stdin). If omitted, reads stdin.",
    )
    parser.add_argument(
        "--tier-good", type=float, default=0.85,
        help="Hit-rate threshold for 'good' tier (default 0.85).",
    )
    parser.add_argument(
        "--tier-warn", type=float, default=0.60,
        help="Hit-rate threshold for 'warn' tier (default 0.60).",
    )
    parser.add_argument(
        "--markdown", action="store_true",
        help="Emit a Markdown table instead of the text dashboard.",
    )
    parser.add_argument(
        "--no-color", action="store_true",
        help="Disable ANSI color codes.",
    )
    args = parser.parse_args(argv)

    path = Path(args.input) if args.input else None
    records = load_records(path)
    if not records:
        print("WARN: no records loaded", file=sys.stderr)

    totals = fleet_totals(records)
    if args.markdown:
        print(render_markdown(records, totals, args.tier_good, args.tier_warn))
    else:
        use_color = (not args.no_color) and sys.stdout.isatty()
        print(render_text(records, totals, args.tier_good, args.tier_warn, use_color))

    # Exit non-zero if any repo is in the bad tier — useful as a CI gate.
    bad = [r for r in records
           if classify(float(r.get("hit_rate", 0.0)), args.tier_good, args.tier_warn) == "bad"]
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
