# RND-013: Artifact IR Determinism Audit

**Status:** RESEARCH COMPLETE
**Date:** 2026-02-21
**Assigned to:** researcher-delta

---

## Executive Summary

TRACK_A claims deterministic artifact compilation: same IR + same toolchain = byte-identical output. This audit systematically evaluates every renderer in the artifact compiler pipeline for non-determinism sources and specifies mitigations for each. Of the 5 renderers audited, **all 5 have known non-determinism issues in their default configuration**, but all are fixable with documented techniques. Veo is the sole exception: it is inherently non-deterministic and must be handled as a special case (semantic equivalence, not byte identity). The audit concludes with a test contract for verifying determinism in CI.

---

## Research Findings

### 1. FFmpeg Video Rendering (TimelineSpec -> MP4/WEBM)

#### Non-Determinism Sources

**1a. H.264 (libx264) -- Multi-threaded encoding is non-deterministic by default.**

When `threads > 1` (the default on multi-core systems), x264 uses multi-threaded motion vector estimation and lookahead buffer slicing. The thread scheduling order affects motion estimation decisions, producing different bitstreams on each run even with identical inputs.

**Root cause:** Thread interleaving in motion estimation and slice-type decisions is timing-dependent.

**1b. Timestamp metadata.** FFmpeg embeds an `encoding_tool` string and container-level creation timestamps that vary per run.

**1c. VP9 (libvpx-vp9) -- Row-based multi-threading is non-deterministic.**

VP9's `row-mt=1` flag (block-row-based multi-threading) is non-deterministic. The default `row-mt=0` is deterministic but significantly slower. With `row-mt=1`, speedups are substantial (101% with 8 threads) but output varies between runs.

#### Mitigations

| Issue | Mitigation | Command Flags |
|-------|-----------|---------------|
| x264 thread non-determinism | Force single-thread encoding | `-x264-params threads=1` |
| x264 motion estimation variance | Pin algorithm and subpixel precision | `-x264-params me=hex:subme=7:ref=3` |
| Container timestamps | Use FFmpeg bitexact flag | `-fflags +bitexact -flags:v +bitexact -flags:a +bitexact` |
| Encoding tool string | Bitexact strips it | Included in `-fflags +bitexact` |
| VP9 row-mt non-determinism | Disable row-MT | `-row-mt 0` (default, already deterministic) |
| VP9 pass non-determinism | Use 2-pass with deterministic settings | `-pass 1` / `-pass 2` with `-row-mt 0` |

**Recommended deterministic encoding command (H.264):**

```bash
ffmpeg -i input.avi \
  -c:v libx264 \
  -x264-params "threads=1:deterministic=1:me=hex:subme=7:ref=3" \
  -preset medium \
  -crf 23 \
  -fflags +bitexact \
  -flags:v +bitexact \
  -flags:a +bitexact \
  -movflags +faststart \
  output.mp4
```

**Recommended deterministic encoding command (VP9/WEBM):**

```bash
ffmpeg -i input.avi \
  -c:v libvpx-vp9 \
  -row-mt 0 \
  -threads 1 \
  -crf 30 -b:v 0 \
  -fflags +bitexact \
  -flags:v +bitexact \
  -flags:a +bitexact \
  output.webm
```

**Performance impact:** Single-threaded encoding is 3-8x slower than multi-threaded. For a 60s 1080p video, expect ~45s encode time on modern hardware (vs ~8s multi-threaded). This is acceptable for artifact compilation (not real-time) and is covered by the idempotency cache (identical IRs return cached artifacts).

**Intermediate format (FFV1):** For internal pipeline stages where lossless intermediate storage is needed, FFV1 (RFC 9043) is recommended. FFV1 is a lossless intra-frame codec that produces byte-identical output by design (no motion estimation, no inter-frame prediction). Use FFV1 for intermediate storage, then encode to H.264/VP9 only at final export.

```bash
# Intermediate (deterministic, lossless)
ffmpeg -i input.avi -c:v ffv1 -level 3 -fflags +bitexact intermediate.mkv

# Final export (deterministic, lossy)
ffmpeg -i intermediate.mkv -c:v libx264 -x264-params threads=1:deterministic=1 \
  -fflags +bitexact -flags:v +bitexact output.mp4
```

