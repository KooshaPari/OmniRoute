# ADR 0002 — MelosViz renderer backend

- **Status:** PROPOSED (operator go/no-go on the recommended path)
- **Date:** 2026-06-29
- **Deciders:** operator + MelosViz maintainers
- **Context source:** origin/main re-map + a 4-option design panel (headless Blender, Rust+wgpu, Adobe CC, node-tools)

---

## Context

MelosViz origin/main is a **minimal, dependency-light Python backend**: `analysis/audio.py`
(`analyze_wav` → 120-bucket features, `spec_from_wav` → `RenderSpec`) + `render/video_exporter.py`
which renders **solid-colour PNG frames color-cycling a palette**, stitched to MP4 by ffmpeg. That
palette-cycler *is* the literal "trashy loop" the operator wants gone. There is **no web frontend,
no Three.js, no librosa-required engine** on main (those existed only on a stale local checkout
17 commits behind, which mis-seeded the first plan).

**Goal:** a robust, beat- and semantics-driven, multi-scene, per-second-evolving 2D/3D visualizer for
festival mainstage screens behind a DJ — an automatic VJ background, deliverable both as offline MP4
and (ideally) live realtime.

**Operator constraints (decisive):**
- Max feat/perf/experimental: prefer **Rust/Zig/Mojo** (else C++/C#/Go).
- GPU-native: **Vulkan (+Metal, DX12)** where possible.
- **Wrap/build-over-hand-roll**: favor existing engines + a **node-graph programming layer** over a bespoke renderer.
- Operator **owns the full Adobe CC suite** (After Effects is a real lever).
- Must be **agent-automatable** end-to-end (JSON/spec → render, no per-track human VJ work).

## Decision drivers

1. The **shared brain** is the same regardless of renderer: upgrade `audio.py` (stems via Demucs,
   MIR semantics, onsets/beats — F1 already wired onsets+chord/scale, PR #23) → a **rich `RenderSpec`**
   (dense keyframes, timeline events, scene/segment classification, per-stem channels).
   This ADR only decides **how that spec is rendered**.
2. Two deliverables with different needs: **offline music-video MP4** (quality-max, batchable) and
   **live mainstage** (realtime, GPU, sync). They may use different renderers off the same spec.
3. Agent-automation is a hard filter — anything requiring manual node-wiring per track scores low.

## Options considered (design-panel scoring, 1–5; higher = better)

| Option | Richness | Perf | Wrap-over-build | Live | Offline MP4 | Effort-to-MVP | Agent-automatable |
|--------|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| **1. Headless Blender** (bpy, Geo/Shader Nodes, Cycles/EEVEE-Next) | 4.5 | 4 | **5** | 1.5 | 5 | 4 | 4 (bpy fully scriptable) |
| **2. Rust + wgpu/Bevy** (Vulkan/Metal/DX12, render-graph, compute) | 4 | **5** | 3 | **5** | 4 | 2 | 4 (spec-driven) |
| **3. Adobe AE/CC** (aerender + data-driven MOGRTs + nexrender) | **5** | 4 | **5** | 1 (3 w/ pre-render) | 5 | 3 | 3 (ExtendScript brittle; render-node license trap) |
| **4a. TouchDesigner** (Python td.op node-gen, NDI/Spout, Movie File Out) | 5 | **5** | **5** | **5** | **5** | 3 | **5 (Python node-gen — dominant)** |
| 4b. Notch | 5 | 5 | 4 | 5 | 4 | — | 2 (NO node-gen API; Win+Nvidia only; $$$) |
| 4c. vvvv gamma | 4 | 4 | 3 | 3 | 3 | — | 3 (XML/C#; nascent agent patterns) |

_Scores from the 4-agent design panel (Blender / Rust-wgpu / Adobe / node-tools), corroborated by
operator constraints. Full per-option reports archived in `.audit-run-v37/initiatives/MELOSVIZ.md`._

**Panel's decisive findings:**
- **TouchDesigner wins the node-tools class 95.6%** and is the single most **agent-automatable** option:
  Python `td.op()` lets an agent *generate and wire* a unique network per track (not just tune params).
  It does **BOTH live (NDI/Spout/Syphon, Ableton-Link) AND frame-perfect offline MP4 (Movie File Out TOP)**
  natively — no ffmpeg wrapper. Free Non-Commercial license; cross-platform; Nvidia/AMD/Intel.
- **Notch disqualified**: no node-generation API (agents can only tune hand-authored Blocks), Windows+Nvidia-only,
  expensive subscription + per-playback license.
- **Blender caveat (important):** **EEVEE-Next headless is broken on macOS/Windows — only Cycles renders
  headless there** (EEVEE headless is Linux-only since 3.4). On a Mac dev box, offline = Cycles (2–5 s/frame@4K).
  Pin Blender 4.6 LTS. GPL-clean for shipping rendered MP4s.
- **Adobe AE**: tier-1 richness but **offline-only** + **render-node licensing trap** (can't run aerender on
  cloud nodes under a personal CC license) → optional template-scene source, not primary.

## Decision (PROPOSED) — TouchDesigner primary + Blender for high-fidelity offline, off one shared spec

**Do NOT hand-roll a fresh renderer** (matches the operator's instinct). The panel refined the original
two-renderer idea: **TouchDesigner alone covers BOTH the live mainstage AND frame-perfect offline MP4**,
and is the most agent-automatable option — so it is the **primary engine**, with Blender as a
**high-fidelity 3D/offline companion** rather than a co-equal second renderer.

- **PRIMARY → TouchDesigner** (Option 4a). One engine, both deliverables:
  - **Live mainstage:** GPU-native, NDI/Spout/Syphon out, Ableton-Link/MIDI sync — the industry standard.
  - **Offline music video:** native Movie File Out TOP, frame-perfect H.264/H.265/ProRes, audio-synced.
  - **Agent-automation (the deciding factor):** Python `td.op()` lets the agent *generate and wire* a
    unique multi-scene network per track from the shared RenderSpec — no per-track human VJ. Built-in
    spectral/beat CHOPs reduce custom DSP. Free Non-Commercial license for R&D.
- **HIGH-FIDELITY OFFLINE COMPANION → headless Blender** (Option 1), for tracks/segments wanting
  photoreal 3D / volumetrics / particle richness beyond TD's realtime budget. bpy + Geometry/Shader
  Nodes driven by the same RenderSpec; **use Cycles for headless on macOS/Windows** (EEVEE-Next headless
  is Linux-only). GPL-clean for shipping MP4s. Optional — bring online when TD's ceiling is hit.

**Rust + wgpu (Option 2)** stays the **strategic fallback / perf escape hatch**: if Blender realtime or
TD licensing/automation prove limiting, a Bevy/wgpu engine is the max-perf bespoke path — but it's the
biggest build and least wrap-over-build, so it's not the starting point. **Adobe AE (Option 3)** is
**not selected** as primary (offline-only, per-machine licensing blocks cloud render farms, ExtendScript
automation is brittle) but is a useful **template-scene source** the operator can author by hand and the
pipeline can data-drive via MOGRTs if desired.

## Consequences

**Positive:** shared `RenderSpec` brain → two best-in-class renderers, each via wrap-over-build; no
bespoke-renderer maintenance burden up front; offline quality (Blender) + live capability (TD) both covered.

**Negative / risk:** two render integrations to maintain; Blender headless GPU has setup gotchas;
TouchDesigner Commercial/Pro licensing for non-watermarked output; the rich-`RenderSpec` must be
expressive enough to drive both (design it renderer-agnostic — reuse F2's `renderSpec.ts` SceneParams
contract as the shape, translated to a Python dataclass).

## Phased build (gated on this ADR)

```
P0 (done/in-review)  F1 audio.py analysis wiring — PR #23 ✅
P1 Shared brain      rich RenderSpec v2 (renderer-agnostic): dense keyframes + timeline + scene segments
                     + per-stem channels; upgrade audio.py (Demucs stems, MIR semantics/mood)
                     (reuse F2's renderSpec.ts SceneParams shape, as a Python dataclass)
P2 TD primary        TouchDesigner harness: agent generates per-track network via td.op() from RenderSpec
                     → Movie File Out MP4 (offline music video, multi-scene)
P3 TD live           same network → NDI/Spout out + Ableton-Link sync (festival mainstage)
P4 Blender companion headless Cycles bpy harness for photoreal/3D segments off the same RenderSpec
P5 Polish/parity     scene library (50+), cross-scene morphing, e2e music-video assembly
(fallback)           Rust+wgpu engine if TD perf/automation hits a ceiling; Adobe AE as optional template source
```

## Sponsor go/no-go (the gate)

This is **PROPOSED**. Confirm before build:
1. Accept **TouchDesigner as the primary engine** (covers both live + offline, most agent-automatable),
   with **Blender (Cycles) as the optional high-fidelity offline companion**?
2. License posture: start on TD **Non-Commercial (free)** for R&D, upgrade to Commercial ($600 one-time)
   only when output goes commercial — acceptable?
3. Keep **Rust+wgpu** as the documented perf-fallback and **Adobe AE** as an optional template source
   (neither built now)?
