---
repo: "legacy-game-mods"
role: legacy
status: archived
covers:
  - UnityDoorstop-NexusPatched
  - Compound-Spheres-3D-Backup
  - WorldSphereMod
  - Dino
absorbed_into: "phenotype-registry/docs/boundary/legacy-game-mods.md"
archived_date: 2026-07-17
last_boundary_review: 2026-07-17
review_cadence: never (archived)
---

# Boundary — Legacy Game Mods (ARCHIVED)

## Disposition

**ARCHIVED** — 4 non-Phenotype repositories on 2026-07-17. Source repos remain on
GitHub as read-only archives; no code is absorbed into the Phenotype fleet.

These repositories sit outside the Phenotype ecosystem boundary (game modding,
Unity game infrastructure). They are tracked here for forensic / provenance
purposes only.

## Repositories

| Repo | Language | Size | Last push | Purpose | Disposition |
|------|----------|------|-----------|---------|-------------|
| `KooshaPari/UnityDoorstop-NexusPatched` | C | 1.5MB | 2026-06-22 | Unity Doorstop 4 rewrite (NeighTools fork) — tool to inject managed .NET into Unity | ARCHIVED |
| `KooshaPari/Compound-Spheres-3D-Backup` | C# | 1.2MB | 2026-06-25 | Backup of Unity GPU/water/spheres rendering engine (used by WorldSphere3D) | ARCHIVED |
| `KooshaPari/WorldSphereMod` | C# | 177MB | 2026-07-03 | WSM3D — hard fork of MelvinShwuaner/WorldSphereMod (WorldBox 3D conversion mod, 10 phases) | ARCHIVED |
| `KooshaPari/Dino` | C# | 657MB | 2026-07-16 | DINOForge general-purpose mod platform for "Diplomacy is Not an Option" (Steam) | ARCHIVED |

## Why archive (not absorb)

These repositories are game modding projects that target third-party game
engines (Unity, WorldBox, "Diplomacy is Not an Option"). They have **no
production dependencies** in the Phenotype fleet and **no consumers** in the
type system, Cargo workspace, Go module graph, or Python SDK. Absorbing them
into a Phenotype repo would:

1. Pollute the type graph with game-domain types
2. Require a new aggregation repo (`phenotype-legacy-collection`) with no
   purpose beyond storage
3. Force future contributors to skip irrelevant game code on every search

## Outcome

All 4 source repos archived on GitHub (`gh repo archive KooshaPari/<repo> -y`).
Registry disposition-index updated:
- `repo-UnityDoorstop-NexusPatched`: fsm=archived, target=phenotype-registry (this doc)
- `repo-Compound-Spheres-3D-Backup`: fsm=archived, target=phenotype-registry (this doc)
- `repo-WorldSphereMod`: fsm=archived, target=phenotype-registry (this doc)
- `repo-Dino`: fsm=archived, target=phenotype-registry (this doc)

Local working-tree clones retained for forensic recovery but will not receive
further updates.