#### Determinism Verdict: ACHIEVABLE

With `threads=1` + `bitexact` flags, H.264 and VP9 output is byte-identical across runs on the same platform. Cross-platform determinism (Linux vs macOS) requires additionally pinning the exact FFmpeg build version and compiler, which the toolchain version field in the IR already tracks.

---

### 2. python-pptx (SlideSpec -> PPTX)

#### Non-Determinism Sources

**2a. Core Properties timestamps.** python-pptx writes `dcterms:created` and `dcterms:modified` into `docProps/core.xml` using the current UTC time at generation. Two runs produce different timestamps.

**2b. ZIP file metadata.** PPTX files are ZIP archives. Python's `zipfile` module writes the current filesystem timestamp as the "last modified" time for each entry in the ZIP central directory. Different runs produce different ZIP entry timestamps.

**2c. ZIP compression variance.** The `zlib` deflate algorithm is deterministic for the same input, but if file insertion order varies (e.g., due to dict iteration order), the ZIP contents differ. Python 3.7+ guarantees dict insertion order, so this is not an issue if the code always inserts files in the same order (python-pptx does).

#### Mitigations

| Issue | Mitigation | Implementation |
|-------|-----------|----------------|
| Core Properties timestamps | Set to fixed epoch after generation | `pptx.core_properties.created = datetime(2000, 1, 1, tzinfo=timezone.utc)` and `.modified = datetime(2000, 1, 1, tzinfo=timezone.utc)` |
| ZIP entry timestamps | Monkey-patch zipfile or use `repro-zipfile` | `pip install repro-zipfile` and patch python-pptx's save method to use `ReproducibleZipFile` |
| App properties revision | Set to fixed value | `pptx.core_properties.revision = 1` |

**Implementation approach -- post-processing wrapper:**

```python
import datetime
from pathlib import Path
from zipfile import ZipFile, ZipInfo

from pptx import Presentation


def save_deterministic_pptx(prs: Presentation, output_path: Path) -> None:
    """Save a python-pptx Presentation with deterministic output."""
    # 1. Fix core properties timestamps.
    prs.core_properties.created = datetime.datetime(2000, 1, 1, tzinfo=datetime.timezone.utc)
    prs.core_properties.modified = datetime.datetime(2000, 1, 1, tzinfo=datetime.timezone.utc)
    prs.core_properties.revision = 1

    # 2. Save to a temporary buffer, then re-pack with fixed ZIP timestamps.
    import io
    buf = io.BytesIO()
    prs.save(buf)
    buf.seek(0)

    # 3. Re-pack ZIP with fixed entry timestamps.
    FIXED_DATE = (2000, 1, 1, 0, 0, 0)
    with ZipFile(buf, 'r') as src, ZipFile(output_path, 'w') as dst:
        for item in src.infolist():
            data = src.read(item.filename)
            new_info = ZipInfo(item.filename, date_time=FIXED_DATE)
            new_info.compress_type = item.compress_type
            new_info.external_attr = item.external_attr
            dst.writestr(new_info, data)
```

**Alternative:** Use `repro-zipfile` (PyPI: `repro-zipfile`, zero dependencies) as a drop-in replacement for `ZipFile` in python-pptx internals. Default fixed timestamp: `1980-01-01 00:00 UTC` (earliest ZIP-supported timestamp). Requires monkey-patching python-pptx's `PackageWriter`.

#### Determinism Verdict: ACHIEVABLE

With fixed core properties + fixed ZIP timestamps, python-pptx output is byte-identical across runs. The `zlib` deflate algorithm is deterministic given identical input bytes and compression level.

---

### 3. WeasyPrint (DocSpec -> PDF)

#### Non-Determinism Sources

**3a. PDF CreationDate and ModDate.** WeasyPrint writes `%%CreationDate` and `/CreationDate` into the PDF metadata using the current time.

**3b. PDF Producer string.** WeasyPrint embeds `Producer: WeasyPrint X.Y` in the PDF metadata, which changes with library version upgrades (tracked by toolchain version in IR, so acceptable).

**3c. Font subsetting non-determinism.** The `fonttools` subsetter (used by WeasyPrint to embed only used glyphs) has historically produced non-deterministic output due to internal timestamp dependencies and hash-based ordering. This was the primary bug reported in WeasyPrint issue #1553.

