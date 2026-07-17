# ADR 0003 — MelosViz architecture: spec-first conductor over a hybrid scene + pro toolchain

- **Status:** PROPOSED → ADOPTED-pending-build (operator has standing approval; sponsor-only items excepted)
- **Date:** 2026-06-29
- **Supersedes:** the "pick one renderer" framing of ADR 0002 (TouchDesigner-vs-Blender). ADR 0002's tool scoring is retained as input.
- **Anchored to:** the operator's original exploration *"Programmable Music Visualizers"* (ChatGPT, 2026-04 → 05; `~/Downloads/ChatGPT-Programmable Music Visualizers.md`). This ADR codifies that vision.

---

## Context

MelosViz's goal is **not** a generic audio-reactive loop. From the operator's exploration, the real product is a
**spec-first, agent-operated, GUI-reviewed, offline-renderable, live-capable** programmable music-video system whose
signature is a **hybrid scene** with **representation-domain switching driven by a musical timeline** — e.g. a 360°
DJ-club capture where a disco-ball "scanner" sweeps and, inside its cone, the world flips between photo / mesh-wireframe /
Gaussian-splat / point-cloud / rotoscoped-performer domains, all beat-locked.

origin/main today is a minimal Python backend (`audio.py` → `RenderSpec`, `video_exporter.py` → palette-cycle MP4) —
the floor to build up from. F1 (PR #23) already wired onsets+chord/scale; P1 (in build) adds stems/MIR + RenderSpec v2.

## Decision drivers (from the exploration + operator constraints)

1. **Spec is the source of truth, NOT the editor project.** Creative truth lives in versioned specs in the repo; the
   GUI tool (TouchDesigner/Unreal) is a runtime/editor for review + nudging; manual tweaks round-trip back to structured overrides — never trapped in a `.toe`/`.uproject`.
2. **Orchestrate the pro arsenal, don't reimplement it.** Operator owns Adobe CC (AE/Premiere/Media Encoder/PS/AI), Blender, Unreal, TouchDesigner. Each is best-in-class at its specialty; an agent "conductor" routes work to the right one.
3. **Hybrid scene representation** (photo / mesh-depth / Gaussian-splat / performer-roto / fx domains), with the **scanner as a first-class field emitter** that writes spatial masks selecting/blending domains.
4. **Deterministic offline sync + live capability** off the *same* timeline (precompute, don't rely on live FFT for the master).
5. **Agent-first DX/AX**: a real CLI/API command surface, not editor macro automation.

## Decision

Adopt the exploration's **split, spec-first architecture**. Four planes:

### 1. Control-plane (the brain) — `melosviz` Python repo (origin/main, extend it)
Owns the source of truth and orchestration:
- **Audio analysis** → canonical **timeline JSON** (BPM, beats, downbeats, bar/phrase, sections, onsets, kick/snare/hat events, bass/mid/high band envelopes, stems, MIR semantics/mood) — this is RenderSpec v2 (P1, in build).
- **Spec model**: `scene spec` (assets + domains), `scanner spec` (cone/orbit/falloff/bpm-lock/write-channels), `material spec` (per-domain look families), `transition spec` (mask→domain mappings), `look/shot spec` (camera + section motifs).
- **Conductor**: routes each shot/segment to the best renderer; composites; encodes. CLI (`viz analyze|build|push|render|diff|apply`) + service API.

### 2. Renderers (orchestrated, best-tool-per-job) — none is "the engine"
| Tool | Best-at role | Headless/agent driver |
|------|--------------|----------------------|
| **TouchDesigner** | realtime runtime/editor + live VJ IO (NDI/Spout/Syphon, Link/MIDI/OSC) + GPA review; hosts the hybrid-domain mixer + scanner fields | Python (`td.op`), OSC/WS bridge |
| **Blender** (Cycles/EEVEE, Geo-Nodes) | first-class offline 3D render, procedural geometry, splat/point-cloud, photoreal — toe-to-toe with Unreal for non-realtime | `blender --background --python` (bpy) |
| **Unreal 5** | realtime + **stage/LED-wall/nDisplay/Pixel-Streaming** only (where a Vulkan game engine genuinely wins) | Python API + Movie Render Queue CLI |
| **After Effects** | motion-graphics, templated scenes, **Roto Brush 3** performer isolation | aerender + nexrender + data-driven MOGRTs |
| **Premiere + Media Encoder** | multi-scene assembly, transcode, HDR/ProRes/DNxHR masters | Media Encoder watch-folder/CLI, scripting |
| **Photoshop / Illustrator** | generated assets, typography, track-ID/brand overlays | UXP/ExtendScript |
| **Bevy / Rust+wgpu** | optional embeddable / perf escape-hatch — **NOT primary** | Rust |

### 3. Hybrid scene + scanner model (the creative core, from the exploration)
- **Domains**: `photo` (equirect/360/projected), `mesh` (tri-mesh/depth-shell/wireframe), `splat` (3DGS/radiance-field/point-cloud), `performer` (roto mattes), `fx` (particles/edge/stylized).
- **Scanner = moving volumetric mask generator** (cone/sphere/spline/rotating-lobe, bpm-locked, occlusion-aware) writing channels (`reveal_splat`, `hide_photo`, `boost_wireframe`, `edge_emission`, …) that drive domain opacity/material/effects. Optionally **semantic** ("prefer human silhouettes on vocals", "reflective materials on hats").
- **Transitions** are declarative `mask→domain` mappings, beat-locked.

### 4. Bridge & round-trip
OSC/WebSocket/shared-JSON between brain and runtime; **manual GUI edits serialize back to structured overrides** (`overrides.yaml`), never trapped in the editor binary. `viz diff overrides` surfaces divergence from canonical spec.

## Phased build (standing approval — dispatch without further gating; sponsor-only items excepted)

```
P0  F1 analysis wiring — PR #23 ✅
P1  RenderSpec v2 brain (stems/MIR/dense keyframes/semantic sections) — IN BUILD (melosviz-p1)
P2  Spec models: scene/scanner/material/transition/look + canonical timeline JSON + CLI (viz ...)
P3  First renderer adapter — Blender bpy (offline, deterministic): RenderSpec → domains → Cycles MP4 (multi-scene)
P4  Hybrid scene MVP: 360/photo + mesh/depth proxy + one splat asset + 1 performer roto layer + disco scanner mask + beat-locked transitions (exploration "MVP")
P5  TouchDesigner runtime: io/timeline/scene/fields/materials/mix/camera/ui/output graph (Python-generated, data-driven) + OSC/WS bridge + override round-trip
P6  Live path (TD NDI/Spout + Ableton-Link) ; Unreal/nDisplay only if stage/LED-wall demanded
P7  Pro-tool conductor: route segments → AE (motion/roto) / PS-AI (assets) / Premiere+ME (assemble/encode/HDR master)
P8  "Full version": hybrid radiance-field+mesh, semantic scanners, multi-scanner, procedural camera, per-section motif state-machine, anti-repetition/narrative arc
```

## Conductor contract & build ordering (from the orchestration panel)

**`scene_type`-routed RenderSpec:** each keyframe/segment carries a `scene_type` tag; the conductor routes it
to the matching tool. This is the conductor's dispatch key:
`procedural_3d_animation → Blender` · `motion_graphics_beat_sync → After Effects` ·
`generative_asset → Photoshop Firefly API` · `live_stage → Unreal nDisplay` ·
`experimental_code_gen → Bevy` · final `encode/HDR → Media Encoder` · `archive → Premiere XML`.

**Build the headless-GOLD tools first** (maturity matrix → de-risks the unattended pipeline):
- **GOLD (fully headless, agent-codegen):** Blender (`-b --python`), Media Encoder (watch-folder + JS API),
  Photoshop Firefly (REST), Bevy (native CLI). → build these first.
- **SILVER (headless + wrapper):** After Effects (aerender + nexrender), TouchDesigner (pre-programmed patches).
- **BRONZE (GUI-bound):** Unreal nDisplay (live, needs GUI), Premiere (XML export only). → last / live-phase.

This makes the offline music-video pipeline (Blender → Firefly assets → Media Encoder master) the
fastest fully-headless MVP, with AE motion-gfx and the live/Unreal path layered after.

## Consequences

**Positive:** matches the operator's own vetted vision; spec-first = agent-operable + reproducible + GUI-reviewable without lock-in; best-tool-per-job leverages the owned arsenal; the scanner/domain model is the distinctive "not trashy loops" core.

**Negative / risk:** many tool integrations (phase them — Blender offline first, it's the highest-leverage single renderer); Gaussian-splat pipeline is research-fast-moving (treat as one domain, not the only scene rep); per-tool headless automation has gotchas (aerender licensing on render nodes, EEVEE-Next headless Linux-only → use Cycles, TD Non-Commercial license for R&D).

## Gap-sweep adoptions (fold into the spec/backlog)
From the gap-sweep + exploration: **photosensitive-epilepsy flash-safety limiter (P1 — safety)**; structure/segmentation (MSAF) & drop/build detection; CLAP/Essentia mood embeddings; Ableton-Link/SMPTE/genlock sync; NDI/Spout/Syphon + projection-mapping/LED + HAP/NotchLC codecs; HDR/ACES/ProRes masters; Gaussian-splat (3DGS/3DGUT) + radiance-field domain; Roto Brush 3 performer isolation; anti-repetition/novelty + per-track narrative arc (the core "make it not look like loops" secret sauce); seeded reproducibility + show-file format; operator preview console.

## Status / standing approval
Operator gave **"always approve"** — build phases dispatch and report without per-step gating. **Excepted (still sponsor-only):** paid licenses (TouchDesigner Commercial, Unreal royalty, Adobe render-node licensing), repo un-archiving, and the canvasApp key (#55, unrelated). Build proceeds P1→P3 now.
