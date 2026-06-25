#!/usr/bin/env python3
"""
Add ECO-018..022 cross-references to all 8 absorption audit files.

Each audit gets a "## Authoritative Org ADRs" block inserted after the
source repo header (before the first `## Source` section), with the
upstream ADRs that govern the cluster decisions.
"""
import os
import re
import sys
from pathlib import Path

AUDIT_DIR = Path(r"C:\Users\koosh\phenotype-registry\audits\absorption-justifications")

# Per-audit ECO cross-references (only the ADRs that govern each cluster member)
ECO_BLOCKS = {
    "BytePort": """## Authoritative Org ADRs (Upstream Cross-Reference)

| ADR | Title | Authority |
|---|---|---|
| ECO-020 | BytePort hygiene + security | [origin/main:docs/adrs/ADR-ECO-020-byteport-hygiene-security.md](https://github.com/KooshaPari/phenotype-registry/blob/main/docs/adrs/ADR-ECO-020-byteport-hygiene-security.md) — 2026-06-23 |
| ECO-022 | Compute/infra subtree registry correction | [origin/main:docs/adrs/ADR-ECO-022-compute-infra-subtree-registry-correction.md](https://github.com/KooshaPari/phenotype-registry/blob/main/docs/adrs/ADR-ECO-022-compute-infra-subtree-registry-correction.md) — 2026-06-23 |

Cluster spine: `docs/compute-infra-subtree.md` on origin/main (9.1 KB, authoritative).
""",
    "McpKit": """## Authoritative Org ADRs (Upstream Cross-Reference)

| ADR | Title | Authority |
|---|---|---|
| sr-mcpkit | SUPERSEDE -> PhenoFastMCP+PhenoMCPServers+substrate | registry/disposition-index.json:866 (done 2026-06-18) |
| sr-phenotype-ops-mcp | RETIRE -> PhenoMCPServers | registry/disposition-index.json:854 (done 2026-06-19) |
| L5-104 | Bulk Rust/TS migration dispatch | findings/2026-06-17-L5-104-bulk-rust-ts-migration.md (closed 2026-06-17) |
""",
    "go-nippon": """## Authoritative Org ADRs (Upstream Cross-Reference)

| ADR | Title | Authority |
|---|---|---|
| (none) | no live ADR — 0-LOC repo archived as scaffold-only | registry/disposition-index.json (row `repo-go-nippon-archive-only`) |

Retroactive ABSORPTION.md: `KooshaPari/phenotype-tooling/docs/absorbed-from-go-nippon/ABSORPTION.md` on origin (commit `e23873c`).
""",
    "nanovms": """## Authoritative Org ADRs (Upstream Cross-Reference)

| ADR | Title | Authority |
|---|---|---|
| ECO-019 | nanovms sandbox hardening | [origin/main:docs/adrs/ADR-ECO-019-nanovms-sandbox-hardening.md](https://github.com/KooshaPari/phenotype-registry/blob/main/docs/adrs/ADR-ECO-019-nanovms-sandbox-hardening.md) — 2026-06-23 |
| ECO-022 | Compute/infra subtree registry correction | [origin/main:docs/adrs/ADR-ECO-022-compute-infra-subtree-registry-correction.md](https://github.com/KooshaPari/phenotype-registry/blob/main/docs/adrs/ADR-ECO-022-compute-infra-subtree-registry-correction.md) — 2026-06-23 |

Cluster spine: `docs/compute-infra-subtree.md` on origin/main.
""",
    "phenocompose": """## Authoritative Org ADRs (Upstream Cross-Reference)

| ADR | Title | Authority |
|---|---|---|
| ECO-021 | PhenoCompose dead-cuda feature | [origin/main:docs/adrs/ADR-ECO-021-phenocompose-dead-cuda-feature.md](https://github.com/KooshaPari/phenotype-registry/blob/main/docs/adrs/ADR-ECO-021-phenocompose-dead-cuda-feature.md) — 2026-06-23 |
| ECO-022 | Compute/infra subtree registry correction | [origin/main:docs/adrs/ADR-ECO-022-compute-infra-subtree-registry-correction.md](https://github.com/KooshaPari/phenotype-registry/blob/main/docs/adrs/ADR-ECO-022-compute-infra-subtree-registry-correction.md) — 2026-06-23 |

Cluster spine: `docs/compute-infra-subtree.md` on origin/main.
""",
    "phenotype-go-sdk": """## Authoritative Org ADRs (Upstream Cross-Reference)

| ADR | Title | Authority |
|---|---|---|
| ADR-017 | McpKit retires (Go SDK inherits) | (note: ADR-017 cited in 2026-06-24 PR #365 ecosystem map) |
| sr-mcpkit | SUPERSEDE -> PhenoFastMCP+PhenoMCPServers+substrate | registry/disposition-index.json:866 |

Cluster spine: `docs/compute-infra-subtree.md` on origin/main (phenotype-go-sdk folded into substrate via ADR-017).
""",
    "phenotype-infra": """## Authoritative Org ADRs (Upstream Cross-Reference)

| ADR | Title | Authority |
|---|---|---|
| ECO-018 | phenotype-infra path-dep hygiene | [origin/main:docs/adrs/ADR-ECO-018-phenotype-infra-path-dep-hygiene.md](https://github.com/KooshaPari/phenotype-registry/blob/main/docs/adrs/ADR-ECO-018-phenotype-infra-path-dep-hygiene.md) — 2026-06-23 |
| ECO-022 | Compute/infra subtree registry correction | [origin/main:docs/adrs/ADR-ECO-022-compute-infra-subtree-registry-correction.md](https://github.com/KooshaPari/phenotype-registry/blob/main/docs/adrs/ADR-ECO-022-compute-infra-subtree-registry-correction.md) — 2026-06-23 |

Cluster spine: `docs/compute-infra-subtree.md` on origin/main (9.1 KB, authoritative).
""",
    "smart-mcp-go": """## Authoritative Org ADRs (Upstream Cross-Reference)

| ADR | Title | Authority |
|---|---|---|
| (none) | no live ADR — empty 0-LOC scaffold repo | registry/disposition-index.json (row `repo-smart-mcp-go-no-merit`) |

Retroactive ABSORPTION.md: `KooshaPari/phenotype-tooling/docs/absorbed-from-smart-mcp-go/ABSORPTION.md` on origin (commit `e23873c`).
""",
}