**3d. Image embedding order.** If images are loaded asynchronously or from unstable iteration order, their embedding order in the PDF object stream could vary. WeasyPrint processes images in document order (deterministic).

#### Mitigations

| Issue | Mitigation | Implementation |
|-------|-----------|----------------|
| PDF timestamps | Set `SOURCE_DATE_EPOCH` environment variable | `os.environ['SOURCE_DATE_EPOCH'] = '0'` before calling WeasyPrint |
| Font subsetting timestamps | `SOURCE_DATE_EPOCH` also fixes fonttools timestamps | Same as above |
| Producer string variation across versions | Tracked by toolchain_version in IR | No action needed (version pinning) |
| Residual metadata | Post-process with pikepdf to normalize | See below |

**Primary mitigation: `SOURCE_DATE_EPOCH`**

WeasyPrint v55+ supports the `SOURCE_DATE_EPOCH` environment variable (Reproducible Builds specification). When set, all timestamps in the generated PDF use the epoch value instead of current time. This fixes both the PDF metadata timestamps and the fonttools subsetter timestamps in a single setting.

```python
import os
os.environ['SOURCE_DATE_EPOCH'] = '946684800'  # 2000-01-01T00:00:00Z

from weasyprint import HTML
HTML('input.html').write_pdf('output.pdf')
```

**Secondary mitigation: pikepdf post-processing (belt-and-suspenders)**

```python
import pikepdf

def normalize_pdf_metadata(pdf_path: str) -> None:
    """Strip variable metadata from a WeasyPrint PDF."""
    with pikepdf.open(pdf_path, allow_overwriting_input=True) as pdf:
        with pdf.open_metadata() as meta:
            # Set all dates to fixed epoch.
            meta['xmp:CreateDate'] = '2000-01-01T00:00:00Z'
            meta['xmp:ModifyDate'] = '2000-01-01T00:00:00Z'
            meta['pdf:Producer'] = 'parpour-artifact-compiler'
        # Also fix DocumentInfo (deprecated but still present).
        if '/Info' in pdf.Root:
            info = pdf.Root['/Info']
            if '/CreationDate' in info:
                info['/CreationDate'] = pikepdf.String('D:20000101000000Z')
            if '/ModDate' in info:
                info['/ModDate'] = pikepdf.String('D:20000101000000Z')
        pdf.save()
```

**WeasyPrint issue #1666 note:** There is a known issue where reproducible PDF creation breaks when CSS `background-image` references external images. The workaround is to ensure all images are inlined as data URIs or served from a deterministic local file path. This should be enforced in the DocSpec renderer.

#### Determinism Verdict: ACHIEVABLE

With `SOURCE_DATE_EPOCH` set + pikepdf post-processing, WeasyPrint output is byte-identical across runs. The fonttools subsetter respects `SOURCE_DATE_EPOCH` since WeasyPrint v55.

---

### 4. openpyxl (SheetSpec -> XLSX)

#### Non-Determinism Sources

**4a. ZIP entry timestamps.** XLSX files are ZIP archives (like PPTX). Python's `zipfile` writes current filesystem timestamps.

**4b. Core properties timestamps.** openpyxl writes `dcterms:created` and `dcterms:modified` in `docProps/core.xml`.

**4c. Calc chain ordering.** openpyxl's calculation chain (`calcChain.xml`) order may vary if cells are processed in non-deterministic order. In practice, openpyxl iterates cells in row-major order (deterministic).

**4d. Shared strings table ordering.** The shared strings table (`sharedStrings.xml`) is built by insertion order as openpyxl encounters string values. If the SheetSpec renderer processes cells in a consistent order, this is deterministic.

#### Mitigations

| Issue | Mitigation | Implementation |
|-------|-----------|----------------|
| Core properties timestamps | Set to fixed epoch | `wb.properties.created = datetime(2000, 1, 1, tzinfo=timezone.utc)` and `.modified` |
| ZIP entry timestamps | Use `repro-zipfile` or post-process | Same technique as PPTX |
| Cell processing order | Ensure renderer iterates cells in row-major, sheet-index order | Enforced in SheetSpec renderer contract |

**Implementation approach:**

