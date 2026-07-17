---
repo: "KDesktopVirt"
role: archive-only
status: archived
last_boundary_review: 2026-07-17
review_cadence: never (archived)
archive_reason: non-phenotype-content
canonical_source: null
absorbing_repo: phenotype-registry (boundary record only)
---

# Boundary — KDesktopVirt (ARCHIVED)

## Disposition

**ARCHIVED** on GitHub 2026-07-17 (verified `isArchived=true` via `gh repo view`).

`KooshaPari/KDesktopVirt` is a **non-Phenotype** project — an AI agent desktop
automation platform built around KDE / Kubuntu / X11 / Wayland containerized
desktops with Docker + Kubernetes orchestration. It targets a Playwright-style
API for full Linux desktop sessions and is unrelated to the Phenotype substrate,
LLM routing, knowledge graph, or device-automation pillar goals.

This boundary doc exists only so the registry retains an auditable record of
why the repo was retired. No source was migrated into the phenotype monorepo.

## Audit summary

| Aspect | Finding |
|--------|---------|
| Domain | KDE desktop virtualization / AI agent UI automation |
| Languages | Rust + Go + Python + TypeScript + shell |
| Size | ~1.2 MB source (excluding `target/`, `node_modules/`) |
| Branches | 1 remote branch (long-stale `main`, last push 2025-07-14) |
| Phenotype substrate alignment | None |
| Pillar | None — falls outside `DOMAIN_ROLES.md` taxonomy |
| Reuse potential | None — Playwright-for-desktop scope not part of Phenotype charter |
| Decision | Archive on GitHub; record in registry; no fork, no transfer |

## Why archive (not absorb)

- No capability overlap with Phenotype pillars (graph, routing, observability,
  governance, contracts, runtime, mobile). KDesktopVirt's "device-automation"
  hook is a stretch label for Linux X11/Wayland pointer/keyboard scripting, not
  the eco-011 device-automation initiative's contracts-first port surface.
- The repo was largely dormant (last push ~12 months before archival).
- Companion repos named in the README (`KVirtualStage`, `kmobile`) are separate
  KooshaPari entities; they are out of scope for this disposition.
- AGENTS.md extends Phenotype-org governance structurally, but the **content**
  (KDE desktop virt) is non-Phenotype, so the structural wrapper does not
  justify keeping the project active.

## What lives where now

| Capability | Lives in |
|------------|----------|
| KDE desktop automation / containerized X11 sessions | N/A — retired |
| Phenotype substrate / LLM routing / contracts | `phenotype-router`, `phenotype-contracts` |
| Mobile device automation contracts | future eco-011 port surface (not this repo) |

## Outcome

- Source repo `KooshaPari/KDesktopVirt` archived on GitHub (read-only tombstone).
- Registry row `repo-KDesktopVirt`: disposition `AFFIRM` → `ARCHIVE_ONLY`,
  fsm `active` → `absorbed`, target pinned to this boundary doc.
- No PR, no fork, no physical transfer. Registry disposition-index.json carries
  the audit trail.

**Next review:** never (archived; tombstone state).