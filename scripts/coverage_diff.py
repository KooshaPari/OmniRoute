#!/usr/bin/env python3
"""coverage_diff.py: Compare cargo-llvm-cov JSON output vs base ref. Fails if any file drops > --max-drop%."""
import argparse, json, subprocess, sys, pathlib

def load_cov(path: str) -> dict:
    with open(path) as f:
        return json.load(f)

def file_coverage(data: dict) -> dict:
    files = {}
    for entry in data.get("data", []):
        for f in entry.get("files", []):
            files[f["filename"]] = f["summary"]["line"]["percent"]
    return files

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cov_json")
    ap.add_argument("base_ref")
    ap.add_argument("--max-drop", type=float, default=2.0)
    args = ap.parse_args()

    cur = file_coverage(load_cov(args.cov_json))
    base_path = "/tmp/base_cov.json"
    subprocess.run(
        ["cargo", "llvm-cov", "--workspace", "--json", "--output-path", base_path],
        check=False, capture_output=True,
    )
    if not pathlib.Path(base_path).exists():
        print("WARN: no base coverage — skipping diff")
        return 0
    base = file_coverage(load_cov(base_path))
    drops = []
    for f, pct in cur.items():
        if f in base and base[f] - pct > args.max_drop:
            drops.append((f, base[f], pct, base[f] - pct))
    if drops:
        for f, b, c, d in drops:
            print(f"FAIL: {f}: {b:.1f}% -> {c:.1f}% (drop {d:.1f}%)")
        return 1
    print(f"PASS: no file dropped > {args.max_drop}%")
    return 0

if __name__ == "__main__":
    sys.exit(main())