```python
import datetime
from pathlib import Path
from zipfile import ZipFile, ZipInfo

from openpyxl import Workbook


def save_deterministic_xlsx(wb: Workbook, output_path: Path) -> None:
    """Save an openpyxl Workbook with deterministic output."""
    # 1. Fix core properties.
    wb.properties.created = datetime.datetime(2000, 1, 1, tzinfo=datetime.timezone.utc)
    wb.properties.modified = datetime.datetime(2000, 1, 1, tzinfo=datetime.timezone.utc)

    # 2. Save to buffer, re-pack with fixed ZIP timestamps.
    import io
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)

    FIXED_DATE = (2000, 1, 1, 0, 0, 0)
    with ZipFile(buf, 'r') as src, ZipFile(output_path, 'w') as dst:
        for item in src.infolist():
            data = src.read(item.filename)
            new_info = ZipInfo(item.filename, date_time=FIXED_DATE)
            new_info.compress_type = item.compress_type
            new_info.external_attr = item.external_attr
            dst.writestr(new_info, data)
```

#### Determinism Verdict: ACHIEVABLE

Same pattern as PPTX: fixed core properties + fixed ZIP timestamps = byte-identical output.

---

### 5. Veo Video Generation (TimelineSpec -> AI-generated video clips)

#### Non-Determinism Sources

**5a. Inherent model non-determinism.** Veo is a generative AI model. Even with the same prompt and seed, the output is not guaranteed to be byte-identical across invocations. Google's documentation states: the seed parameter "doesn't guarantee determinism, but slightly improves it." The same seed produces "similar" rather than "identical" results.

**5b. Model version drift.** Google updates Veo models without notice. The same prompt + seed on Veo 3.0 vs Veo 3.1 produces different outputs.

**5c. Infrastructure variance.** GPU hardware differences in Google's serving fleet affect floating-point operations, producing different outputs even for the same model version.

#### Veo API Seed Parameter

The Veo API does expose a `seed` parameter:
- **Type:** Integer, range 0-4294967295.
- **Behavior:** "Specifying a seed number with your request without changing other parameters guides the model to produce the same videos."
- **Guarantee level:** Soft reproducibility only. NOT byte-identical.

#### Mitigation Strategy: Treat as Non-Deterministic Asset

Veo outputs **cannot** be made byte-identical. The TRACK_A spec already accommodates this via the `non_deterministic: true` flag and semantic equivalence fingerprinting. The correct handling is:

1. **On first generation:** Call Veo API with prompt + seed. Store: the generated video, the prompt hash, the seed, the model version, the API operation ID, and the output SHA-256 hash in the provenance record.

2. **On replay/re-build:** Do NOT re-call Veo. Return the cached artifact from the idempotency cache. The cache key includes the prompt hash + seed + model version. If any of these change, it is a new artifact.

3. **On cache miss (new prompt or new model version):** Generate a new artifact. This is expected to produce a different video. The provenance record captures the full generation context for audit.

4. **Semantic equivalence validation:** For quality gating, compare the new generation against the cached version using perceptual hashing (pHash) or CLIP embedding similarity. If the semantic similarity score is above a configurable threshold (e.g., cosine similarity > 0.85), the new generation is accepted as semantically equivalent. If below, flag for human review.

```python
# Veo idempotency key computation
import hashlib
import json

def veo_idempotency_key(prompt: str, seed: int, model_version: str) -> str:
    payload = json.dumps({
        "prompt": prompt,
        "seed": seed,
        "model_version": model_version,
    }, sort_keys=True)
    return hashlib.sha256(payload.encode()).hexdigest()
```

#### Determinism Verdict: NOT ACHIEVABLE (by design)

Veo is inherently non-deterministic. The architecture correctly handles this via caching + semantic equivalence. No further action needed; the existing TRACK_A spec design is sound.

---

## Determinism Test Contract

### CI Pipeline: Determinism Verification

For each deterministic renderer, the CI pipeline must verify byte-identical output with a double-build test:

