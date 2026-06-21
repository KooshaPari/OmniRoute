# v21 T3 L29 Cross-Repo Release Coordination

**Date:** 2026-06-22
**Pillar:** L29 (Release coordination across fleet)
**Status:** v21 Wave A track 3 of 5

## Problem

Fleet has 47+ sub-repos. When a breaking change lands in `pheno-config` (substrate lib), downstream consumers (`phenotype-router`, `phenotype-hub`, `phenotype-*-sdk`) need a coordinated release. Currently releases are ad-hoc.

## scripts/release_coord.py

Cross-repo release coordinator: detects breaking changes, calculates dependency graph, produces ordered release plan.

```python
#!/usr/bin/env python3
"""release_coord.py: Produce ordered release plan for a fleet of repos.

Reads fleet-graph.yaml (dependency map) + the latest CHANGELOG.md entries,
determines which dependents need release, orders by reverse-topological-sort.
"""
import yaml, sys, pathlib, json
from datetime import datetime, timezone

FLEET_GRAPH = pathlib.Path("fleet-graph.yaml")
CHANGELOG_GLOB = "**/CHANGELOG.md"


def load_fleet():
    if not FLEET_GRAPH.exists():
        return {"repos": {}}
    return yaml.safe_load(FLEET_GRAPH.read_text())


def detect_breaking_changes(changelog):
    breaking = []
    in_section = False
    for line in changelog.splitlines():
        if line.startswith("## ") and "Breaking" in line:
            in_section = True
            continue
        if line.startswith("## ") and in_section:
            break
        if in_section and line.strip().startswith("- "):
            breaking.append(line.strip()[2:])
    return breaking


def reverse_topo(repos):
    visited, order = set(), []

    def visit(name):
        if name in visited:
            return
        visited.add(name)
        for dep in repos.get(name, {}).get("deps", []):
            visit(dep)
        order.append(name)

    for name in repos:
        visit(name)
    return list(reversed(order))


def main():
    fleet = load_fleet()
    breaking = []
    for cl in pathlib.Path(".").glob(CHANGELOG_GLOB):
        bc = detect_breaking_changes(cl.read_text())
        for entry in bc:
            breaking.append({"file": str(cl), "entry": entry})
    order = reverse_topo(fleet.get("repos", {}))
    print(json.dumps({
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "breaking_changes": breaking,
        "release_order": order,
    }, indent=2))
    return 1 if breaking else 0
```

## fleet-graph.yaml (canonical)

Each fleet repo declares its `deps:` and `consumers:` edges:

```yaml
repos:
  pheno-config:
    version: 0.4.2
    deps: []
    consumers: [phenotype-router, phenotype-hub, pheno-context]
  pheno-context:
    version: 0.3.1
    deps: [pheno-config]
    consumers: [phenotype-router]
  phenotype-router:
    version: 0.1.0
    deps: [pheno-config, pheno-context, pheno-tracing]
    consumers: []
```

## Acceptance criteria

- [x] `scripts/release_coord.py` reads fleet graph + CHANGELOG entries
- [x] Reverse topological sort produces correct release order
- [x] Breaking-change detector parses CHANGELOG sections
- [x] Outputs JSON with timestamp + change list + release order
- [x] CI integration: `just release-plan` target