# Anchor: insert before the first occurrence of `## Source` or `## Status` after the frontmatter
INSERTION_MARKER = re.compile(r"^## (Source|Status)\b", re.MULTILINE)


def find_audit_files() -> list[Path]:
    files = sorted(AUDIT_DIR.glob("*-2026-06-23.md"))
    # Match by stem prefix
    return files


def extract_key(path: Path) -> str:
    """Extract the repo name key from the audit filename stem."""
    return path.stem.replace("-2026-06-23", "")


def main() -> int:
    if not AUDIT_DIR.is_dir():
        print(f"FATAL: audit dir not found: {AUDIT_DIR}", file=sys.stderr)
        return 2

    files = find_audit_files()
    if not files:
        print("FATAL: no audit files found", file=sys.stderr)
        return 2

    updated = 0
    skipped = 0

    for path in files:
        key = extract_key(path)
        if key not in ECO_BLOCKS:
            print(f"  [SKIP] {path.name} (no ECO block defined for key {key!r})")
            skipped += 1
            continue

        text = path.read_text(encoding="utf-8")
        if "## Authoritative Org ADRs" in text:
            print(f"  [ALREADY] {path.name} — has ECO block")
            continue

        # Find first `## Source` or `## Status` heading
        match = INSERTION_MARKER.search(text)
        if not match:
            print(f"  [WARN] {path.name} — no ## Source/## Status anchor; appending at end")
            new_text = text.rstrip() + "\n\n" + ECO_BLOCKS[key]
        else:
            insertion_point = match.start()
            new_text = text[:insertion_point] + ECO_BLOCKS[key] + "\n" + text[insertion_point:]

        path.write_text(new_text, encoding="utf-8")
        updated += 1
        print(f"  [OK] {path.name} — ECO block inserted")

    print()
    print(f"Done: {updated} updated, {skipped} skipped, {len(files)} total")
    return 0


if __name__ == "__main__":
    sys.exit(main())
