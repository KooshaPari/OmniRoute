#!/usr/bin/env python3
"""T3 (L46.1) — SBOM drift CI gate.

Compares CycloneDX SBOMs between builds; fails if CRITICAL drift detected.
"""
import sys, json, pathlib

def load_sbom(path: str) -> dict:
    raw = json.loads(pathlib.Path(path).read_text())
    components = raw.get("components", []) if "components" in raw else raw.get("packages", [])
    return {c.get("bom-ref", c.get("name", "?")): c for c in components}

def main():
    prev_path = sys.argv[1] if len(sys.argv) > 1 else "sbom-prev.json"
    curr_path = sys.argv[2] if len(sys.argv) > 2 else "sbom-curr.json"
    threshold = float(sys.argv[3]) if len(sys.argv) > 3 else 0.05

    prev = load_sbom(prev_path)
    curr = load_sbom(curr_path)

    prev_names = set(c.get("name", "?") for c in prev.values())
    curr_names = set(c.get("name", "?") for c in curr.values())

    added = curr_names - prev_names
    removed = prev_names - curr_names

    print(f"=== SBOM Drift: {prev_path} -> {curr_path} ===")
    print(f"Previous: {len(prev_names)}  Current: {len(curr_names)}")

    drift_pct = (len(added) + len(removed)) / max(len(curr_names), 1)
    if added:
        print(f"ADDED ({len(added)}):  {', '.join(sorted(added)[:10])}...")
    if removed:
        print(f"REMOVED ({len(removed)}):  {', '.join(sorted(removed)[:10])}...")

    if drift_pct > threshold:
        print(f"CRITICAL: drift {drift_pct:.1%} exceeds threshold {threshold:.1%}. Fix SBOM before merge.")
        return 1
    print(f"PASS: drift {drift_pct:.1%} within threshold {threshold:.1%}.")
    return 0

if __name__ == "__main__":
    sys.exit(main())
