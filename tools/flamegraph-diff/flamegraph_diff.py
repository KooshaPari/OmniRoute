#!/usr/bin/env python3
"""T2 (L44.1) — Flamegraph profiler fleet diff.

Compare flamegraph SVGs between baseline and current runs.
Reports hot-spot changes >5% relative time.
"""
import sys, json, re, pathlib

def parse_flamegraph(svg_path: str) -> dict:
    """Extract (function, pct) pairs from a flamegraph SVG."""
    result = {}
    text = pathlib.Path(svg_path).read_text()
    for match in re.finditer(r'<title>([^<]+)</title>', text):
        parts = match.group(1).rsplit(' ', 1)
        if len(parts) == 2 and parts[1].endswith('%'):
            name = parts[0].strip()
            pct = float(parts[1].rstrip('%'))
            result[name] = pct
    return result

def main():
    baseline_path = sys.argv[1] if len(sys.argv) > 1 else 'benchmarks/flamegraph/flamegraph-baseline.svg'
    current_path = sys.argv[2] if len(sys.argv) > 2 else 'benchmarks/flamegraph/flamegraph-current.svg'

    base = parse_flamegraph(baseline_path)
    curr = parse_flamegraph(current_path)

    print("=== Flamegraph Diff (Hotspots with >5% change) ===")
    changed = False
    for name, pct in sorted(curr.items(), key=lambda x: -x[1]):
        base_pct = base.get(name, 0.0)
        if abs(pct - base_pct) > 5.0:
            direction = "↑" if pct > base_pct else "↓"
            print(f"  {direction} {name:60s} {base_pct:5.1f}% → {pct:5.1f}% ({pct - base_pct:+.1f}%)")
            changed = True
    if not changed:
        print("  No hotspots exceeded 5% drift threshold.")
    return 0 if not changed else 1

if __name__ == "__main__":
    sys.exit(main())