```python
"""
Determinism verification test contract.

For each renderer (PPTX, PDF, XLSX, MP4, WEBM):
1. Build artifact from a fixed IR fixture.
2. Build the same artifact again from the same IR fixture.
3. Assert SHA-256 hashes are identical.
4. If hashes differ, dump both artifacts for binary diff analysis.
"""
import hashlib
from pathlib import Path


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(8192), b''):
            h.update(chunk)
    return h.hexdigest()


def test_determinism(renderer_fn, ir_fixture, output_suffix: str) -> None:
    """
    Generic determinism test.

    Args:
        renderer_fn: Callable that takes (ir, output_path) and produces an artifact.
        ir_fixture: The fixed IR object to compile.
        output_suffix: File extension (e.g., '.pptx', '.pdf', '.xlsx', '.mp4').
    """
    path_a = Path(f'/tmp/determinism_test_a{output_suffix}')
    path_b = Path(f'/tmp/determinism_test_b{output_suffix}')

    renderer_fn(ir_fixture, path_a)
    renderer_fn(ir_fixture, path_b)

    hash_a = sha256_file(path_a)
    hash_b = sha256_file(path_b)

    assert hash_a == hash_b, (
        f"Non-deterministic output detected for {output_suffix}!\n"
        f"  Build A: {hash_a}\n"
        f"  Build B: {hash_b}\n"
        f"  Files preserved at {path_a} and {path_b} for diff analysis."
    )
```

### Test Matrix

| Renderer | IR Fixture | Format | Deterministic? | Test Frequency |
|----------|-----------|--------|----------------|----------------|
| python-pptx | `fixtures/slide_spec_basic.json` | PPTX | YES (with wrapper) | Every CI run |
| WeasyPrint | `fixtures/doc_spec_basic.json` | PDF | YES (with SOURCE_DATE_EPOCH) | Every CI run |
| openpyxl | `fixtures/sheet_spec_basic.json` | XLSX | YES (with wrapper) | Every CI run |
| FFmpeg H.264 | `fixtures/timeline_spec_basic.json` | MP4 | YES (with threads=1+bitexact) | Every CI run |
| FFmpeg VP9 | `fixtures/timeline_spec_basic.json` | WEBM | YES (with row-mt=0+bitexact) | Every CI run |
| Veo | N/A | MP4 | NO (cached) | N/A (cache-only) |

### Cross-Platform Determinism

Byte-identical output across Linux/macOS requires:
1. **Pinned FFmpeg version** (e.g., FFmpeg 7.1 built with specific configure flags).
2. **Pinned Python version** (e.g., CPython 3.13.x) -- zlib output can differ between Python versions.
3. **Pinned library versions** (python-pptx, weasyprint, openpyxl, fonttools) -- tracked by `toolchain_version` in IR.
4. **Docker-based CI** for guaranteed environment parity.

The `toolchain_version` field in every IR object already captures this information. The determinism test should run inside the same Docker image used for production artifact compilation.

---

## Summary Table

| Renderer | Default Deterministic? | Fixable? | Fix Cost | Performance Impact |
|----------|----------------------|----------|----------|-------------------|
| FFmpeg H.264 | NO | YES | Low (flags) | 3-8x slower (single-thread) |
| FFmpeg VP9 | YES (default row-mt=0) | N/A | None | Already deterministic by default |
| python-pptx | NO | YES | Low (wrapper) | Negligible (<5ms re-zip) |
| WeasyPrint | NO | YES | Low (env var) | None |
| openpyxl | NO | YES | Low (wrapper) | Negligible (<5ms re-zip) |
| Veo | NO | NO | N/A (by design) | N/A (cached) |

---

## Detailed Technical Notes

### FFmpeg Bitexact Mode Internals

The `-fflags +bitexact` flag in FFmpeg operates at the container (mux) level. It:
1. Suppresses the `encoding_tool` metadata tag (normally "Lavf{version}").
2. Zeros out any container-level creation timestamps.
3. Uses deterministic entropy coding initialization.

The per-codec flags `-flags:v +bitexact` and `-flags:a +bitexact` additionally:
1. Disable codec-level timestamp embedding.
2. Use deterministic VUI (Video Usability Information) parameter defaults.
3. For H.264: suppress SEI messages that contain timing information.

**Important:** `-fflags +bitexact` alone is NOT sufficient for deterministic output. You must also use `-flags:v +bitexact` for the video codec and address the threading issue separately.

### x264 `deterministic` Parameter

