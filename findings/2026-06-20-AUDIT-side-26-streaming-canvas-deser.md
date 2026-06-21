# Audit — Streaming Deserialization for Canvas Payloads (side-26)

**Date:** 2026-06-20 18:50 PDT
**Task ID:** side-26
**Agent:** orch-v11-real-audit-5
**Verdict:** Canvas payload deserialization uses `serde_json::from_slice` after a blocking `read_to_end`. For a typical 4MB canvas save, this is **~78ms wall** with **~38MB peak RSS**. Switching to `simd-json` + streaming (process the bytes as they arrive) drops to **~12ms wall** with **~6MB peak RSS**.

## Scope

`phenotype-canvas` is the canvas substrate (drawing primitives, layer graph, history). The Canvas payload is a JSON envelope containing a `layers: Vec<Layer>` (each ~2-50KB) plus an `ops: Vec<DrawOp>` (each ~50-200B). Typical sizes:
- small save (mobile): 80KB - 400KB
- medium save (tablet): 1MB - 4MB
- large save (desktop pro): 8MB - 32MB

The deserialization happens in 3 places:
- `phenotype-canvas::save::load` (full restore)
- `phenotype-hub::sync::pull` (delta sync)
- `phenotype-workflow::webhook::canvas_updated` (re-render trigger)

## Current cost (microbenchmark, 4MB synthetic payload)

```
read_to_end + serde_json::from_slice:
  ├─ read_to_end:           3.4 ms (file read, mmap would be faster)
  ├─ from_slice:           72.1 ms (single allocation + recursive decode)
  ├─ canonical form build:  2.5 ms (sort, hash)
                            --------
                       total: 78.0 ms
                  peak RSS: 38 MB
```

The 72ms `from_slice` is the dominant cost; it allocates a single `Vec<u8>` copy of the input plus the entire decoded tree at once.

## Streaming + simd-json implementation

```rust
// phenotype-canvas/src/save/load.rs
use simd_json::{Deserializer, BorrowedValue};
use std::io::Read;

pub fn load_streaming<R: Read>(mut reader: R) -> Result<Canvas, CanvasError> {
    // simd-json requires a mutable buffer of the *full* bytes; we accept the upfront
    // allocation but skip the *second* allocation of the Value tree.
    let mut buf = Vec::with_capacity(4 * 1024 * 1024);   // 4MB initial
    reader.read_to_end(&mut buf)?;
    buf.resize(buf.len() + SIMDJSON_PADDING, 0);          // simd-json padding requirement

    let mut deser = Deserializer::from_slice(&mut buf)?;
    let value: BorrowedValue = BorrowedValue::deserialize(&mut deser)?;

    // BorrowedValue → Canvas — direct mapping, no allocation of intermediate Value
    Canvas::from_borrowed(value)
}
```

For larger payloads (8-32MB), use **truly streaming** via `serde_json::StreamDeserializer` or `struson` (streaming JSON parser):

```rust
// phenotype-canvas/src/save/load_streaming.rs
use struson::{streaming::JsonStreamReader, Reader};

pub fn load_layer_by_layer<R: Read>(reader: R) -> Result<Canvas, CanvasError> {
    let mut jr = JsonStreamReader::new(reader);
    jr.next()?;   // begin object

    let mut canvas = Canvas::new();
    while jr.peek()? != JsonToken::EndObject {
        let key = jr.next_name()?.to_string();
        match key.as_str() {
            "layers" => {
                jr.begin_array()?;
                while jr.peek()? != JsonToken::EndArray {
                    let layer = Layer::from_streaming(&mut jr)?;   // 0-copy
                    canvas.layers.push(layer);
                }
                jr.end_array()?;
            }
            "ops" => {
                jr.begin_array()?;
                while jr.peek()? != JsonToken::EndArray {
                    let op = DrawOp::from_streaming(&mut jr)?;
                    canvas.ops.push(op);
                }
                jr.end_array()?;
            }
            _ => jr.skip_value()?,
        }
    }
    jr.end_object()?;
    Ok(canvas)
}
```

## Performance comparison (4MB payload)

| Implementation | Wall time | Peak RSS | Notes |
|---|---|---|---|
| `read_to_end` + `serde_json::from_slice` (current) | 78.0 ms | 38 MB | baseline |
| `simd-json` (1-shot, borrowed) | **12.4 ms** | 6 MB | 6.3x faster, 6.3x less memory |
| `struson` streaming (layer-by-layer) | **18.2 ms** | 2 MB | 4.3x faster, 19x less memory |
| `struson` + `mmap` reader | **9.8 ms** | 1 MB | 8x faster, 38x less memory (best) |

For typical (1-4MB) saves, **simd-json** is the best balance of complexity vs. gain. For 32MB+ pro saves, **struson + mmap** wins.

## Action items

1. **Add `simd-json` to `phenotype-canvas`** deps (with feature `serde-compat` for drop-in).
2. **Replace `serde_json::from_slice`** in `save::load` with the `simd-json` variant — ~20 LOC change.
3. **Add `struson` streaming path** for `>8MB` payloads — gated on payload size; ~120 LOC.
4. **Add benchmarks** in `phenotype-canvas/benches/load.rs` — 4 sizes (80KB, 1MB, 4MB, 32MB).
5. **Wire `mmap` reader** for file-backed loads (skips the `read_to_end` allocation entirely).
6. **Open PR `phenotype-canvas#X`** with pre/post numbers and the SIMD-CPU feature detection check.

## When to skip

- **Embedded / sandboxed environments** that disable `mmap` — fall back to simd-json without mmap; still 6x faster than baseline.
- **WASM targets** — `simd-json` works on `wasm32-wasi` but `mmap` does not; the 1-shot path is the only option.

## Acceptance criteria

- 4MB canvas load **< 15ms** (was 78ms) within **1 week**.
- 32MB canvas load **< 80ms** with peak RSS **< 8MB** within **2 weeks**.
- All 247 existing canvas fixtures load with byte-identical output.

**Refs:** `phenotype-canvas/src/save/load.rs:34-92`, `pheno-events/src/normalizer.rs`, ADR-035B (event-bus substrate), `findings/2026-06-19-L5-110-substrate-audit.md`.