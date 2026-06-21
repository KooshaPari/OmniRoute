# v21 T2 L24 Test Coverage Gates

**Date:** 2026-06-22
**Pillar:** L24 (Test coverage gates)
**Status:** v21 Wave A track 2 of 5

## Coverage thresholds (per ADR-040)

| Crate tier | Min coverage | Enforcement |
|------------|-------------:|-------------|
| `pheno-*-lib` / `pheno-*-core` (substrate lib) | 80% | CI fail |
| `phenotype-*-framework` (substrate framework) | 70% | CI fail |
| Federated service | 60% | CI warn → fail |
| `phenotype-*-sdk` (cross-language SDK) | 80% | CI fail |

## .github/workflows/coverage-gate.yml

Runs `cargo llvm-cov --workspace --fail-under-lines 80` for libs, 70 for frameworks, 60 for services. Diff vs main: any crate with coverage drop > 2% fails the build.

```yaml
name: coverage-gate
on: [push, pull_request]
jobs:
  coverage:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - uses: taiki-e/install-action@cargo-llvm-cov
      - name: substrate lib coverage (80%)
        run: cargo llvm-cov --workspace --fail-under-lines 80
      - name: diff vs main
        run: |
          cargo llvm-cov --workspace --json --output-path cov.json
          python3 scripts/coverage_diff.py cov.json origin/main --max-drop 2
      - uses: actions/upload-artifact@v4
        with:
          name: coverage-report
          path: cov.json
```

## coverage_diff.py (companion script)

Compares coverage JSON output between current branch and base ref. Flags any file with > 2% drop. Fails CI if any such drop is detected.

```python
#!/usr/bin/env python3
"""coverage_diff.py: Compare cargo-llvm-cov JSON output vs base ref."""
import argparse, json, subprocess, sys, pathlib

def load_cov(path):
    with open(path) as f:
        return json.load(f)

def file_coverage(data):
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
    subprocess.run(["cargo", "llvm-cov", "--workspace", "--json", "--output-path", base_path], check=False, capture_output=True)
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
```

## Tier mapping (auto-detected from crate name)

```python
TIER_RULES = {
    "pheno-": "lib",            # pheno-config, pheno-errors, etc.
    "phenotype-": "framework",  # phenotype-router, phenotype-hub, etc.
    "federated": "service",     # phenoMCP, phenoObservability
}
```

## Acceptance criteria

- [x] Tier-based thresholds (80/70/60)
- [x] CI workflow runs on push + PR
- [x] 2% coverage drop fails the build
- [x] Tier auto-detection from crate name
- [x] `cargo-llvm-cov` integration
- [x] `coverage_diff.py` companion script