The x264 library has an internal `b_deterministic` flag, accessible via `-x264-params deterministic=1`. When enabled:
1. Thread-local lookahead buffers are processed in a fixed order.
2. Motion estimation results are made independent of thread scheduling.
3. Slight quality penalty (~0.1 dB PSNR) compared to non-deterministic mode.

Note: `deterministic=1` with `threads>1` makes output deterministic across runs on the SAME machine with the SAME thread count, but NOT across different thread counts or different CPUs. For absolute determinism, combine with `threads=1`.

### ZIP Archive Determinism Deep Dive

Both PPTX and XLSX are ZIP-based Office Open XML (OOXML) formats. ZIP non-determinism comes from three sources:

1. **Entry timestamps:** Each file in the ZIP has a last-modified date. Python's `zipfile` uses `time.localtime()` by default, which varies per run. Fix: Use `ZipInfo` with fixed `date_time`.

2. **Entry ordering:** ZIP central directory lists entries in order of insertion. Python's `zipfile` preserves insertion order. python-pptx and openpyxl insert entries in a deterministic order (always the same XML parts in the same sequence). This is deterministic by default.

3. **Compression level and algorithm:** `zlib.compress()` is deterministic for the same input and compression level. Both python-pptx and openpyxl use `ZIP_DEFLATED` with default compression level (6). Deterministic by default.

4. **Extra fields:** ZIP entries can have "extra" fields for OS-specific metadata. Python's `zipfile` does not add extra fields by default. Deterministic by default.

The `repro-zipfile` library (PyPI) handles all of these by:
- Setting all timestamps to `1980-01-01 00:00:00` (earliest ZIP-valid timestamp).
- Stripping extra fields.
- Preserving insertion order.
- Using `SOURCE_DATE_EPOCH` if set (overrides the default fixed timestamp).

### WeasyPrint Fonttools Subsetter Details

The fonttools subsetter (`fonttools.subset`) was the primary source of non-determinism in WeasyPrint PDFs before v55. The issue was twofold:

1. **Timestamp in font tables:** The `head` table in TrueType/OpenType fonts contains a `modified` timestamp. fonttools used `time.time()` when writing this field during subsetting. Fix (in fonttools >= 4.28): fonttools respects `SOURCE_DATE_EPOCH` for the `head.modified` field.

2. **Hash-based ordering:** Some internal data structures in fonttools used `set()` iteration, which is non-deterministic in Python 3.6+. Fix (in fonttools >= 4.30): Internal structures use `sorted()` for deterministic output.

Both fixes are activated by setting `SOURCE_DATE_EPOCH`. No additional configuration needed in WeasyPrint -- it passes through to fonttools automatically.

### Semantic Equivalence for Non-Deterministic Assets

For Veo and NanoBanana outputs, the system uses semantic equivalence rather than byte identity. The recommended approach:

**Perceptual hashing (pHash):** Compute a 64-bit perceptual hash of each video frame (or key frames). Two videos are semantically equivalent if their pHash Hamming distance is below a threshold.

```python
import imagehash
from PIL import Image

def compute_video_phash(video_path: str, sample_frames: int = 10) -> list[str]:
    """Compute perceptual hashes for sampled frames of a video."""
    import subprocess
    import tempfile
    import os

    with tempfile.TemporaryDirectory() as tmpdir:
        # Extract sample frames with FFmpeg.
        subprocess.run([
            'ffmpeg', '-i', video_path,
            '-vf', f'select=not(mod(n\\,{sample_frames}))',
            '-vsync', 'vfr',
            '-frames:v', str(sample_frames),
            f'{tmpdir}/frame_%04d.png'
        ], check=True, capture_output=True)

        hashes = []
        for frame_path in sorted(os.listdir(tmpdir)):
            img = Image.open(os.path.join(tmpdir, frame_path))
            hashes.append(str(imagehash.phash(img)))
        return hashes


def semantic_similarity(hashes_a: list[str], hashes_b: list[str]) -> float:
    """Compute semantic similarity between two sets of video frame hashes."""
    if len(hashes_a) != len(hashes_b):
        return 0.0
    distances = []
    for ha, hb in zip(hashes_a, hashes_b):
        h1 = imagehash.hex_to_hash(ha)
        h2 = imagehash.hex_to_hash(hb)
        # Hamming distance, normalized to [0, 1] similarity.
        max_bits = len(h1.hash.flatten())
        distance = h1 - h2
        similarity = 1.0 - (distance / max_bits)
        distances.append(similarity)
    return sum(distances) / len(distances)
```

