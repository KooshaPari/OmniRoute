#!/usr/bin/env python3
"""release_coord.py: Produce ordered release plan for a fleet of repos."""
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


if __name__ == "__main__":
    sys.exit(main())
