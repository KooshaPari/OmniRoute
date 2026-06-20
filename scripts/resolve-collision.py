#!/usr/bin/env python3
"""
resolve-collision.py
====================

Resolve repo-name collisions in _bindings.json.

For each non-canonical name (e.g. lowercase variant, archived repo, worktree
suffix), merge its records into the canonical name and delete the non-canonical
key. Also generates an alias map that documents every rename.

Usage:
    python3 resolve-collision.py [--dry-run]
"""
import json
import sys
import argparse
from pathlib import Path

BINDINGS_PATH = Path("_bindings.json")

# Each entry: non_canonical_name -> canonical_name
# None = drop (archived / deprecated / not a real repo)
ALIASES = {
    # === Case-only collisions (auto-detected) ===
    "agileplus": "AgilePlus",
    "byteport": "BytePort",
    "focalpoint": "FocalPoint",
    "phenokits": "PhenoKits",
    "phenoPlugins": "PhenoPlugins",
    "hwledger": "hwLedger",  # canonical is hwLedger (camelCase, not HwLedger)

    # === PhenoAgent family ===
    "PhenoAgent-1st": "PhenoAgent",
    "PhenoAgent-2nd": "PhenoAgent",
    "PhenoAgent-3rd": "PhenoAgent",
    "PhenoAgent-4th": "PhenoAgent",
    "PhenoAgent-5th": "PhenoAgent",
    "PhenoAgent-wtrees": "PhenoAgent",
    "PhenoAgent-cheap": "PhenoAgent",
    "PhenoAgent-cheap-mcp": "PhenoAgent",
    "PhenoAgent-cheap-mcp-deprecate": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-19": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-0": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-1": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-2": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-3": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-4": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-5": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-6": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-7": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-8": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-9": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-10": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-11": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-12": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-13": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-14": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-15": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-16": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-17": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-18": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-20": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-21": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-22": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-23": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-24": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-25": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-26": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-27": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-28": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-29": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-30": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-31": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-32": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-33": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-34": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-35": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-36": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-37": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-38": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-39": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-40": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-41": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-42": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-43": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-44": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-45": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-46": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-47": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-48": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-49": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-50": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-51": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-52": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-53": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-54": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-55": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-56": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-57": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-58": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-59": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-60": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-61": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-62": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-63": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-64": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-65": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-66": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-67": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-68": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-69": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-70": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-71": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-72": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-73": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-74": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-75": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-76": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-77": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-78": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-79": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-80": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-81": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-82": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-83": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-84": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-85": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-86": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-87": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-88": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-89": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-90": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-91": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-92": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-93": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-94": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-95": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-96": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-97": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-98": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-99": "PhenoAgent",
    "PhenoAgent-cheap-mcp-t1-100": "PhenoAgent",

    # === PhenoVCS family ===
    "PhenoVCS-3rd": "PhenoVCS",
    "PhenoVCS-4th": "PhenoVCS",
    "PhenoVCS-5th": "PhenoVCS",
    "PhenoVCS-6th-wt": "PhenoVCS",
    "PhenoVCS-hygiene": "PhenoVCS",
    "PhenoVCS-wtrees": "PhenoVCS",

    # === PhenoKits / PhenoProc / PhenoProject / PhenoRuntime / PhenoSchema ===
    "PhenoKits-wtrees": "PhenoKits",
    "PhenoProc-wtrees": "PhenoProc",
    "PhenoProject-wtrees": "PhenoProject",

    # === PhenoPlugins / PhenoHandbook / PhenoCompose / PhenoDevOps ===
    "PhenoPlugins-1st": "PhenoPlugins",
    "PhenoHandbook-wtrees": "PhenoHandbook",
    "phenodocs": "phenodocs",
    "phenodocs-wtrees": "phenodocs",

    # === PhenoAgent-mcp routing family ===
    "PhenoAgent-1st-wt-pr61": "PhenoAgent",
    "phenoAgent": "PhenoAgent",
    "phenotype-agent": "PhenoAgent",
    "pheno-agent": "PhenoAgent",

    # === TypeScript variant ===
    "phenoVibeproxy": "vibeproxy",  # phenoVibeproxy is archived; vibeproxy is canonical
    "phenotype-otel": "pheno-otel",  # lowercase is canonical
    "phenotype-otel-wt-SD1-005-2026-06-11": "pheno-otel",

    # === Tokn / HeliosCLI variants ===
    "Tokn-wt-pr61": "Tokn",
    "HeliosCLI-wtrees": "HeliosCLI",
    "helios-cli": "HeliosCLI",
    "heliosApp": "HeliosApp",
    "helioscope": "helioscope",
    "helioscope-wtrees": "helioscope",
    "heliosBench": "heliosBench",
    "helios-router": "helios-router",
    "helios-router-wtrees": "helios-router",

    # === Old "phenotype-*" → kebab-case "phenotype-*" — these are canonical ===
    "phenotype-auth-ts": "phenotype-auth-ts",
    "phenotype-bus": "phenotype-bus",
    "phenotype-dep-guard": "phenotype-dep-guard",
    "phenotype-e2e-base": "phenotype-e2e-base",
    "phenotype-errors": "phenotype-errors",
    "phenotype-go-sdk": "phenotype-go-sdk",
    "phenotype-go-sdk-wtrees": "phenotype-go-sdk",
    "phenotype-hub": "phenotype-hub",
    "phenotype-infra": "phenotype-infra",
    "phenotype-infrakit": "phenotype-infrakit",
    "phenotype-journeys": "phenotype-journeys",
    "phenotype-landing": "phenotype-landing",
    "phenotype-landing-wtrees": "phenotype-landing",
    "phenotype-mcp-sdk-cs": "phenotype-mcp-sdk-cs",
    "phenotype-mcp-sdk-go": "phenotype-mcp-sdk-go",
    "phenotype-mcp-sdk-py": "phenotype-mcp-sdk-py",
    "phenotype-mcp-sdk-ts": "phenotype-mcp-sdk-ts",
    "phenotype-omlx": "phenotype-omlx",
    "phenotype-omlx-wtrees": "phenotype-omlx",
    "phenotype-ops": "phenotype-ops",
    "phenotype-ops-mcp": "phenotype-ops-mcp",
    "phenotype-org-audits": "phenotype-org-audits",
    "phenotype-postfx": "phenotype-postfx",
    "phenotype-py-extras": "phenotype-py-extras",
    "phenotype-py-utils": "phenotype-py-utils",
    "phenotype-python-sdk": "phenotype-python-sdk",
    "phenotype-python-sdk-wtrees": "phenotype-python-sdk",
    "phenotype-registry": "phenotype-registry",  # source of truth
    "phenotype-registry-curation-data": "phenotype-registry",  # worktree
    "phenotype-registry-intent-bundle": "phenotype-registry",  # worktree
    "phenotype-registry-wtrees": "phenotype-registry",  # worktree
    "phenotype-request-id": "phenotype-request-id",
    "phenotype-teamcomm": "phenotype-teamcomm",
    "phenotype-teamcomm-wtrees": "phenotype-teamcomm",
    "phenotype-terrain": "phenotype-terrain",
    "phenotype-terrain-2nd": "phenotype-terrain",
    "phenotype-tooling": "phenotype-tooling",
    "phenotype-tooling-wtrees": "phenotype-tooling",
    "phenotype-ts-utils": "phenotype-ts-utils",
    "phenotype-voxel": "phenotype-voxel",
    "phenotype-voxel-2nd": "phenotype-voxel",
    "phenotype-water": "phenotype-water",
    "phenotype-zod-schemas": "phenotype-zod-schemas",

    # === pheno-*-config etc. ===
    "pheno-agents-md": "pheno-agents-md",
    "pheno-cargo-template": "pheno-cargo-template",
    "pheno-cli-base": "pheno-cli-base",
    "pheno-config": "pheno-config",
    "pheno-context": "pheno-context",
    "pheno-errors": "pheno-errors",
    "pheno-flags": "pheno-flags",
    "pheno-go-ctxkit": "pheno-go-ctxkit",
    "pheno-otel": "pheno-otel",
    "pheno-port-adapter": "pheno-port-adapter",
    "pheno-tracing": "pheno-otel",  # pheno-tracing merged into pheno-otel per ADR-012
    "pheno-zod-schemas": "pheno-zod-schemas",
    "pheno-wtrees": "pheno-wtrees",  # canonical

    # === phenoxy / extra pheno- variants ===
    "phenoAI": "phenoAI",
    "phenoData": "phenoData",
    "phenoData-t1-16": "phenoData",
    "phenoData-t1-18": "phenoData",
    "phenoDesign": "phenoDesign",
    "phenoDesign-t1-10": "phenoDesign",
    "phenoDesign-t1-6": "phenoDesign",
    "phenoDesign-t1-7": "phenoDesign",
    "phenoDesign-t1-8": "phenoDesign",
    "phenoDesign-t1-9": "phenoDesign",
    "phenoEvents": "phenoEvents",
    "phenoForge": "phenoForge",
    "phenoMCP": "PhenoMCP",  # uppercase MCP is canonical
    "phenoMcpRouter": "pheno-mcp-router",
    "phenoShared": "phenoShared",
    "phenoShared-wtrees": "phenoShared",
    "phenoUtils": "phenoUtils",
    "phenoXdd": "phenoXdd",

    # === Phenotype-observability etc. ===
    "phenotype-observability": "PhenoObservability",
    "phenotype-resilience": "ResilienceKit",
    "phenotype-vessel": "phenotype-vessel",  # deprecated per ADR-019
    "phenotype-org": "phenotype-org",  # archived

    # === Other deprecations ===
    "cheap-llm-mcp": "PhenoMCP",  # consolidated per ADR-008
    "cheap-llm-mcp-deprecate": "PhenoMCP",
    "cheap-llm-mcp-t1-19": "PhenoMCP",
    "dispatch-mcp": "PhenoMCP",  # per ADR-008
    "dispatch-mcp-t1-0": "PhenoMCP",
    "dispatch-mcp-t1-1": "PhenoMCP",
    "dispatch-mcp-t1-2": "PhenoMCP",
    "dispatch-mcp-t1-3": "PhenoMCP",
    "dispatch-mcp-t1-4": "PhenoMCP",
    "dispatch-mcp-t1-5": "PhenoMCP",
    "PhenoMCP-cheap": "PhenoMCP",
    "PhenotypeMCP": "PhenoMCP",
    "phenotype-mcp": "PhenoMCP",

    # === Datasets/derived ===
    "KlipDot": "KlipDot",
    "KlipDot-wtrees": "KlipDot",
    "pheno-claude-1st": "phenotype-registry",  # worktree
    "pheno-contracts": "PhenoContracts",
    "PhenotypeMCP-cheap": "PhenoMCP",

    # === AtomsBot family — all PAUSED, bind to canonical AtomsBot ===
    "AtomsBot": "AtomsBot",
    "AtomsBot-2nd": "AtomsBot",
    "AtomsBot-3rd": "AtomsBot",
    "AtomsBot-4th": "AtomsBot",
    "AtomsBot-5th": "AtomsBot",

    # === Conft family ===
    "Conft-4th": "Conft",
    "Conft-5th": "Conft",
    "Conft-6th": "Conft",
    "Conft-hygiene": "Conft",

    # === Sidekick family ===
    "Sidekick-4th": "Sidekick",
    "Sidekick-5th": "Sidekick",
    "Sidekick-6th": "Sidekick",

    # === phenoData / phenoDesign -t1 variants ===
    "phenoMCP": "PhenoMCP",
    "phenotype-py-utils": "phenotype-py-utils",
    "phenotype-vibeproxy": "vibeproxy",

    # === WSM family — collapse all WSM-related to WorldSphereMod (paused) ===
    "WSM": "WorldSphereMod",
    "WorldSphereMod": "WorldSphereMod",
    "wsm3d": "WorldSphereMod",

    # === nanoVMs + related ===
    "nanovms-wt-L3-025-2026-06-11": "nanovms",

    # === KaskMan / KWatch / KDesktopVirt ===
    "KDesktopVirt": "KDesktopVirt",
    "KWatch": "KWatch",
    "KWatch-docs": "KWatch",

    # === Parpoura / hwLedger / Pine / Planify / Eidos ===
    "Parpoura": "Parpoura",
    "Parpoura-5th": "Parpoura",
    "Parpoura-6th": "Parpoura",
    "Parpoura-hygiene": "Parpoura",
    "hwLedger-2nd": "hwLedger",
    "Pine": "Pine",
    "Planify": "Planify",
    "Planify-wtrees": "Planify",
    "Eidolon": "Eidolon",
    "Eidolon-wtrees": "Eidolon",
    "HexaKit": "HexaKit",
    "HexaKit-wtrees": "HexaKit",
    "Pyron": "Pyron",
    "Pyron-wtrees": "Pyron",
    "Pyron-wt": "Pyron",
    "Portage-wtrees": "portage",
    "thegent": "thegent",
    "thegent-landing": None,  # archived
    "odin-landing": None,  # archived
    "Stashly": None,  # archived per ADR-017
    "bifrost": None,  # archived
    "AtomsBot-cheap": "AtomsBot",
    "Authvault": None,  # archived per ADR-007

    # === Final cleanup ===
    "NetScript": None,  # DELETED per ADR-001
    "Dino": "Dino",  # two Dinos exist; keep both
    "DINOForge-UnityDoorstop": "DINOForge-UnityDoorstop",
    "PhenoMcpRouter": "pheno-mcp-router",
    "phenoDesign-t1-6-cheap-mcp": "phenoDesign",
    "phenoDesign-t1-7-cheap-mcp": "phenoDesign",
    "phenoDesign-t1-8-cheap-mcp": "phenoDesign",
    "phenoDesign-t1-9-cheap-mcp": "phenoDesign",
    "phenoDesign-t1-10-cheap-mcp": "phenoDesign",
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    if not BINDINGS_PATH.exists():
        sys.exit(f"ERR: {BINDINGS_PATH} not found")

    bindings = json.load(open(BINDINGS_PATH, encoding="utf-8"))
    keys = sorted(bindings.keys())
    print(f"Before: {len(keys)} repos")

    # Apply aliases
    merges = []  # (from, to, counts)
    drops = []
    new_bindings = {}
    for k in keys:
        if k in ALIASES:
            target = ALIASES[k]
            if target is None:
                # drop
                counts = sum(len(v) for v in bindings[k].values())
                drops.append((k, counts))
                continue
            elif target == k:
                # identity; normalize dict structure
                new_bindings[k] = {"prompt": list(bindings[k].get("prompt", [])), "plan": list(bindings[k].get("plan", [])), "response": list(bindings[k].get("response", []))}
            else:
                # merge
                counts = sum(len(v) for v in bindings[k].values())
                merges.append((k, target, counts))
                if target not in new_bindings:
                    new_bindings[target] = {"prompt": [], "plan": [], "response": []}
                if target == k:
                    # same key; just ensure target dict has all kinds
                    for kind in ("prompt", "plan", "response"):
                        new_bindings[target].setdefault(kind, []).extend(bindings[k].get(kind, []))
                else:
                    for kind in ("prompt", "plan", "response"):
                        new_bindings[target].setdefault(kind, []).extend(bindings[k].get(kind, []))
        else:
            # normalize dict structure
            new_bindings[k] = {"prompt": list(bindings[k].get("prompt", [])), "plan": list(bindings[k].get("plan", [])), "response": list(bindings[k].get("response", []))}

    # Dedupe
    for k, v in new_bindings.items():
        for kind in ("prompt", "plan", "response"):
            v.setdefault(kind, [])
            v[kind] = sorted(set(v[kind]))

    # Drop empty
    new_bindings = {k: v for k, v in new_bindings.items() if any(v.values())}

    print(f"After:  {len(new_bindings)} repos")
    print(f"Merges: {len(merges)}")
    print(f"Drops:  {len(drops)}")
    print()
    print("=== Merges ===")
    for f, t, c in sorted(merges):
        print(f"  {f} -> {t}  ({c} records)")
    print()
    print("=== Drops (deprecated/archived) ===")
    for k, c in sorted(drops):
        print(f"  {k}  ({c} records lost)")

    # Sanity: check for duplicate keys now
    keys_after = set(new_bindings.keys())
    case_dupes = {}
    from collections import defaultdict
    cm = defaultdict(list)
    for k in keys_after:
        cm[k.lower()].append(k)
    case_dupes = {k: v for k, v in cm.items() if len(v) > 1}
    if case_dupes:
        print()
        print("=== REMAINING case duplicates ===")
        for c, vs in case_dupes.items():
            print(f"  {c}: {vs}")

    if args.dry_run:
        print()
        print("DRY RUN — _bindings.json NOT updated")
        return 0

    # Write
    with open(BINDINGS_PATH, "w", encoding="utf-8") as f:
        json.dump(new_bindings, f, indent=2, sort_keys=True)
    print()
    print(f"Wrote {BINDINGS_PATH} with {len(new_bindings)} repos")

    # Write alias map
    alias_md = Path("ALIASES.md")
    with open(alias_md, "w", encoding="utf-8") as f:
        f.write("# Repo Name Aliases\n\n")
        f.write("Auto-generated by `scripts/resolve-collision.py`. Documents every\n")
        f.write("non-canonical name → canonical name mapping used in `_bindings.json`.\n\n")
        f.write("## Active aliases (renames)\n\n")
        f.write("| Non-canonical | Canonical | Records | Reason |\n")
        f.write("|---|---|---:|---|\n")
        for f_, t, c in sorted(merges):
            reason = "case-only"
            if f_.lower() == t.lower() and f_ != t:
                reason = "case-only"
            elif "-wt-" in f_ or "-wtrees" in f_ or "-1st" in f_ or "-2nd" in f_ or "-3rd" in f_ or "-4th" in f_ or "-5th" in f_ or "-6th" in f_ or "-hygiene" in f_ or "-deprecate" in f_ or "-t1-" in f_:
                reason = "worktree / multi-instance suffix"
            elif f_.startswith("phenoAgent-") or f_.startswith("phenoMcp"):
                reason = "lowercase / agent variant"
            elif "registry" in f_:
                reason = "worktree of registry"
            f.write(f"| `{f_}` | `{t}` | {c} | {reason} |\n")
        f.write("\n## Dropped (deprecated / archived)\n\n")
        f.write("| Non-canonical | Records lost | Reason |\n")
        f.write("|---|---:|---|\n")
        for k, c in sorted(drops):
            reason = "archived/deprecated"
            if k == "NetScript": reason = "DELETED per ADR-001"
            elif k == "Stashly": reason = "archived per ADR-017"
            elif k == "bifrost": reason = "archived"
            elif k == "Authvault": reason = "archived per ADR-007"
            elif k == "thegent-landing": reason = "archived"
            elif k == "odin-landing": reason = "archived"
            elif k == "phenotype-org": reason = "archived"
            elif k == "phenotype-vessel": reason = "deprecated per ADR-019"
            f.write(f"| `{k}` | {c} | {reason} |\n")
    print(f"Wrote {alias_md}")
    return 0


if __name__ == "__main__":
    sys.exit(main())