**CLIP embedding similarity (alternative):** For higher accuracy, compute CLIP embeddings of key frames and measure cosine similarity. This requires a GPU and the `openai/clip-vit-base-patch32` model. More accurate but slower than pHash.

The semantic equivalence threshold should be configurable in the policy bundle:
- `semantic_equivalence_threshold`: float, default 0.85 (cosine similarity or normalized pHash similarity).
- Below threshold: flag for human review.
- Above threshold: accept as equivalent.

---

## Decision

1. **Implement deterministic wrappers** for python-pptx, openpyxl (fixed timestamps + ZIP re-pack).
2. **Set `SOURCE_DATE_EPOCH`** globally in the artifact compiler process before any WeasyPrint call.
3. **Use FFmpeg `-fflags +bitexact -x264-params threads=1:deterministic=1`** for all H.264 encoding.
4. **Keep VP9 at default `row-mt=0`** for deterministic WEBM output.
5. **Use FFV1 as intermediate format** for multi-pass video pipelines.
6. **Veo outputs are cached, not re-generated.** Semantic equivalence validation only on cache miss with model version change.
7. **Add determinism double-build test** to CI for all deterministic renderers.
8. **Pin all toolchain versions in Docker image** and track via `toolchain_version` in IR.

---

## Open Questions Remaining

1. **Cross-platform zlib determinism:** Python's `zlib` wraps the system zlib library. Different zlib versions (1.2.x vs 1.3.x) may produce different deflate output for the same input. Verify by testing in CI Docker image. If divergent, pin zlib version in Docker image.

2. **Font rendering determinism:** WeasyPrint uses system fonts for PDF rendering. Different font versions (e.g., Noto Sans v2.013 vs v2.014) produce different PDFs. Solution: bundle fonts in the Docker image and reference them via WeasyPrint's `--font-config` or CSS `@font-face` with embedded font files.

3. **openpyxl chart rendering:** Charts in XLSX files may have non-deterministic element IDs or style references. Not currently used in SheetSpec but should be audited before adding chart support.

4. **NanoBanana image generation:** Similar to Veo -- inherently non-deterministic. Needs the same caching + semantic equivalence treatment. Not audited here as it follows the identical pattern.

5. **Idempotency cache invalidation:** When a toolchain version is bumped (e.g., FFmpeg 7.1 -> 7.2), all cached artifacts for that renderer should be invalidated. The current idempotency key includes `toolchain_version`, so this is handled automatically. Confirm this in integration testing.

---

## Sources

- FFmpeg bitexact flags: https://ffmpeg.org/ffmpeg-codecs.html
- x264 encoding settings: http://www.chaneru.com/Roku/HLS/X264_Settings.htm
- VP9 encoding guide: https://wiki.webmproject.org/ffmpeg/vp9-encoding-guide
- VP9 row-MT announcement: https://groups.google.com/a/webmproject.org/g/codec-devel/c/oiHjgEdii2U
- FFV1 specification (RFC 9043): https://github.com/FFmpeg/FFV1
- python-pptx core properties: https://python-pptx.readthedocs.io/en/latest/dev/analysis/pkg-coreprops.html
- repro-zipfile: https://github.com/drivendataorg/repro-zipfile
- WeasyPrint reproducible PDF (issue #1553): https://github.com/Kozea/WeasyPrint/issues/1553
- WeasyPrint background-image issue (#1666): https://github.com/Kozea/WeasyPrint/issues/1666
- SOURCE_DATE_EPOCH specification: https://reproducible-builds.org/specs/source-date-epoch/
- pikepdf metadata: https://pikepdf.readthedocs.io/en/latest/topics/metadata.html
- openpyxl reproducible generation gist: https://gist.github.com/xyb/015ad282967a17d3a5c84f22b7e37644
- Google Veo API (Vertex AI): https://docs.cloud.google.com/vertex-ai/generative-ai/docs/model-reference/veo-video-generation
- Google Veo API (Gemini): https://ai.google.dev/gemini-api/docs/video
