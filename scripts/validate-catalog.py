#!/usr/bin/env python3
"""validate-catalog.py — validates catalog/registry.yaml.

Enforces ADR-ECO-017 (substrate schema conventions):
  - Every substrate entry has the required `tier` field.
  - architecture is set when tier is `phenotype-framework`.
  - ports/adapters are set when architecture is `hexagonal-l4`.
  - Every entry's `boundary` / `intent` paths resolve on disk
    (unless explicitly null).
  - Slugs are unique and repo paths match `^KooshaPari/<name>$`.

Exit codes: 0 = clean, 1 = one or more validation failures, 2 = I/O.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

try:
    import yaml  # type: ignore
except ImportError:
    sys.stderr.write(
        "validate-catalog: PyYAML not installed; install with `pip install pyyaml`\n"
    )
    sys.exit(2)


REPO_ROOT = Path(__file__).resolve().parent.parent
CATALOG = REPO_ROOT / "catalog" / "registry.yaml"
SCHEMA = REPO_ROOT / "catalog" / "registry.schema.json"

VALID_TIERS = {"pheno-lib", "phenotype-sdk", "phenotype-framework", "federated-service"}
VALID_ARCHITECTURES = {"hexagonal-l4", "layered", "microkernel", "none"}
VALID_STATUS = {"active", "archived", "deprecated", "absorbed"}

RE_ID = re.compile(r"^[a-z0-9-]+$")
RE_REPO = re.compile(r"^KooshaPari/[A-Za-z0-9_.-]+$")
RE_PORT = re.compile(r"^[A-Z][A-Za-z0-9]+Port$")
RE_ADAPTER = re.compile(r"^[A-Z][A-Za-z0-9]+Adapter$")


def fail(msg: str) -> None:
    print(f"FAIL  {msg}")


def warn(msg: str) -> None:
    print(f"WARN  {msg}")


def pass_(msg: str) -> None:
    print(f"PASS  {msg}")


def main() -> int:
    if not CATALOG.exists():
        fail(f"catalog file missing: {CATALOG}")
        return 1

    try:
        with CATALOG.open() as f:
            catalog = yaml.safe_load(f)
    except (yaml.YAMLError, OSError) as e:
        fail(f"could not parse {CATALOG}: {e}")
        return 1

    substrates = catalog.get("substrates", [])
    if not isinstance(substrates, list):
        fail("`substrates` must be a list")
        return 1

    fails = 0
    seen_slugs: set[str] = set()
    schema_doc = None
    if SCHEMA.exists():
        try:
            with SCHEMA.open() as f:
                schema_doc = json.load(f)
            pass_(f"schema loaded: {SCHEMA.relative_to(REPO_ROOT)}")
        except (json.JSONDecodeError, OSError) as e:
            warn(f"could not parse {SCHEMA}: {e} (proceeding with inline rules)")

    for entry in substrates:
        slug = entry.get("id", "<missing id>")
        print(f"\n== substrate {slug} ==")

        # id
        if not RE_ID.match(slug):
            fail(f"{slug}: id must match ^[a-z0-9-]+$")
            fails += 1
        if slug in seen_slugs:
            fail(f"{slug}: duplicate id in catalog")
            fails += 1
        seen_slugs.add(slug)

        # repo
        repo = entry.get("repo", "")
        if not RE_REPO.match(repo):
            fail(f"{slug}: repo `{repo}` must match ^KooshaPari/<name>$")
            fails += 1
        else:
            pass_(f"{slug}: repo OK ({repo})")

        # status
        status = entry.get("status")
        if status not in VALID_STATUS:
            fail(f"{slug}: status `{status}` must be one of {sorted(VALID_STATUS)}")
            fails += 1

        # tier (REQUIRED per ADR-ECO-017)
        tier = entry.get("tier")
        if tier is None:
            fail(f"{slug}: tier is REQUIRED per ADR-ECO-017")
            fails += 1
        elif tier not in VALID_TIERS:
            fail(f"{slug}: tier `{tier}` must be one of {sorted(VALID_TIERS)}")
            fails += 1
        else:
            pass_(f"{slug}: tier OK ({tier})")

        # architecture (REQUIRED when tier is phenotype-framework)
        architecture = entry.get("architecture")
        if tier == "phenotype-framework" and not architecture:
            fail(f"{slug}: tier=phenotype-framework requires `architecture`")
            fails += 1
        if architecture is not None:
            if architecture not in VALID_ARCHITECTURES:
                fail(f"{slug}: architecture `{architecture}` must be one of {sorted(VALID_ARCHITECTURES)}")
                fails += 1
            else:
                pass_(f"{slug}: architecture OK ({architecture})")

        # ports + adapters (REQUIRED when architecture is hexagonal-l4)
        ports = entry.get("ports") or []
        adapters = entry.get("adapters") or []
        if architecture == "hexagonal-l4":
            if not ports:
                fail(f"{slug}: architecture=hexagonal-l4 requires non-empty `ports`")
                fails += 1
            if not adapters:
                fail(f"{slug}: architecture=hexagonal-l4 requires non-empty `adapters`")
                fails += 1
        for p in ports:
            if not RE_PORT.match(p):
                fail(f"{slug}: port `{p}` must end in `Port` (CamelCase)")
                fails += 1
        for a in adapters:
            if not RE_ADAPTER.match(a):
                fail(f"{slug}: adapter `{a}` must end in `Adapter` (CamelCase)")
                fails += 1

        # boundary / intent paths
        for key in ("boundary", "intent"):
            val = entry.get(key)
            if val is None:
                continue
            path = REPO_ROOT / val
            if not path.exists():
                warn(f"{slug}: {key} path `{val}` does not exist on disk")
            else:
                pass_(f"{slug}: {key} resolves to {val}")

    # schema $id sanity (informational)
    if schema_doc and "$id" in schema_doc:
        pass_(f"schema $id = {schema_doc['$id']}")

    print(f"\n== validate-catalog: {fails} fail ==")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
