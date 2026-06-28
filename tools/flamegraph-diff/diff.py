#!/usr/bin/env python3
"""L44.1 flamegraph-diff — compares two flamegraph stacks and reports differences.

Useful for CI: takes a before/after collapsed stack file and produces a
structured diff showing which frames regressed.
"""
from __future__ import annotations

import argparse
import sys
from collections import defaultdict
from pathlib import Path


def load_stacks(path: Path) -> dict[str, float]:
    stacks: dict[str, float] = {}
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or "\t" not in line:
            continue
        stack, count_s = line.rsplit("\t", 1)
        try:
            stacks[stack] = float(count_s)
        except ValueError:
            continue
    return stacks


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("before", type=Path)
    ap.add_argument("after", type=Path)
    ap.add_argument("--threshold", type=float, default=5.0,
                    help="Minimum % change to report (default: 5.0)")
    args = ap.parse_args()

    before = load_stacks(args.before)
    after = load_stacks(args.after)

    all_frames = set(before) | set(after)
    diffs = []
    for frame in sorted(all_frames):
        b = before.get(frame, 0.0)
        a = after.get(frame, 0.0)
        if b == 0 and a > 0:
            pct = 100.0
        elif a == 0 and b > 0:
            pct = -100.0
        else:
            pct = ((a - b) / b) * 100 if b > 0 else 0.0
        tokens = frame.split(";")[-3:]  # last 3 frames for readability
        short = ";".join(tokens)
        if abs(pct) >= args.threshold:
            diffs.append((pct, short, b, a))

    print(f"# Flamegraph Diff: {args.before.name} → {args.after.name}")
    print()
    print(f"Threshold: >= {args.threshold}% change")
    print(f"Total unique frames: {len(all_frames)}")
    print(f"Regressed frames: {len(diffs)}")
    print()
    print("| % Change | Frame | Before | After |")
    print("|----------|-------|--------|-------|")
    for pct, short, b, a in sorted(diffs, reverse=True):
        pct_s = f"{pct:+.1f}%"
        print(f"| {pct_s} | `{short}` | {b:.0f} | {a:.0f} |")

    return 0 if len(diffs) == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
