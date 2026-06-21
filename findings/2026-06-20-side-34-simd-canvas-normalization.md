# SOTA — Vectorized SIMD for Canvas Normalization (side-34)

**Date:** 2026-06-20
**Task ID:** side-34
**Agent:** v11-sota-batch-1
**Verdict:** **Defer.** No fleet consumer today. SIMD acceleration for canvas/image normalization is the right substrate if/when a vision pipeline ships, but the Phenotype fleet has no image-processing workload in any active substrate.

## What vectorized SIMD for canvas normalization is (2026-06)

"Canvas normalization" in this context most likely means image preprocessing for ML inference: resize, crop, color-space conversion, channel reorder, mean/std normalization, letterboxing. SIMD (Single Instruction, Multiple Data) accelerates the per-pixel loops via CPU vector units:

- **x86_64**: SSE2 (128-bit, universal), SSE4.1, AVX2 (256-bit, ~99% of fleet CPUs), AVX-512 (512-bit, server-class only), AVX-VNNI for int8 dot products.
- **aarch64**: NEON (128-bit, universal on Apple Silicon and ARM server), SVE/SVE2 (scalable vectors, AWS Graviton3+/Fujitsu A64FX).
- **wasm**: SIMD128 (WASM SIMD proposal, stable in V8/SpiderMonkey/JSC).

The realistic fleet paths are:

1. **`image` crate + `wide` / `safe-arch`** — Rust portable SIMD via the `wide` crate or `safe_arch` thin wrappers. Less ergonomic than target-specific intrinsics but cross-platform.
2. **`std::simd` (portable SIMD group, nightly-only as of 2026-06; tracking for 1.90 stabilization)** — the long-term answer. Will be the right call once stable; right now too risky for production substrate.
3. **Vendor-specific intrinsics** (`core::arch::{x86_64, aarch64}::*`) — max performance, max maintenance burden, hand-written feature detection per platform.
4. **GPU offload** (wgpu, CUDA, Metal) — appropriate for batch inference, overkill for per-frame preprocessing.

For canvas/image normalization specifically, the SOTA libraries in 2026 are `image` (Rust), `dlib` (C++), `OpenCV` (C++), `ffmpeg` swscale (C, SIMD-accelerated), `nvJPEG` / `nvJPEG2000` (NVIDIA GPU). Of these, `image` + the portable SIMD group + AVX2/NEON runtime detection is the path of least resistance in Rust.

## Fleet relevance (today)

There is **no canvas or image processing workload** in any active Phenotype substrate today:

- **`pheno-*` libs** — config, errors, context, port-adapter, tracing, flags, worklog-schema. All text/data. No image path.
- **`phenotype-*` SDKs/frameworks** — auth, bus, hub, journeys, registry, infra. None touch pixel data.
- **`pheno-otel` / `ObservabilityKit`** — observability. Image data only as spans/metrics (already covered by side-60 simd-json).
- **`Civis`** (active app) — text/data social platform. No image pipeline.
- **`Dino`** (paused per ADR-023) — game engine with potential canvas needs, but explicitly out of scope.
- **`AtomsBot*`** (paused capstone) — image generation downstream consumer, but the substrate in question is upstream.

The single speculative consumer is a future ML inference substrate (probably `phenotype-ml-serving` or similar), and the canvas-normalization SIMD question is downstream of "do we host models at all." Until that's decided, this work is speculative.

## When SIMD canvas normalization becomes attractive

- **First ML inference workload appears** — even a small one (object detection, OCR, image captioning) makes SIMD normalization worth doing.
- **Throughput ceiling reached** — single-threaded normalization tops out around 50–100 MP/sec at 1080p on a modern x86. If we need >1 GP/sec, SIMD is on the table. If we need >10 GP/sec, GPU offload.
- **Latency budget <5ms per frame** at 1080p — single-threaded `image` is borderline; SIMD buys headroom.
- **Mobile or edge deployment** — NEON on Apple Silicon and ARM server is the difference between "works at 30fps" and "doesn't."

## Concrete recommendations

1. **Do not adopt SIMD canvas normalization as a fleet substrate right now.** No consumer; the work would sit unused.
2. **Wait for `std::simd` stabilization** (tracking Rust 1.90+). Once stable, the portable-SIMD story becomes "write once, run on SSE2/AVX2/AVX-512/NEON/SVE2/WASM-SIMD128 with no nightly toolchain." That is the inflection point at which SIMD in fleet code becomes low-friction.
3. **If a vision workload appears**, use `image` + `wide` (or `std::simd` once stable) for the per-pixel normalization; do not write per-platform intrinsics unless profiling demands it. `image` is well-maintained, has color-space conversion paths, and the hot loops are SIMD-friendly.
4. **Track `std::simd` RFC landing** — currently the portable SIMD group is on nightly with 1.90 stabilization targeted. Subscribe to `rust-lang/rust` issue #116155 for status.
5. **If mobile is in scope**, prefer NEON-tuned Rust paths or offload to Core ML / NNAPI; the per-platform intrinsics story is too painful for a fleet of 2 consumers.

## Recommendation

**Defer.** No consumer. `std::simd` stabilization is the inflection point; revisit in 6 months or when the first vision workload surfaces, whichever comes first. When the time comes, `image` + `wide` is the default path; per-platform intrinsics are not.

**Refs:** Rust portable SIMD group (github.com/rust-lang/portable-simd), `wide` crate (docs.rs/wide), `safe_arch` crate (docs.rs/safe-arch), `image` crate (docs.rs/image), Intel Intrinsics Guide, ARM NEON Intrinsics Reference, ADR-023 (app-level repo triage — `Dino` out of scope), `findings/2026-06-20-side-60-simd-json-telemetry-ingestion.md` (related SIMD precedent in fleet).
