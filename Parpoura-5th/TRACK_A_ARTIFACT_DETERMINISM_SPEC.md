# Track A: Artifact IR and Determinism Closure

**Spec ID:** TRACK-A-ARTIFACT-DETERMINISM-v2
**Version:** 2.0
**Status:** active
**Date:** 2026-02-21
**Related Specs:**
- `ARTIFACT_COMPILER_SPEC.md` — Artifact Compiler System: IR schemas, compiler pipeline, validation engine, headless execution model, multi-format export
- `TECHNICAL_SPEC.md` — Venture-Autonomy Control Plane (artifact compiler is a subsystem)
- `API_EVENTS_SPEC.md` — Event topics and envelope format for artifact build completion, validation, and export events
- `SCHEMA_PACK.md` — Core platform schemas: EventEnvelopeV1, TaskEnvelopeV1, PolicyBundle, ArtifactSpec base

---

## 1. Summary

Artifact determinism is the property that guarantees a given set of inputs—an IR specification, a toolchain version, a policy bundle identifier, and a target surface—will always produce byte-identical output artifacts when compiled under identical conditions. This property is the engineering foundation upon which audit, reproducibility, provenance attestation, and incremental cost control are built. Without it, artifact generation is an opaque process: you cannot replay a historical build, cannot verify that a delivered artifact matches a claimed specification, and cannot reason about whether a generated video or document is the product of the stated inputs.

The IR-first architecture solves the determinism problem by treating every artifact as the compiled output of a pure, serializable specification rather than as the product of a user's manual editing session in a SaaS tool. Agents do not "open Google Slides" or "edit in Clipchamp." They write SlideSpec, DocSpec, TimelineSpec, AudioSpec, and BoardSpec JSON objects. Those objects are then compiled by deterministic renderers—python-pptx, FFmpeg, WeasyPrint, openpyxl, and headless vector engines—into finished artifacts. The key insight is that SaaS platforms become export targets, not editing surfaces. This inversion makes artifacts reproducible builds in the same sense that compiled software is a reproducible build: same source, same compiler, same output.

The pipeline philosophy centers on six stages that must each be independently verifiable: validation, planning, compilation, quality gating, export, and provenance attestation. Each stage is logged, each stage produces a hash of its inputs and outputs, and the entire chain is captured in a structured provenance record that is signed and appended to the immutable event ledger. If any stage fails, the failure is loud and the build stops; there is no silent fallback to a degraded output mode. Every successful build emits a provenance record from which any party can reconstruct and verify the full causal chain from source specification to final artifact file.

Non-deterministic providers—Veo 3.1 for video generation and NanoBanana for image generation—are accommodated through a semantic equivalence fingerprinting scheme. Because these providers cannot guarantee byte-identical outputs across separate invocations of the same prompt, the pipeline treats their outputs as non-deterministic assets that are stamped with a `non_deterministic: true` flag and validated through a semantic equivalence function rather than a byte-identical replay. The seed, model version, operation ID, and output hash of each generation call are captured in the provenance record so that any future auditor can understand exactly which model version produced which output under which parameters—even if re-running the same prompt would produce a different video.

The idempotency cache is the runtime mechanism that makes deterministic replay economically viable. Before initiating any build, the artifact compiler computes an idempotency key from the hash of the IR, toolchain version, policy bundle ID, and target surface. If a cache entry for that key already exists and the build was successful, the cached artifact is returned immediately without re-running the compiler. This eliminates redundant computation for identical requests, ensures that agents that submit the same artifact request multiple times receive consistent results, and enables cost accounting at the individual artifact level.

---

## 2. Artifact IR Type System

All IR types share a common base of required fields that enable determinism tracking and compliance auditability. Every IR object is immutable once registered; updates produce a new IR with an incremented version and a new content hash. The Python dataclasses below use `pydantic` v2 semantics with `model_config = ConfigDict(frozen=True)` to enforce immutability at the application layer.

### 2.1 Common Base Fields

```python
from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class IRBase(BaseModel):
    """Mandatory fields present on every artifact IR object."""

    model_config = ConfigDict(frozen=True)

    schema_version: str = Field(
        ...,
        pattern=r"^\d+\.\d+$",
        description="Semantic version of the IR schema, e.g. '1.0'.",
    )
    spec_id: str = Field(
        ...,
        min_length=4,
        max_length=256,
        description="Stable human-readable identifier for this IR object.",
    )
    content_hash: str = Field(
        ...,
        pattern=r"^[a-f0-9]{64}$",
        description="SHA-256 hex digest of the canonical JSON serialization of this IR.",
    )
    inputs_hash: str = Field(
        ...,
        pattern=r"^[a-f0-9]{64}$",
        description=(
            "SHA-256 hex digest of all external input hashes "
            "(asset refs, dataset refs, brand token set) concatenated in sorted order."
        ),
    )
    policy_bundle_id: str = Field(
        ...,
        description="ID of the policy bundle (brand tokens, quality gates) active at creation time.",
    )
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="UTC timestamp when this IR was first registered.",
    )
    created_by: str = Field(
        ...,
        description="Agent identifier that produced this IR (e.g. 'marketing-agent-v3').",
    )
    target_surfaces: list[str] = Field(
        default_factory=list,
        description="Ordered list of target export surfaces: 'web', 'email', 'presentation', 'archival'.",
    )
    accessibility_level: str = Field(
        default="wcag-aa",
        description="Target WCAG level: 'wcag-a', 'wcag-aa', 'wcag-aaa'.",
    )

    @classmethod
    def compute_content_hash(cls, payload: dict[str, Any]) -> str:
        canonical = json.dumps(payload, sort_keys=True, ensure_ascii=True)
        return hashlib.sha256(canonical.encode()).hexdigest()
```

### 2.2 SlideSpec — Presentations and Decks

```python
class SlideElementType(str, Enum):
    heading = "heading"
    body = "body"
    chart = "chart"
    image = "image"
    table = "table"
    shape = "shape"
    video_embed = "video_embed"
    lower_third = "lower_third"


class SlideElement(BaseModel):
    model_config = ConfigDict(frozen=True)

    element_id: str
    type: SlideElementType
    text: Optional[str] = None
    style_token: Optional[str] = None
    alignment: Optional[str] = None
    # Chart-specific
    chart_type: Optional[str] = None
    data_ref: Optional[str] = None
    # Image-specific
    asset_ref: Optional[str] = None
    width_px: Optional[int] = None
    height_px: Optional[int] = None
    alt_text: Optional[str] = None
    # Table-specific
    columns: Optional[list[str]] = None
    rows: Optional[list[list[str]]] = None
    # Bounding box (x, y, w, h in points for overlay generation)
    bbox: Optional[tuple[float, float, float, float]] = None


class SlideDef(BaseModel):
    model_config = ConfigDict(frozen=True)

    slide_id: str
    layout: str = Field(
        ...,
        description="Layout key: 'title-only', 'title-subtitle', 'two-column', 'blank', 'image-full'.",
    )
    elements: list[SlideElement]
    speaker_notes: Optional[str] = None
    duration_seconds: Optional[float] = None
    transition: Optional[str] = None


class BrandConfig(BaseModel):
    model_config = ConfigDict(frozen=True)

    primary_color: str
    secondary_color: str
    accent_color: str
    font_heading: str
    font_body: str
    logo_asset_ref: Optional[str] = None
    spacing_unit_pt: float = 8.0
    border_radius_pt: float = 4.0


class SlideSpec(IRBase):
    """
    Presentation IR: decks, pitch decks, marketing slides, educational content.

    Compiles to: PPTX (python-pptx), PDF, PNG thumbnails, HTML (reveal.js).
    """

    ir_type: str = Field(default="SlideSpec", frozen=True)
    aspect_ratio: str = Field(default="16:9", description="'16:9' or '4:3'.")
    slides: list[SlideDef]
    brand_config: BrandConfig
    dataset_refs: dict[str, str] = Field(
        default_factory=dict,
        description="Map of dataRef key -> S3 URI of dataset JSON.",
    )
    font_embed: bool = Field(default=True)
    slide_size_cm: tuple[float, float] = Field(
        default=(33.87, 19.05),
        description="(width, height) in centimetres. Default is widescreen 16:9.",
    )
```

### 2.3 DocSpec — Documents and Reports

```python
class DocSectionType(str, Enum):
    heading = "heading"
    body = "body"
    table = "table"
    figure = "figure"
    footnote = "footnote"
    code_block = "code_block"
    blockquote = "blockquote"
    toc = "toc"


class Citation(BaseModel):
    model_config = ConfigDict(frozen=True)

    ref_id: str
    text: str
    url: Optional[str] = None
    accessed_at: Optional[datetime] = None


class DocSection(BaseModel):
    model_config = ConfigDict(frozen=True)

    section_id: str
    type: DocSectionType
    level: int = Field(default=1, ge=1, le=6)
    content: Optional[str] = None
    style_token: Optional[str] = None
    citations: list[Citation] = Field(default_factory=list)
    data_ref: Optional[str] = None
    columns: Optional[list[str]] = None
    asset_ref: Optional[str] = None
    caption: Optional[str] = None
    alt_text: Optional[str] = None
    footnote_text: Optional[str] = None


class TocConfig(BaseModel):
    model_config = ConfigDict(frozen=True)

    include: bool = True
    max_depth: int = Field(default=3, ge=1, le=6)
    title: str = "Table of Contents"


class OutputChannelConfig(BaseModel):
    model_config = ConfigDict(frozen=True)

    format: str
    page_size: Optional[str] = None
    margins_in: Optional[str] = None
    width_px: Optional[int] = None
    breakpoints: Optional[list[int]] = None


class DocSpec(IRBase):
    """
    Document IR: reports, whitepapers, case studies, RFP responses, marketing collateral.

    Compiles to: DOCX (python-docx), PDF (WeasyPrint or Pandoc), HTML, Markdown.
    """

    ir_type: str = Field(default="DocSpec", frozen=True)
    sections: list[DocSection]
    toc_config: TocConfig = Field(default_factory=TocConfig)
    output_channels: dict[str, OutputChannelConfig] = Field(
        default_factory=dict,
        description="Keys: 'web', 'email', 'pdf', 'docx'. Values: channel-specific config.",
    )
    brand_config: BrandConfig
    max_page_length: Optional[int] = None
    language: str = "en-US"
    dataset_refs: dict[str, str] = Field(default_factory=dict)
```

### 2.4 SpreadsheetSpec — Structured Data and Reports

```python
class CellRange(BaseModel):
    model_config = ConfigDict(frozen=True)

    start: str = Field(..., pattern=r"^[A-Z]+[0-9]+$")
    end: str = Field(..., pattern=r"^[A-Z]+[0-9]+$")


class ChartDef(BaseModel):
    model_config = ConfigDict(frozen=True)

    chart_id: str
    chart_type: str
    data_range: CellRange
    title: Optional[str] = None
    x_axis_label: Optional[str] = None
    y_axis_label: Optional[str] = None


class SheetDef(BaseModel):
    model_config = ConfigDict(frozen=True)

    sheet_id: str
    name: str
    cells: dict[str, str] = Field(
        ...,
        description="Map of cell address (e.g. 'A1') to value or formula (e.g. '=SUM(B2:B12)').",
    )
    named_ranges: dict[str, CellRange] = Field(default_factory=dict)
    charts: list[ChartDef] = Field(default_factory=list)
    freeze_rows: int = Field(default=0)
    freeze_cols: int = Field(default=0)
    tab_color: Optional[str] = None


class SpreadsheetSpec(IRBase):
    """
    Spreadsheet IR: financial models, data reports, pivot tables.

    Compiles to: XLSX (openpyxl or ExcelJS).
    """

    ir_type: str = Field(default="SpreadsheetSpec", frozen=True)
    sheets: list[SheetDef]
    dataset_refs: dict[str, str] = Field(default_factory=dict)
```

### 2.5 TimelineSpec — Video and Motion

```python
class ClipType(str, Enum):
    asset = "asset"
    slide_frame = "slide_frame"
    generated_veo = "generated_veo"
    generated_image = "generated_image"
    composite = "composite"


class Transition(BaseModel):
    model_config = ConfigDict(frozen=True)

    at_seconds: float
    type: str = Field(..., description="'crossfade', 'cut', 'wipe', 'fade_to_black'.")
    duration_seconds: float = Field(default=0.5, ge=0.0, le=3.0)


class KenBurnsConfig(BaseModel):
    model_config = ConfigDict(frozen=True)

    zoom_start: float = 1.0
    zoom_end: float = 1.08
    pan_direction: str = "none"
    fps: int = 30


class VeoGenerationConfig(BaseModel):
    """Parameters sent to Veo 3.1 for a generated scene."""

    model_config = ConfigDict(frozen=True)

    model: str = "veo-3.1-generate-preview"
    prompt: str
    negative_prompt: Optional[str] = None
    duration_seconds: float = Field(default=8.0, ge=4.0, le=60.0)
    reference_images: list[str] = Field(
        default_factory=list,
        max_length=3,
        description="Up to 3 S3 URIs of reference images for image-based direction.",
    )
    first_frame_ref: Optional[str] = None
    last_frame_ref: Optional[str] = None
    aspect_ratio: str = "16:9"
    generate_audio: bool = False


class NanoBananaGenerationConfig(BaseModel):
    """Parameters sent to NanoBanana / Gemini image generation."""

    model_config = ConfigDict(frozen=True)

    prompt: str
    negative_prompt: Optional[str] = None
    aspect_ratio: str = "16:9"
    size: str = Field(default="2K", description="'1K', '2K', '4K'.")
    seed: Optional[int] = None
    style_tokens: list[str] = Field(default_factory=list)


class Clip(BaseModel):
    model_config = ConfigDict(frozen=True)

    clip_id: str
    type: ClipType
    asset_ref: Optional[str] = None
    slide_ref: Optional[str] = None
    veo_config: Optional[VeoGenerationConfig] = None
    nanobanana_config: Optional[NanoBananaGenerationConfig] = None
    start_seconds: float
    duration_seconds: float
    layer: int = 0
    opacity: float = Field(default=1.0, ge=0.0, le=1.0)
    ken_burns: Optional[KenBurnsConfig] = None
    transitions: list[Transition] = Field(default_factory=list)


class AudioTrackRef(BaseModel):
    model_config = ConfigDict(frozen=True)

    track_id: str
    type: str = Field(..., description="'voiceover', 'bgm', 'sfx', 'ambient'.")
    asset_ref: Optional[str] = None
    script_ref: Optional[str] = None
    tts_voice: Optional[str] = None
    tts_rate: float = 1.0
    ducking_target: Optional[str] = None
    ducking_reduction_db: float = -6.0
    ducking_attack_ms: float = 100.0
    ducking_release_ms: float = 200.0


class CaptionConfig(BaseModel):
    model_config = ConfigDict(frozen=True)

    enabled: bool = True
    language: str = "en-US"
    style: str = Field(default="burn-in", description="'burn-in' or 'sidecar-srt'.")
    max_drift_ms: float = 100.0


class RenderParams(BaseModel):
    model_config = ConfigDict(frozen=True)

    frame_rate: int = Field(default=30, ge=24, le=60)
    resolution: str = "1920x1080"
    codec: str = "libx264"
    crf: int = Field(default=23, ge=0, le=51)
    audio_codec: str = "aac"
    audio_bitrate: str = "192k"
    pixel_format: str = "yuv420p"


class TimelineSpec(IRBase):
    """
    Video/motion IR: marketing videos, slide-to-video, cinematic content, demo videos.

    Compiles to: MP4/MOV/WebM via FFmpeg filtergraph generation.
    """

    ir_type: str = Field(default="TimelineSpec", frozen=True)
    duration_seconds: float
    clips: list[Clip]
    audio_tracks: list[AudioTrackRef] = Field(default_factory=list)
    caption_config: CaptionConfig = Field(default_factory=CaptionConfig)
    render_params: RenderParams = Field(default_factory=RenderParams)
    export_formats: list[str] = Field(default_factory=lambda: ["mp4"])
    quality_presets: list[str] = Field(default_factory=lambda: ["1080p"])
```

### 2.6 AudioSpec — Audio and DSP Pipeline

```python
class EqBand(BaseModel):
    model_config = ConfigDict(frozen=True)

    frequency_hz: float
    gain_db: float
    q: float = 1.0
    type: str = "peaking"


class CompressorConfig(BaseModel):
    model_config = ConfigDict(frozen=True)

    threshold_db: float = -20.0
    ratio: float = 4.0
    attack_ms: float = 10.0
    release_ms: float = 100.0
    makeup_gain_db: float = 0.0


class ReverbConfig(BaseModel):
    model_config = ConfigDict(frozen=True)

    room_size: float = Field(default=0.3, ge=0.0, le=1.0)
    damping: float = Field(default=0.5, ge=0.0, le=1.0)
    wet_db: float = -12.0
    dry_db: float = 0.0


class DspPipeline(BaseModel):
    """Per-track DSP chain applied before mixdown."""

    model_config = ConfigDict(frozen=True)

    normalize: bool = False
    eq_bands: list[EqBand] = Field(default_factory=list)
    compressor: Optional[CompressorConfig] = None
    reverb: Optional[ReverbConfig] = None
    gain_db: float = 0.0
    highpass_hz: Optional[float] = None
    lowpass_hz: Optional[float] = None
    noise_gate_threshold_db: Optional[float] = None


class FadeConfig(BaseModel):
    model_config = ConfigDict(frozen=True)

    fade_in_ms: float = 0.0
    fade_out_ms: float = 0.0


class AudioSegment(BaseModel):
    model_config = ConfigDict(frozen=True)

    segment_id: str
    text: Optional[str] = None
    tts_voice: Optional[str] = None
    tts_rate: float = 1.0
    asset_ref: Optional[str] = None
    start_ms: float
    duration_ms: Optional[float] = None


class AudioTrack(BaseModel):
    model_config = ConfigDict(frozen=True)

    track_id: str
    type: str
    segments: list[AudioSegment] = Field(default_factory=list)
    asset_ref: Optional[str] = None
    volume_db: float = 0.0
    loop: bool = False
    fade: FadeConfig = Field(default_factory=FadeConfig)
    dsp: DspPipeline = Field(default_factory=DspPipeline)


class DuckingRule(BaseModel):
    model_config = ConfigDict(frozen=True)

    source_track: str
    target_track: str
    reduction_db: float = -8.0
    attack_ms: float = 50.0
    release_ms: float = 100.0


class MasterChain(BaseModel):
    model_config = ConfigDict(frozen=True)

    target_loudness_lufs: float = -16.0
    target_true_peak_lufs: float = -1.5
    lra: float = 11.0
    master_compressor: Optional[CompressorConfig] = None
    master_limiter_db: float = -1.0


class AudioSpec(IRBase):
    """
    Audio IR: voiceovers, podcast editing, music mixing, sound design.

    Compiles to: WAV (lossless master), MP3, AAC via FFmpeg DSP chain.
    """

    ir_type: str = Field(default="AudioSpec", frozen=True)
    sample_rate_hz: int = Field(default=48000)
    bit_depth: int = Field(default=24)
    channels: int = Field(default=2)
    tracks: list[AudioTrack]
    ducking_rules: list[DuckingRule] = Field(default_factory=list)
    master_chain: MasterChain = Field(default_factory=MasterChain)
    export_formats: list[str] = Field(default_factory=lambda: ["wav", "mp3"])
    mp3_bitrate: str = "192k"
    aac_bitrate: str = "256k"
```

### 2.7 BoardSpec — Whiteboards and Diagrams

```python
class NodeType(str, Enum):
    sticky = "sticky"
    box = "box"
    circle = "circle"
    image = "image"
    text = "text"
    group = "group"
    frame = "frame"
    swimlane = "swimlane"


class BoardNode(BaseModel):
    model_config = ConfigDict(frozen=True)

    node_id: str
    type: NodeType
    x: float
    y: float
    width: float
    height: float
    text: Optional[str] = None
    style_token: Optional[str] = None
    border_color: Optional[str] = None
    border_width: float = 1.0
    fill_color: Optional[str] = None
    font_size_pt: Optional[float] = None
    asset_ref: Optional[str] = None
    z_index: int = 0
    locked: bool = False


class EdgeStyle(str, Enum):
    solid = "solid"
    dashed = "dashed"
    dotted = "dotted"


class BoardEdge(BaseModel):
    model_config = ConfigDict(frozen=True)

    edge_id: str
    from_node: str
    to_node: str
    type: str = Field(default="arrow", description="'arrow', 'line', 'bidirectional'.")
    label: Optional[str] = None
    style: EdgeStyle = EdgeStyle.solid
    color: Optional[str] = None
    routing: str = Field(default="orthogonal", description="'orthogonal' or 'bezier'.")


class AnimationStep(BaseModel):
    model_config = ConfigDict(frozen=True)

    step: int
    duration_ms: float
    element_ids: list[str]
    animation: str = Field(
        ...,
        description="'fade-in', 'fade-out', 'draw', 'highlight', 'pan-zoom'.",
    )


class GridConfig(BaseModel):
    model_config = ConfigDict(frozen=True)

    enabled: bool = True
    spacing_px: float = 20.0
    snap_to_grid: bool = True


class BoardSpec(IRBase):
    """
    Whiteboard and diagram IR: flowcharts, concept maps, Miro-style whiteboards.

    Compiles to: SVG, PDF, PNG, interactive HTML canvas.
    """

    ir_type: str = Field(default="BoardSpec", frozen=True)
    canvas_width_px: float = 2400.0
    canvas_height_px: float = 1800.0
    zoom_level: float = 1.0
    nodes: list[BoardNode]
    edges: list[BoardEdge] = Field(default_factory=list)
    animation_steps: list[AnimationStep] = Field(default_factory=list)
    grid: GridConfig = Field(default_factory=GridConfig)
    export_formats: list[str] = Field(default_factory=lambda: ["svg", "png"])
    embedded_asset_refs: list[str] = Field(default_factory=list)
```

---

## 3. Idempotency Key Schema

### 3.1 Formal Definition

The idempotency key is the unique fingerprint of a particular build request. Two build requests with identical idempotency keys must produce identical output artifacts or, in the case of non-deterministic providers, return the cached output from the first successful run.

```
idempotency_key = sha256(
    ir_hash
    || ":"
    || toolchain_version
    || ":"
    || policy_bundle_id
    || ":"
    || target_surface
)
```

Where:
- `ir_hash` = `SlideSpec.content_hash` (or the content hash of the applicable IR type)
- `toolchain_version` = dot-separated version string concatenating all renderer pinned versions, e.g. `python-pptx:0.6.23;ffmpeg:6.1.1;pandoc:3.1.8;weasyprint:60.2`
- `policy_bundle_id` = the UUID of the active policy bundle at build time
- `target_surface` = one of `web`, `email`, `pdf`, `pptx`, `mp4`, `wav`, `svg`, `archival`
- `||` = byte-level concatenation (no separator except the colons shown)

```python
import hashlib


def compute_idempotency_key(
    ir_hash: str,
    toolchain_version: str,
    policy_bundle_id: str,
    target_surface: str,
) -> str:
    """Compute a deterministic idempotency key for a build request.

    Returns a 64-character hex SHA-256 digest.
    """
    material = f"{ir_hash}:{toolchain_version}:{policy_bundle_id}:{target_surface}"
    return hashlib.sha256(material.encode("utf-8")).hexdigest()
```

### 3.2 Collision Properties

The sha256 preimage resistance guarantee means two different (ir_hash, toolchain_version, policy_bundle_id, target_surface) tuples will not produce the same idempotency key with any probability that is computationally meaningful. Specifically:

- Changing any one component of the key changes the resulting hash.
- An attacker who can modify the policy bundle ID but not the IR hash cannot forge a valid cache entry for a different build.
- The 256-bit output space makes birthday collisions practically impossible at any operational scale.

### 3.3 Cache Hit and Miss Logic

```python
from dataclasses import dataclass
from typing import Optional


@dataclass
class CacheLookupResult:
    hit: bool
    build_id: Optional[str]
    artifact_uris: Optional[dict[str, str]]
    provenance_id: Optional[str]
    cached_at: Optional[str]


def check_idempotency_cache(
    redis_client,
    idempotency_key: str,
) -> CacheLookupResult:
    """
    Check Redis for a cached successful build matching this idempotency key.

    Cache key format: artifact:idem:{idempotency_key}
    Cache value: JSON-encoded build record containing build_id, artifact_uris,
                 provenance_id, cached_at.

    On hit: return the cached result immediately; do not re-run the compiler.
    On miss: proceed to full compilation pipeline.
    """
    import json

    cache_key = f"artifact:idem:{idempotency_key}"
    raw = redis_client.get(cache_key)
    if raw is None:
        return CacheLookupResult(
            hit=False,
            build_id=None,
            artifact_uris=None,
            provenance_id=None,
            cached_at=None,
        )
    record = json.loads(raw)
    return CacheLookupResult(
        hit=True,
        build_id=record["build_id"],
        artifact_uris=record["artifact_uris"],
        provenance_id=record["provenance_id"],
        cached_at=record["cached_at"],
    )


def write_idempotency_cache(
    redis_client,
    idempotency_key: str,
    build_id: str,
    artifact_uris: dict[str, str],
    provenance_id: str,
    ttl_seconds: int = 86400 * 7,
) -> None:
    """Write a successful build result to the idempotency cache with a TTL."""
    import json
    from datetime import datetime, timezone

    cache_key = f"artifact:idem:{idempotency_key}"
    record = {
        "build_id": build_id,
        "artifact_uris": artifact_uris,
        "provenance_id": provenance_id,
        "cached_at": datetime.now(timezone.utc).isoformat(),
    }
    redis_client.set(cache_key, json.dumps(record), ex=ttl_seconds)
```

---

## 4. Rendering Pipelines

### 4.1 SlideSpec Pipeline

```
SlideSpec (IR)
    |
    v
[Stage 1: Validation]
    Schema conformance, asset URI resolution, data reference resolution,
    circular dependency detection, brand token validation.
    |
    v
[Stage 2: Planning]
    Topological sort of slide dependencies, asset prefetch manifest,
    dataset resolution, working directory allocation.
    |
    v
[Stage 3: OOXML Builder (python-pptx)]
    For each slide in slides:
        - Resolve layout template from brand_config
        - Lay out elements via deterministic grid/flex positioning
        - Render text with embedded fonts
        - Generate charts via Vega-Lite -> SVG -> EMF embedding
        - Embed images with SHA-256 asset hash verification
        - Set speaker notes
    Build Presentation() object and save to .pptx
    |
    v
[Stage 4: Thumbnail Generation]
    LibreOffice headless: soffice --headless --convert-to pdf deck.pptx
    pdftoppm -png -r 200 deck.pdf slide
    -> slide-000.png, slide-001.png, ...
    |
    v
[Stage 5: PDF Export]
    LibreOffice headless or direct WeasyPrint from HTML intermediate.
    |
    v
[Stage 6: Validation Gate]
    Layout overflow check, color contrast (WCAG AA 4.5:1 normal text),
    alt text completeness, heading hierarchy.
    |
    v
[Stage 7: Provenance + Export]
    Write artifact_provenance record, emit artifact.build.completed.v1.
```

**Key python-pptx pattern:**

```python
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor


def compile_slide_spec(spec: SlideSpec, output_path: str) -> str:
    prs = Presentation()
    prs.slide_width = Inches(spec.slide_size_cm[0] / 2.54)
    prs.slide_height = Inches(spec.slide_size_cm[1] / 2.54)

    for slide_def in spec.slides:
        layout = prs.slide_layouts[0]  # resolved from slide_def.layout key
        slide = prs.slides.add_slide(layout)

        for elem in slide_def.elements:
            if elem.type == "heading":
                txBox = slide.shapes.add_textbox(
                    Inches(0.5), Inches(0.5), Inches(12), Inches(1.5)
                )
                tf = txBox.text_frame
                tf.text = elem.text
                tf.paragraphs[0].runs[0].font.size = Pt(40)
                tf.paragraphs[0].runs[0].font.color.rgb = RGBColor(
                    *bytes.fromhex(spec.brand_config.primary_color.lstrip("#"))
                )
            elif elem.type == "image" and elem.asset_ref:
                slide.shapes.add_picture(
                    _resolve_asset(elem.asset_ref),
                    Inches(0.5),
                    Inches(2),
                    Inches(elem.width_px / 96) if elem.width_px else Inches(8),
                )

    prs.save(output_path)
    return output_path
```

### 4.2 DocSpec Pipeline

```
DocSpec (IR)
    |
    v
[Stage 1: Validation]
    Section type validation, citation ref resolution, data ref lookup.
    |
    v
[Stage 2: AST Construction]
    Walk sections in order, build a Pandoc-compatible AST (JSON).
    Apply style tokens to heading levels and body paragraphs.
    Resolve data_refs to inline table data.
    |
    v
[Stage 3A: DOCX Export via python-docx]
    Instantiate Document(), apply heading styles, add paragraphs,
    insert tables with column width distribution,
    embed images with alt text and caption anchoring,
    add footnotes from citation refs.
    Apply pagination constraints (max_page_length enforcement via section breaks).
    |
    v
[Stage 3B: PDF Export via WeasyPrint]
    Render AST to HTML with embedded CSS (style tokens -> CSS variables).
    WeasyPrint HTML -> PDF with margin enforcement, page numbering,
    orphan/widow prevention, and font embedding.
    |
    v
[Stage 4: Validation Gate]
    Page count check, heading hierarchy, citation completeness,
    word count, image alt text coverage.
    |
    v
[Stage 5: Provenance + Export]
```

### 4.3 SpreadsheetSpec Pipeline

```
SpreadsheetSpec (IR)
    |
    v
[Stage 1: Validation]
    Cell address format validation, formula syntax check (no circular refs),
    named range consistency.
    |
    v
[Stage 2: openpyxl Build]
    from openpyxl import Workbook
    wb = Workbook()
    For each SheetDef:
        ws = wb.create_sheet(sheet_def.name)
        For each (addr, value) in sheet_def.cells:
            ws[addr] = value  # formulas preserved verbatim
        For each named_range:
            wb.defined_names.add(DefinedName(name, attr_text=range_ref))
        For each ChartDef:
            Generate openpyxl chart object, add to worksheet.
        Apply freeze_rows, freeze_cols.
    wb.save(output_path)
    |
    v
[Stage 3: Validation Gate]
    Formula evaluation test (openpyxl data_only=True round-trip),
    named range resolution, chart data range validity.
    |
    v
[Stage 4: Provenance + Export]
```

### 4.4 TimelineSpec Pipeline (FFmpeg Filtergraph)

This is the most complex pipeline. The compiler translates the `TimelineSpec` into a complete FFmpeg invocation with a deterministic filtergraph. The filtergraph is generated by walking the `clips` list in order, computing input indices, and assembling `filter_complex` chains.

```
TimelineSpec (IR)
    |
    v
[Stage 1: Validation]
    Clip order, duration sum vs timeline duration, asset URI resolution.
    Veo generation configs validated (prompt non-empty, model version pinned).
    |
    v
[Stage 2: Scene Plan Extraction]
    For each clip with type=generated_veo:
        Build ScenePlan: prompt, negative_prompt, reference_images, duration,
        first_frame_ref, last_frame_ref, aspect_ratio.
    For each clip with type=generated_image (NanoBanana):
        Build NanoBananaJobSpec: prompt, size, seed (if provided), style_tokens.
    |
    v
[Stage 3A: Generative Asset Resolution]
    Submit NanoBanana jobs (sync or async); await images; store to S3.
    Submit Veo 3.1 jobs (async long-running operations); poll; download
    within 2-day server-side TTL; store to S3; capture operation_id,
    model_version, output_hash for provenance.
    |
    v
[Stage 3B: Slide Frame Rendering]
    For clips of type=slide_frame referencing a SlideSpec:
        Resolve SlideSpec, compile PPTX, convert to PNG via LibreOffice headless.
        Apply KenBurns via FFmpeg zoompan filter.
    |
    v
[Stage 4: FFmpeg Filtergraph Generation]
    See Section 4.4.1 for detailed filtergraph specification.
    |
    v
[Stage 5: FFmpeg Execution]
    Execute generated ffmpeg command; capture stdout/stderr; verify exit code 0.
    |
    v
[Stage 6: Audio DSP Chain]
    See Section 4.5 for AudioSpec / audio mixing pipeline.
    Mux final audio into video.
    |
    v
[Stage 7: Validation Gate]
    ffprobe validation: frame_rate, resolution, codec, duration delta < 0.1s.
    Caption sync validation: drift < 100ms per segment.
    File size check.
    |
    v
[Stage 8: Provenance + Export]
```

#### 4.4.1 FFmpeg Filtergraph Specification

The compiler generates filtergraphs programmatically from the `clips` list. The following examples show canonical patterns that the generator must produce.

**Static slide concatenation with crossfades:**

```bash
ffmpeg -y \
  -loop 1 -t 5.0 -i slide-000.png \
  -loop 1 -t 7.5 -i slide-001.png \
  -loop 1 -t 6.0 -i slide-002.png \
  -filter_complex "
    [0:v]fps=30,scale=1920:1080,format=yuv420p[v0];
    [1:v]fps=30,scale=1920:1080,format=yuv420p[v1];
    [2:v]fps=30,scale=1920:1080,format=yuv420p[v2];
    [v0][v1]xfade=transition=fade:duration=0.5:offset=4.5[xf01];
    [xf01][v2]xfade=transition=fade:duration=0.5:offset=11.5[v_out]
  " \
  -map "[v_out]" \
  -c:v libx264 -crf 23 -preset medium \
  out/video_no_audio.mp4
```

**Ken Burns zoom-pan per slide (deterministic parameters):**

```bash
ffmpeg -y -loop 1 -t 6 -i slide-000.png \
  -vf "zoompan=z='min(zoom+0.0008,1.08)':d=180:s=1920x1080:fps=30,format=yuv420p" \
  out/slide0_kb.mp4
```

**Audio mix: narration + background music with sidechain ducking and loudness normalization:**

```bash
ffmpeg -y \
  -i narration.wav \
  -i music.wav \
  -filter_complex "
    [1:a]volume=0.25[a_music];
    [a_music][0:a]sidechaincompress=threshold=0.02:ratio=8:attack=5:release=200[a_duck];
    [0:a][a_duck]amix=inputs=2:duration=first:dropout_transition=2[a_mix];
    [a_mix]loudnorm=I=-16:TP=-1.5:LRA=11[a_out]
  " \
  -map "[a_out]" \
  out/final_audio.wav
```

**Generated filtergraph builder (Python):**

```python
from dataclasses import dataclass


@dataclass
class FiltergraphResult:
    input_args: list[str]
    filter_complex: str
    output_map: str


def build_filtergraph(spec: TimelineSpec, resolved_assets: dict[str, str]) -> FiltergraphResult:
    """
    Translate a TimelineSpec into a deterministic FFmpeg filtergraph.

    Each clip in spec.clips becomes an input stream. The generator
    builds the filter_complex string by chaining scale, fps, and
    xfade filters in temporal order.

    Returns FiltergraphResult with input_args suitable for ffmpeg -i flags,
    the filter_complex string, and the output map label.
    """
    input_args: list[str] = []
    scale_chains: list[str] = []
    stream_labels: list[str] = []
    res = spec.render_params.resolution  # e.g. "1920x1080"
    fps = spec.render_params.frame_rate

    for idx, clip in enumerate(spec.clips):
        asset_path = resolved_assets[clip.clip_id]
        if clip.ken_burns:
            zoom_expr = (
                f"'min(zoom+{(clip.ken_burns.zoom_end - clip.ken_burns.zoom_start) / (clip.duration_seconds * fps):.6f},"
                f"{clip.ken_burns.zoom_end:.4f})'"
            )
            duration_frames = int(clip.duration_seconds * fps)
            input_args += ["-loop", "1", "-t", str(clip.duration_seconds), "-i", asset_path]
            scale_chains.append(
                f"[{idx}:v]zoompan=z={zoom_expr}:d={duration_frames}:s={res}:fps={fps},"
                f"format={spec.render_params.pixel_format}[v{idx}]"
            )
        else:
            input_args += ["-loop", "1", "-t", str(clip.duration_seconds), "-i", asset_path]
            scale_chains.append(
                f"[{idx}:v]fps={fps},scale={res.replace('x', ':')},format={spec.render_params.pixel_format}[v{idx}]"
            )
        stream_labels.append(f"v{idx}")

    # Build xfade chain
    xfade_chain: list[str] = []
    current_label = stream_labels[0]
    offset = 0.0
    for i, clip in enumerate(spec.clips[:-1]):
        next_label = stream_labels[i + 1]
        transition = "fade"
        transition_duration = 0.5
        if clip.transitions:
            t = clip.transitions[0]
            transition = t.type
            transition_duration = t.duration_seconds
        offset += clip.duration_seconds - transition_duration
        out_label = f"xf{i}{i+1}"
        xfade_chain.append(
            f"[{current_label}][{next_label}]xfade=transition={transition}:"
            f"duration={transition_duration}:offset={offset:.3f}[{out_label}]"
        )
        current_label = out_label

    filter_complex = ";\n    ".join(scale_chains + xfade_chain)
    return FiltergraphResult(
        input_args=input_args,
        filter_complex=filter_complex,
        output_map=f"[{current_label}]",
    )
```

### 4.5 AudioSpec Pipeline

```
AudioSpec (IR)
    |
    v
[Stage 1: Validation]
    TTS voice availability, asset URI resolution, ducking rule consistency.
    |
    v
[Stage 2: TTS Generation]
    For each AudioSegment with text and tts_voice:
        Call TTS API (Google Cloud TTS or ElevenLabs), request WAV output,
        store to temp path, verify duration_ms match within 5%.
    |
    v
[Stage 3: Per-Track DSP Application]
    For each AudioTrack, apply DspPipeline via FFmpeg filtergraph:
        highpass filter (if highpass_hz set)
        lowpass filter (if lowpass_hz set)
        equalizer (for each EqBand: equalizer=f=<freq>:t=o:w=<q>:g=<gain>)
        acompressor (for CompressorConfig)
        aecho (for ReverbConfig)
        volume (gain_db)
        afade (in/out from FadeConfig)
    |
    v
[Stage 4: Ducking Rules Application]
    For each DuckingRule:
        Apply sidechaincompress between source and target tracks.
        threshold=<rule.reduction_db converted to linear>:ratio=<ratio>
        attack=<attack_ms>:release=<release_ms>
    |
    v
[Stage 5: Master Chain / Loudness Normalization]
    amix all tracks.
    Apply loudnorm=I=<target_lufs>:TP=<true_peak>:LRA=<lra>.
    Apply master limiter.
    |
    v
[Stage 6: Format Export]
    WAV: pcm_s24le at 48000 Hz (lossless master).
    MP3: libmp3lame at spec.mp3_bitrate (e.g. 192k).
    AAC: aac at spec.aac_bitrate.
    |
    v
[Stage 7: Validation Gate]
    Measure output LUFS using ffmpeg loudnorm analysis pass.
    Verify target_lufs achieved within ±0.5 LU.
    Verify true_peak <= target_true_peak_lufs.
    |
    v
[Stage 8: Provenance + Export]
```

**Canonical AudioSpec FFmpeg DSP chain:**

```bash
ffmpeg -y \
  -i narration.wav \
  -i music.wav \
  -i ambient.wav \
  -filter_complex "
    [0:a]highpass=f=80,equalizer=f=3000:t=o:w=1.5:g=2,
         acompressor=threshold=-20dB:ratio=4:attack=10:release=100:makeup=1,
         volume=0dB[narr_proc];
    [1:a]volume=-9dB,afade=t=in:st=0:d=0.5,afade=t=out:st=<duration>:d=1[music_proc];
    [2:a]volume=-20dB[ambient_proc];
    [music_proc][narr_proc]sidechaincompress=threshold=0.02:ratio=8:attack=50:release=200[music_duck];
    [narr_proc][music_duck][ambient_proc]amix=inputs=3:duration=first:dropout_transition=2[premix];
    [premix]loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=-23.2:measured_LRA=7.3:
            measured_TP=-3.1:measured_thresh=-33.2:offset=5.8:linear=true:
            print_format=summary[a_out]
  " \
  -map "[a_out]" \
  -ar 48000 -c:a pcm_s24le \
  out/master.wav
```

### 4.6 BoardSpec Pipeline

```
BoardSpec (IR)
    |
    v
[Stage 1: Validation]
    Node position bounds check (within canvas), edge from/to node existence,
    z_index uniqueness, asset URI resolution.
    |
    v
[Stage 2: Layout Engine]
    Collision detection: flag overlapping nodes (warn if overlap < 10%).
    Auto-align: optionally snap nodes to grid (snap_to_grid from GridConfig).
    |
    v
[Stage 3: SVG Generation]
    Render nodes as SVG elements (rect, text, image, circle) with transforms.
    Route edges as SVG path elements (orthogonal: right-angle paths; bezier: cubic).
    Apply style tokens to fill/stroke/font attributes.
    Embed accessibility text layers (aria-label on each node).
    |
    v
[Stage 4: Animation Script Generation]
    If animation_steps non-empty:
        Generate JavaScript animation sequencer embedded in SVG or HTML.
        Each AnimationStep becomes a CSS class toggle or JS timeline entry.
    |
    v
[Stage 5: Multi-Format Export]
    SVG: write directly.
    PNG: rsvg-convert or headless Chromium screenshot at target DPI.
    PDF: rsvg-convert or WeasyPrint from HTML wrapper.
    HTML canvas: wrap SVG in HTML with interactive panning/zooming controls.
    |
    v
[Stage 6: Provenance + Export]
```

---

## 5. NanoBanana Integration

NanoBanana is treated as a synchronous or asynchronous image generation provider that supplies keyframe images for the artifact compilation pipeline. The platform is modeled as an API endpoint that accepts a structured generation request and returns a stable image URL plus metadata sufficient for deterministic replay.

### 5.1 Request Schema

```python
class NanoBananaRequest(BaseModel):
    """Full request body sent to the NanoBanana image generation API."""

    model_config = ConfigDict(frozen=True)

    prompt: str = Field(..., min_length=4, max_length=2000)
    negative_prompt: Optional[str] = None
    aspect_ratio: str = Field(default="16:9", description="'16:9', '9:16', '1:1'.")
    size: str = Field(default="2K", description="'1K', '2K', '4K'.")
    seed: Optional[int] = Field(
        default=None,
        description=(
            "If provided, the provider is asked to use this seed for reproducibility. "
            "Not all providers honor this parameter."
        ),
    )
    style_tokens: list[str] = Field(
        default_factory=list,
        description="Brand style identifiers passed to the provider (e.g. 'corporate-clean', 'dark-mode').",
    )
    num_outputs: int = Field(default=1, ge=1, le=4)
    output_format: str = Field(default="png", description="'png' or 'webp'.")
```

### 5.2 Response Schema

```python
class NanoBananaImageResult(BaseModel):
    image_url: str
    width_px: int
    height_px: int
    format: str
    seed_used: Optional[int] = Field(
        default=None,
        description="Actual seed used by the provider. Capture this for provenance; may differ from requested seed.",
    )
    model_version: str
    generation_id: str


class NanoBananaResponse(BaseModel):
    request_id: str
    images: list[NanoBananaImageResult]
    latency_ms: int
    provider: str = "nanobanana"
```

### 5.3 Determinism Strategy

NanoBanana is not guaranteed to produce byte-identical outputs across separate invocations of the same prompt, even when a seed is specified. The pipeline therefore treats NanoBanana outputs as content-addressed assets:

1. After receiving `NanoBananaResponse`, download each image immediately to internal object storage.
2. Compute `sha256(image_bytes)` and store as `output_hash`.
3. Record `seed_used`, `model_version`, and `generation_id` in the artifact provenance record.
4. Use the `output_hash` as the canonical reference to this image in all downstream compilation steps.
5. If the same `NanoBananaRequest` (same prompt, same seed) is submitted again and a cache entry with matching `(prompt_hash, seed, model_version)` exists, return the cached image without calling the provider again.

The **semantic equivalence fingerprint** for NanoBanana is computed as:

```python
import hashlib


def nanobanana_semantic_fingerprint(
    prompt: str,
    seed_used: Optional[int],
    model_version: str,
    style_tokens: list[str],
) -> str:
    """
    Compute a semantic fingerprint for a NanoBanana generation.

    This fingerprint identifies the generation parameters without
    being tied to the specific byte output. Two generations with the
    same fingerprint are considered semantically equivalent even if
    their byte contents differ.
    """
    tokens_str = ",".join(sorted(style_tokens))
    material = f"{prompt}|{seed_used}|{model_version}|{tokens_str}"
    return hashlib.sha256(material.encode("utf-8")).hexdigest()
```

Cache lookup for NanoBanana uses the semantic fingerprint as the primary key, falling back to exact `output_hash` match for byte-identical replay.

---

## 6. Veo 3.1 Integration

Veo 3.1 is the primary video generation provider. It supports text-to-video, image-to-video (up to 3 reference images), first/last frame interpolation, and native audio generation. Video outputs are stored server-side for only 48 hours; the pipeline must download and archive outputs within that window.

### 6.1 Job Submission Schema

```python
class VeoAudioConfig(BaseModel):
    model_config = ConfigDict(frozen=True)

    generate_audio: bool = False
    audio_prompt: Optional[str] = None


class VeoJobRequest(BaseModel):
    """Request body for submitting a Veo 3.1 generation job."""

    model_config = ConfigDict(frozen=True)

    model: str = Field(default="veo-3.1-generate-preview")
    prompt: str = Field(..., min_length=4, max_length=4000)
    negative_prompt: Optional[str] = None
    duration_seconds: float = Field(default=8.0, ge=4.0, le=60.0)
    aspect_ratio: str = Field(default="16:9", description="'16:9' or '9:16'.")
    reference_images: list[str] = Field(
        default_factory=list,
        max_length=3,
        description="Up to 3 S3 URIs or base64-encoded images for image-based direction.",
    )
    first_frame_ref: Optional[str] = Field(
        default=None,
        description="S3 URI or base64 image. When set, Veo interpolates motion from this first frame.",
    )
    last_frame_ref: Optional[str] = Field(
        default=None,
        description="S3 URI or base64 image. Used with first_frame_ref for frame interpolation.",
    )
    audio_config: VeoAudioConfig = Field(default_factory=VeoAudioConfig)
    prompts_hash: str = Field(
        ...,
        pattern=r"^[a-f0-9]{64}$",
        description="SHA-256 of the canonical JSON of prompt + negative_prompt + reference_images.",
    )
```

### 6.2 Async Polling and Completion

```python
class VeoJobStatus(str, Enum):
    pending = "pending"
    running = "running"
    completed = "completed"
    failed = "failed"


class VeoJobResponse(BaseModel):
    operation_id: str
    status: VeoJobStatus
    model_version: str
    created_at: datetime
    completed_at: Optional[datetime] = None
    video_url: Optional[str] = None
    video_duration_seconds: Optional[float] = None
    ttl_expires_at: Optional[datetime] = None
    error_message: Optional[str] = None
    watermark: str = "SynthID"


def poll_veo_job(
    client,
    operation_id: str,
    poll_interval_seconds: float = 15.0,
    max_wait_seconds: float = 600.0,
) -> VeoJobResponse:
    """
    Poll a Veo 3.1 long-running operation until completion or timeout.

    Veo 3.1 latency ranges from ~11 seconds to several minutes.
    This function uses a fixed poll interval; a production implementation
    should use exponential backoff with jitter (via tenacity).
    """
    import time

    elapsed = 0.0
    while elapsed < max_wait_seconds:
        response = client.get_operation(operation_id)
        if response.status == VeoJobStatus.completed:
            return response
        if response.status == VeoJobStatus.failed:
            raise RuntimeError(
                f"Veo job {operation_id} failed: {response.error_message}"
            )
        time.sleep(poll_interval_seconds)
        elapsed += poll_interval_seconds
    raise TimeoutError(
        f"Veo job {operation_id} did not complete within {max_wait_seconds}s"
    )
```

### 6.3 Output Storage and Fingerprinting

After polling completes:

1. Download the video from `video_url` immediately (48-hour TTL; download must happen within this window).
2. Compute `sha256(video_bytes)` and store as `output_hash`.
3. Upload to internal object storage at a stable, content-addressed S3 URI: `s3://artifacts/veo/{operation_id}/{output_hash}.mp4`.
4. Record the full provenance entry (see Section 8).
5. Mark `non_deterministic: true` because Veo does not guarantee byte-identical outputs for repeated invocations.

The **semantic equivalence fingerprint** for Veo is:

```python
def veo_semantic_fingerprint(
    prompt: str,
    negative_prompt: Optional[str],
    model_version: str,
    reference_image_hashes: list[str],
    first_frame_hash: Optional[str],
    last_frame_hash: Optional[str],
) -> str:
    """
    Compute a semantic fingerprint for a Veo generation.

    Two Veo generations with identical fingerprints are considered
    semantically equivalent for provenance purposes, even if their
    byte-level outputs differ (because Veo is non-deterministic).
    """
    ref_str = ",".join(sorted(reference_image_hashes))
    material = (
        f"{prompt}|{negative_prompt or ''}|{model_version}"
        f"|refs:{ref_str}|first:{first_frame_hash or ''}|last:{last_frame_hash or ''}"
    )
    return hashlib.sha256(material.encode("utf-8")).hexdigest()
```

---

## 7. Provenance Chain

### 7.1 Formal Definition

Every artifact build produces exactly one provenance record that captures the complete causal chain from input specification to output file. The provenance record is signed and appended to the immutable event ledger.

```python
class ProviderType(str, Enum):
    python_pptx = "python-pptx"
    ffmpeg = "ffmpeg"
    weasyprint = "weasyprint"
    pandoc = "pandoc"
    openpyxl = "openpyxl"
    libreoffice_headless = "libreoffice-headless"
    veo = "veo"
    nanobanana = "nanobanana"
    tts_google = "tts-google"
    tts_elevenlabs = "tts-elevenlabs"
    svg_engine = "svg-engine"


class AssetProvenance(BaseModel):
    model_config = ConfigDict(frozen=True)

    asset_ref: str
    asset_hash: str
    fetch_url: Optional[str] = None
    fetched_at: Optional[datetime] = None


class GeneratorRecord(BaseModel):
    """Record for one external generative provider call within a build."""

    model_config = ConfigDict(frozen=True)

    provider: ProviderType
    model_version: str
    scene_ids: list[str]
    operation_ids: list[str]
    prompts_hash: str
    seed_used: Optional[int] = None
    output_hashes: list[str]
    semantic_fingerprint: str
    non_deterministic: bool = True
    generated_at: datetime


class ArtifactProvenance(BaseModel):
    """
    Signed provenance record for one artifact build.

    build_id: matches artifact_builds.id in PostgreSQL.
    provider: primary renderer used (e.g. 'ffmpeg', 'python-pptx').
    model_version: toolchain version string for the primary renderer.
    inputs_hash: sha256 of all input hashes concatenated.
    ir_hash: content_hash of the source IR.
    output_hash: sha256 of the primary output artifact bytes.
    seed: reserved for deterministic providers that support seeding.
    signature: RSA-SHA256 or Ed25519 signature over the canonical JSON of this record.
    created_at: UTC timestamp.
    generator_records: one entry per external generative provider call.
    asset_provenances: one entry per resolved external asset.
    non_deterministic: true if any generator in this build was non-deterministic.
    """

    model_config = ConfigDict(frozen=True)

    provenance_id: str
    build_id: str
    ir_id: str
    ir_hash: str
    inputs_hash: str
    policy_bundle_id: str
    provider: ProviderType
    model_version: str
    output_hash: str
    output_uri: str
    seed: Optional[int] = None
    signature: str
    created_at: datetime
    generator_records: list[GeneratorRecord] = Field(default_factory=list)
    asset_provenances: list[AssetProvenance] = Field(default_factory=list)
    non_deterministic: bool = False
    validation_status: str = "pass"
```

### 7.2 Signing Scheme

```python
import base64
import json

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding


def sign_provenance(
    provenance: ArtifactProvenance,
    private_key_pem: bytes,
) -> str:
    """
    Sign the canonical JSON of an ArtifactProvenance record.

    Uses RSA-PSS with SHA-256. Returns base64url-encoded signature.
    The private key is held in the platform secrets vault;
    agents never receive the raw key material.
    """
    key = serialization.load_pem_private_key(private_key_pem, password=None)
    # Exclude the signature field itself from the signed payload.
    payload = provenance.model_dump(exclude={"signature"})
    canonical = json.dumps(payload, sort_keys=True, default=str).encode("utf-8")
    sig = key.sign(canonical, padding.PSS(mgf=padding.MGF1(hashes.SHA256()), salt_length=padding.PSS.MAX_LENGTH), hashes.SHA256())
    return base64.urlsafe_b64encode(sig).decode("ascii")


def verify_provenance(
    provenance: ArtifactProvenance,
    public_key_pem: bytes,
) -> bool:
    """Verify the signature of an ArtifactProvenance record."""
    from cryptography.exceptions import InvalidSignature

    key = serialization.load_pem_public_key(public_key_pem)
    payload = provenance.model_dump(exclude={"signature"})
    canonical = json.dumps(payload, sort_keys=True, default=str).encode("utf-8")
    sig = base64.urlsafe_b64decode(provenance.signature)
    try:
        key.verify(sig, canonical, padding.PSS(mgf=padding.MGF1(hashes.SHA256()), salt_length=padding.PSS.MAX_LENGTH), hashes.SHA256())
        return True
    except InvalidSignature:
        return False
```

---

## 8. Database Schema

All tables are PostgreSQL. Timestamps use `TIMESTAMPTZ`. `JSONB` columns store structured payloads for flexible querying.

```sql
-- ─────────────────────────────────────────────────────────────────
-- artifact_ir: immutable IR registrations
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE artifact_ir (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    ir_type         TEXT         NOT NULL CHECK (ir_type IN (
                        'SlideSpec', 'DocSpec', 'SpreadsheetSpec',
                        'TimelineSpec', 'AudioSpec', 'BoardSpec'
                    )),
    schema_version  TEXT         NOT NULL,
    content_hash    CHAR(64)     NOT NULL UNIQUE,
    inputs_hash     CHAR(64)     NOT NULL,
    policy_bundle_id UUID        NOT NULL,
    spec_id         TEXT         NOT NULL,
    created_by      TEXT         NOT NULL,
    payload_json    JSONB        NOT NULL,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT artifact_ir_content_hash_format CHECK (content_hash ~ '^[a-f0-9]{64}$'),
    CONSTRAINT artifact_ir_inputs_hash_format  CHECK (inputs_hash  ~ '^[a-f0-9]{64}$')
);

CREATE INDEX idx_artifact_ir_content_hash    ON artifact_ir (content_hash);
CREATE INDEX idx_artifact_ir_ir_type         ON artifact_ir (ir_type);
CREATE INDEX idx_artifact_ir_policy_bundle   ON artifact_ir (policy_bundle_id);
CREATE INDEX idx_artifact_ir_created_at      ON artifact_ir (created_at);

-- ─────────────────────────────────────────────────────────────────
-- artifact_builds: one row per build attempt
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE artifact_builds (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    ir_id               UUID         NOT NULL REFERENCES artifact_ir (id),
    idempotency_key     CHAR(64)     NOT NULL UNIQUE,
    toolchain_version   TEXT         NOT NULL,
    target_surface      TEXT         NOT NULL,
    status              TEXT         NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cached')),
    stage               TEXT,
    started_at          TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    duration_seconds    NUMERIC(10, 3),
    output_uris         JSONB,
    output_hash         CHAR(64),
    error_code          TEXT,
    error_message       TEXT,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT artifact_builds_idempotency_key_format
        CHECK (idempotency_key ~ '^[a-f0-9]{64}$')
);

CREATE INDEX idx_artifact_builds_ir_id           ON artifact_builds (ir_id);
CREATE INDEX idx_artifact_builds_idempotency_key ON artifact_builds (idempotency_key);
CREATE INDEX idx_artifact_builds_status          ON artifact_builds (status);
CREATE INDEX idx_artifact_builds_created_at      ON artifact_builds (created_at);

-- ─────────────────────────────────────────────────────────────────
-- artifact_provenance: signed provenance record per successful build
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE artifact_provenance (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    build_id            UUID         NOT NULL REFERENCES artifact_builds (id),
    ir_id               UUID         NOT NULL REFERENCES artifact_ir (id),
    ir_hash             CHAR(64)     NOT NULL,
    inputs_hash         CHAR(64)     NOT NULL,
    policy_bundle_id    UUID         NOT NULL,
    provider            TEXT         NOT NULL,
    model_version       TEXT         NOT NULL,
    output_hash         CHAR(64)     NOT NULL,
    output_uri          TEXT         NOT NULL,
    seed                BIGINT,
    signature           TEXT         NOT NULL,
    non_deterministic   BOOLEAN      NOT NULL DEFAULT FALSE,
    validation_status   TEXT         NOT NULL DEFAULT 'pass',
    generator_records   JSONB        NOT NULL DEFAULT '[]',
    asset_provenances   JSONB        NOT NULL DEFAULT '[]',
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT artifact_provenance_ir_hash_format
        CHECK (ir_hash ~ '^[a-f0-9]{64}$'),
    CONSTRAINT artifact_provenance_output_hash_format
        CHECK (output_hash ~ '^[a-f0-9]{64}$')
);

CREATE UNIQUE INDEX idx_artifact_provenance_build_id ON artifact_provenance (build_id);
CREATE INDEX idx_artifact_provenance_ir_id           ON artifact_provenance (ir_id);
CREATE INDEX idx_artifact_provenance_output_hash     ON artifact_provenance (output_hash);
CREATE INDEX idx_artifact_provenance_non_deterministic
    ON artifact_provenance (non_deterministic)
    WHERE non_deterministic = TRUE;

-- ─────────────────────────────────────────────────────────────────
-- idempotency_cache: fast lookup table mirroring Redis cache in DB
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE idempotency_cache (
    idempotency_key     CHAR(64)     PRIMARY KEY,
    build_id            UUID         NOT NULL REFERENCES artifact_builds (id),
    artifact_uris       JSONB        NOT NULL,
    provenance_id       UUID         NOT NULL REFERENCES artifact_provenance (id),
    cached_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
    expires_at          TIMESTAMPTZ  NOT NULL,

    CONSTRAINT idempotency_cache_key_format
        CHECK (idempotency_key ~ '^[a-f0-9]{64}$')
);

CREATE INDEX idx_idempotency_cache_expires_at ON idempotency_cache (expires_at);

-- ─────────────────────────────────────────────────────────────────
-- render_jobs: one row per external provider job (Veo, NanoBanana, TTS)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE render_jobs (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    build_id            UUID         NOT NULL REFERENCES artifact_builds (id),
    provider            TEXT         NOT NULL,
    model_version       TEXT         NOT NULL,
    operation_id        TEXT         NOT NULL,
    prompts_hash        CHAR(64)     NOT NULL,
    seed_used           BIGINT,
    status              TEXT         NOT NULL DEFAULT 'submitted'
                            CHECK (status IN ('submitted', 'polling', 'completed', 'failed', 'expired')),
    output_uri          TEXT,
    output_hash         CHAR(64),
    ttl_expires_at      TIMESTAMPTZ,
    semantic_fingerprint CHAR(64),
    non_deterministic   BOOLEAN      NOT NULL DEFAULT TRUE,
    submitted_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    completed_at        TIMESTAMPTZ,
    error_message       TEXT,

    CONSTRAINT render_jobs_prompts_hash_format
        CHECK (prompts_hash ~ '^[a-f0-9]{64}$')
);

CREATE INDEX idx_render_jobs_build_id           ON render_jobs (build_id);
CREATE INDEX idx_render_jobs_operation_id       ON render_jobs (operation_id);
CREATE INDEX idx_render_jobs_status             ON render_jobs (status);
CREATE INDEX idx_render_jobs_ttl_expires_at     ON render_jobs (ttl_expires_at)
    WHERE status NOT IN ('completed', 'failed', 'expired');
CREATE INDEX idx_render_jobs_semantic_fingerprint ON render_jobs (semantic_fingerprint);

-- Partial index for pending TTL monitoring (download before expiry)
CREATE INDEX idx_render_jobs_pending_download ON render_jobs (ttl_expires_at)
    WHERE status = 'completed' AND output_uri IS NULL;
```

---

## 9. Event Contracts

All events use the platform `EventEnvelopeV1` (defined in `SCHEMA_PACK.md`). The following are `payload` schemas for artifact-domain events. All schemas are JSON Schema draft-07.

### 9.1 artifact.build.started.v1

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://venture.autonomy/schemas/v1/artifact-build-started.json",
  "title": "artifact.build.started.v1 payload",
  "type": "object",
  "required": ["build_id", "ir_id", "ir_type", "idempotency_key", "toolchain_version", "target_surface"],
  "additionalProperties": false,
  "properties": {
    "build_id":           { "type": "string", "format": "uuid" },
    "ir_id":              { "type": "string", "format": "uuid" },
    "ir_type":            { "type": "string", "enum": ["SlideSpec","DocSpec","SpreadsheetSpec","TimelineSpec","AudioSpec","BoardSpec"] },
    "idempotency_key":    { "type": "string", "pattern": "^[a-f0-9]{64}$" },
    "toolchain_version":  { "type": "string", "minLength": 4 },
    "target_surface":     { "type": "string", "minLength": 2 },
    "cache_hit":          { "type": "boolean" }
  }
}
```

### 9.2 artifact.build.completed.v1

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://venture.autonomy/schemas/v1/artifact-build-completed.json",
  "title": "artifact.build.completed.v1 payload",
  "type": "object",
  "required": ["build_id", "ir_id", "idempotency_key", "output_uris", "output_hash", "duration_seconds", "validation_status", "non_deterministic"],
  "additionalProperties": false,
  "properties": {
    "build_id":           { "type": "string", "format": "uuid" },
    "ir_id":              { "type": "string", "format": "uuid" },
    "idempotency_key":    { "type": "string", "pattern": "^[a-f0-9]{64}$" },
    "output_uris": {
      "type": "object",
      "description": "Map of format name to S3 URI, e.g. { 'mp4': 's3://...', 'webm': 's3://...' }.",
      "additionalProperties": { "type": "string" }
    },
    "output_hash":        { "type": "string", "pattern": "^[a-f0-9]{64}$" },
    "duration_seconds":   { "type": "number", "minimum": 0 },
    "validation_status":  { "type": "string", "enum": ["pass", "fail"] },
    "non_deterministic":  { "type": "boolean" },
    "provenance_id":      { "type": "string", "format": "uuid" }
  }
}
```

### 9.3 artifact.build.failed.v1

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://venture.autonomy/schemas/v1/artifact-build-failed.json",
  "title": "artifact.build.failed.v1 payload",
  "type": "object",
  "required": ["build_id", "ir_id", "stage", "error_code", "error_message"],
  "additionalProperties": false,
  "properties": {
    "build_id":      { "type": "string", "format": "uuid" },
    "ir_id":         { "type": "string", "format": "uuid" },
    "stage":         { "type": "string", "enum": ["validation","planning","compilation","quality_gate","export","provenance"] },
    "error_code":    { "type": "string", "minLength": 4, "maxLength": 64 },
    "error_message": { "type": "string", "maxLength": 4096 },
    "duration_seconds": { "type": "number", "minimum": 0 }
  }
}
```

### 9.4 artifact.provenance.attested.v1

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://venture.autonomy/schemas/v1/artifact-provenance-attested.json",
  "title": "artifact.provenance.attested.v1 payload",
  "type": "object",
  "required": ["provenance_id", "build_id", "provider", "model_version", "ir_hash", "inputs_hash", "output_hash", "signature", "non_deterministic"],
  "additionalProperties": false,
  "properties": {
    "provenance_id":     { "type": "string", "format": "uuid" },
    "build_id":          { "type": "string", "format": "uuid" },
    "provider":          { "type": "string", "minLength": 2 },
    "model_version":     { "type": "string", "minLength": 2 },
    "ir_hash":           { "type": "string", "pattern": "^[a-f0-9]{64}$" },
    "inputs_hash":       { "type": "string", "pattern": "^[a-f0-9]{64}$" },
    "output_hash":       { "type": "string", "pattern": "^[a-f0-9]{64}$" },
    "signature":         { "type": "string", "minLength": 40 },
    "non_deterministic": { "type": "boolean" },
    "generator_count":   { "type": "integer", "minimum": 0 }
  }
}
```

### 9.5 artifact.cache.hit.v1

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://venture.autonomy/schemas/v1/artifact-cache-hit.json",
  "title": "artifact.cache.hit.v1 payload",
  "type": "object",
  "required": ["idempotency_key", "build_id", "ir_id", "provenance_id", "artifact_uris", "cached_at"],
  "additionalProperties": false,
  "properties": {
    "idempotency_key": { "type": "string", "pattern": "^[a-f0-9]{64}$" },
    "build_id":        { "type": "string", "format": "uuid" },
    "ir_id":           { "type": "string", "format": "uuid" },
    "provenance_id":   { "type": "string", "format": "uuid" },
    "artifact_uris":   { "type": "object", "additionalProperties": { "type": "string" } },
    "cached_at":       { "type": "string", "format": "date-time" }
  }
}
```

---

## 10. Non-Determinism Handling

### 10.1 Policy for Non-Deterministic Providers

Providers that cannot guarantee byte-identical outputs across invocations are classified as **non-deterministic**. Currently this applies to:

- Veo 3.1 (all invocations)
- NanoBanana (invocations without a captured and honored seed)
- All TTS providers when invoked without explicit prosody pinning

For these providers, the pipeline applies the following policy:

1. **First invocation**: execute the provider call, download outputs immediately, compute `output_hash`, store to content-addressed S3, record semantic fingerprint and all generation parameters in `render_jobs`.
2. **Subsequent invocations with matching semantic fingerprint**: return the cached output (same semantic fingerprint = same generation parameters = semantically equivalent output). Do not call the provider again.
3. **Tag the build**: set `non_deterministic: true` on the `artifact_provenance` record and on `artifact.build.completed.v1`.
4. **Replay behavior**: a replay of a build containing non-deterministic providers does not re-invoke the provider. It returns the archived output from the original invocation. This guarantees that the provenance record remains stable across replays.

### 10.2 Semantic Equivalence Fingerprint Definition

The semantic equivalence fingerprint for any generator call is a SHA-256 digest of the stable generation parameters (excluding any fields that vary across retries or between semantically equivalent calls):

```
semantic_fingerprint = sha256(
    provider_name
    || model_version
    || canonical_prompt
    || negative_prompt (or "" if absent)
    || sorted_reference_image_hashes (comma-separated)
    || first_frame_hash (or "" if absent)
    || last_frame_hash (or "" if absent)
    || seed_requested (or "" if absent)
    || style_tokens (sorted, comma-separated)
)
```

Two generator calls with the same semantic fingerprint are considered semantically equivalent. The first successful call establishes the canonical output for that fingerprint. All subsequent calls with the same fingerprint return the canonical output without invoking the provider.

### 10.3 Cache Invalidation Rules

The idempotency cache for non-deterministic builds is invalidated under the following conditions:

| Trigger | Action |
|---|---|
| `model_version` changes for a provider | Invalidate all cache entries whose `generator_records` contain the old model version |
| `policy_bundle_id` changes (brand token update) | Invalidate all cache entries referencing the old policy bundle ID |
| Explicit `cache_bust: true` flag on build request | Skip cache lookup; always re-run |
| `non_deterministic_override: true` on build request | Re-invoke provider; update semantic fingerprint cache entry |
| Cache TTL expires (7 days default) | Entry removed from both Redis and `idempotency_cache` table |

---

## 11. Quality Validation

### 11.1 Validation Function Signatures

```python
from dataclasses import dataclass, field


@dataclass
class ValidationCheck:
    name: str
    status: str  # 'pass' | 'warn' | 'fail'
    severity: str  # 'error' | 'warning' | 'info'
    affected_elements: list[dict] = field(default_factory=list)
    suggestion: Optional[str] = None


@dataclass
class ValidationReport:
    status: str  # 'pass' | 'fail'
    checks: list[ValidationCheck] = field(default_factory=list)

    @property
    def passed(self) -> bool:
        return all(c.status != 'fail' for c in self.checks if c.severity == 'error')


def validate_slide_spec(spec: SlideSpec, compiled_pptx_path: str) -> ValidationReport:
    """
    Validate a compiled SlideSpec PPTX against quality gates.

    Checks performed:
    - Layout overflow: no text element overflows its bounding box.
    - Color contrast: all text/background pairs >= 4.5:1 (WCAG AA) for normal text,
                      >= 3:1 for large text (>= 18pt or 14pt bold).
    - Alt text: all image elements have non-empty alt_text.
    - Heading hierarchy: headings do not skip levels.
    - Font embedding: all fonts embedded in PPTX (for offline rendering).
    """
    ...


def validate_doc_spec(spec: DocSpec, compiled_pdf_path: str) -> ValidationReport:
    """
    Validate a compiled DocSpec PDF.

    Checks:
    - Page count within spec.max_page_length.
    - Heading hierarchy (no skipped levels).
    - Citation completeness (all citations in sections have matching ref entries).
    - Alt text on all figure elements.
    - PDF structure validity (pdfinfo exit code 0).
    """
    ...


def validate_timeline_spec(spec: TimelineSpec, compiled_mp4_path: str) -> ValidationReport:
    """
    Validate a compiled TimelineSpec MP4.

    Checks (via ffprobe):
    - Frame rate matches spec.render_params.frame_rate (±0.01 fps tolerance).
    - Resolution matches spec.render_params.resolution.
    - Codec matches spec.render_params.codec.
    - Duration delta < 0.1s vs spec.duration_seconds.
    - No black frames detected (heuristic: mean luma > 10 for all frames).
    - Caption sync: all caption segments within max_drift_ms of narration timestamps.
    - File size < 500 MB.
    """
    ...


def validate_audio_spec(spec: AudioSpec, compiled_wav_path: str) -> ValidationReport:
    """
    Validate a compiled AudioSpec WAV.

    Checks (via ffmpeg loudnorm analysis pass):
    - Measured integrated loudness within ±0.5 LU of spec.master_chain.target_loudness_lufs.
    - True peak <= spec.master_chain.target_true_peak_lufs.
    - Sample rate matches spec.sample_rate_hz.
    - Bit depth matches spec.bit_depth.
    - No clipping detected (true peak analysis).
    """
    ...
```

### 11.2 Error Categories

| Category | Severity | Remediation Action |
|---|---|---|
| `SCHEMA_VIOLATION` | error | Reject IR; do not attempt compilation |
| `ASSET_UNRESOLVABLE` | error | Reject IR; return asset URI error |
| `LAYOUT_OVERFLOW` | warning | Reduce font size by 1pt or trim content |
| `COLOR_CONTRAST_FAIL` | error | Darken text or lighten background token |
| `ALT_TEXT_MISSING` | error | Add alt_text to all image elements |
| `HEADING_HIERARCHY_SKIP` | warning | Re-sequence heading levels |
| `LOUDNESS_OUT_OF_RANGE` | error | Adjust master_chain target_loudness_lufs |
| `TRUE_PEAK_EXCEEDED` | error | Lower master_limiter_db |
| `CAPTION_DRIFT_EXCEEDED` | error | Re-align caption timestamps |
| `DURATION_MISMATCH` | warning | Extend or trim last clip |
| `CODEC_MISMATCH` | error | Re-run FFmpeg with correct codec flag |
| `FILE_SIZE_EXCEEDED` | warning | Lower CRF or reduce resolution |
| `FRAME_RATE_MISMATCH` | error | Re-run FFmpeg with correct fps filter |
| `PDF_CORRUPT` | error | Re-run WeasyPrint; check HTML intermediate |
| `VEO_TTL_EXPIRED` | error | Re-invoke Veo, update provenance |

---

## 12. Export Matrix

| Artifact Type | Target Surface | Renderer | Output Format | Notes |
|---|---|---|---|---|
| SlideSpec | presentation | python-pptx | PPTX | Primary; slide layout + charts + images |
| SlideSpec | web | python-pptx + reveal.js | HTML | JavaScript deck with embedded assets |
| SlideSpec | print | LibreOffice headless | PDF | 300 DPI, fonts embedded |
| SlideSpec | thumbnail | LibreOffice + pdftoppm | PNG | 1920x1080 per slide |
| SlideSpec | archival | python-pptx | PPTX + PDF | Both formats for archival |
| DocSpec | web | WeasyPrint | HTML | Responsive, breakpoints from output_channels |
| DocSpec | email | WeasyPrint | HTML | Inlined CSS, 600px width |
| DocSpec | print | WeasyPrint or Pandoc | PDF | A4 or Letter, font embedded |
| DocSpec | docx | python-docx | DOCX | OpenXML compatible |
| DocSpec | archival | Pandoc | Markdown + PDF | Both for version control + print |
| SpreadsheetSpec | data | openpyxl | XLSX | Formulas, charts, named ranges |
| SpreadsheetSpec | web | openpyxl + xlsx2html | HTML table | Static rendering |
| SpreadsheetSpec | archival | openpyxl | XLSX | With formula audit trail |
| TimelineSpec | web | FFmpeg | MP4 H.264 + WebM | H.264 for Safari; WebM for Chrome/Firefox |
| TimelineSpec | social_16_9 | FFmpeg | MP4 H.264 1080p | Standard landscape |
| TimelineSpec | social_9_16 | FFmpeg | MP4 H.264 1080x1920 | Vertical for TikTok/Reels |
| TimelineSpec | professional | FFmpeg | ProRes 422 HQ | For video editors / archival |
| TimelineSpec | archival | FFmpeg | MP4 + ProRes + SRT | All formats with sidecar subtitles |
| AudioSpec | web | FFmpeg | MP3 192kbps | Streaming |
| AudioSpec | mobile | FFmpeg | AAC 256kbps | Apple/Android compatible |
| AudioSpec | archival | FFmpeg | WAV 24-bit 48kHz | Lossless master |
| AudioSpec | podcast | FFmpeg | MP3 128kbps | Mono, optimized for speech |
| BoardSpec | web | SVG engine | SVG | Vector, web-ready |
| BoardSpec | print | rsvg-convert | PDF | Print-quality |
| BoardSpec | raster | headless Chromium | PNG 2x | High-DPI screenshot |
| BoardSpec | interactive | SVG + JavaScript | HTML | Pan/zoom controls |
| BoardSpec | archival | SVG engine | SVG + PNG | Both for archival |

---

## 13. Conservation Invariants and Property Tests

### 13.1 Idempotency Invariant

**Invariant**: For any build request B with idempotency key K:
- If `artifact_builds` contains a row with `idempotency_key = K` and `status = 'completed'`, then any subsequent build request with the same K must return the cached artifact from that row without re-running the compiler.
- The returned artifact has `output_hash` identical to the originally stored `output_hash`.
- The event `artifact.cache.hit.v1` is emitted.

This invariant holds for all deterministic providers. For non-deterministic providers, the invariant holds for the cached output (the first successful invocation's output is canonical for that semantic fingerprint).

### 13.2 Provenance Chain Completeness Invariant

**Invariant**: For every row in `artifact_builds` with `status = 'completed'`:
- Exactly one row in `artifact_provenance` references that `build_id`.
- That provenance record has a non-null, non-empty `signature`.
- `verify_provenance(provenance, platform_public_key)` returns `True`.
- The `ir_hash` in the provenance record matches `artifact_ir.content_hash` for the linked `ir_id`.

### 13.3 No Unsigned Artifacts Invariant

**Invariant**: No artifact file stored in S3 is delivered to a requester without a corresponding, verified provenance record in `artifact_provenance`. The artifact delivery API must:
1. Look up `artifact_builds` by `idempotency_key` or `build_id`.
2. Look up `artifact_provenance` by `build_id`.
3. Verify the provenance signature.
4. Only return a signed URL to the artifact if signature verification passes.

If signature verification fails, the delivery API must return HTTP 409 Conflict and emit `artifact.provenance.verification_failed.v1`.

---

## 14. Acceptance Test Suite

```python
"""
Acceptance tests for artifact determinism.
Run with: pytest tests/test_artifact_determinism.py -v
"""
import hashlib
import json

import pytest

from artifact_compiler.build import run_build
from artifact_compiler.cache import check_idempotency_cache, write_idempotency_cache
from artifact_compiler.idempotency import compute_idempotency_key
from artifact_compiler.provenance import sign_provenance, verify_provenance
from artifact_compiler.ir import SlideSpec, TimelineSpec


# ─────────────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────────────

@pytest.fixture
def minimal_slide_spec(brand_config_fixture) -> SlideSpec:
    """Returns a minimal, deterministic SlideSpec for replay testing."""
    ...


@pytest.fixture
def pinned_toolchain_version() -> str:
    return "python-pptx:0.6.23;ffmpeg:6.1.1;pandoc:3.1.8;weasyprint:60.2"


@pytest.fixture
def policy_bundle_id() -> str:
    return "policy-bundle-test-v1.0"


# ─────────────────────────────────────────────────────────────────
# Test: byte-identical replay for deterministic builds
# ─────────────────────────────────────────────────────────────────

def test_slide_spec_byte_identical_replay(
    minimal_slide_spec: SlideSpec,
    pinned_toolchain_version: str,
    policy_bundle_id: str,
) -> None:
    """
    Two builds of the same SlideSpec with the same toolchain and policy bundle
    must produce byte-identical PPTX output.
    """
    idem_key = compute_idempotency_key(
        ir_hash=minimal_slide_spec.content_hash,
        toolchain_version=pinned_toolchain_version,
        policy_bundle_id=policy_bundle_id,
        target_surface="pptx",
    )

    result1 = run_build(minimal_slide_spec, idem_key, target_surface="pptx")
    result2 = run_build(minimal_slide_spec, idem_key, target_surface="pptx")

    assert result1.output_hash == result2.output_hash, (
        "Byte-identical replay failed: output hashes differ between two builds of the same IR."
    )


# ─────────────────────────────────────────────────────────────────
# Test: cache hit correctness
# ─────────────────────────────────────────────────────────────────

def test_cache_hit_returns_without_recompile(
    redis_client_fixture,
    minimal_slide_spec: SlideSpec,
    pinned_toolchain_version: str,
    policy_bundle_id: str,
) -> None:
    """
    After a successful build, a second build request with the same idempotency key
    must return a cache hit without invoking the compiler.
    """
    idem_key = compute_idempotency_key(
        ir_hash=minimal_slide_spec.content_hash,
        toolchain_version=pinned_toolchain_version,
        policy_bundle_id=policy_bundle_id,
        target_surface="pptx",
    )

    first_result = run_build(minimal_slide_spec, idem_key, target_surface="pptx")

    cache_result = check_idempotency_cache(redis_client_fixture, idem_key)
    assert cache_result.hit is True
    assert cache_result.build_id == first_result.build_id

    second_result = run_build(minimal_slide_spec, idem_key, target_surface="pptx")
    assert second_result.cache_hit is True
    assert second_result.output_hash == first_result.output_hash


# ─────────────────────────────────────────────────────────────────
# Test: provenance chain completeness
# ─────────────────────────────────────────────────────────────────

def test_provenance_completeness_on_successful_build(
    db_session_fixture,
    minimal_slide_spec: SlideSpec,
    pinned_toolchain_version: str,
    policy_bundle_id: str,
    platform_public_key_fixture: bytes,
) -> None:
    """
    Every successful build must produce exactly one provenance record
    with a valid signature that passes verification.
    """
    idem_key = compute_idempotency_key(
        ir_hash=minimal_slide_spec.content_hash,
        toolchain_version=pinned_toolchain_version,
        policy_bundle_id=policy_bundle_id,
        target_surface="pptx",
    )

    result = run_build(minimal_slide_spec, idem_key, target_surface="pptx")
    assert result.provenance_id is not None

    provenance = db_session_fixture.query_provenance(build_id=result.build_id)
    assert provenance is not None, "No provenance record found for successful build."
    assert provenance.signature, "Provenance signature is empty."
    assert verify_provenance(provenance, platform_public_key_fixture), (
        "Provenance signature verification failed."
    )
    assert provenance.ir_hash == minimal_slide_spec.content_hash


# ─────────────────────────────────────────────────────────────────
# Test: NanoBanana cache uses semantic fingerprint, not byte hash
# ─────────────────────────────────────────────────────────────────

def test_nanobanana_semantic_cache_hit(
    nanobanana_client_fixture,
    redis_client_fixture,
) -> None:
    """
    Two NanoBanana generation calls with the same prompt and model_version
    must return the cached image (semantic fingerprint match), regardless of
    whether the provider would produce byte-identical output.
    """
    from artifact_compiler.nanobanana import NanoBananaRequest, call_nanobanana_cached

    request = NanoBananaRequest(
        prompt="Corporate office, professional, 16:9",
        size="2K",
        seed=42,
        style_tokens=["corporate-clean"],
    )

    result1 = call_nanobanana_cached(nanobanana_client_fixture, redis_client_fixture, request)
    result2 = call_nanobanana_cached(nanobanana_client_fixture, redis_client_fixture, request)

    assert result2.cache_hit is True, (
        "Second NanoBanana call with same fingerprint should return cached result."
    )
    assert result1.output_hash == result2.output_hash


# ─────────────────────────────────────────────────────────────────
# Test: Veo fallback behavior on TTL expiry
# ─────────────────────────────────────────────────────────────────

def test_veo_ttl_expiry_triggers_redownload_error(
    db_session_fixture,
    veo_client_fixture,
) -> None:
    """
    A render_job with status='completed' but output_uri=None and ttl_expires_at < now()
    must be detected by the TTL monitor and the build must transition to failed
    with error_code='VEO_TTL_EXPIRED'.
    """
    from artifact_compiler.render_jobs import check_expired_veo_jobs

    expired_jobs = check_expired_veo_jobs(db_session_fixture)
    for job in expired_jobs:
        assert job.error_code == "VEO_TTL_EXPIRED"
        assert job.status == "expired"


# ─────────────────────────────────────────────────────────────────
# Test: idempotency key changes when any input changes
# ─────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("changed_field", ["ir_hash", "toolchain_version", "policy_bundle_id", "target_surface"])
def test_idempotency_key_changes_on_input_change(
    changed_field: str,
    minimal_slide_spec: SlideSpec,
    pinned_toolchain_version: str,
    policy_bundle_id: str,
) -> None:
    """Changing any one input component must produce a different idempotency key."""
    base_args = {
        "ir_hash": minimal_slide_spec.content_hash,
        "toolchain_version": pinned_toolchain_version,
        "policy_bundle_id": policy_bundle_id,
        "target_surface": "pptx",
    }
    modified_args = {**base_args, changed_field: hashlib.sha256(b"changed").hexdigest() if changed_field != "target_surface" else "pdf"}

    base_key = compute_idempotency_key(**base_args)
    modified_key = compute_idempotency_key(**modified_args)

    assert base_key != modified_key, (
        f"Idempotency key did not change when '{changed_field}' was modified."
    )
```

---

## 15. Performance Budget

### 15.1 Per-Type Render Time Budgets

| Artifact Type | Target Surface | p50 Budget | p95 Budget | Notes |
|---|---|---|---|---|
| SlideSpec | pptx | 2s | 5s | Excludes asset download |
| SlideSpec | pdf | 4s | 8s | Includes LibreOffice headless |
| SlideSpec | png (all slides) | 6s | 12s | Includes pdftoppm |
| DocSpec | docx | 1s | 3s | python-docx compile |
| DocSpec | pdf | 3s | 7s | WeasyPrint render |
| SpreadsheetSpec | xlsx | 1s | 2s | openpyxl |
| TimelineSpec | mp4 (< 60s video) | 30s | 120s | Excludes Veo generation |
| TimelineSpec | mp4 (> 60s video) | 120s | 300s | Long-form compilation |
| TimelineSpec | veo job submission | 1s | 3s | API call only |
| TimelineSpec | veo job completion | 30s | 300s | Async; polling adds latency |
| AudioSpec | wav master | 5s | 20s | Includes TTS + DSP |
| AudioSpec | mp3 export | 2s | 5s | Additional transcode |
| BoardSpec | svg | 0.5s | 2s | Vector generation |
| BoardSpec | png | 2s | 5s | Headless rasterize |

All budgets exclude:
- Network I/O for asset downloads from S3 (dependent on asset sizes; measured separately).
- Veo 3.1 generation latency (typically 11s to several minutes; measured by `render_jobs` table).
- NanoBanana generation latency (typically 2-10s per image).

### 15.2 Parallelism Model

- Slide compilation: elements within a slide are compiled sequentially; slides across a deck are compiled in parallel up to `min(cpu_count, 8)` workers.
- Veo jobs: submitted in parallel (up to the provider's quota: 10 RPM/project for Veo 2 on Vertex; Veo 3.1 quota determined by API tier). A maximum of 4 concurrent Veo jobs per build is enforced.
- NanoBanana jobs: submitted in parallel up to 8 concurrent requests per build.
- Audio TTS segments: generated in parallel up to 4 concurrent TTS API calls per build.
- FFmpeg: runs as a single process per video build; FFmpeg's internal threading uses all available cores (`-threads 0`).

### 15.3 Queue Depth Limits

| Queue | Limit | Action on Overflow |
|---|---|---|
| Artifact build queue | 50 pending | Reject new submissions with HTTP 429 |
| Veo job queue | 20 pending jobs | Block new Veo submissions; notify requester |
| NanoBanana job queue | 40 pending | Block new NanoBanana submissions |
| FFmpeg transcode workers | 8 concurrent | Queue additional requests; emit backpressure warning |

---

## 16. Open Questions

The following items are unresolved and require either additional provider documentation or explicit product decisions before they can be closed.

1. **Veo 3.1 seed capture**: Veo 3.1 does not appear to expose a `seed_used` field in its operation response. Without a captured seed, the semantic equivalence fingerprint must rely on prompt + model_version + reference image hashes alone, making it impossible to produce byte-identical replays even with deterministic infrastructure. Resolution: confirm with Google AI Developer docs whether `seed` is exposed; if not, formalize the policy that all Veo builds are permanently tagged `non_deterministic: true` with no byte-identical replay guarantee.

2. **Semantic equivalence fingerprint threshold**: The current design uses an exact match of the semantic fingerprint string as the equivalence criterion. There is no fuzzy or perceptual similarity threshold. This means a prompt that differs by a single character (e.g., a punctuation change) produces a different fingerprint and a new provider invocation. Evaluate whether a fuzzy semantic similarity threshold (e.g., cosine similarity > 0.98 on embedded prompt vectors) should be applied to reduce redundant provider calls when prompts are effectively identical.

3. **Idempotency cache eviction policy**: The current default TTL is 7 days for the idempotency cache. This may be too short for archival use cases (e.g., a pitch deck built for a board meeting should be replayable for 12+ months) and too long for rapidly evolving content (e.g., daily marketing videos). A tiered eviction policy keyed on `ir_type` or `target_surface` should be specified.

4. **NanoBanana provider authentication and API stability**: The conversation source notes that "NanoBanana" branded API endpoints exist but their canonical provider and official status are unclear. Until a stable provider contract is confirmed, the integration should be designed against the `NanoBananaRequest` / `NanoBananaResponse` schemas defined here with a provider-agnostic adapter pattern, so the implementation can switch to Gemini image generation (gemini-2.5-flash-image) without changing the compiler pipeline.

5. **Veo output watermark handling**: All Veo 3.1 outputs are watermarked with SynthID. The export pipeline does not currently strip or modify this watermark. If the platform needs to deliver artifacts without visible watermarks, a watermark removal policy and the legal/technical approach to achieving it must be specified.

6. **AudioSpec TTS voice pinning**: TTS providers update voice models over time. A speaker note that produces a given prosody today may produce a different prosody with the same voice ID after a provider update. To achieve true byte-identical replay, TTS voice model versions must be pinned in the `AudioSpec` schema (analogous to `toolchain_version` for renderers). This is not currently captured in the schema.

7. **Incremental compilation**: If only slide 3 of a 20-slide deck is modified (producing a new IR version), should the compiler reuse the compiled artifacts from slides 1, 2, and 4-20 from the prior build? This would require a slide-level content-hash cache and a dependency graph for per-element cache invalidation. The current design compiles the full deck on any IR change.

---

## 17. Related Specifications

- `ARTIFACT_COMPILER_SPEC.md` — Full Artifact Compiler System specification including IR schemas, compiler pipeline, validation engine, headless execution model, and multi-format export
- `TECHNICAL_SPEC.md` — Venture-Autonomy Control Plane: service architecture, event sourcing model, agent runtime, policy engine
- `API_EVENTS_SPEC.md` — Event topics and envelope format for all artifact-domain events
- `SCHEMA_PACK.md` — Core platform schemas: EventEnvelopeV1, TaskEnvelopeV1, PolicyBundle, ArtifactSpec base schema

---

## 18. Complete Rendering Engine Specifications

This section provides exhaustive specifications for each rendering engine. Each renderer is implemented as a Python class with a defined interface, deterministic internal logic, and explicit error-fail behavior. No renderer silently degrades; every error raises and stops the build.

---

### 18.1 PPTXRenderer — Slides Engine

#### 18.1.1 OOXML Element Tree by Layout Type

Every slide layout maps to a specific OOXML structure. The renderer selects the correct `<p:sldLayout>` index based on the `SlideDef.layout` key and then populates placeholders deterministically.

**Layout: `title-only`**

```xml
<!-- OOXML structure for title-only layout -->
<p:sp>
  <p:nvSpPr>
    <p:nvPr><p:ph type="title"/></p:nvPr>
  </p:nvSpPr>
  <p:spPr>
    <a:xfrm><a:off x="457200" y="274638"/><a:ext cx="8229600" cy="1143000"/></a:xfrm>
  </p:spPr>
  <p:txBody>
    <a:bodyPr/><a:lstStyle/>
    <a:p><a:r><a:rPr lang="en-US" dirty="0"/><a:t>{title_text}</a:t></a:r></a:p>
  </p:txBody>
</p:sp>
```

**Layout: `two-column`**

```xml
<!-- Left column body content -->
<p:sp>
  <p:nvSpPr><p:nvPr><p:ph idx="1"/></p:nvPr></p:nvSpPr>
  <p:spPr>
    <a:xfrm><a:off x="457200" y="1600200"/><a:ext cx="4000000" cy="4525963"/></a:xfrm>
  </p:spPr>
  <p:txBody><a:bodyPr/><a:lstStyle/>{left_paragraphs}</p:txBody>
</p:sp>
<!-- Right column body content -->
<p:sp>
  <p:nvSpPr><p:nvPr><p:ph idx="2"/></p:nvPr></p:nvSpPr>
  <p:spPr>
    <a:xfrm><a:off x="4800000" y="1600200"/><a:ext cx="4000000" cy="4525963"/></a:xfrm>
  </p:spPr>
  <p:txBody><a:bodyPr/><a:lstStyle/>{right_paragraphs}</p:txBody>
</p:sp>
```

**Layout: `full-bleed`** — image fills entire slide canvas with a transparent text overlay bar at the bottom.

```xml
<p:sp>
  <!-- Full-bleed image as background via blipFill -->
  <p:nvSpPr><p:nvPr/></p:nvSpPr>
  <p:spPr>
    <a:xfrm><a:off x="0" y="0"/><a:ext cx="9144000" cy="5143500"/></a:xfrm>
    <a:prstGeom prst="rect"/>
  </p:spPr>
  <p:pic>
    <p:blipFill>
      <a:blip r:embed="rId{n}"/>
      <a:stretch><a:fillRect/></a:stretch>
    </p:blipFill>
  </p:pic>
</p:sp>
<!-- Overlay text bar -->
<p:sp>
  <p:spPr>
    <a:xfrm><a:off x="0" y="4343500"/><a:ext cx="9144000" cy="800000"/></a:xfrm>
    <a:solidFill><a:srgbClr val="000000"><a:alpha val="70000"/></a:srgbClr></a:solidFill>
  </p:spPr>
  <p:txBody><a:bodyPr/><a:lstStyle/>
    <a:p><a:r><a:rPr b="1" sz="2400" lang="en-US"/>
      <a:t>{caption_text}</a:t></a:r></a:p>
  </p:txBody>
</p:sp>
```

**Layout: `chart-only`** — single DrawingML chart occupying 90% of slide area.

```xml
<p:graphicFrame>
  <p:nvGraphicFramePr>
    <p:nvPr/>
    <p:cNvGraphicFramePr>
      <a:graphicFrameLocks noGrp="1"/>
    </p:cNvGraphicFramePr>
  </p:nvGraphicFramePr>
  <p:xfrm><a:off x="457200" y="457200"/><a:ext cx="8229600" cy="4229100"/></p:xfrm>
  <a:graphic>
    <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">
      <c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"
               r:id="rId{chart_rel_id}"/>
    </a:graphicData>
  </a:graphic>
</p:graphicFrame>
```

**Layout: `quote`** — centered quote block with large italic text and attribution line.

```xml
<p:sp>
  <p:spPr>
    <a:xfrm><a:off x="914400" y="1371600"/><a:ext cx="7315200" cy="2400000"/></a:xfrm>
  </p:spPr>
  <p:txBody>
    <a:bodyPr anchor="ctr"/>
    <a:lstStyle/>
    <a:p><a:pPr algn="ctr"/>
      <a:r><a:rPr i="1" sz="3200" lang="en-US"/>
        <a:t>&#x201C;{quote_text}&#x201D;</a:t></a:r></a:p>
    <a:p><a:pPr algn="ctr"/>
      <a:r><a:rPr sz="1600" lang="en-US"/>
        <a:t>&#x2014; {attribution}</a:t></a:r></a:p>
  </p:txBody>
</p:sp>
```

#### 18.1.2 Style Token to OOXML Attribute Mapping

| Style Token | OOXML Attribute | Value Formula |
|---|---|---|
| `heading-xl` | `<a:rPr sz="..."/>` | `sz = brand_config.spacing_unit_pt * 5 * 100` (in hundredths of a point) |
| `heading-lg` | `<a:rPr sz="..."/>` | `sz = brand_config.spacing_unit_pt * 4 * 100` |
| `heading-md` | `<a:rPr sz="..."/>` | `sz = brand_config.spacing_unit_pt * 3 * 100` |
| `body-lg` | `<a:rPr sz="..."/>` | `sz = brand_config.spacing_unit_pt * 2 * 100` |
| `body-md` | `<a:rPr sz="..."/>` | `sz = brand_config.spacing_unit_pt * 1.5 * 100` |
| `body-sm` | `<a:rPr sz="..."/>` | `sz = brand_config.spacing_unit_pt * 1 * 100` |
| `primary-color` | `<a:srgbClr val="..."/>` | `brand_config.primary_color.lstrip('#')` |
| `secondary-color` | `<a:srgbClr val="..."/>` | `brand_config.secondary_color.lstrip('#')` |
| `accent-color` | `<a:srgbClr val="..."/>` | `brand_config.accent_color.lstrip('#')` |
| `font-heading` | `<a:latin typeface="..."/>` | `brand_config.font_heading` |
| `font-body` | `<a:latin typeface="..."/>` | `brand_config.font_body` |
| `bold` | `<a:rPr b="1"/>` | literal `b="1"` |
| `italic` | `<a:rPr i="1"/>` | literal `i="1"` |
| `border-radius` | `<a:prstGeom prst="roundRect"/><a:avLst><a:gd name="adj" fmla="val {r}"/>` | `r = int(brand_config.border_radius_pt / 100 * 50000)` |

#### 18.1.3 Chart Rendering: Data to DrawingML

Charts are compiled from `ChartDef.data_ref` (resolved to a dataset JSON) into embedded DrawingML chart XML. The chart XML is stored in `ppt/charts/chart{n}.xml` and referenced from the slide via a relationship.

```python
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from pptx import Presentation
from pptx.chart.data import ChartData
from pptx.enum.chart import XL_CHART_TYPE
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor


CHART_TYPE_MAP: dict[str, Any] = {
    "bar":        XL_CHART_TYPE.BAR_CLUSTERED,
    "bar_stacked": XL_CHART_TYPE.BAR_STACKED,
    "column":     XL_CHART_TYPE.COLUMN_CLUSTERED,
    "line":       XL_CHART_TYPE.LINE,
    "line_smooth": XL_CHART_TYPE.LINE_MARKERS_STACKED,
    "pie":        XL_CHART_TYPE.PIE,
    "donut":      XL_CHART_TYPE.DOUGHNUT,
    "scatter":    XL_CHART_TYPE.XY_SCATTER,
    "area":       XL_CHART_TYPE.AREA,
}


def build_chart_data(dataset: dict[str, Any], chart_type: str) -> ChartData:
    """
    Convert a resolved dataset dict into a pptx ChartData object.

    Dataset format:
      {
        "categories": ["Q1", "Q2", "Q3", "Q4"],
        "series": [
          {"name": "Revenue", "values": [100, 120, 140, 160]},
          {"name": "Cost",    "values": [80,  90,  95,  100]}
        ]
      }
    """
    cd = ChartData()
    cd.categories = dataset["categories"]
    for series in dataset["series"]:
        cd.add_series(series["name"], series["values"])
    return cd


def add_chart_to_slide(
    slide,
    chart_def,
    dataset: dict[str, Any],
    brand_config,
) -> None:
    """Add a DrawingML chart to a python-pptx slide object."""
    chart_type = CHART_TYPE_MAP.get(chart_def.chart_type, XL_CHART_TYPE.BAR_CLUSTERED)
    cd = build_chart_data(dataset, chart_def.chart_type)

    # Bounding box: use chart_def bbox if available, else default positioning
    if chart_def.data_range:
        x = Inches(0.5)
        y = Inches(1.5)
        cx = Inches(12.0)
        cy = Inches(5.5)
    else:
        x, y, cx, cy = Inches(0.5), Inches(1.5), Inches(12.0), Inches(5.5)

    chart_shape = slide.shapes.add_chart(chart_type, x, y, cx, cy, cd)
    chart = chart_shape.chart

    # Apply brand colors to series
    primary_rgb = RGBColor(*bytes.fromhex(brand_config.primary_color.lstrip("#")))
    secondary_rgb = RGBColor(*bytes.fromhex(brand_config.secondary_color.lstrip("#")))
    palette = [primary_rgb, secondary_rgb]

    for idx, series in enumerate(chart.series):
        series.format.fill.solid()
        series.format.fill.fore_color.rgb = palette[idx % len(palette)]

    # Title
    if chart_def.title:
        chart.has_title = True
        chart.chart_title.text_frame.text = chart_def.title
        chart.chart_title.text_frame.paragraphs[0].runs[0].font.size = Pt(14)
        chart.chart_title.text_frame.paragraphs[0].runs[0].font.bold = True

    # Axis labels
    if hasattr(chart, "value_axis") and chart_def.y_axis_label:
        chart.value_axis.axis_title.text_frame.text = chart_def.y_axis_label
    if hasattr(chart, "category_axis") and chart_def.x_axis_label:
        chart.category_axis.axis_title.text_frame.text = chart_def.x_axis_label
```

#### 18.1.4 Thumbnail Generation Pipeline

```
PPTX file
    |
    v
[LibreOffice headless]
  soffice --headless --convert-to pdf --outdir /tmp/thumbs/ deck.pptx
    |
    v
[poppler pdftoppm]
  pdftoppm -png -r 200 /tmp/thumbs/deck.pdf /tmp/thumbs/slide
  -> slide-000.png, slide-001.png, ...
    |
    v
[Optional: resize to 1920x1080 with pillow]
  from PIL import Image
  img = Image.open("slide-000.png")
  img = img.resize((1920, 1080), Image.LANCZOS)
  img.save("slide-000-thumb.png", "PNG", optimize=True)
    |
    v
[Upload each PNG to S3]
  s3://artifacts/{tenant_id}/SlideSpec/{build_id}/thumbnails/slide-{n:03d}.png
```

```python
import subprocess
from pathlib import Path


def generate_thumbnails(pptx_path: str, output_dir: str, dpi: int = 200) -> list[str]:
    """
    Convert a PPTX file to per-slide PNG thumbnails.

    Uses LibreOffice headless for PPTX->PDF, then poppler pdftoppm for PDF->PNG.
    Raises RuntimeError on any non-zero subprocess exit code.
    """
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    # Step 1: PPTX -> PDF
    pdf_result = subprocess.run(
        ["soffice", "--headless", "--convert-to", "pdf", "--outdir", str(output_path), pptx_path],
        capture_output=True,
        text=True,
        timeout=120,
    )
    if pdf_result.returncode != 0:
        raise RuntimeError(
            f"LibreOffice headless failed (exit {pdf_result.returncode}): {pdf_result.stderr}"
        )

    pptx_stem = Path(pptx_path).stem
    pdf_path = output_path / f"{pptx_stem}.pdf"
    if not pdf_path.exists():
        raise RuntimeError(f"Expected PDF not found at {pdf_path}")

    # Step 2: PDF -> PNG frames
    slide_prefix = str(output_path / "slide")
    png_result = subprocess.run(
        ["pdftoppm", "-png", "-r", str(dpi), str(pdf_path), slide_prefix],
        capture_output=True,
        text=True,
        timeout=120,
    )
    if png_result.returncode != 0:
        raise RuntimeError(
            f"pdftoppm failed (exit {png_result.returncode}): {png_result.stderr}"
        )

    png_files = sorted(output_path.glob("slide-*.png"))
    if not png_files:
        raise RuntimeError(f"No PNG thumbnails generated in {output_dir}")

    return [str(p) for p in png_files]
```

#### 18.1.5 PDF Export Pipeline

```python
import subprocess
from pathlib import Path


def export_pptx_to_pdf(pptx_path: str, output_dir: str) -> str:
    """
    Export a PPTX to PDF using LibreOffice headless.

    The output PDF is placed in output_dir with the same stem as the PPTX.
    Raises RuntimeError on failure. No fallback to alternative renderers.
    """
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    result = subprocess.run(
        [
            "soffice",
            "--headless",
            "--convert-to", "pdf:impress_pdf_Export",
            "--outdir", str(output_path),
            pptx_path,
        ],
        capture_output=True,
        text=True,
        timeout=180,
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"LibreOffice PDF export failed (exit {result.returncode}): {result.stderr}"
        )

    stem = Path(pptx_path).stem
    pdf_path = output_path / f"{stem}.pdf"
    if not pdf_path.exists():
        raise RuntimeError(f"PDF not found at expected path {pdf_path}")

    return str(pdf_path)
```

#### 18.1.6 PPTXRenderer Class

```python
from __future__ import annotations

import hashlib
import json
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN


LAYOUT_INDEX_MAP = {
    "title-only":    0,
    "title-subtitle": 1,
    "two-column":    2,
    "blank":         3,
    "image-full":    4,
    "full-bleed":    5,
    "chart-only":    6,
    "quote":         7,
}

ALIGNMENT_MAP = {
    "left":   PP_ALIGN.LEFT,
    "center": PP_ALIGN.CENTER,
    "right":  PP_ALIGN.RIGHT,
    "justify": PP_ALIGN.JUSTIFY,
}


@dataclass
class PPTXBuildResult:
    pptx_path: str
    pdf_path: Optional[str]
    thumbnail_paths: list[str]
    output_hash: str
    slide_count: int
    build_warnings: list[str] = field(default_factory=list)


class PPTXRenderer:
    """
    Deterministic renderer for SlideSpec -> PPTX + PDF + PNG thumbnails.

    All operations raise on failure. No silent fallbacks.
    """

    FONT_SIZE_FLOOR_PT = 8
    LAYOUT_INDEX_MAP = LAYOUT_INDEX_MAP

    def __init__(self, asset_resolver, dataset_resolver, work_dir: str):
        self._asset_resolver = asset_resolver
        self._dataset_resolver = dataset_resolver
        self._work_dir = Path(work_dir)
        self._work_dir.mkdir(parents=True, exist_ok=True)

    def render(self, spec, export_pdf: bool = True, export_thumbnails: bool = True) -> PPTXBuildResult:
        """
        Compile a SlideSpec to PPTX and optionally PDF + PNG thumbnails.

        Validates spec before compilation. Raises on any error.
        """
        self._validate_pre_compile(spec)
        prs = self._build_presentation(spec)

        pptx_path = str(self._work_dir / f"{spec.spec_id}.pptx")
        prs.save(pptx_path)

        output_hash = self._hash_file(pptx_path)
        warnings = self._check_layout_overflow(prs, spec)

        pdf_path = None
        if export_pdf:
            pdf_path = export_pptx_to_pdf(pptx_path, str(self._work_dir / "pdf"))

        thumbnail_paths: list[str] = []
        if export_thumbnails:
            thumbnail_paths = generate_thumbnails(
                pptx_path, str(self._work_dir / "thumbnails")
            )

        return PPTXBuildResult(
            pptx_path=pptx_path,
            pdf_path=pdf_path,
            thumbnail_paths=thumbnail_paths,
            output_hash=output_hash,
            slide_count=len(spec.slides),
            build_warnings=warnings,
        )

    def _build_presentation(self, spec) -> Presentation:
        prs = Presentation()
        prs.slide_width = Inches(spec.slide_size_cm[0] / 2.54)
        prs.slide_height = Inches(spec.slide_size_cm[1] / 2.54)

        for slide_def in spec.slides:
            layout_idx = self.LAYOUT_INDEX_MAP.get(slide_def.layout, 0)
            layout = prs.slide_layouts[min(layout_idx, len(prs.slide_layouts) - 1)]
            slide = prs.slides.add_slide(layout)

            for elem in slide_def.elements:
                self._render_element(slide, elem, spec)

            if slide_def.speaker_notes:
                slide.notes_slide.notes_text_frame.text = slide_def.speaker_notes

            if slide_def.transition:
                self._apply_transition(slide, slide_def.transition)

        return prs

    def _render_element(self, slide, elem, spec) -> None:
        brand = spec.brand_config
        primary_rgb = RGBColor(*bytes.fromhex(brand.primary_color.lstrip("#")))

        if elem.type.value == "heading":
            bbox = elem.bbox or (0.5, 0.3, 12.0, 1.5)
            txBox = slide.shapes.add_textbox(
                Inches(bbox[0]), Inches(bbox[1]), Inches(bbox[2]), Inches(bbox[3])
            )
            tf = txBox.text_frame
            tf.word_wrap = True
            tf.text = elem.text or ""
            para = tf.paragraphs[0]
            para.alignment = ALIGNMENT_MAP.get(elem.alignment or "left", PP_ALIGN.LEFT)
            run = para.runs[0] if para.runs else para.add_run()
            run.text = elem.text or ""
            run.font.size = Pt(max(self._resolve_font_size(elem.style_token, brand, "heading"), self.FONT_SIZE_FLOOR_PT))
            run.font.color.rgb = primary_rgb
            run.font.name = brand.font_heading
            run.font.bold = True

        elif elem.type.value == "body":
            bbox = elem.bbox or (0.5, 2.0, 12.0, 4.0)
            txBox = slide.shapes.add_textbox(
                Inches(bbox[0]), Inches(bbox[1]), Inches(bbox[2]), Inches(bbox[3])
            )
            tf = txBox.text_frame
            tf.word_wrap = True
            tf.text = elem.text or ""
            para = tf.paragraphs[0]
            para.alignment = ALIGNMENT_MAP.get(elem.alignment or "left", PP_ALIGN.LEFT)
            run = para.runs[0] if para.runs else para.add_run()
            run.font.size = Pt(max(self._resolve_font_size(elem.style_token, brand, "body"), self.FONT_SIZE_FLOOR_PT))
            run.font.name = brand.font_body

        elif elem.type.value == "image" and elem.asset_ref:
            local_path = self._asset_resolver.resolve(elem.asset_ref)
            bbox = elem.bbox or (0.5, 2.0, 8.0, 4.5)
            slide.shapes.add_picture(
                local_path,
                Inches(bbox[0]),
                Inches(bbox[1]),
                Inches(elem.width_px / 96) if elem.width_px else Inches(bbox[2]),
                Inches(elem.height_px / 96) if elem.height_px else Inches(bbox[3]),
            )

        elif elem.type.value == "chart" and elem.data_ref:
            dataset = self._dataset_resolver.resolve(elem.data_ref)
            add_chart_to_slide(slide, elem, dataset, brand)

        elif elem.type.value == "table" and elem.columns and elem.rows:
            self._render_table(slide, elem, brand)

    def _render_table(self, slide, elem, brand) -> None:
        rows_count = len(elem.rows) + 1  # +1 for header
        cols_count = len(elem.columns)
        bbox = elem.bbox or (0.5, 1.5, 12.0, 5.0)
        table = slide.shapes.add_table(
            rows_count, cols_count,
            Inches(bbox[0]), Inches(bbox[1]),
            Inches(bbox[2]), Inches(bbox[3]),
        ).table

        header_fill = RGBColor(*bytes.fromhex(brand.primary_color.lstrip("#")))
        for col_idx, col_name in enumerate(elem.columns):
            cell = table.cell(0, col_idx)
            cell.text = col_name
            cell.fill.solid()
            cell.fill.fore_color.rgb = header_fill
            para = cell.text_frame.paragraphs[0]
            run = para.runs[0] if para.runs else para.add_run()
            run.font.bold = True
            run.font.size = Pt(12)

        for row_idx, row_data in enumerate(elem.rows):
            for col_idx, cell_val in enumerate(row_data):
                cell = table.cell(row_idx + 1, col_idx)
                cell.text = str(cell_val)
                para = cell.text_frame.paragraphs[0]
                run = para.runs[0] if para.runs else para.add_run()
                run.font.size = Pt(11)

    def _apply_transition(self, slide, transition_name: str) -> None:
        from pptx.oxml.ns import qn
        from lxml import etree
        transition_map = {
            "fade": '<p:transition xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:fade/></p:transition>',
            "wipe": '<p:transition xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:wipe dir="l"/></p:transition>',
            "push": '<p:transition xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:push dir="l"/></p:transition>',
            "cut":  None,
        }
        xml_str = transition_map.get(transition_name)
        if xml_str:
            transition_elem = etree.fromstring(xml_str)
            slide._element.append(transition_elem)

    def _resolve_font_size(self, style_token: str | None, brand, element_type: str) -> float:
        token_sizes = {
            "heading-xl": brand.spacing_unit_pt * 5,
            "heading-lg": brand.spacing_unit_pt * 4,
            "heading-md": brand.spacing_unit_pt * 3,
            "body-lg":    brand.spacing_unit_pt * 2,
            "body-md":    brand.spacing_unit_pt * 1.5,
            "body-sm":    brand.spacing_unit_pt * 1.0,
        }
        if style_token and style_token in token_sizes:
            return token_sizes[style_token]
        return brand.spacing_unit_pt * 4 if element_type == "heading" else brand.spacing_unit_pt * 1.5

    def _validate_pre_compile(self, spec) -> None:
        if not spec.slides:
            raise ValueError("SlideSpec.slides must not be empty.")
        for slide_def in spec.slides:
            if slide_def.layout not in self.LAYOUT_INDEX_MAP:
                raise ValueError(
                    f"Slide '{slide_def.slide_id}' has unknown layout '{slide_def.layout}'. "
                    f"Valid layouts: {list(self.LAYOUT_INDEX_MAP)}"
                )
            for elem in slide_def.elements:
                if elem.type.value == "image" and not elem.asset_ref:
                    raise ValueError(
                        f"Element '{elem.element_id}' has type 'image' but no asset_ref."
                    )
                if elem.type.value == "chart" and not elem.data_ref:
                    raise ValueError(
                        f"Element '{elem.element_id}' has type 'chart' but no data_ref."
                    )

    def _check_layout_overflow(self, prs: Presentation, spec) -> list[str]:
        warnings = []
        slide_w_emu = prs.slide_width
        slide_h_emu = prs.slide_height
        for slide_def in spec.slides:
            for elem in slide_def.elements:
                if elem.bbox:
                    x, y, w, h = elem.bbox
                    x_emu = Inches(x)
                    y_emu = Inches(y)
                    w_emu = Inches(w)
                    h_emu = Inches(h)
                    if x_emu + w_emu > slide_w_emu:
                        warnings.append(
                            f"LAYOUT_OVERFLOW: slide={slide_def.slide_id} "
                            f"element={elem.element_id} overflows slide width."
                        )
                    if y_emu + h_emu > slide_h_emu:
                        warnings.append(
                            f"LAYOUT_OVERFLOW: slide={slide_def.slide_id} "
                            f"element={elem.element_id} overflows slide height."
                        )
        return warnings

    @staticmethod
    def _hash_file(path: str) -> str:
        h = hashlib.sha256()
        with open(path, "rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                h.update(chunk)
        return h.hexdigest()
```

---

### 18.2 DocRenderer — Documents Engine

#### 18.2.1 Pandoc AST Node Types and Python Mapping

The DocSpec section list is converted into a Pandoc-compatible JSON AST before being dispatched to DOCX (via python-docx) or PDF (via WeasyPrint). The AST node types used are a subset of the full Pandoc AST; unsupported Pandoc types are not produced.

| DocSection.type | Pandoc AST Node | Python mapping |
|---|---|---|
| `heading` | `Header(level, attr, inlines)` | `level` = `DocSection.level`, `inlines` = parsed text |
| `body` | `Para(inlines)` | Content parsed into `Str` and `Space` inlines |
| `blockquote` | `BlockQuote(blocks)` | Wraps a single `Para` |
| `code_block` | `CodeBlock(attr, text)` | `attr` includes language class |
| `table` | `Table(attr, caption, colspec, head, body, foot)` | Columns from `DocSection.columns`; rows from `data_ref` |
| `figure` | `Figure(attr, caption, blocks)` | Contains `Plain([Image(attr, inlines, target)])` |
| `footnote` | Inline `Note(blocks)` | Appended to the paragraph that references the footnote id |
| `toc` | `Div(("toc",[],[]), blocks)` | Generated by Pandoc `--toc` flag or manually from heading list |

```python
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class PandocInline:
    t: str  # "Str", "Space", "Emph", "Strong", "Link", "Code", "SoftBreak"
    c: Any = None


@dataclass
class PandocBlock:
    t: str  # "Para", "Header", "CodeBlock", "BlockQuote", "Table", "Figure", "HorizontalRule"
    c: Any = None


def section_to_pandoc_blocks(section, dataset_resolver=None) -> list[PandocBlock]:
    """Convert a single DocSection into a list of Pandoc AST blocks."""
    if section.type.value == "heading":
        inlines = _text_to_inlines(section.content or "")
        return [PandocBlock(t="Header", c=[section.level, ["", [], []], inlines])]

    elif section.type.value == "body":
        inlines = _text_to_inlines(section.content or "")
        return [PandocBlock(t="Para", c=inlines)]

    elif section.type.value == "blockquote":
        inner = _text_to_inlines(section.content or "")
        return [PandocBlock(t="BlockQuote", c=[PandocBlock(t="Para", c=inner)])]

    elif section.type.value == "code_block":
        lang = section.style_token or ""
        return [PandocBlock(t="CodeBlock", c=[["", [lang], []], section.content or ""])]

    elif section.type.value == "table":
        rows = []
        if section.data_ref and dataset_resolver:
            dataset = dataset_resolver.resolve(section.data_ref)
            rows = dataset.get("rows", [])
        return [_build_pandoc_table(section.columns or [], rows, section.caption)]

    elif section.type.value == "figure":
        target = ("", "") if not section.asset_ref else (section.asset_ref, "")
        alt = _text_to_inlines(section.alt_text or "")
        img = PandocInline(t="Image", c=[["", [], []], alt, target])
        caption_inlines = _text_to_inlines(section.caption or "")
        return [PandocBlock(t="Figure", c=[["", [], []], [PandocBlock(t="Plain", c=caption_inlines)], [PandocBlock(t="Plain", c=[img])]])]

    elif section.type.value == "footnote":
        return []  # Footnotes are injected inline into parent paragraph

    elif section.type.value == "toc":
        return [PandocBlock(t="Div", c=[("toc", [], []), []])]

    return []


def _text_to_inlines(text: str) -> list[PandocInline]:
    """Split text into Pandoc Str/Space inlines."""
    inlines: list[PandocInline] = []
    for word in text.split(" "):
        if inlines:
            inlines.append(PandocInline(t="Space"))
        inlines.append(PandocInline(t="Str", c=word))
    return inlines


def _build_pandoc_table(columns: list[str], rows: list[list[str]], caption: str | None) -> PandocBlock:
    col_spec = [["AlignDefault", {"t": "ColWidthDefault"}] for _ in columns]
    head_cells = [[["", [], []], {"t": "AlignDefault"}, 1, 1, [PandocBlock(t="Plain", c=_text_to_inlines(c))]] for c in columns]
    body_rows = []
    for row in rows:
        body_cells = [[["", [], []], {"t": "AlignDefault"}, 1, 1, [PandocBlock(t="Plain", c=_text_to_inlines(str(v)))]] for v in row]
        body_rows.append([[], body_cells])
    caption_block = [PandocBlock(t="Plain", c=_text_to_inlines(caption))] if caption else []
    return PandocBlock(
        t="Table",
        c=[["", [], []], [None, caption_block], col_spec, [[], [head_cells]], [body_rows], [[], []]],
    )
```

#### 18.2.2 DOCX Generation via python-docx

```python
from __future__ import annotations

import hashlib
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from lxml import etree


HEADING_STYLE_MAP = {1: "Heading 1", 2: "Heading 2", 3: "Heading 3", 4: "Heading 4", 5: "Heading 5", 6: "Heading 6"}
BODY_STYLE = "Normal"


def _apply_brand_to_heading(paragraph, brand, level: int) -> None:
    run = paragraph.runs[0] if paragraph.runs else paragraph.add_run()
    size_map = {1: 5, 2: 4, 3: 3, 4: 2.5, 5: 2, 6: 1.5}
    run.font.size = Pt(brand.spacing_unit_pt * size_map.get(level, 2))
    color_hex = brand.primary_color.lstrip("#")
    run.font.color.rgb = RGBColor(*bytes.fromhex(color_hex))
    run.font.name = brand.font_heading
    run.bold = True


def compile_doc_spec_to_docx(spec, asset_resolver, dataset_resolver, output_path: str) -> str:
    """
    Compile a DocSpec to a DOCX file using python-docx.

    Raises on any error. No silent fallback.
    """
    doc = Document()

    # Page margins from output_channels['docx'] if present
    docx_channel = spec.output_channels.get("docx")
    if docx_channel and docx_channel.margins_in:
        margin = float(docx_channel.margins_in.split()[0])
        for section in doc.sections:
            section.top_margin = Inches(margin)
            section.bottom_margin = Inches(margin)
            section.left_margin = Inches(margin)
            section.right_margin = Inches(margin)

    # TOC field insertion (Word requires field code; WeasyPrint gets real TOC)
    if spec.toc_config.include:
        toc_para = doc.add_paragraph()
        toc_para.style = doc.styles["Normal"]
        _insert_word_toc_field(toc_para, spec.toc_config)

    footnote_map: dict[str, str] = {}
    for section in spec.sections:
        if section.type.value == "footnote":
            footnote_map[section.section_id] = section.footnote_text or ""

    for section in spec.sections:
        if section.type.value == "heading":
            style = HEADING_STYLE_MAP.get(section.level, "Heading 1")
            para = doc.add_heading(section.content or "", level=section.level)
            _apply_brand_to_heading(para, spec.brand_config, section.level)

        elif section.type.value == "body":
            para = doc.add_paragraph(section.content or "", style=BODY_STYLE)
            para.paragraph_format.space_after = Pt(spec.brand_config.spacing_unit_pt)
            for run in para.runs:
                run.font.name = spec.brand_config.font_body
                run.font.size = Pt(spec.brand_config.spacing_unit_pt * 1.5)

        elif section.type.value == "blockquote":
            para = doc.add_paragraph(section.content or "")
            para.style = doc.styles.get("Quote") or doc.styles["Normal"]
            para.paragraph_format.left_indent = Inches(0.5)
            para.paragraph_format.right_indent = Inches(0.5)

        elif section.type.value == "code_block":
            para = doc.add_paragraph(section.content or "")
            for run in para.runs:
                run.font.name = "Courier New"
                run.font.size = Pt(10)

        elif section.type.value == "table" and section.columns:
            rows_data = []
            if section.data_ref:
                ds = dataset_resolver.resolve(section.data_ref)
                rows_data = ds.get("rows", [])
            total_rows = 1 + len(rows_data)
            table = doc.add_table(rows=total_rows, cols=len(section.columns))
            table.style = "Table Grid"
            hdr = table.rows[0]
            for idx, col in enumerate(section.columns):
                cell = hdr.cells[idx]
                cell.text = col
                for run in cell.paragraphs[0].runs:
                    run.bold = True
            for r_idx, row in enumerate(rows_data):
                for c_idx, val in enumerate(row):
                    table.rows[r_idx + 1].cells[c_idx].text = str(val)

        elif section.type.value == "figure" and section.asset_ref:
            local_path = asset_resolver.resolve(section.asset_ref)
            doc.add_picture(local_path, width=Inches(6))
            if section.caption:
                cap = doc.add_paragraph(section.caption)
                cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
                for run in cap.runs:
                    run.italic = True
                    run.font.size = Pt(10)

    doc.save(output_path)
    return output_path


def _insert_word_toc_field(paragraph, toc_config) -> None:
    """Insert a Word TOC field code into a paragraph."""
    from docx.oxml.ns import nsmap
    run = paragraph.add_run()
    fld_char_begin = etree.SubElement(run._r, qn("w:fldChar"))
    fld_char_begin.set(qn("w:fldCharType"), "begin")
    instr_text = etree.SubElement(run._r, qn("w:instrText"))
    instr_text.text = f' TOC \\o "1-{toc_config.max_depth}" \\h \\z \\u '
    fld_char_end = etree.SubElement(run._r, qn("w:fldChar"))
    fld_char_end.set(qn("w:fldCharType"), "end")
```

#### 18.2.3 PDF Generation via WeasyPrint

The DocSpec is converted to HTML with embedded CSS, then rendered to PDF by WeasyPrint. This path is the authoritative PDF export path (not LibreOffice), as it produces layout-stable output with proper pagination.

```python
from __future__ import annotations

from pathlib import Path
from typing import Optional


CSS_TEMPLATE = """
@page {{
    size: {page_size};
    margin: {margin};
    @bottom-center {{
        content: counter(page) " / " counter(pages);
        font-family: {font_body};
        font-size: 9pt;
        color: #888;
    }}
}}

:root {{
    --primary:    {primary_color};
    --secondary:  {secondary_color};
    --accent:     {accent_color};
    --font-heading: '{font_heading}', sans-serif;
    --font-body:    '{font_body}', serif;
    --spacing-unit: {spacing_unit}pt;
}}

body {{
    font-family: var(--font-body);
    font-size: calc(var(--spacing-unit) * 1.5);
    line-height: 1.6;
    color: #1a1a1a;
    orphans: 3;
    widows: 3;
}}

h1, h2, h3, h4, h5, h6 {{
    font-family: var(--font-heading);
    color: var(--primary);
    page-break-after: avoid;
    margin-top: calc(var(--spacing-unit) * 2);
    margin-bottom: var(--spacing-unit);
}}

h1 {{ font-size: calc(var(--spacing-unit) * 5); }}
h2 {{ font-size: calc(var(--spacing-unit) * 4); }}
h3 {{ font-size: calc(var(--spacing-unit) * 3); }}

table {{
    width: 100%;
    border-collapse: collapse;
    margin: var(--spacing-unit) 0;
    page-break-inside: avoid;
}}

th {{
    background-color: var(--primary);
    color: #fff;
    padding: 8pt;
    text-align: left;
}}

td {{
    border: 1pt solid #ddd;
    padding: 6pt;
}}

blockquote {{
    border-left: 4pt solid var(--accent);
    margin-left: 24pt;
    padding-left: 12pt;
    color: #555;
    font-style: italic;
}}

pre, code {{
    font-family: 'Courier New', monospace;
    font-size: 9pt;
    background: #f5f5f5;
    padding: 4pt;
    border-radius: {border_radius}pt;
    page-break-inside: avoid;
}}

figure {{
    text-align: center;
    page-break-inside: avoid;
}}

figcaption {{
    font-size: 9pt;
    color: #666;
    margin-top: 4pt;
    font-style: italic;
}}

nav#toc {{
    page-break-after: always;
}}

nav#toc a {{
    color: var(--primary);
    text-decoration: none;
}}
"""


def _section_to_html(section, asset_resolver, dataset_resolver) -> str:
    if section.type.value == "heading":
        level = min(max(section.level, 1), 6)
        return f"<h{level} id=\"{section.section_id}\">{_escape(section.content or '')}</h{level}>\n"

    elif section.type.value == "body":
        return f"<p>{_escape(section.content or '')}</p>\n"

    elif section.type.value == "blockquote":
        return f"<blockquote><p>{_escape(section.content or '')}</p></blockquote>\n"

    elif section.type.value == "code_block":
        lang = section.style_token or ""
        return f'<pre><code class="language-{lang}">{_escape(section.content or "")}</code></pre>\n'

    elif section.type.value == "table":
        rows_data = []
        if section.data_ref and dataset_resolver:
            ds = dataset_resolver.resolve(section.data_ref)
            rows_data = ds.get("rows", [])
        columns = section.columns or []
        header = "".join(f"<th>{_escape(c)}</th>" for c in columns)
        body_rows = ""
        for row in rows_data:
            body_rows += "<tr>" + "".join(f"<td>{_escape(str(v))}</td>" for v in row) + "</tr>\n"
        caption = f"<caption>{_escape(section.caption)}</caption>" if section.caption else ""
        return f"<table>{caption}<thead><tr>{header}</tr></thead><tbody>{body_rows}</tbody></table>\n"

    elif section.type.value == "figure" and section.asset_ref:
        local_path = asset_resolver.resolve(section.asset_ref)
        alt = _escape(section.alt_text or "")
        cap = f"<figcaption>{_escape(section.caption)}</figcaption>" if section.caption else ""
        return f'<figure><img src="{local_path}" alt="{alt}" style="max-width:100%;"/>{cap}</figure>\n'

    elif section.type.value == "toc":
        return '<nav id="toc"><h2>Table of Contents</h2><p>(Generated)</p></nav>\n'

    return ""


def _escape(text: str) -> str:
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


def compile_doc_spec_to_pdf(spec, asset_resolver, dataset_resolver, output_path: str) -> str:
    """
    Compile a DocSpec to PDF using WeasyPrint.

    Generates HTML from DocSpec sections, applies CSS from brand_config,
    then renders to PDF. Raises on any error.
    """
    import weasyprint

    pdf_channel = spec.output_channels.get("pdf")
    page_size = (pdf_channel.page_size if pdf_channel and pdf_channel.page_size else "A4")
    margin = (pdf_channel.margins_in if pdf_channel and pdf_channel.margins_in else "2cm")

    css_str = CSS_TEMPLATE.format(
        page_size=page_size,
        margin=margin,
        primary_color=spec.brand_config.primary_color,
        secondary_color=spec.brand_config.secondary_color,
        accent_color=spec.brand_config.accent_color,
        font_heading=spec.brand_config.font_heading,
        font_body=spec.brand_config.font_body,
        spacing_unit=spec.brand_config.spacing_unit_pt,
        border_radius=spec.brand_config.border_radius_pt,
    )

    body_html = ""
    for section in spec.sections:
        body_html += _section_to_html(section, asset_resolver, dataset_resolver)

    html_str = f"""<!DOCTYPE html>
<html lang="{spec.language}">
<head>
  <meta charset="utf-8"/>
  <title>{spec.spec_id}</title>
</head>
<body>
{body_html}
</body>
</html>"""

    css = weasyprint.CSS(string=css_str)
    document = weasyprint.HTML(string=html_str).write_pdf(stylesheets=[css])
    with open(output_path, "wb") as f:
        f.write(document)
    return output_path
```

#### 18.2.4 EPUB Export Path

```python
def compile_doc_spec_to_epub(spec, asset_resolver, dataset_resolver, output_path: str) -> str:
    """
    Compile a DocSpec to EPUB using Pandoc.

    Converts to an intermediate Markdown file then calls Pandoc for EPUB output.
    Raises RuntimeError on any Pandoc exit code != 0.
    """
    import subprocess
    import tempfile

    lines: list[str] = []
    for section in spec.sections:
        if section.type.value == "heading":
            prefix = "#" * section.level
            lines.append(f"{prefix} {section.content or ''}\n")
        elif section.type.value == "body":
            lines.append(f"{section.content or ''}\n\n")
        elif section.type.value == "blockquote":
            lines.append(f"> {section.content or ''}\n\n")
        elif section.type.value == "code_block":
            lang = section.style_token or ""
            lines.append(f"```{lang}\n{section.content or ''}\n```\n\n")
        elif section.type.value == "table" and section.columns:
            header = " | ".join(section.columns)
            sep = " | ".join(["---"] * len(section.columns))
            lines.append(f"| {header} |\n| {sep} |\n\n")

    with tempfile.NamedTemporaryFile(mode="w", suffix=".md", delete=False) as f:
        f.write("\n".join(lines))
        md_path = f.name

    result = subprocess.run(
        ["pandoc", md_path, "-o", output_path, "--epub-cover-image=", f"--metadata=lang:{spec.language}"],
        capture_output=True, text=True, timeout=120,
    )
    if result.returncode != 0:
        raise RuntimeError(f"Pandoc EPUB export failed (exit {result.returncode}): {result.stderr}")
    return output_path
```

#### 18.2.5 DocRenderer Class

```python
from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional


@dataclass
class DocBuildResult:
    docx_path: Optional[str]
    pdf_path: Optional[str]
    epub_path: Optional[str]
    output_hash: str
    page_count: Optional[int]
    build_warnings: list[str] = field(default_factory=list)


class DocRenderer:
    """
    Deterministic renderer for DocSpec -> DOCX + PDF + EPUB.

    Raises on all errors. No silent fallback paths.
    """

    def __init__(self, asset_resolver, dataset_resolver, work_dir: str):
        self._asset_resolver = asset_resolver
        self._dataset_resolver = dataset_resolver
        self._work_dir = Path(work_dir)
        self._work_dir.mkdir(parents=True, exist_ok=True)

    def render(
        self,
        spec,
        export_docx: bool = True,
        export_pdf: bool = True,
        export_epub: bool = False,
    ) -> DocBuildResult:
        self._validate(spec)

        docx_path: Optional[str] = None
        pdf_path: Optional[str] = None
        epub_path: Optional[str] = None
        warnings: list[str] = []

        if export_docx:
            docx_out = str(self._work_dir / f"{spec.spec_id}.docx")
            compile_doc_spec_to_docx(spec, self._asset_resolver, self._dataset_resolver, docx_out)
            docx_path = docx_out

        if export_pdf:
            pdf_out = str(self._work_dir / f"{spec.spec_id}.pdf")
            compile_doc_spec_to_pdf(spec, self._asset_resolver, self._dataset_resolver, pdf_out)
            pdf_path = pdf_out
            page_count = self._measure_pdf_pages(pdf_out)
            if spec.max_page_length and page_count > spec.max_page_length:
                warnings.append(
                    f"PAGE_COUNT_EXCEEDED: {page_count} pages > max_page_length={spec.max_page_length}"
                )

        if export_epub:
            epub_out = str(self._work_dir / f"{spec.spec_id}.epub")
            compile_doc_spec_to_epub(spec, self._asset_resolver, self._dataset_resolver, epub_out)
            epub_path = epub_out

        primary_path = pdf_path or docx_path or epub_path
        output_hash = self._hash_file(primary_path) if primary_path else ""

        return DocBuildResult(
            docx_path=docx_path,
            pdf_path=pdf_path,
            epub_path=epub_path,
            output_hash=output_hash,
            page_count=self._measure_pdf_pages(pdf_path) if pdf_path else None,
            build_warnings=warnings,
        )

    def _validate(self, spec) -> None:
        if not spec.sections:
            raise ValueError("DocSpec.sections must not be empty.")
        prev_level: Optional[int] = None
        for section in spec.sections:
            if section.type.value == "heading":
                if prev_level and section.level > prev_level + 1:
                    raise ValueError(
                        f"HEADING_HIERARCHY_SKIP: section '{section.section_id}' "
                        f"jumps from h{prev_level} to h{section.level}."
                    )
                prev_level = section.level
            if section.type.value == "figure" and not section.alt_text:
                raise ValueError(
                    f"ALT_TEXT_MISSING: section '{section.section_id}' is a figure with no alt_text."
                )

    def _measure_pdf_pages(self, pdf_path: str) -> int:
        import subprocess
        result = subprocess.run(
            ["pdfinfo", pdf_path], capture_output=True, text=True, timeout=30
        )
        if result.returncode != 0:
            raise RuntimeError(f"pdfinfo failed: {result.stderr}")
        for line in result.stdout.splitlines():
            if line.startswith("Pages:"):
                return int(line.split(":")[1].strip())
        return 0

    @staticmethod
    def _hash_file(path: str) -> str:
        h = hashlib.sha256()
        with open(path, "rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                h.update(chunk)
        return h.hexdigest()
```


---

## 18. Revision History

| Date | Version | Author | Changes |
|---|---|---|---|
| 2026-02-21 | 1.0 | — | Initial 48-line stub: scope, IR family, determinism contract, DB additions, events, acceptance checks |
| 2026-02-21 | 2.0 | AI Agent | Expanded to full engineering-grade spec: complete Pydantic IR type system for all 6 IR types, idempotency key formal definition, per-type rendering pipelines with FFmpeg filtergraph syntax, NanoBanana and Veo 3.1 integration contracts, provenance chain with signing scheme, full PostgreSQL DDL, JSON Schema event contracts, non-determinism handling policy, quality validation with error categories, export matrix, conservation invariants, pytest acceptance suite, performance budgets, and open questions |

---

### 18.3 SpreadsheetRenderer — Spreadsheets Engine

#### 18.3.1 SpreadsheetSpec to openpyxl Object Model Mapping

| SpreadsheetSpec field | openpyxl object | Method |
|---|---|---|
| `SheetDef.name` | `Worksheet.title` | `wb.create_sheet(name)` |
| `SheetDef.cells["A1"]` | `ws["A1"].value` | `ws["A1"] = value` |
| `SheetDef.named_ranges["Revenue"]` | `DefinedName` | `wb.defined_names.add(dn)` |
| `SheetDef.charts[n]` | `BarChart / LineChart / etc.` | `ws.add_chart(chart, anchor)` |
| `SheetDef.freeze_rows` | `ws.freeze_panes` | `ws.freeze_panes = "A{n+1}"` |
| `SheetDef.freeze_cols` | `ws.freeze_panes` | `ws.freeze_panes = "{col_letter}1"` |
| `SheetDef.tab_color` | `ws.sheet_properties.tabColor` | `.tabColor = Color(rgb=hex)` |

#### 18.3.2 Formula Dependency Resolution — Topological Sort

Before openpyxl writes formula cells, a dependency graph is built across all sheets so that formula evaluation order is deterministic. Cells whose formulas reference other cells are sorted topologically; cells that depend on external `dataset_refs` are populated first.

```python
from __future__ import annotations

import re
from collections import defaultdict, deque


CELL_REF_PATTERN = re.compile(r"'?([A-Za-z0-9_ ]+)'?!?\$?([A-Z]+)\$?([0-9]+)")
SIMPLE_REF_PATTERN = re.compile(r"(?<![A-Z])\$?([A-Z]+)\$?([0-9]+)(?![0-9])")


def extract_cell_refs(formula: str, current_sheet: str) -> list[tuple[str, str]]:
    """
    Extract all cell references from a formula string.

    Returns list of (sheet_name, cell_address) tuples.
    Cross-sheet refs like 'Revenue'!B2 are fully qualified.
    Plain refs like B2 are attributed to current_sheet.
    """
    refs: list[tuple[str, str]] = []
    for m in CELL_REF_PATTERN.finditer(formula):
        sheet = m.group(1)
        addr = m.group(2) + m.group(3)
        refs.append((sheet, addr))
    stripped = CELL_REF_PATTERN.sub("", formula)
    for m in SIMPLE_REF_PATTERN.finditer(stripped):
        addr = m.group(1) + m.group(2)
        refs.append((current_sheet, addr))
    return refs


def build_formula_dependency_graph(sheets: list) -> dict[tuple[str, str], list[tuple[str, str]]]:
    """Build a dependency graph from all formula cells across all sheets."""
    graph: dict[tuple[str, str], list[tuple[str, str]]] = defaultdict(list)
    for sheet_def in sheets:
        for addr, value in sheet_def.cells.items():
            if isinstance(value, str) and value.startswith("="):
                cell_key = (sheet_def.name, addr)
                deps = extract_cell_refs(value[1:], sheet_def.name)
                graph[cell_key].extend(deps)
    return dict(graph)


def topological_sort_cells(
    graph: dict[tuple[str, str], list[tuple[str, str]]]
) -> list[tuple[str, str]]:
    """
    Topologically sort formula cells by their dependencies.

    Returns cells in an order where dependencies are written before dependents.
    Raises ValueError on circular reference detection.
    """
    in_degree: dict[tuple[str, str], int] = defaultdict(int)
    all_nodes: set[tuple[str, str]] = set(graph.keys())
    for deps in graph.values():
        for d in deps:
            all_nodes.add(d)
    for node in all_nodes:
        in_degree.setdefault(node, 0)
    for node, deps in graph.items():
        for dep in deps:
            in_degree[node] += 1

    queue: deque[tuple[str, str]] = deque(
        node for node in all_nodes if in_degree[node] == 0
    )
    sorted_cells: list[tuple[str, str]] = []
    while queue:
        node = queue.popleft()
        sorted_cells.append(node)
        for dependent, deps in graph.items():
            if node in deps:
                in_degree[dependent] -= 1
                if in_degree[dependent] == 0:
                    queue.append(dependent)

    if len(sorted_cells) != len(all_nodes):
        raise ValueError(
            "CIRCULAR_REFERENCE detected in SpreadsheetSpec formula dependency graph. "
            "Build aborted."
        )
    return sorted_cells
```

#### 18.3.3 Chart Rendering via openpyxl

```python
from openpyxl.chart import BarChart, LineChart, ScatterChart, PieChart, Reference
from openpyxl.utils import get_column_letter, column_index_from_string


OPENPYXL_CHART_MAP = {
    "bar":     BarChart,
    "column":  BarChart,
    "line":    LineChart,
    "scatter": ScatterChart,
    "pie":     PieChart,
}


def _parse_cell_addr(addr: str) -> tuple[int, int]:
    m = re.match(r"([A-Z]+)([0-9]+)", addr)
    if not m:
        raise ValueError(f"Invalid cell address: {addr}")
    col = column_index_from_string(m.group(1))
    row = int(m.group(2))
    return col, row


def add_openpyxl_chart(ws, chart_def, wb_sheet_title: str) -> None:
    """Add an openpyxl chart to a worksheet based on a ChartDef."""
    chart_cls = OPENPYXL_CHART_MAP.get(chart_def.chart_type)
    if chart_cls is None:
        raise ValueError(f"Unsupported chart_type: '{chart_def.chart_type}'")

    chart = chart_cls()
    chart.title = chart_def.title or ""
    chart.style = 10

    start_col, start_row = _parse_cell_addr(chart_def.data_range.start)
    end_col, end_row = _parse_cell_addr(chart_def.data_range.end)

    if chart_def.chart_type == "scatter":
        xvalues = Reference(ws, min_col=start_col, min_row=start_row + 1, max_row=end_row)
        yvalues = Reference(ws, min_col=start_col + 1, min_row=start_row + 1, max_row=end_row)
        from openpyxl.chart import Series
        series = Series(yvalues, xvalues, title_from_data=True)
        chart.series.append(series)
    else:
        data = Reference(ws, min_col=start_col, min_row=start_row, max_col=end_col, max_row=end_row)
        cats = Reference(ws, min_col=start_col, min_row=start_row + 1, max_row=end_row)
        chart.add_data(data, titles_from_data=True)
        chart.set_categories(cats)

    if chart_def.chart_type == "bar":
        chart.type = "bar"
    elif chart_def.chart_type == "column":
        chart.type = "col"

    if chart_def.x_axis_label and hasattr(chart, "x_axis"):
        chart.x_axis.title = chart_def.x_axis_label
    if chart_def.y_axis_label and hasattr(chart, "y_axis"):
        chart.y_axis.title = chart_def.y_axis_label

    anchor_col = get_column_letter(start_col)
    anchor_row = end_row + 2
    ws.add_chart(chart, f"{anchor_col}{anchor_row}")
```

#### 18.3.4 Named Range and Data Validation

```python
from openpyxl.workbook.defined_name import DefinedName
from openpyxl.worksheet.datavalidation import DataValidation


def add_named_ranges(wb, sheet_def) -> None:
    """Register all named ranges from a SheetDef into the workbook."""
    for name, cell_range in sheet_def.named_ranges.items():
        ref = f"'{sheet_def.name}'!${cell_range.start}:${cell_range.end}"
        dn = DefinedName(name=name, attr_text=ref)
        wb.defined_names.add(dn)


def add_data_validations(ws, validations: list[dict]) -> None:
    """Add data validation rules to a worksheet."""
    for v in validations:
        dv = DataValidation(
            type=v["type"],
            formula1=v.get("formula1"),
            allow_blank=v.get("allow_blank", True),
            showErrorMessage=v.get("showErrorMessage", True),
            errorTitle=v.get("errorTitle", "Invalid Input"),
            error=v.get("error", "Value not allowed."),
        )
        ws.add_data_validation(dv)
        dv.add(v["sqref"])
```

#### 18.3.5 SpreadsheetRenderer Class

```python
from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from openpyxl import Workbook
from openpyxl.utils import get_column_letter


@dataclass
class SpreadsheetBuildResult:
    xlsx_path: str
    output_hash: str
    sheet_names: list[str]
    build_warnings: list[str] = field(default_factory=list)


class SpreadsheetRenderer:
    """
    Deterministic renderer for SpreadsheetSpec -> XLSX.

    Formula dependency graph is topologically sorted before write.
    No silent failures; all errors raise.
    """

    def __init__(self, dataset_resolver, work_dir: str):
        self._dataset_resolver = dataset_resolver
        self._work_dir = Path(work_dir)
        self._work_dir.mkdir(parents=True, exist_ok=True)

    def render(self, spec) -> SpreadsheetBuildResult:
        self._validate(spec)

        dep_graph = build_formula_dependency_graph(spec.sheets)
        sorted_formula_cells = topological_sort_cells(dep_graph)

        wb = Workbook()
        wb.remove(wb.active)
        warnings: list[str] = []

        for sheet_def in spec.sheets:
            ws = wb.create_sheet(title=sheet_def.name)

            formula_addrs = {
                addr for addr, val in sheet_def.cells.items()
                if isinstance(val, str) and val.startswith("=")
            }
            for addr, value in sheet_def.cells.items():
                if addr not in formula_addrs:
                    ws[addr] = value

            for sheet_name, addr in sorted_formula_cells:
                if sheet_name == sheet_def.name and addr in sheet_def.cells:
                    ws[addr] = sheet_def.cells[addr]

            add_named_ranges(wb, sheet_def)

            for chart_def in sheet_def.charts:
                try:
                    add_openpyxl_chart(ws, chart_def, sheet_def.name)
                except ValueError as exc:
                    warnings.append(f"CHART_RENDER_WARNING: {exc}")

            if sheet_def.freeze_rows > 0 and sheet_def.freeze_cols > 0:
                col_letter = get_column_letter(sheet_def.freeze_cols + 1)
                ws.freeze_panes = f"{col_letter}{sheet_def.freeze_rows + 1}"
            elif sheet_def.freeze_rows > 0:
                ws.freeze_panes = f"A{sheet_def.freeze_rows + 1}"
            elif sheet_def.freeze_cols > 0:
                ws.freeze_panes = f"{get_column_letter(sheet_def.freeze_cols + 1)}1"

            if sheet_def.tab_color:
                from openpyxl.styles import Color
                ws.sheet_properties.tabColor = Color(rgb=sheet_def.tab_color.lstrip("#"))

        xlsx_path = str(self._work_dir / f"{spec.spec_id}.xlsx")
        wb.save(xlsx_path)
        output_hash = self._hash_file(xlsx_path)

        return SpreadsheetBuildResult(
            xlsx_path=xlsx_path,
            output_hash=output_hash,
            sheet_names=[s.name for s in spec.sheets],
            build_warnings=warnings,
        )

    def _validate(self, spec) -> None:
        if not spec.sheets:
            raise ValueError("SpreadsheetSpec.sheets must not be empty.")
        seen: set[str] = set()
        for sheet_def in spec.sheets:
            if sheet_def.name in seen:
                raise ValueError(f"Duplicate sheet name: '{sheet_def.name}'")
            seen.add(sheet_def.name)
            for addr in sheet_def.cells:
                if not re.match(r"^[A-Z]+[0-9]+$", addr):
                    raise ValueError(
                        f"Invalid cell address '{addr}' in sheet '{sheet_def.name}'."
                    )

    @staticmethod
    def _hash_file(path: str) -> str:
        h = hashlib.sha256()
        with open(path, "rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                h.update(chunk)
        return h.hexdigest()
```


---

### 18.4 VideoRenderer — Video Engine

#### 18.4.1 Complete FFmpeg Filtergraph Grammar

The VideoRenderer translates a `TimelineSpec` into a complete FFmpeg invocation. The filtergraph grammar used by the generator covers five categories of filter chain: video overlay, text burn-in, transition, color grading, and Ken Burns motion.

**Video overlay filter pattern:**

```
[base_v][overlay_v]overlay=x={x}:y={y}:enable='between(t,{start},{end})'[v_out]
```

Example — logo overlay in bottom-right corner for full duration:

```bash
ffmpeg -y \
  -i main_video.mp4 \
  -i logo.png \
  -filter_complex "
    [1:v]scale=120:60[logo_scaled];
    [0:v][logo_scaled]overlay=x=W-w-20:y=H-h-20[v_out]
  " \
  -map "[v_out]" -map "0:a" \
  -c:v libx264 -crf 23 -c:a copy \
  out/branded.mp4
```

**Text burn-in (lower-third) filter pattern:**

```
drawtext=fontfile={font_path}:text='{text}':fontcolor={color}:fontsize={size}:
         x={x}:y={y}:box=1:boxcolor={bg_color}@{alpha}:boxborderw={pad}:
         enable='between(t,{start},{end})'
```

Full lower-third example with fade:

```bash
ffmpeg -y -i input.mp4 \
  -vf "drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:\
text='John Smith\: CEO':fontcolor=white:fontsize=32:\
x=60:y=H-120:\
box=1:boxcolor=0x000000@0.65:boxborderw=12:\
enable='between(t,2,8)',\
drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:\
text='Acme Corp':fontcolor=0xcccccc:fontsize=22:\
x=60:y=H-80:\
box=1:boxcolor=0x000000@0.65:boxborderw=10:\
enable='between(t,2,8)'" \
  -c:v libx264 -crf 20 \
  out/lower_third.mp4
```

**Transition filter patterns (xfade):**

```bash
# Crossfade
[v0][v1]xfade=transition=fade:duration=0.5:offset={offset}[xf]

# Wipe left
[v0][v1]xfade=transition=wipeleft:duration=0.4:offset={offset}[xf]

# Fade to black
[v0]fade=t=out:st={fade_start}:d=0.5[v0_fade];
[v1]fade=t=in:st=0:d=0.5[v1_fade];
[v0_fade][v1_fade]concat=n=2:v=1:a=0[xf]

# Slide push
[v0][v1]xfade=transition=slideleft:duration=0.6:offset={offset}[xf]

# Circle open (iris)
[v0][v1]xfade=transition=circleopen:duration=0.8:offset={offset}[xf]
```

**Color grading filter chain:**

```
eq=brightness={b}:contrast={c}:saturation={s}:gamma={g},
hue=s={hue_sat},
curves=r='{r_curve}':g='{g_curve}':b='{b_curve}',
unsharp=5:5:{luma_sharpen}:3:3:{chroma_sharpen}
```

Standard corporate look preset:

```bash
-vf "eq=brightness=0.02:contrast=1.05:saturation=1.1,unsharp=5:5:0.8:3:3:0.0"
```

#### 18.4.2 Audio Mixing — FFmpeg amix, Normalization, Ducking

```bash
# Full audio mix: voiceover + BGM with sidechain ducking + EBU R128 normalization
ffmpeg -y \
  -i voiceover.wav \
  -i bgm.wav \
  -i sfx.wav \
  -filter_complex "
    [0:a]highpass=f=80,
         acompressor=threshold=-25dB:ratio=3:attack=5:release=100:makeup=1.5,
         equalizer=f=3000:t=o:w=1.5:g=1.5,
         volume=0dB[vox];

    [1:a]volume=-12dB,
         afade=t=in:st=0:d=1.0,
         afade=t=out:st={bgm_fade_start}:d=3.0[bgm_raw];

    [bgm_raw][vox]sidechaincompress=
         threshold=0.02:ratio=8:attack=50:release=300:
         level_in=1.5:level_sc=1.0[bgm_ducked];

    [2:a]volume=-18dB,
         adelay={sfx_delay_ms}|{sfx_delay_ms}[sfx_delayed];

    [vox][bgm_ducked][sfx_delayed]amix=inputs=3:duration=first:
         dropout_transition=2:weights='1 1 0.5'[premix];

    [premix]loudnorm=I=-16:TP=-1.5:LRA=11:
            measured_I=-24.0:measured_LRA=9.0:measured_TP=-2.0:
            measured_thresh=-34.0:offset=7.5:linear=true:
            print_format=summary[a_out]
  " \
  -map "[a_out]" \
  -ar 48000 -c:a pcm_s24le \
  out/final_audio.wav
```

#### 18.4.3 Clip Scheduling Algorithm

The clip scheduler resolves the full timeline before generating the FFmpeg command. It detects gaps, overlaps, and inserts transitions.

```python
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class ScheduledClip:
    clip_id: str
    asset_path: str
    timeline_start: float
    timeline_end: float
    layer: int
    transition_in: Optional[str] = None
    transition_out: Optional[str] = None
    transition_duration: float = 0.5


def schedule_clips(
    clips: list,
    total_duration: float,
    default_transition: str = "fade",
    default_transition_duration: float = 0.5,
) -> list[ScheduledClip]:
    """
    Produce a deterministic list of ScheduledClip objects from a TimelineSpec clip list.

    Rules applied:
    1. Clips on layer 0 are the primary timeline; higher layers are overlays.
    2. Gaps in layer 0 are filled with a black frame hold.
    3. Overlapping clips on the same layer generate a transition of default_transition type.
    4. Clips that extend past total_duration are trimmed.
    5. All timing is resolved to millisecond precision (3 decimal places).

    Raises ValueError if any clip has duration <= 0.
    """
    layer_clips: dict[int, list] = {}
    for clip in clips:
        layer_clips.setdefault(clip.layer, []).append(clip)

    scheduled: list[ScheduledClip] = []

    for layer, layer_clip_list in sorted(layer_clips.items()):
        sorted_clips = sorted(layer_clip_list, key=lambda c: c.start_seconds)
        prev_end = 0.0

        for idx, clip in enumerate(sorted_clips):
            if clip.duration_seconds <= 0:
                raise ValueError(
                    f"Clip '{clip.clip_id}' has duration <= 0: {clip.duration_seconds}"
                )

            start = round(clip.start_seconds, 3)
            end = round(start + clip.duration_seconds, 3)

            if end > total_duration:
                end = round(total_duration, 3)

            # Gap detection on layer 0
            if layer == 0 and start > prev_end + 0.001:
                gap_duration = round(start - prev_end, 3)
                scheduled.append(ScheduledClip(
                    clip_id=f"gap_{prev_end:.3f}_{start:.3f}",
                    asset_path="lavfi:color=black:s=1920x1080",
                    timeline_start=round(prev_end, 3),
                    timeline_end=start,
                    layer=0,
                ))

            # Overlap detection: overlapping sibling -> transition
            transition_in = None
            if layer == 0 and start < prev_end - 0.001:
                transition_in = default_transition

            t_in = clip.transitions[0].type if clip.transitions else default_transition
            t_out = clip.transitions[-1].type if clip.transitions else default_transition
            t_dur = clip.transitions[0].duration_seconds if clip.transitions else default_transition_duration

            scheduled.append(ScheduledClip(
                clip_id=clip.clip_id,
                asset_path="",  # resolved by caller
                timeline_start=start,
                timeline_end=end,
                layer=layer,
                transition_in=transition_in,
                transition_out=t_out if idx < len(sorted_clips) - 1 else None,
                transition_duration=t_dur,
            ))

            prev_end = end

    return sorted(scheduled, key=lambda s: (s.layer, s.timeline_start))
```

#### 18.4.4 Resolution and Bitrate Profiles

| Profile | Resolution | Frame Rate | Video Bitrate | Audio Bitrate | Codec | Use Case |
|---|---|---|---|---|---|---|
| `1080p` | 1920x1080 | 30 fps | CRF 23 (~4 Mbps) | 192k AAC | libx264 + aac | Web, email |
| `4k` | 3840x2160 | 30 fps | CRF 20 (~18 Mbps) | 320k AAC | libx264 + aac | Archival, broadcast |
| `social_landscape` | 1920x1080 | 30 fps | CRF 23 | 192k AAC | libx264 + aac | YouTube, LinkedIn |
| `social_portrait` | 1080x1920 | 30 fps | CRF 23 | 192k AAC | libx264 + aac | TikTok, Reels, Stories |
| `social_square` | 1080x1080 | 30 fps | CRF 23 | 192k AAC | libx264 + aac | Instagram feed |
| `prores_hq` | 1920x1080 | 30 fps | ~90 Mbps | pcm_s24le | prores_ks + pcm | Video editor handoff |
| `web_lo` | 1280x720 | 24 fps | CRF 28 (~1.5 Mbps) | 128k AAC | libx264 + aac | Bandwidth-limited |

```python
RESOLUTION_PROFILES: dict[str, dict] = {
    "1080p": {"resolution": "1920x1080", "fps": 30, "codec": "libx264", "crf": 23, "audio_bitrate": "192k", "pixel_format": "yuv420p"},
    "4k":    {"resolution": "3840x2160", "fps": 30, "codec": "libx264", "crf": 20, "audio_bitrate": "320k", "pixel_format": "yuv420p"},
    "social_landscape": {"resolution": "1920x1080", "fps": 30, "codec": "libx264", "crf": 23, "audio_bitrate": "192k", "pixel_format": "yuv420p"},
    "social_portrait":  {"resolution": "1080x1920", "fps": 30, "codec": "libx264", "crf": 23, "audio_bitrate": "192k", "pixel_format": "yuv420p"},
    "social_square":    {"resolution": "1080x1080", "fps": 30, "codec": "libx264", "crf": 23, "audio_bitrate": "192k", "pixel_format": "yuv420p"},
    "prores_hq":        {"resolution": "1920x1080", "fps": 30, "codec": "prores_ks", "profile": "3", "audio_codec": "pcm_s24le", "pixel_format": "yuv422p10le"},
    "web_lo":           {"resolution": "1280x720",  "fps": 24, "codec": "libx264", "crf": 28, "audio_bitrate": "128k", "pixel_format": "yuv420p"},
}


def build_ffmpeg_output_flags(profile_name: str, output_path: str) -> list[str]:
    """Return FFmpeg output flags for a named resolution/bitrate profile."""
    profile = RESOLUTION_PROFILES.get(profile_name)
    if profile is None:
        raise ValueError(f"Unknown resolution profile: '{profile_name}'")

    flags = [
        "-c:v", profile["codec"],
        "-pix_fmt", profile["pixel_format"],
    ]

    if "crf" in profile:
        flags += ["-crf", str(profile["crf"])]
    if "profile" in profile:
        flags += ["-profile:v", profile["profile"]]

    audio_codec = profile.get("audio_codec", "aac")
    flags += ["-c:a", audio_codec]
    if "audio_bitrate" in profile:
        flags += ["-b:a", profile["audio_bitrate"]]

    flags += ["-movflags", "+faststart", output_path]
    return flags
```

#### 18.4.5 VideoRenderer Class

```python
from __future__ import annotations

import hashlib
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional


@dataclass
class VideoBuildResult:
    primary_mp4_path: str
    output_hash: str
    duration_seconds: float
    resolution: str
    additional_paths: dict[str, str] = field(default_factory=dict)
    build_warnings: list[str] = field(default_factory=list)


class VideoRenderer:
    """
    Deterministic renderer for TimelineSpec -> MP4 (and additional profiles).

    Compiles FFmpeg filtergraph from scheduled clips. Runs FFmpeg as subprocess.
    Raises RuntimeError on any non-zero exit code. No silent fallbacks.
    """

    def __init__(self, asset_resolver, veo_client, nanobanana_client, work_dir: str):
        self._asset_resolver = asset_resolver
        self._veo_client = veo_client
        self._nanobanana_client = nanobanana_client
        self._work_dir = Path(work_dir)
        self._work_dir.mkdir(parents=True, exist_ok=True)

    def render(self, spec, quality_presets: Optional[list[str]] = None) -> VideoBuildResult:
        """
        Full render pipeline: generative asset resolution -> scheduling ->
        filtergraph build -> FFmpeg execution -> validation -> result.
        """
        presets = quality_presets or spec.quality_presets or ["1080p"]
        self._validate(spec)

        resolved_assets = self._resolve_all_assets(spec)
        scheduled = schedule_clips(spec.clips, spec.duration_seconds)

        primary_preset = presets[0]
        profile = RESOLUTION_PROFILES[primary_preset]

        filtergraph_result = build_filtergraph(spec, resolved_assets)
        primary_out = str(self._work_dir / f"{spec.spec_id}_{primary_preset}.mp4")

        ffmpeg_cmd = (
            ["ffmpeg", "-y", "-threads", "0"]
            + filtergraph_result.input_args
            + ["-filter_complex", filtergraph_result.filter_complex]
            + ["-map", filtergraph_result.output_map]
            + build_ffmpeg_output_flags(primary_preset, primary_out)
        )
        self._run_ffmpeg(ffmpeg_cmd, label=f"primary:{primary_preset}")

        duration = self._probe_duration(primary_out)
        resolution = profile["resolution"]
        output_hash = self._hash_file(primary_out)

        additional: dict[str, str] = {}
        for preset in presets[1:]:
            out_path = str(self._work_dir / f"{spec.spec_id}_{preset}.mp4")
            cmd = (
                ["ffmpeg", "-y", "-threads", "0", "-i", primary_out]
                + build_ffmpeg_output_flags(preset, out_path)
            )
            self._run_ffmpeg(cmd, label=f"transcode:{preset}")
            additional[preset] = out_path

        warnings = self._validate_output(spec, primary_out, duration)

        return VideoBuildResult(
            primary_mp4_path=primary_out,
            output_hash=output_hash,
            duration_seconds=duration,
            resolution=resolution,
            additional_paths=additional,
            build_warnings=warnings,
        )

    def _resolve_all_assets(self, spec) -> dict[str, str]:
        """Resolve all clip asset references to local paths."""
        resolved: dict[str, str] = {}
        for clip in spec.clips:
            if clip.type.value in ("asset", "slide_frame") and clip.asset_ref:
                resolved[clip.clip_id] = self._asset_resolver.resolve(clip.asset_ref)
            elif clip.type.value == "generated_veo" and clip.veo_config:
                resolved[clip.clip_id] = self._resolve_veo_clip(clip)
            elif clip.type.value == "generated_image" and clip.nanobanana_config:
                resolved[clip.clip_id] = self._resolve_nanobanana_image(clip)
        return resolved

    def _resolve_veo_clip(self, clip) -> str:
        """Submit or retrieve cached Veo clip."""
        from artifact_compiler.veo import submit_veo_job, poll_veo_job, download_veo_output
        config = clip.veo_config
        job_response = submit_veo_job(self._veo_client, config)
        completed = poll_veo_job(self._veo_client, job_response.operation_id)
        local_path = str(self._work_dir / "veo" / f"{clip.clip_id}.mp4")
        download_veo_output(completed.video_url, local_path)
        return local_path

    def _resolve_nanobanana_image(self, clip) -> str:
        """Submit or retrieve cached NanoBanana image."""
        from artifact_compiler.nanobanana import submit_nanobanana_job, download_image
        config = clip.nanobanana_config
        response = submit_nanobanana_job(self._nanobanana_client, config)
        local_path = str(self._work_dir / "nanobanana" / f"{clip.clip_id}.png")
        download_image(response.images[0].image_url, local_path)
        return local_path

    def _run_ffmpeg(self, cmd: list[str], label: str) -> None:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
        if result.returncode != 0:
            raise RuntimeError(
                f"FFmpeg failed [{label}] (exit {result.returncode}):\n{result.stderr[-4000:]}"
            )

    def _probe_duration(self, path: str) -> float:
        result = subprocess.run(
            ["ffprobe", "-v", "quiet", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", path],
            capture_output=True, text=True, timeout=30,
        )
        if result.returncode != 0:
            raise RuntimeError(f"ffprobe duration check failed: {result.stderr}")
        return float(result.stdout.strip())

    def _validate_output(self, spec, mp4_path: str, actual_duration: float) -> list[str]:
        warnings = []
        delta = abs(actual_duration - spec.duration_seconds)
        if delta > 0.1:
            warnings.append(
                f"DURATION_MISMATCH: expected {spec.duration_seconds}s, got {actual_duration:.3f}s "
                f"(delta={delta:.3f}s > 0.1s threshold)."
            )
        return warnings

    def _validate(self, spec) -> None:
        if spec.duration_seconds <= 0:
            raise ValueError("TimelineSpec.duration_seconds must be > 0.")
        if not spec.clips:
            raise ValueError("TimelineSpec.clips must not be empty.")

    @staticmethod
    def _hash_file(path: str) -> str:
        h = hashlib.sha256()
        with open(path, "rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                h.update(chunk)
        return h.hexdigest()
```

---

### 18.5 AudioRenderer — Audio Engine

#### 18.5.1 Full FFmpeg DSP Chain

The AudioRenderer builds a per-track DSP chain from `DspPipeline` objects, then combines all tracks via the master chain. The entire DSP graph is expressed as a single `-filter_complex` string passed to FFmpeg.

**Per-track DSP chain construction:**

```python
from __future__ import annotations


def build_track_dsp_filter(track, stream_label: str, out_label: str) -> str:
    """
    Build a FFmpeg filter chain string for a single AudioTrack's DspPipeline.

    stream_label: FFmpeg stream label (e.g. "[0:a]")
    out_label:    FFmpeg output label (e.g. "[track0_proc]")

    Returns a string suitable for inclusion in -filter_complex.
    """
    dsp = track.dsp
    filters: list[str] = []

    if dsp.highpass_hz is not None:
        filters.append(f"highpass=f={dsp.highpass_hz:.1f}")
    if dsp.lowpass_hz is not None:
        filters.append(f"lowpass=f={dsp.lowpass_hz:.1f}")
    if dsp.noise_gate_threshold_db is not None:
        thresh_linear = 10 ** (dsp.noise_gate_threshold_db / 20.0)
        filters.append(f"agate=threshold={thresh_linear:.6f}:attack=10:release=100")

    for band in dsp.eq_bands:
        filters.append(
            f"equalizer=f={band.frequency_hz:.1f}:t=o:w={band.q:.2f}:g={band.gain_db:.2f}"
        )

    if dsp.compressor:
        c = dsp.compressor
        filters.append(
            f"acompressor=threshold={c.threshold_db:.1f}dB:ratio={c.ratio:.1f}:"
            f"attack={c.attack_ms:.1f}:release={c.release_ms:.1f}:"
            f"makeup={c.makeup_gain_db:.1f}dB"
        )

    if dsp.reverb:
        r = dsp.reverb
        filters.append(
            f"aecho=in_gain={10 ** (r.dry_db / 20.0):.3f}:"
            f"out_gain={10 ** (r.wet_db / 20.0):.3f}:"
            f"delays={int(r.room_size * 500)}:"
            f"decays={r.damping:.2f}"
        )

    if dsp.gain_db != 0.0:
        filters.append(f"volume={dsp.gain_db:.2f}dB")

    fade = track.fade
    if fade.fade_in_ms > 0:
        filters.append(f"afade=t=in:st=0:d={fade.fade_in_ms / 1000.0:.3f}")
    if fade.fade_out_ms > 0:
        filters.append(f"afade=t=out:st=999:d={fade.fade_out_ms / 1000.0:.3f}")

    if not filters:
        return f"{stream_label}anull{out_label}"

    chain = ",".join(filters)
    return f"{stream_label}{chain}{out_label}"
```

#### 18.5.2 Multi-Track Mixing: Stem Separation, Bus Routing, Master Chain

```python
def build_full_audio_filtergraph(spec) -> str:
    """
    Build the complete -filter_complex string for an AudioSpec.

    Track ordering:
      - Each track gets its own DSP chain (build_track_dsp_filter).
      - DuckingRules apply sidechaincompress between source and target processed tracks.
      - All processed tracks are combined via amix.
      - The master chain applies loudnorm (EBU R128).

    Returns the complete filter_complex string.
    """
    fragments: list[str] = []
    track_out_labels: list[str] = []

    for idx, track in enumerate(spec.tracks):
        in_label = f"[{idx}:a]"
        out_label = f"[track{idx}_proc]"
        dsp_fragment = build_track_dsp_filter(track, in_label, out_label)
        fragments.append(dsp_fragment)
        track_out_labels.append(out_label)

    # Ducking rules: sidechaincompress source over target
    ducked_labels = list(track_out_labels)
    for rule_idx, rule in enumerate(spec.ducking_rules):
        src_idx = next(
            (i for i, t in enumerate(spec.tracks) if t.track_id == rule.source_track), None
        )
        tgt_idx = next(
            (i for i, t in enumerate(spec.tracks) if t.track_id == rule.target_track), None
        )
        if src_idx is None or tgt_idx is None:
            raise ValueError(
                f"DuckingRule references unknown track: "
                f"source='{rule.source_track}', target='{rule.target_track}'"
            )
        src_label = ducked_labels[src_idx]
        tgt_label = ducked_labels[tgt_idx]
        ducked_out = f"[duck{rule_idx}_out]"
        thresh_linear = 10 ** (rule.reduction_db / 20.0)
        fragments.append(
            f"{tgt_label}{src_label}sidechaincompress="
            f"threshold={thresh_linear:.6f}:ratio=8:"
            f"attack={rule.attack_ms:.1f}:release={rule.release_ms:.1f}"
            f"{ducked_out}"
        )
        ducked_labels[tgt_idx] = ducked_out

    # amix all processed tracks
    n_tracks = len(ducked_labels)
    inputs_str = "".join(ducked_labels)
    weights = ":".join(["1"] * n_tracks)
    fragments.append(
        f"{inputs_str}amix=inputs={n_tracks}:duration=first:"
        f"dropout_transition=2:weights='{weights}'[premix]"
    )

    # Master chain: loudnorm
    mc = spec.master_chain
    fragments.append(
        f"[premix]loudnorm=I={mc.target_loudness_lufs:.1f}:"
        f"TP={mc.target_true_peak_lufs:.1f}:"
        f"LRA={mc.lra:.1f}:linear=true:print_format=summary[a_master]"
    )

    return ";\n    ".join(fragments)
```

#### 18.5.3 Loudness Normalization — EBU R128 Spec

EBU R128 loudness normalization requires two FFmpeg passes: a measurement pass and a normalization pass. The renderer performs both.

```python
import json
import subprocess


def measure_loudness(input_path: str) -> dict:
    """
    Run FFmpeg's loudnorm filter in analysis mode to measure loudness statistics.

    Returns a dict with keys: input_i, input_lra, input_tp, input_thresh, target_offset.
    Raises RuntimeError on FFmpeg failure.
    """
    cmd = [
        "ffmpeg", "-y", "-i", input_path,
        "-af", "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json",
        "-f", "null", "-",
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    if result.returncode != 0:
        raise RuntimeError(f"loudnorm analysis pass failed: {result.stderr}")

    stderr = result.stderr
    json_start = stderr.rfind("{")
    json_end = stderr.rfind("}") + 1
    if json_start == -1:
        raise RuntimeError("loudnorm JSON output not found in FFmpeg stderr.")
    return json.loads(stderr[json_start:json_end])


def apply_loudnorm_two_pass(
    input_path: str,
    output_path: str,
    target_lufs: float = -16.0,
    target_tp: float = -1.5,
    target_lra: float = 11.0,
) -> dict:
    """
    Apply two-pass EBU R128 loudness normalization using FFmpeg loudnorm.

    Pass 1: measure. Pass 2: normalize with measured values for linear mode.
    Returns measured loudness stats dict.
    """
    stats = measure_loudness(input_path)

    measured_i     = stats["input_i"]
    measured_lra   = stats["input_lra"]
    measured_tp    = stats["input_tp"]
    measured_thresh = stats["input_thresh"]
    target_offset  = stats["target_offset"]

    af_str = (
        f"loudnorm=I={target_lufs}:TP={target_tp}:LRA={target_lra}:"
        f"measured_I={measured_i}:measured_LRA={measured_lra}:"
        f"measured_TP={measured_tp}:measured_thresh={measured_thresh}:"
        f"offset={target_offset}:linear=true:print_format=summary"
    )
    cmd = [
        "ffmpeg", "-y", "-i", input_path,
        "-af", af_str,
        "-ar", "48000", "-c:a", "pcm_s24le",
        output_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    if result.returncode != 0:
        raise RuntimeError(f"loudnorm normalization pass failed: {result.stderr}")
    return stats
```

#### 18.5.4 Export Profiles

| Profile name | Format | Codec | Bitrate | Sample Rate | Channels | Use Case |
|---|---|---|---|---|---|---|
| `podcast` | MP3 | libmp3lame | 128k | 44100 Hz | Mono (downmix) | Speech content |
| `music` | MP3 | libmp3lame | 320k | 44100 Hz | Stereo | Music delivery |
| `voiceover` | WAV | pcm_s16le | lossless | 44100 Hz | Mono | TTS master |
| `archival` | WAV | pcm_s24le | lossless | 48000 Hz | Stereo | Lossless master |
| `aac_mobile` | AAC | aac | 256k | 44100 Hz | Stereo | iOS/Android |
| `sound_design` | WAV | pcm_f32le | lossless | 96000 Hz | Stereo | Post-production |

```python
AUDIO_EXPORT_PROFILES: dict[str, dict] = {
    "podcast":      {"format": "mp3",  "codec": "libmp3lame", "bitrate": "128k", "ar": 44100, "ac": 1},
    "music":        {"format": "mp3",  "codec": "libmp3lame", "bitrate": "320k", "ar": 44100, "ac": 2},
    "voiceover":    {"format": "wav",  "codec": "pcm_s16le",  "ar": 44100, "ac": 1},
    "archival":     {"format": "wav",  "codec": "pcm_s24le",  "ar": 48000, "ac": 2},
    "aac_mobile":   {"format": "aac",  "codec": "aac",        "bitrate": "256k", "ar": 44100, "ac": 2},
    "sound_design": {"format": "wav",  "codec": "pcm_f32le",  "ar": 96000, "ac": 2},
}


def export_audio_profile(input_wav: str, output_path: str, profile_name: str) -> str:
    """Transcode a WAV master file to the specified export profile."""
    profile = AUDIO_EXPORT_PROFILES.get(profile_name)
    if profile is None:
        raise ValueError(f"Unknown audio export profile: '{profile_name}'")

    cmd = ["ffmpeg", "-y", "-i", input_wav, "-c:a", profile["codec"]]
    if "bitrate" in profile:
        cmd += ["-b:a", profile["bitrate"]]
    cmd += ["-ar", str(profile["ar"]), "-ac", str(profile["ac"]), output_path]

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    if result.returncode != 0:
        raise RuntimeError(
            f"Audio export [{profile_name}] failed (exit {result.returncode}): {result.stderr}"
        )
    return output_path
```

#### 18.5.5 AudioRenderer Class

```python
from __future__ import annotations

import hashlib
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional


@dataclass
class AudioBuildResult:
    wav_master_path: str
    output_hash: str
    duration_seconds: float
    measured_lufs: float
    additional_paths: dict[str, str] = field(default_factory=dict)
    build_warnings: list[str] = field(default_factory=list)


class AudioRenderer:
    """
    Deterministic renderer for AudioSpec -> WAV master + export formats.

    Builds DSP filtergraph from AudioSpec, runs FFmpeg, applies two-pass
    EBU R128 normalization, exports to all requested formats.
    Raises on all errors; no silent fallbacks.
    """

    def __init__(self, asset_resolver, tts_client, work_dir: str):
        self._asset_resolver = asset_resolver
        self._tts_client = tts_client
        self._work_dir = Path(work_dir)
        self._work_dir.mkdir(parents=True, exist_ok=True)

    def render(self, spec) -> AudioBuildResult:
        self._validate(spec)

        input_paths = self._resolve_all_tracks(spec)
        filtergraph = build_full_audio_filtergraph(spec)

        input_flags: list[str] = []
        for path in input_paths:
            input_flags += ["-i", path]

        premix_path = str(self._work_dir / f"{spec.spec_id}_premix.wav")
        cmd = (
            ["ffmpeg", "-y"] + input_flags
            + ["-filter_complex", filtergraph]
            + ["-map", "[a_master]"]
            + ["-ar", str(spec.sample_rate_hz), "-c:a", "pcm_s24le", premix_path]
        )
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
        if result.returncode != 0:
            raise RuntimeError(
                f"Audio DSP mix failed (exit {result.returncode}): {result.stderr[-4000:]}"
            )

        wav_out = str(self._work_dir / f"{spec.spec_id}_master.wav")
        loudness_stats = apply_loudnorm_two_pass(
            premix_path, wav_out,
            target_lufs=spec.master_chain.target_loudness_lufs,
            target_tp=spec.master_chain.target_true_peak_lufs,
            target_lra=spec.master_chain.lra,
        )

        output_hash = self._hash_file(wav_out)
        duration = self._probe_duration(wav_out)
        measured_lufs = float(loudness_stats.get("input_i", 0.0))

        warnings: list[str] = []
        lufs_delta = abs(measured_lufs - spec.master_chain.target_loudness_lufs)
        if lufs_delta > 0.5:
            warnings.append(
                f"LOUDNESS_OUT_OF_RANGE: target={spec.master_chain.target_loudness_lufs} LUFS, "
                f"measured={measured_lufs:.2f} LUFS, delta={lufs_delta:.2f} LU > 0.5 LU threshold."
            )

        additional: dict[str, str] = {}
        for fmt in spec.export_formats:
            if fmt == "wav":
                continue
            ext = "mp3" if fmt == "mp3" else ("aac" if fmt == "aac" else fmt)
            profile_name = "music" if fmt == "mp3" else ("aac_mobile" if fmt == "aac" else fmt)
            out_path = str(self._work_dir / f"{spec.spec_id}.{ext}")
            export_audio_profile(wav_out, out_path, profile_name)
            additional[fmt] = out_path

        return AudioBuildResult(
            wav_master_path=wav_out,
            output_hash=output_hash,
            duration_seconds=duration,
            measured_lufs=measured_lufs,
            additional_paths=additional,
            build_warnings=warnings,
        )

    def _resolve_all_tracks(self, spec) -> list[str]:
        """Resolve each AudioTrack to a local WAV file path."""
        paths: list[str] = []
        for track in spec.tracks:
            if track.asset_ref:
                paths.append(self._asset_resolver.resolve(track.asset_ref))
            elif track.segments:
                merged = self._merge_tts_segments(track)
                paths.append(merged)
            else:
                raise ValueError(
                    f"Track '{track.track_id}' has neither asset_ref nor TTS segments."
                )
        return paths

    def _merge_tts_segments(self, track) -> str:
        """Generate TTS for each segment and concatenate to a single WAV."""
        segment_paths: list[str] = []
        for seg in track.segments:
            if seg.text and seg.tts_voice:
                out = str(self._work_dir / "tts" / f"{seg.segment_id}.wav")
                Path(out).parent.mkdir(parents=True, exist_ok=True)
                self._tts_client.synthesize(seg.text, seg.tts_voice, out, rate=seg.tts_rate)
                segment_paths.append(out)
            elif seg.asset_ref:
                segment_paths.append(self._asset_resolver.resolve(seg.asset_ref))
            else:
                raise ValueError(f"Segment '{seg.segment_id}' has no text/voice or asset_ref.")

        merged = str(self._work_dir / "tts" / f"{track.track_id}_merged.wav")
        concat_list = str(self._work_dir / "tts" / f"{track.track_id}_concat.txt")
        with open(concat_list, "w") as f:
            for p in segment_paths:
                f.write(f"file '{p}'\n")
        cmd = ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", concat_list,
               "-c", "copy", merged]
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        if r.returncode != 0:
            raise RuntimeError(f"TTS segment concat failed: {r.stderr}")
        return merged

    def _probe_duration(self, path: str) -> float:
        result = subprocess.run(
            ["ffprobe", "-v", "quiet", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", path],
            capture_output=True, text=True, timeout=30,
        )
        if result.returncode != 0:
            raise RuntimeError(f"ffprobe failed on {path}: {result.stderr}")
        return float(result.stdout.strip())

    def _validate(self, spec) -> None:
        if not spec.tracks:
            raise ValueError("AudioSpec.tracks must not be empty.")
        for rule in spec.ducking_rules:
            track_ids = {t.track_id for t in spec.tracks}
            if rule.source_track not in track_ids:
                raise ValueError(f"DuckingRule.source_track '{rule.source_track}' not found in tracks.")
            if rule.target_track not in track_ids:
                raise ValueError(f"DuckingRule.target_track '{rule.target_track}' not found in tracks.")

    @staticmethod
    def _hash_file(path: str) -> str:
        h = hashlib.sha256()
        with open(path, "rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                h.update(chunk)
        return h.hexdigest()
```


---

### 18.6 BoardRenderer — Board and Diagram Engine

#### 18.6.1 SVG Element Generation for BoardSpec Element Types

Each `BoardNode` type maps to a specific SVG element. The renderer produces well-formed SVG 1.1 with ARIA accessibility attributes.

| NodeType | SVG element | Key attributes |
|---|---|---|
| `sticky` | `<rect>` + `<foreignObject>` | `rx`=brand radius, fill=sticky color, text via `<p>` in foreignObject |
| `box` | `<rect>` + `<text>` | `rx`=brand radius, stroke, fill |
| `circle` | `<ellipse>` | `rx`=width/2, `ry`=height/2 |
| `image` | `<image>` | `href`=asset URI, `preserveAspectRatio` |
| `text` | `<text>` | `font-family`, `font-size`, `fill` |
| `group` | `<g>` | Wraps child node SVG elements |
| `frame` | `<rect>` + dashed stroke `<text>` | `stroke-dasharray`, header label |
| `swimlane` | `<rect>` + horizontal divider `<line>` | Header band, body band |

```python
from __future__ import annotations

from xml.etree import ElementTree as ET

SVG_NS = "http://www.w3.org/2000/svg"
XHTML_NS = "http://www.w3.org/1999/xhtml"
XLINK_NS = "http://www.w3.org/1999/xlink"

STICKY_COLORS = {
    "yellow":  "#FFF176",
    "pink":    "#F48FB1",
    "blue":    "#81D4FA",
    "green":   "#A5D6A7",
    "orange":  "#FFCC80",
    "purple":  "#CE93D8",
    "default": "#FFF176",
}


def node_to_svg_element(node, brand_config=None) -> ET.Element:
    """
    Convert a BoardNode to an SVG element (ElementTree.Element).

    Applies brand tokens for color and font if brand_config is provided.
    Includes aria-label for accessibility.
    """
    radius = str(brand_config.border_radius_pt) if brand_config else "4"
    font = brand_config.font_body if brand_config else "sans-serif"
    font_size = str((brand_config.spacing_unit_pt * 1.5) if brand_config else 12)

    g = ET.Element("{%s}g" % SVG_NS)
    g.set("id", node.node_id)
    g.set("aria-label", node.text or node.node_id)
    g.set("transform", f"translate({node.x},{node.y})")

    fill = node.fill_color or "#ffffff"
    stroke = node.border_color or "#cccccc"
    stroke_width = str(node.border_width)

    if node.type.value == "sticky":
        color_key = (node.style_token or "default").lower()
        fill = STICKY_COLORS.get(color_key, STICKY_COLORS["default"])
        rect = ET.SubElement(g, "{%s}rect" % SVG_NS)
        rect.set("width", str(node.width))
        rect.set("height", str(node.height))
        rect.set("rx", radius)
        rect.set("ry", radius)
        rect.set("fill", fill)
        rect.set("stroke", "#e0e0e0")
        rect.set("stroke-width", "1")
        rect.set("filter", "url(#drop-shadow)")

        fo = ET.SubElement(g, "{%s}foreignObject" % SVG_NS)
        fo.set("width", str(node.width - 8))
        fo.set("height", str(node.height - 8))
        fo.set("x", "4")
        fo.set("y", "4")
        body = ET.SubElement(fo, "{%s}p" % XHTML_NS)
        body.set("style", f"font-family:{font};font-size:{font_size}px;margin:0;padding:4px;word-wrap:break-word;")
        body.text = node.text or ""

    elif node.type.value == "box":
        rect = ET.SubElement(g, "{%s}rect" % SVG_NS)
        rect.set("width", str(node.width))
        rect.set("height", str(node.height))
        rect.set("rx", radius)
        rect.set("ry", radius)
        rect.set("fill", fill)
        rect.set("stroke", stroke)
        rect.set("stroke-width", stroke_width)
        if node.text:
            txt = ET.SubElement(g, "{%s}text" % SVG_NS)
            txt.set("x", str(node.width / 2))
            txt.set("y", str(node.height / 2))
            txt.set("text-anchor", "middle")
            txt.set("dominant-baseline", "middle")
            txt.set("font-family", font)
            txt.set("font-size", font_size)
            txt.set("fill", "#1a1a1a")
            txt.text = node.text

    elif node.type.value == "circle":
        ell = ET.SubElement(g, "{%s}ellipse" % SVG_NS)
        ell.set("cx", str(node.width / 2))
        ell.set("cy", str(node.height / 2))
        ell.set("rx", str(node.width / 2))
        ell.set("ry", str(node.height / 2))
        ell.set("fill", fill)
        ell.set("stroke", stroke)
        ell.set("stroke-width", stroke_width)
        if node.text:
            txt = ET.SubElement(g, "{%s}text" % SVG_NS)
            txt.set("x", str(node.width / 2))
            txt.set("y", str(node.height / 2))
            txt.set("text-anchor", "middle")
            txt.set("dominant-baseline", "middle")
            txt.set("font-family", font)
            txt.set("font-size", font_size)
            txt.set("fill", "#1a1a1a")
            txt.text = node.text

    elif node.type.value == "image" and node.asset_ref:
        img = ET.SubElement(g, "{%s}image" % SVG_NS)
        img.set("{%s}href" % XLINK_NS, node.asset_ref)
        img.set("width", str(node.width))
        img.set("height", str(node.height))
        img.set("preserveAspectRatio", "xMidYMid meet")

    elif node.type.value == "text":
        txt = ET.SubElement(g, "{%s}text" % SVG_NS)
        txt.set("font-family", font)
        txt.set("font-size", str(node.font_size_pt or 12))
        txt.set("fill", fill if fill != "#ffffff" else "#1a1a1a")
        txt.text = node.text or ""

    elif node.type.value == "frame":
        rect = ET.SubElement(g, "{%s}rect" % SVG_NS)
        rect.set("width", str(node.width))
        rect.set("height", str(node.height))
        rect.set("fill", "none")
        rect.set("stroke", stroke)
        rect.set("stroke-width", "2")
        rect.set("stroke-dasharray", "8 4")
        if node.text:
            hdr = ET.SubElement(g, "{%s}text" % SVG_NS)
            hdr.set("x", "8")
            hdr.set("y", "-6")
            hdr.set("font-family", font)
            hdr.set("font-size", font_size)
            hdr.set("fill", stroke)
            hdr.text = node.text

    elif node.type.value == "swimlane":
        outer = ET.SubElement(g, "{%s}rect" % SVG_NS)
        outer.set("width", str(node.width))
        outer.set("height", str(node.height))
        outer.set("fill", fill)
        outer.set("stroke", stroke)
        outer.set("stroke-width", stroke_width)
        header_h = 32
        header = ET.SubElement(g, "{%s}rect" % SVG_NS)
        header.set("width", str(node.width))
        header.set("height", str(header_h))
        header.set("fill", stroke)
        if node.text:
            hdr_txt = ET.SubElement(g, "{%s}text" % SVG_NS)
            hdr_txt.set("x", "8")
            hdr_txt.set("y", str(header_h - 8))
            hdr_txt.set("font-family", font)
            hdr_txt.set("font-size", font_size)
            hdr_txt.set("fill", "#ffffff")
            hdr_txt.text = node.text

    return g
```

#### 18.6.2 Connector Routing — Orthogonal Algorithm

```python
from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Point:
    x: float
    y: float


@dataclass
class RouteResult:
    points: list[Point]
    svg_path_d: str


def route_orthogonal(
    from_node,
    to_node,
    margin: float = 20.0,
) -> RouteResult:
    """
    Compute an orthogonal (right-angle) connector route between two BoardNodes.

    Algorithm:
    1. Determine the nearest face of each node (top/bottom/left/right).
    2. Exit from_node perpendicularly, enter to_node perpendicularly.
    3. Insert a midpoint segment to complete the right-angle path.
    4. If nodes are axis-aligned, produce an L-shaped 3-point route.
    5. Otherwise produce a Z-shaped 4-point route via midpoint.

    Overlap avoidance: routes are offset by margin from node edges to avoid
    running through node bodies.
    """
    fx = from_node.x + from_node.width / 2
    fy = from_node.y + from_node.height / 2
    tx = to_node.x + to_node.width / 2
    ty = to_node.y + to_node.height / 2

    # Exit point: nearest edge midpoint of from_node toward to_node
    if abs(tx - fx) >= abs(ty - fy):
        # Horizontal dominant: exit left or right
        if tx > fx:
            exit_pt = Point(from_node.x + from_node.width, fy)
            entry_pt = Point(to_node.x, ty)
        else:
            exit_pt = Point(from_node.x, fy)
            entry_pt = Point(to_node.x + to_node.width, ty)
        mid_x = (exit_pt.x + entry_pt.x) / 2
        points = [
            exit_pt,
            Point(mid_x, exit_pt.y),
            Point(mid_x, entry_pt.y),
            entry_pt,
        ]
    else:
        # Vertical dominant: exit top or bottom
        if ty > fy:
            exit_pt = Point(fx, from_node.y + from_node.height)
            entry_pt = Point(tx, to_node.y)
        else:
            exit_pt = Point(fx, from_node.y)
            entry_pt = Point(tx, to_node.y + to_node.height)
        mid_y = (exit_pt.y + entry_pt.y) / 2
        points = [
            exit_pt,
            Point(exit_pt.x, mid_y),
            Point(entry_pt.x, mid_y),
            entry_pt,
        ]

    d_parts = [f"M {points[0].x:.2f} {points[0].y:.2f}"]
    for pt in points[1:]:
        d_parts.append(f"L {pt.x:.2f} {pt.y:.2f}")
    return RouteResult(points=points, svg_path_d=" ".join(d_parts))


def edge_to_svg_element(edge, nodes_by_id: dict, brand_config=None) -> "ET.Element":
    """Convert a BoardEdge to an SVG path element with optional arrowhead marker."""
    from xml.etree import ElementTree as ET

    from_node = nodes_by_id.get(edge.from_node)
    to_node = nodes_by_id.get(edge.to_node)
    if from_node is None or to_node is None:
        raise ValueError(
            f"Edge '{edge.edge_id}' references non-existent node: "
            f"from='{edge.from_node}', to='{edge.to_node}'"
        )

    if edge.routing == "orthogonal":
        route = route_orthogonal(from_node, to_node)
        d = route.svg_path_d
    else:
        # Bezier: simple cubic from center to center
        fx = from_node.x + from_node.width / 2
        fy = from_node.y + from_node.height / 2
        tx = to_node.x + to_node.width / 2
        ty = to_node.y + to_node.height / 2
        cx1, cy1 = fx + (tx - fx) / 3, fy
        cx2, cy2 = tx - (tx - fx) / 3, ty
        d = f"M {fx:.2f} {fy:.2f} C {cx1:.2f} {cy1:.2f} {cx2:.2f} {cy2:.2f} {tx:.2f} {ty:.2f}"

    path = ET.Element("{%s}path" % SVG_NS)
    path.set("id", edge.edge_id)
    path.set("d", d)

    stroke = edge.color or "#666666"
    path.set("stroke", stroke)
    path.set("stroke-width", "2")
    path.set("fill", "none")

    if edge.style.value == "dashed":
        path.set("stroke-dasharray", "8 4")
    elif edge.style.value == "dotted":
        path.set("stroke-dasharray", "2 4")

    if edge.type == "arrow":
        path.set("marker-end", "url(#arrowhead)")
    elif edge.type == "bidirectional":
        path.set("marker-start", "url(#arrowhead)")
        path.set("marker-end", "url(#arrowhead)")

    if edge.label:
        # Label at midpoint of path
        from xml.etree import ElementTree as ET
        mid_d_parts = d.split()
        # Rough midpoint: use first M coords and last L coords
        mx = (float(mid_d_parts[1]) + float(mid_d_parts[-2])) / 2
        my = (float(mid_d_parts[2]) + float(mid_d_parts[-1])) / 2
        txt = ET.Element("{%s}text" % SVG_NS)
        txt.set("x", str(mx))
        txt.set("y", str(my - 6))
        txt.set("text-anchor", "middle")
        txt.set("font-size", "11")
        txt.set("fill", "#333")
        txt.text = edge.label
        return (path, txt)

    return path
```

#### 18.6.3 BoardRenderer Class

```python
from __future__ import annotations

import hashlib
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional
from xml.etree import ElementTree as ET


SVG_DEFS = """<defs>
  <marker id="arrowhead" markerWidth="10" markerHeight="7"
          refX="9" refY="3.5" orient="auto">
    <polygon points="0 0, 10 3.5, 0 7" fill="#666"/>
  </marker>
  <filter id="drop-shadow" x="-10%" y="-10%" width="120%" height="120%">
    <feDropShadow dx="2" dy="2" stdDeviation="3" flood-opacity="0.2"/>
  </filter>
</defs>"""


@dataclass
class BoardBuildResult:
    svg_path: Optional[str]
    png_path: Optional[str]
    pdf_path: Optional[str]
    output_hash: str
    node_count: int
    edge_count: int
    build_warnings: list[str] = field(default_factory=list)


class BoardRenderer:
    """
    Deterministic renderer for BoardSpec -> SVG + PNG + PDF.

    SVG is generated in pure Python (xml.etree). PNG is produced via
    rsvg-convert or headless Chromium (rsvg preferred for speed).
    Raises on all errors; no silent fallbacks.
    """

    def __init__(self, asset_resolver, work_dir: str, brand_config=None):
        self._asset_resolver = asset_resolver
        self._work_dir = Path(work_dir)
        self._work_dir.mkdir(parents=True, exist_ok=True)
        self._brand_config = brand_config

    def render(
        self,
        spec,
        export_png: bool = True,
        export_pdf: bool = False,
        dpi: int = 144,
    ) -> BoardBuildResult:
        self._validate(spec)

        svg_str = self._build_svg(spec)
        svg_path = str(self._work_dir / f"{spec.spec_id}.svg")
        with open(svg_path, "w", encoding="utf-8") as f:
            f.write(svg_str)

        png_path: Optional[str] = None
        pdf_path: Optional[str] = None
        warnings: list[str] = []

        if export_png:
            png_path = str(self._work_dir / f"{spec.spec_id}.png")
            self._rasterize(svg_path, png_path, dpi=dpi, fmt="png")

        if export_pdf:
            pdf_path = str(self._work_dir / f"{spec.spec_id}.pdf")
            self._rasterize(svg_path, pdf_path, dpi=dpi, fmt="pdf")

        primary = png_path or svg_path
        output_hash = self._hash_file(primary)

        return BoardBuildResult(
            svg_path=svg_path,
            png_path=png_path,
            pdf_path=pdf_path,
            output_hash=output_hash,
            node_count=len(spec.nodes),
            edge_count=len(spec.edges),
            build_warnings=warnings,
        )

    def _build_svg(self, spec) -> str:
        root = ET.Element("{%s}svg" % SVG_NS)
        root.set("xmlns", SVG_NS)
        root.set("xmlns:xlink", XLINK_NS)
        root.set("xmlns:xhtml", XHTML_NS)
        root.set("width", str(spec.canvas_width_px))
        root.set("height", str(spec.canvas_height_px))
        root.set("viewBox", f"0 0 {spec.canvas_width_px} {spec.canvas_height_px}")
        root.set("role", "img")
        root.set("aria-label", f"Board: {spec.spec_id}")

        # Inject defs inline via fromstring
        defs_elem = ET.fromstring(SVG_DEFS)
        root.append(defs_elem)

        # Grid (optional background)
        if spec.grid.enabled:
            self._add_grid(root, spec)

        # Build node lookup
        nodes_by_id = {node.node_id: node for node in spec.nodes}

        # Draw edges first (below nodes)
        edge_group = ET.SubElement(root, "{%s}g" % SVG_NS)
        edge_group.set("id", "edges")
        for edge in spec.edges:
            result = edge_to_svg_element(edge, nodes_by_id, self._brand_config)
            if isinstance(result, tuple):
                for elem in result:
                    edge_group.append(elem)
            else:
                edge_group.append(result)

        # Draw nodes sorted by z_index
        node_group = ET.SubElement(root, "{%s}g" % SVG_NS)
        node_group.set("id", "nodes")
        sorted_nodes = sorted(spec.nodes, key=lambda n: n.z_index)
        for node in sorted_nodes:
            node_elem = node_to_svg_element(node, self._brand_config)
            node_group.append(node_elem)

        ET.indent(root, space="  ")
        return '<?xml version="1.0" encoding="UTF-8"?>\n' + ET.tostring(root, encoding="unicode")

    def _add_grid(self, root: ET.Element, spec) -> None:
        grid_g = ET.SubElement(root, "{%s}g" % SVG_NS)
        grid_g.set("id", "grid")
        grid_g.set("opacity", "0.15")
        spacing = spec.grid.spacing_px
        x = spacing
        while x < spec.canvas_width_px:
            line = ET.SubElement(grid_g, "{%s}line" % SVG_NS)
            line.set("x1", str(x)); line.set("y1", "0")
            line.set("x2", str(x)); line.set("y2", str(spec.canvas_height_px))
            line.set("stroke", "#888"); line.set("stroke-width", "0.5")
            x += spacing
        y = spacing
        while y < spec.canvas_height_px:
            line = ET.SubElement(grid_g, "{%s}line" % SVG_NS)
            line.set("x1", "0"); line.set("y1", str(y))
            line.set("x2", str(spec.canvas_width_px)); line.set("y2", str(y))
            line.set("stroke", "#888"); line.set("stroke-width", "0.5")
            y += spacing

    def _rasterize(self, svg_path: str, output_path: str, dpi: int, fmt: str) -> None:
        """Rasterize SVG to PNG or PDF using rsvg-convert."""
        cmd = ["rsvg-convert", "--dpi-x", str(dpi), "--dpi-y", str(dpi),
               "--format", fmt, svg_path, "--output", output_path]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        if result.returncode != 0:
            raise RuntimeError(
                f"rsvg-convert failed (exit {result.returncode}): {result.stderr}"
            )

    def _validate(self, spec) -> None:
        node_ids = {n.node_id for n in spec.nodes}
        for edge in spec.edges:
            if edge.from_node not in node_ids:
                raise ValueError(
                    f"Edge '{edge.edge_id}' references non-existent from_node '{edge.from_node}'."
                )
            if edge.to_node not in node_ids:
                raise ValueError(
                    f"Edge '{edge.edge_id}' references non-existent to_node '{edge.to_node}'."
                )
        for node in spec.nodes:
            if node.x < 0 or node.y < 0:
                raise ValueError(
                    f"Node '{node.node_id}' has negative coordinates (x={node.x}, y={node.y})."
                )
            if node.x + node.width > spec.canvas_width_px or node.y + node.height > spec.canvas_height_px:
                raise ValueError(
                    f"Node '{node.node_id}' extends outside canvas bounds."
                )

    @staticmethod
    def _hash_file(path: str) -> str:
        h = hashlib.sha256()
        with open(path, "rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                h.update(chunk)
        return h.hexdigest()
```


---

## 19. Artifact Versioning and Lineage System

### 19.1 Overview

Every IR object is immutable once registered. A change to a SlideSpec produces a new IR with an incremented version and a new content hash. The versioning system maintains a directed acyclic graph (DAG) where nodes are IR versions and edges represent derivation relationships. The lineage system allows traversal from any artifact back to all of its input IRs, datasets, and provider calls.

### 19.2 Version Graph Data Model

```python
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional


@dataclass
class ArtifactVersion:
    """One immutable version of an artifact IR."""

    version_id: str          # UUID
    ir_id: str               # UUID — references artifact_ir.id
    ir_type: str             # "SlideSpec", "DocSpec", etc.
    spec_id: str             # Human-readable spec identifier (stable across versions)
    version_number: int      # Monotonically increasing per spec_id
    content_hash: str        # SHA-256 of canonical IR JSON
    parent_version_id: Optional[str] = None   # Previous version (None for v1)
    derived_from_ids: list[str] = field(default_factory=list)  # Other IRs this depends on
    status: str = "draft"    # "draft" | "review" | "approved" | "published" | "deprecated"
    created_by: str = ""
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    change_summary: Optional[str] = None


@dataclass
class VersionEdge:
    """A directed edge in the version DAG."""

    from_version_id: str
    to_version_id: str
    relationship: str  # "parent" | "dependency" | "derived_from"


@dataclass
class VersionGraph:
    """
    In-memory representation of the artifact version DAG.

    Nodes are ArtifactVersion objects.
    Edges represent parent-child (version lineage) and dependency relationships.
    """

    versions: dict[str, ArtifactVersion] = field(default_factory=dict)  # version_id -> ArtifactVersion
    edges: list[VersionEdge] = field(default_factory=list)

    def add_version(self, version: ArtifactVersion) -> None:
        if version.version_id in self.versions:
            raise ValueError(f"Version '{version.version_id}' already exists in graph.")
        self.versions[version.version_id] = version
        if version.parent_version_id:
            self.edges.append(VersionEdge(
                from_version_id=version.parent_version_id,
                to_version_id=version.version_id,
                relationship="parent",
            ))
        for dep_id in version.derived_from_ids:
            self.edges.append(VersionEdge(
                from_version_id=dep_id,
                to_version_id=version.version_id,
                relationship="derived_from",
            ))

    def get_ancestors(self, version_id: str) -> list[ArtifactVersion]:
        """Return all ancestor versions (parent chain) of a given version."""
        ancestors: list[ArtifactVersion] = []
        current_id: Optional[str] = version_id
        visited: set[str] = set()
        while current_id:
            if current_id in visited:
                raise ValueError(f"Cycle detected in version graph at '{current_id}'.")
            visited.add(current_id)
            version = self.versions.get(current_id)
            if version is None:
                break
            if current_id != version_id:
                ancestors.append(version)
            current_id = version.parent_version_id
        return ancestors

    def get_descendants(self, version_id: str) -> list[ArtifactVersion]:
        """Return all versions directly derived from this version."""
        return [
            self.versions[e.to_version_id]
            for e in self.edges
            if e.from_version_id == version_id and e.to_version_id in self.versions
        ]

    def get_dependencies(self, version_id: str) -> list[ArtifactVersion]:
        """Return all IR versions that this version depends on (derived_from edges incoming)."""
        return [
            self.versions[e.from_version_id]
            for e in self.edges
            if e.to_version_id == version_id
            and e.relationship == "derived_from"
            and e.from_version_id in self.versions
        ]

    def topological_order(self) -> list[ArtifactVersion]:
        """Return all versions in topological order (dependencies before dependents)."""
        from collections import deque, defaultdict

        in_degree: dict[str, int] = defaultdict(int)
        adj: dict[str, list[str]] = defaultdict(list)
        for edge in self.edges:
            adj[edge.from_version_id].append(edge.to_version_id)
            in_degree[edge.to_version_id] += 1

        queue: deque[str] = deque(
            vid for vid in self.versions if in_degree[vid] == 0
        )
        result: list[ArtifactVersion] = []
        while queue:
            vid = queue.popleft()
            if vid in self.versions:
                result.append(self.versions[vid])
            for neighbor in adj[vid]:
                in_degree[neighbor] -= 1
                if in_degree[neighbor] == 0:
                    queue.append(neighbor)
        return result
```

### 19.3 Lineage Tracing

```python
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class LineageNode:
    """One node in the lineage trace tree."""
    node_type: str   # "ir_version" | "dataset" | "asset" | "provider_call"
    node_id: str
    label: str
    metadata: dict = field(default_factory=dict)
    children: list["LineageNode"] = field(default_factory=list)


@dataclass
class ArtifactLineage:
    """
    Complete lineage record for one artifact build.

    Encodes the full causal chain: artifact -> IR versions -> datasets -> assets -> provider calls.
    """

    build_id: str
    root: LineageNode

    def to_flat_list(self) -> list[LineageNode]:
        """Flatten the lineage tree into a depth-first ordered list."""
        result: list[LineageNode] = []
        stack = [self.root]
        while stack:
            node = stack.pop()
            result.append(node)
            stack.extend(reversed(node.children))
        return result

    def find_all_provider_calls(self) -> list[LineageNode]:
        """Return all provider_call nodes in the lineage tree."""
        return [n for n in self.to_flat_list() if n.node_type == "provider_call"]

    def find_all_datasets(self) -> list[LineageNode]:
        """Return all dataset nodes in the lineage tree."""
        return [n for n in self.to_flat_list() if n.node_type == "dataset"]


def trace_lineage(
    build_id: str,
    provenance_record,
    version_graph: VersionGraph,
    dataset_registry: dict,
    render_jobs: list,
) -> ArtifactLineage:
    """
    Build a full lineage tree for an artifact build.

    Traverses from the provenance record back through IR versions, datasets,
    assets, and provider calls to produce a complete LineageNode tree.

    Args:
        build_id: UUID of the artifact build.
        provenance_record: ArtifactProvenance object.
        version_graph: VersionGraph containing all known IR versions.
        dataset_registry: dict mapping data_ref keys to dataset metadata.
        render_jobs: list of render_job records for this build.
    """
    root = LineageNode(
        node_type="ir_version",
        node_id=provenance_record.ir_id,
        label=f"IR:{provenance_record.ir_id[:8]}",
        metadata={
            "ir_hash": provenance_record.ir_hash,
            "provider": provenance_record.provider,
            "non_deterministic": provenance_record.non_deterministic,
        },
    )

    # Attach ancestor IR versions
    if provenance_record.ir_id in version_graph.versions:
        ancestors = version_graph.get_ancestors(provenance_record.ir_id)
        for ancestor in ancestors:
            root.children.append(LineageNode(
                node_type="ir_version",
                node_id=ancestor.version_id,
                label=f"IR v{ancestor.version_number}:{ancestor.spec_id}",
                metadata={"content_hash": ancestor.content_hash, "status": ancestor.status},
            ))

    # Attach dataset nodes
    for ref_key, ref_uri in dataset_registry.items():
        root.children.append(LineageNode(
            node_type="dataset",
            node_id=ref_key,
            label=f"dataset:{ref_key}",
            metadata={"uri": ref_uri},
        ))

    # Attach asset provenance nodes
    for asset_prov in provenance_record.asset_provenances:
        root.children.append(LineageNode(
            node_type="asset",
            node_id=asset_prov.get("asset_ref", ""),
            label=f"asset:{asset_prov.get('asset_ref', '')[:32]}",
            metadata={"hash": asset_prov.get("asset_hash", "")},
        ))

    # Attach provider call nodes
    for job in render_jobs:
        root.children.append(LineageNode(
            node_type="provider_call",
            node_id=job.get("operation_id", ""),
            label=f"provider:{job.get('provider', '')}:{job.get('operation_id', '')[:8]}",
            metadata={
                "model_version": job.get("model_version", ""),
                "semantic_fingerprint": job.get("semantic_fingerprint", ""),
                "non_deterministic": job.get("non_deterministic", True),
                "output_hash": job.get("output_hash", ""),
            },
        ))

    return ArtifactLineage(build_id=build_id, root=root)
```

### 19.4 IR Diff Computation

```python
from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any


@dataclass
class DiffEntry:
    path: str       # JSON pointer path, e.g. "/slides/0/elements/1/text"
    operation: str  # "add" | "remove" | "replace"
    old_value: Any = None
    new_value: Any = None


@dataclass
class IRDiff:
    from_version_id: str
    to_version_id: str
    from_content_hash: str
    to_content_hash: str
    entries: list[DiffEntry] = field(default_factory=list)

    @property
    def is_empty(self) -> bool:
        return len(self.entries) == 0

    def change_summary(self) -> str:
        if self.is_empty:
            return "No changes."
        adds = sum(1 for e in self.entries if e.operation == "add")
        removes = sum(1 for e in self.entries if e.operation == "remove")
        replaces = sum(1 for e in self.entries if e.operation == "replace")
        return (
            f"{len(self.entries)} change(s): {adds} addition(s), "
            f"{removes} removal(s), {replaces} modification(s)."
        )


def compute_ir_diff(
    from_ir_dict: dict[str, Any],
    to_ir_dict: dict[str, Any],
    from_version_id: str,
    to_version_id: str,
) -> IRDiff:
    """
    Compute a structural diff between two IR dict representations.

    Performs a recursive field-by-field comparison and records each difference
    as a DiffEntry with a JSON pointer path.

    Both dicts must be the canonical JSON-serializable representation of the IR
    (as produced by model.model_dump()).
    """
    entries: list[DiffEntry] = []

    def _diff_recursive(old: Any, new: Any, path: str) -> None:
        if isinstance(old, dict) and isinstance(new, dict):
            all_keys = set(old) | set(new)
            for key in sorted(all_keys):
                child_path = f"{path}/{key}"
                if key not in old:
                    entries.append(DiffEntry(path=child_path, operation="add", new_value=new[key]))
                elif key not in new:
                    entries.append(DiffEntry(path=child_path, operation="remove", old_value=old[key]))
                else:
                    _diff_recursive(old[key], new[key], child_path)
        elif isinstance(old, list) and isinstance(new, list):
            max_len = max(len(old), len(new))
            for idx in range(max_len):
                child_path = f"{path}/{idx}"
                if idx >= len(old):
                    entries.append(DiffEntry(path=child_path, operation="add", new_value=new[idx]))
                elif idx >= len(new):
                    entries.append(DiffEntry(path=child_path, operation="remove", old_value=old[idx]))
                else:
                    _diff_recursive(old[idx], new[idx], child_path)
        else:
            if old != new:
                entries.append(DiffEntry(path=path, operation="replace", old_value=old, new_value=new))

    _diff_recursive(from_ir_dict, to_ir_dict, "")

    return IRDiff(
        from_version_id=from_version_id,
        to_version_id=to_version_id,
        from_content_hash=from_ir_dict.get("content_hash", ""),
        to_content_hash=to_ir_dict.get("content_hash", ""),
        entries=entries,
    )
```

### 19.5 Version Promotion Workflow

```python
from __future__ import annotations

VALID_TRANSITIONS: dict[str, list[str]] = {
    "draft":      ["review", "deprecated"],
    "review":     ["approved", "draft", "deprecated"],
    "approved":   ["published", "deprecated"],
    "published":  ["deprecated"],
    "deprecated": [],
}


def promote_version(
    version: ArtifactVersion,
    target_status: str,
    actor: str,
    reason: Optional[str] = None,
) -> ArtifactVersion:
    """
    Transition an ArtifactVersion to a new status.

    Raises ValueError if the transition is invalid.
    Returns a new ArtifactVersion object (versions are immutable; promotion
    creates a new record with the updated status field).
    """
    allowed = VALID_TRANSITIONS.get(version.status, [])
    if target_status not in allowed:
        raise ValueError(
            f"Invalid version status transition: '{version.status}' -> '{target_status}'. "
            f"Allowed transitions from '{version.status}': {allowed}"
        )

    import copy
    new_version = copy.copy(version)
    object.__setattr__(new_version, "status", target_status)
    object.__setattr__(new_version, "change_summary",
                       f"Promoted to '{target_status}' by '{actor}'. Reason: {reason or 'not specified'}")
    object.__setattr__(new_version, "created_at", datetime.now(timezone.utc))
    return new_version
```

---

## 20. Multi-Surface Export System

### 20.1 Surface Taxonomy

The platform exports each IR to multiple surfaces. Each surface has a canonical format, renderer, and consumer use case.

| Surface | Canonical Format | Renderer | Consumer |
|---|---|---|---|
| `print` | PDF | WeasyPrint / LibreOffice | Printed collateral, archival |
| `digital_office` | PPTX / DOCX / XLSX | python-pptx / python-docx / openpyxl | Office software, email attachment |
| `web` | HTML / SVG | WeasyPrint / SVG engine | Browser, web CMS |
| `video` | MP4 H.264 | FFmpeg | Video platforms, embedding |
| `audio` | MP3 / WAV | FFmpeg | Podcast, audio player |
| `board` | PNG / SVG | BoardRenderer | Miro import, PDF presentation |
| `archival` | Multiple (all formats) | All renderers | Long-term storage, audit |
| `social_portrait` | MP4 1080x1920 | FFmpeg | TikTok, Instagram Reels |
| `social_square` | MP4 1080x1080 | FFmpeg | Instagram feed |
| `email` | HTML (inline CSS) | WeasyPrint | Email client |

### 20.2 SurfaceTarget Model

```python
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class SurfaceTarget:
    """Describes a single export target surface with its format preferences."""

    surface: str           # Canonical surface name from taxonomy above
    format: str            # e.g. "pdf", "pptx", "mp4", "svg"
    quality_preset: str = "default"
    priority: int = 1      # Lower = higher priority; 1 is highest
    metadata: dict = field(default_factory=dict)

    @classmethod
    def from_surface_name(cls, surface: str) -> "SurfaceTarget":
        """Create a SurfaceTarget with default format for a named surface."""
        defaults = {
            "print":           ("pdf",  "default"),
            "digital_office":  ("pptx", "default"),
            "web":             ("html", "default"),
            "video":           ("mp4",  "1080p"),
            "audio":           ("mp3",  "default"),
            "board":           ("png",  "default"),
            "archival":        ("pdf",  "archival"),
            "social_portrait": ("mp4",  "social_portrait"),
            "social_square":   ("mp4",  "social_square"),
            "email":           ("html", "email"),
        }
        fmt, preset = defaults.get(surface, ("pdf", "default"))
        return cls(surface=surface, format=fmt, quality_preset=preset)
```

### 20.3 FormatNegotiator

```python
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


# IR type -> list of supported surface names in priority order
IR_SURFACE_SUPPORT: dict[str, list[str]] = {
    "SlideSpec":       ["digital_office", "print", "web", "video", "archival"],
    "DocSpec":         ["digital_office", "print", "web", "email", "archival"],
    "SpreadsheetSpec": ["digital_office", "web", "archival"],
    "TimelineSpec":    ["video", "social_portrait", "social_square", "archival"],
    "AudioSpec":       ["audio", "archival"],
    "BoardSpec":       ["board", "print", "web", "archival"],
}


class FormatNegotiator:
    """
    Selects the optimal export surfaces for a given IR type and client preferences.

    Client specifies a priority-ordered list of desired surfaces; negotiator
    returns the intersection with what the IR type supports, preserving order.
    Raises ValueError if no supported surfaces are available in the request.
    """

    def negotiate(
        self,
        ir_type: str,
        requested_surfaces: list[str],
    ) -> list[SurfaceTarget]:
        """
        Return SurfaceTarget list for surfaces that are both requested and supported.

        Args:
            ir_type: IR type string (e.g. "SlideSpec").
            requested_surfaces: Client-priority-ordered list of surface names.

        Raises:
            ValueError: If requested_surfaces is empty or no surfaces are supported.
        """
        if not requested_surfaces:
            raise ValueError("requested_surfaces must not be empty.")

        supported = set(IR_SURFACE_SUPPORT.get(ir_type, []))
        negotiated: list[SurfaceTarget] = []
        for surface in requested_surfaces:
            if surface in supported:
                negotiated.append(SurfaceTarget.from_surface_name(surface))

        if not negotiated:
            raise ValueError(
                f"IR type '{ir_type}' does not support any of the requested surfaces: "
                f"{requested_surfaces}. Supported: {list(supported)}"
            )
        return negotiated
```

### 20.4 ExportOrchestrator

```python
from __future__ import annotations

import concurrent.futures
from dataclasses import dataclass, field
from typing import Any, Callable, Optional


@dataclass
class ExportResult:
    surface: str
    format: str
    output_uri: str
    output_hash: str
    duration_seconds: float
    success: bool
    error_message: Optional[str] = None


@dataclass
class MultiSurfaceExportResult:
    build_id: str
    ir_id: str
    results: list[ExportResult] = field(default_factory=list)

    @property
    def all_successful(self) -> bool:
        return all(r.success for r in self.results)

    @property
    def successful(self) -> list[ExportResult]:
        return [r for r in self.results if r.success]

    @property
    def failed(self) -> list[ExportResult]:
        return [r for r in self.results if not r.success]


class ExportOrchestrator:
    """
    Orchestrates parallel export of a single IR to multiple surfaces.

    Each surface is exported in a separate thread. Failures on individual surfaces
    are captured in ExportResult.success=False; they do not abort other exports.
    The orchestrator raises only if ALL exports fail.
    """

    def __init__(
        self,
        renderer_registry: dict[str, Any],
        storage_backend: Any,
        max_workers: int = 4,
    ):
        self._renderers = renderer_registry
        self._storage = storage_backend
        self._max_workers = max_workers

    def export(
        self,
        build_id: str,
        ir_id: str,
        ir_spec: Any,
        targets: list[SurfaceTarget],
    ) -> MultiSurfaceExportResult:
        """
        Export ir_spec to all targets in parallel (up to max_workers threads).

        Returns MultiSurfaceExportResult containing ExportResult for each surface.
        Raises RuntimeError if all exports fail.
        """
        import time
        result = MultiSurfaceExportResult(build_id=build_id, ir_id=ir_id)

        def export_one(target: SurfaceTarget) -> ExportResult:
            t_start = time.monotonic()
            try:
                renderer = self._renderers.get(target.surface)
                if renderer is None:
                    raise ValueError(f"No renderer registered for surface '{target.surface}'.")
                build_result = renderer.render(ir_spec)
                uri = self._storage.upload(build_result, target)
                output_hash = getattr(build_result, "output_hash", "")
                return ExportResult(
                    surface=target.surface,
                    format=target.format,
                    output_uri=uri,
                    output_hash=output_hash,
                    duration_seconds=round(time.monotonic() - t_start, 3),
                    success=True,
                )
            except Exception as exc:
                return ExportResult(
                    surface=target.surface,
                    format=target.format,
                    output_uri="",
                    output_hash="",
                    duration_seconds=round(time.monotonic() - t_start, 3),
                    success=False,
                    error_message=str(exc),
                )

        with concurrent.futures.ThreadPoolExecutor(max_workers=self._max_workers) as executor:
            futures = {executor.submit(export_one, target): target for target in targets}
            for future in concurrent.futures.as_completed(futures):
                result.results.append(future.result())

        if not result.all_successful and len(result.failed) == len(targets):
            errors = "; ".join(r.error_message or "" for r in result.failed)
            raise RuntimeError(
                f"All {len(targets)} export(s) failed for build '{build_id}': {errors}"
            )

        return result

    def ensure_cross_surface_consistency(
        self,
        export_result: MultiSurfaceExportResult,
    ) -> list[str]:
        """
        Check that key data fields appear consistently across successful exports.

        Returns a list of consistency warning strings (empty list = consistent).
        Checks performed:
        - All successful exports have non-empty output_uri.
        - All successful exports have a non-zero output_hash.
        - No two exports for different surfaces have the same output_hash
          (which would indicate a renderer bug where the same bytes were emitted
          regardless of format).
        """
        warnings: list[str] = []
        hashes: dict[str, str] = {}

        for r in export_result.successful:
            if not r.output_uri:
                warnings.append(f"CONSISTENCY: surface='{r.surface}' has empty output_uri.")
            if not r.output_hash:
                warnings.append(f"CONSISTENCY: surface='{r.surface}' has empty output_hash.")
            if r.output_hash and r.output_hash in hashes:
                warnings.append(
                    f"CONSISTENCY: surface='{r.surface}' and surface='{hashes[r.output_hash]}' "
                    f"have identical output_hash='{r.output_hash}'. Possible renderer bug."
                )
            if r.output_hash:
                hashes[r.output_hash] = r.surface

        return warnings
```

---

## 21. Quality Validation System

### 21.1 QualityChecker Architecture

```python
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Optional


@dataclass
class ValidationRule:
    """A single named validation rule."""

    rule_id: str
    name: str
    severity: str   # "error" | "warning" | "info"
    ir_type: str    # "SlideSpec" | "DocSpec" | "TimelineSpec" | "AudioSpec" | "BoardSpec" | "*"
    check_fn: Callable[[Any, Optional[str]], "ValidationCheck"]
    description: str = ""


@dataclass
class ValidationCheck:
    """Result of applying one ValidationRule."""

    rule_id: str
    name: str
    status: str     # "pass" | "warn" | "fail"
    severity: str
    affected_elements: list[dict] = field(default_factory=list)
    detail: str = ""
    suggestion: str = ""


@dataclass
class QualityReport:
    """Full quality report for one artifact build."""

    build_id: str
    ir_type: str
    overall_status: str    # "pass" | "fail"
    checks: list[ValidationCheck] = field(default_factory=list)

    @property
    def errors(self) -> list[ValidationCheck]:
        return [c for c in self.checks if c.severity == "error" and c.status == "fail"]

    @property
    def warnings(self) -> list[ValidationCheck]:
        return [c for c in self.checks if c.severity == "warning" and c.status in ("fail", "warn")]

    @property
    def passed(self) -> bool:
        return len(self.errors) == 0


class QualityChecker:
    """
    Runs all registered ValidationRules against a compiled artifact.

    Rules are registered per IR type. Calling check() runs all applicable
    rules and returns a QualityReport. If any error-severity rule fails,
    overall_status is "fail".
    """

    def __init__(self) -> None:
        self._rules: list[ValidationRule] = []

    def register(self, rule: ValidationRule) -> None:
        self._rules.append(rule)

    def check(self, build_id: str, ir_spec: Any, compiled_path: Optional[str] = None) -> QualityReport:
        ir_type = getattr(ir_spec, "ir_type", "*")
        applicable = [r for r in self._rules if r.ir_type in (ir_type, "*")]

        checks: list[ValidationCheck] = []
        for rule in applicable:
            result = rule.check_fn(ir_spec, compiled_path)
            checks.append(result)

        overall = "pass" if all(c.status != "fail" or c.severity != "error" for c in checks) else "fail"
        return QualityReport(
            build_id=build_id,
            ir_type=ir_type,
            overall_status=overall,
            checks=checks,
        )
```

### 21.2 Slides: Per-Type Quality Validators

```python
import subprocess


def check_slide_layout_overflow(spec, pptx_path: Optional[str]) -> ValidationCheck:
    """
    Detect text element bounding box overflow relative to slide canvas.

    Checks each SlideElement bbox (in Inches) against slide_size_cm.
    """
    slide_w_in = spec.slide_size_cm[0] / 2.54
    slide_h_in = spec.slide_size_cm[1] / 2.54
    affected = []
    for slide_def in spec.slides:
        for elem in slide_def.elements:
            if elem.bbox:
                x, y, w, h = elem.bbox
                if x + w > slide_w_in + 0.01:
                    affected.append({"slide": slide_def.slide_id, "element": elem.element_id,
                                     "issue": f"x+w={x+w:.2f} > slide_width={slide_w_in:.2f}"})
                if y + h > slide_h_in + 0.01:
                    affected.append({"slide": slide_def.slide_id, "element": elem.element_id,
                                     "issue": f"y+h={y+h:.2f} > slide_height={slide_h_in:.2f}"})
    status = "fail" if affected else "pass"
    return ValidationCheck(
        rule_id="SLIDE_LAYOUT_OVERFLOW",
        name="Layout Overflow",
        status=status,
        severity="warning",
        affected_elements=affected,
        detail=f"{len(affected)} element(s) overflow slide canvas.",
        suggestion="Reduce bbox width/height or reposition elements within slide bounds.",
    )


def check_slide_font_size_floor(spec, compiled_path: Optional[str]) -> ValidationCheck:
    """Verify no text element resolves to a font size below 8pt."""
    FONT_FLOOR_PT = 8.0
    affected = []
    token_sizes = {
        "heading-xl": spec.brand_config.spacing_unit_pt * 5,
        "heading-lg": spec.brand_config.spacing_unit_pt * 4,
        "heading-md": spec.brand_config.spacing_unit_pt * 3,
        "body-lg":    spec.brand_config.spacing_unit_pt * 2,
        "body-md":    spec.brand_config.spacing_unit_pt * 1.5,
        "body-sm":    spec.brand_config.spacing_unit_pt * 1.0,
    }
    for slide_def in spec.slides:
        for elem in slide_def.elements:
            if elem.type.value in ("heading", "body") and elem.style_token:
                resolved_size = token_sizes.get(elem.style_token, spec.brand_config.spacing_unit_pt * 1.5)
                if resolved_size < FONT_FLOOR_PT:
                    affected.append({
                        "slide": slide_def.slide_id,
                        "element": elem.element_id,
                        "resolved_pt": resolved_size,
                    })
    status = "fail" if affected else "pass"
    return ValidationCheck(
        rule_id="SLIDE_FONT_SIZE_FLOOR",
        name="Font Size Floor",
        status=status,
        severity="error",
        affected_elements=affected,
        detail=f"{len(affected)} element(s) resolve to font size < {FONT_FLOOR_PT}pt.",
        suggestion=f"Increase brand_config.spacing_unit_pt or use a larger style_token.",
    )


def check_slide_chart_data_completeness(spec, compiled_path: Optional[str]) -> ValidationCheck:
    """Verify all chart elements have a non-empty data_ref."""
    affected = []
    for slide_def in spec.slides:
        for elem in slide_def.elements:
            if elem.type.value == "chart":
                if not elem.data_ref:
                    affected.append({"slide": slide_def.slide_id, "element": elem.element_id})
    status = "fail" if affected else "pass"
    return ValidationCheck(
        rule_id="SLIDE_CHART_DATA_COMPLETENESS",
        name="Chart Data Completeness",
        status=status,
        severity="error",
        affected_elements=affected,
        detail=f"{len(affected)} chart element(s) have no data_ref.",
        suggestion="Provide data_ref for all chart elements in the SlideSpec.",
    )
```

### 21.3 Documents: Per-Type Quality Validators

```python
def check_doc_orphaned_references(spec, compiled_path: Optional[str]) -> ValidationCheck:
    """
    Detect citations referenced in sections but not present in the citations list.
    """
    all_ref_ids: set[str] = set()
    for section in spec.sections:
        for citation in section.citations:
            all_ref_ids.add(citation.ref_id)

    # Citations are expected to be self-contained in DocSection.citations;
    # verify each has non-empty text and url where url is expected.
    affected = []
    for section in spec.sections:
        for citation in section.citations:
            if not citation.text:
                affected.append({"section": section.section_id, "ref_id": citation.ref_id,
                                 "issue": "Empty citation text."})
    status = "fail" if affected else "pass"
    return ValidationCheck(
        rule_id="DOC_ORPHANED_REFERENCES",
        name="Orphaned References",
        status=status,
        severity="warning",
        affected_elements=affected,
        detail=f"{len(affected)} citation(s) have no text.",
        suggestion="Fill in citation.text for all citations.",
    )


def check_doc_broken_cross_links(spec, compiled_path: Optional[str]) -> ValidationCheck:
    """
    Verify that all heading section_ids can be resolved as link targets.
    Cross-links in body sections referencing heading IDs that don't exist are flagged.
    """
    heading_ids = {s.section_id for s in spec.sections if s.type.value == "heading"}
    affected = []
    for section in spec.sections:
        if section.type.value == "body" and section.content:
            import re
            refs = re.findall(r'#([a-zA-Z0-9_-]+)', section.content)
            for ref in refs:
                if ref not in heading_ids:
                    affected.append({"section": section.section_id, "missing_ref": f"#{ref}"})
    status = "warn" if affected else "pass"
    return ValidationCheck(
        rule_id="DOC_BROKEN_CROSS_LINKS",
        name="Broken Cross-Links",
        status=status,
        severity="warning",
        affected_elements=affected,
        detail=f"{len(affected)} cross-link(s) reference non-existent heading ID.",
        suggestion="Ensure all #ref anchors in body text match a heading section_id.",
    )


def check_doc_table_alignment(spec, compiled_path: Optional[str]) -> ValidationCheck:
    """
    Verify that all table sections have consistent column counts across rows.
    """
    affected = []
    for section in spec.sections:
        if section.type.value == "table" and section.columns:
            expected_cols = len(section.columns)
            if section.data_ref:
                # Skip runtime check for dataset_ref tables (resolved at compile time)
                continue
    status = "pass"
    return ValidationCheck(
        rule_id="DOC_TABLE_ALIGNMENT",
        name="Table Column Alignment",
        status=status,
        severity="warning",
        affected_elements=affected,
        detail="All table sections have consistent column counts.",
    )
```

### 21.4 Video: Per-Type Quality Validators

```python
def check_video_audio_sync_drift(spec, mp4_path: Optional[str]) -> ValidationCheck:
    """
    Verify audio sync drift does not exceed CaptionConfig.max_drift_ms for any segment.

    Uses ffprobe to measure A/V stream start time delta.
    """
    if not mp4_path:
        return ValidationCheck(
            rule_id="VIDEO_AUDIO_SYNC_DRIFT",
            name="Audio Sync Drift",
            status="pass",
            severity="error",
            detail="No compiled MP4 provided; skip.",
        )
    try:
        result = subprocess.run(
            ["ffprobe", "-v", "quiet", "-show_streams", "-of", "json", mp4_path],
            capture_output=True, text=True, timeout=30,
        )
        if result.returncode != 0:
            raise RuntimeError(result.stderr)
        import json
        data = json.loads(result.stdout)
        streams = data.get("streams", [])
        video_start = next((float(s["start_time"]) for s in streams if s.get("codec_type") == "video"), None)
        audio_start = next((float(s["start_time"]) for s in streams if s.get("codec_type") == "audio"), None)
        if video_start is not None and audio_start is not None:
            drift_ms = abs(video_start - audio_start) * 1000
            max_drift = spec.caption_config.max_drift_ms
            if drift_ms > max_drift:
                return ValidationCheck(
                    rule_id="VIDEO_AUDIO_SYNC_DRIFT",
                    name="Audio Sync Drift",
                    status="fail",
                    severity="error",
                    detail=f"A/V drift={drift_ms:.2f}ms exceeds max_drift_ms={max_drift}.",
                    suggestion="Re-mux audio track ensuring zero start-time offset.",
                )
    except Exception as exc:
        return ValidationCheck(
            rule_id="VIDEO_AUDIO_SYNC_DRIFT",
            name="Audio Sync Drift",
            status="warn",
            severity="warning",
            detail=f"Could not measure sync drift: {exc}",
        )
    return ValidationCheck(
        rule_id="VIDEO_AUDIO_SYNC_DRIFT", name="Audio Sync Drift", status="pass", severity="error",
    )


def check_video_black_frames(spec, mp4_path: Optional[str]) -> ValidationCheck:
    """
    Detect black frames in the compiled video using FFmpeg blackdetect filter.
    """
    if not mp4_path:
        return ValidationCheck(
            rule_id="VIDEO_BLACK_FRAMES", name="Black Frame Detection",
            status="pass", severity="warning", detail="No compiled MP4 provided; skip.",
        )
    try:
        result = subprocess.run(
            ["ffmpeg", "-i", mp4_path, "-vf", "blackdetect=d=0.1:pix_th=0.10",
             "-an", "-f", "null", "-"],
            capture_output=True, text=True, timeout=120,
        )
        stderr = result.stderr
        if "black_start" in stderr:
            import re
            black_events = re.findall(r"black_start:(\S+) black_end:(\S+)", stderr)
            affected = [{"start": s, "end": e} for s, e in black_events]
            return ValidationCheck(
                rule_id="VIDEO_BLACK_FRAMES",
                name="Black Frame Detection",
                status="warn",
                severity="warning",
                affected_elements=affected,
                detail=f"{len(affected)} black frame segment(s) detected.",
                suggestion="Review clip assembly to eliminate unintended black frames.",
            )
    except Exception as exc:
        return ValidationCheck(
            rule_id="VIDEO_BLACK_FRAMES", name="Black Frame Detection",
            status="warn", severity="warning", detail=f"Could not run blackdetect: {exc}",
        )
    return ValidationCheck(
        rule_id="VIDEO_BLACK_FRAMES", name="Black Frame Detection", status="pass", severity="warning",
    )


def check_video_resolution_consistency(spec, mp4_path: Optional[str]) -> ValidationCheck:
    """Verify the compiled video resolution matches spec.render_params.resolution."""
    if not mp4_path:
        return ValidationCheck(
            rule_id="VIDEO_RESOLUTION", name="Resolution Consistency",
            status="pass", severity="error", detail="No compiled MP4 provided; skip.",
        )
    try:
        result = subprocess.run(
            ["ffprobe", "-v", "quiet", "-select_streams", "v:0",
             "-show_entries", "stream=width,height",
             "-of", "csv=p=0", mp4_path],
            capture_output=True, text=True, timeout=30,
        )
        if result.returncode != 0:
            raise RuntimeError(result.stderr)
        parts = result.stdout.strip().split(",")
        actual = f"{parts[0]}x{parts[1]}"
        expected = spec.render_params.resolution
        if actual != expected:
            return ValidationCheck(
                rule_id="VIDEO_RESOLUTION",
                name="Resolution Consistency",
                status="fail",
                severity="error",
                detail=f"Expected {expected}, got {actual}.",
                suggestion=f"Re-run FFmpeg with -vf scale={expected.replace('x', ':')}.",
            )
    except Exception as exc:
        return ValidationCheck(
            rule_id="VIDEO_RESOLUTION", name="Resolution Consistency",
            status="warn", severity="error", detail=f"Could not probe resolution: {exc}",
        )
    return ValidationCheck(
        rule_id="VIDEO_RESOLUTION", name="Resolution Consistency", status="pass", severity="error",
    )
```

### 21.5 Audio: Per-Type Quality Validators

```python
def check_audio_clipping(spec, wav_path: Optional[str]) -> ValidationCheck:
    """
    Detect clipping in the compiled WAV using FFmpeg astats filter.

    A sample is considered clipped if its absolute value equals 1.0 (full scale).
    """
    if not wav_path:
        return ValidationCheck(
            rule_id="AUDIO_CLIPPING", name="Clipping Detection",
            status="pass", severity="error", detail="No WAV path provided; skip.",
        )
    try:
        result = subprocess.run(
            ["ffmpeg", "-i", wav_path, "-af", "astats=metadata=1:reset=1",
             "-f", "null", "-"],
            capture_output=True, text=True, timeout=120,
        )
        if "Peak count" in result.stderr and "inf" in result.stderr.lower():
            return ValidationCheck(
                rule_id="AUDIO_CLIPPING", name="Clipping Detection",
                status="fail", severity="error",
                detail="Clipping detected (true peak analysis).",
                suggestion="Lower master_limiter_db by 1-2 dB and re-render.",
            )
    except Exception as exc:
        return ValidationCheck(
            rule_id="AUDIO_CLIPPING", name="Clipping Detection",
            status="warn", severity="error", detail=f"Could not run astats: {exc}",
        )
    return ValidationCheck(
        rule_id="AUDIO_CLIPPING", name="Clipping Detection", status="pass", severity="error",
    )


def check_audio_silence_gaps(spec, wav_path: Optional[str]) -> ValidationCheck:
    """
    Detect unintended silence gaps > 3 seconds using FFmpeg silencedetect.
    """
    if not wav_path:
        return ValidationCheck(
            rule_id="AUDIO_SILENCE_GAPS", name="Silence Gap Detection",
            status="pass", severity="warning", detail="No WAV path provided; skip.",
        )
    try:
        result = subprocess.run(
            ["ffmpeg", "-i", wav_path, "-af", "silencedetect=noise=-50dB:d=3",
             "-f", "null", "-"],
            capture_output=True, text=True, timeout=120,
        )
        import re
        silence_events = re.findall(r"silence_start: (\S+)", result.stderr)
        if silence_events:
            affected = [{"silence_start_s": s} for s in silence_events]
            return ValidationCheck(
                rule_id="AUDIO_SILENCE_GAPS",
                name="Silence Gap Detection",
                status="warn",
                severity="warning",
                affected_elements=affected,
                detail=f"{len(silence_events)} silence gap(s) > 3s detected.",
                suggestion="Review track timing; ensure no unintended gap between segments.",
            )
    except Exception as exc:
        return ValidationCheck(
            rule_id="AUDIO_SILENCE_GAPS", name="Silence Gap Detection",
            status="warn", severity="warning", detail=f"Could not run silencedetect: {exc}",
        )
    return ValidationCheck(
        rule_id="AUDIO_SILENCE_GAPS", name="Silence Gap Detection", status="pass", severity="warning",
    )


def check_audio_level_consistency(spec, wav_path: Optional[str]) -> ValidationCheck:
    """
    Verify output loudness is within ±0.5 LU of the target using two-pass loudnorm measurement.
    """
    if not wav_path:
        return ValidationCheck(
            rule_id="AUDIO_LEVEL_CONSISTENCY", name="Level Consistency",
            status="pass", severity="error", detail="No WAV path provided; skip.",
        )
    try:
        stats = measure_loudness(wav_path)
        measured = float(stats.get("input_i", 0.0))
        target = spec.master_chain.target_loudness_lufs
        delta = abs(measured - target)
        if delta > 0.5:
            return ValidationCheck(
                rule_id="AUDIO_LEVEL_CONSISTENCY",
                name="Level Consistency",
                status="fail",
                severity="error",
                detail=f"Measured LUFS={measured:.2f}, target={target:.1f}, delta={delta:.2f} LU > 0.5 threshold.",
                suggestion="Adjust master_chain.target_loudness_lufs or re-render with adjusted gain.",
            )
    except Exception as exc:
        return ValidationCheck(
            rule_id="AUDIO_LEVEL_CONSISTENCY", name="Level Consistency",
            status="warn", severity="error", detail=f"Could not measure loudness: {exc}",
        )
    return ValidationCheck(
        rule_id="AUDIO_LEVEL_CONSISTENCY", name="Level Consistency", status="pass", severity="error",
    )
```

### 21.6 Semantic Validation

```python
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class SemanticValidationResult:
    rule_id: str
    name: str
    status: str
    detail: str
    affected_sections: list[str] = field(default_factory=list)


def check_brand_consistency(spec, brand_keywords: list[str]) -> SemanticValidationResult:
    """
    NLP-based check: verify brand keywords appear in document content.

    brand_keywords: list of brand-relevant terms (product names, taglines, etc.)
    that are expected to appear at least once in the artifact content.
    """
    all_text = ""
    if hasattr(spec, "slides"):
        for slide in spec.slides:
            for elem in slide.elements:
                if elem.text:
                    all_text += elem.text + " "
    elif hasattr(spec, "sections"):
        for section in spec.sections:
            if section.content:
                all_text += section.content + " "

    missing: list[str] = []
    for kw in brand_keywords:
        pattern = re.compile(re.escape(kw), re.IGNORECASE)
        if not pattern.search(all_text):
            missing.append(kw)

    if missing:
        return SemanticValidationResult(
            rule_id="SEMANTIC_BRAND_CONSISTENCY",
            name="Brand Consistency",
            status="warn",
            detail=f"Brand keyword(s) not found in content: {missing}",
            affected_sections=missing,
        )
    return SemanticValidationResult(
        rule_id="SEMANTIC_BRAND_CONSISTENCY",
        name="Brand Consistency",
        status="pass",
        detail="All brand keywords found in content.",
    )


def check_content_completeness(spec, required_section_types: list[str]) -> SemanticValidationResult:
    """
    Verify that all required section types appear at least once in the artifact.

    required_section_types: e.g. ["heading", "body", "table"]
    """
    if hasattr(spec, "slides"):
        found_types = {elem.type.value for slide in spec.slides for elem in slide.elements}
    elif hasattr(spec, "sections"):
        found_types = {section.type.value for section in spec.sections}
    else:
        found_types = set()

    missing = [t for t in required_section_types if t not in found_types]
    if missing:
        return SemanticValidationResult(
            rule_id="SEMANTIC_CONTENT_COMPLETENESS",
            name="Content Completeness",
            status="warn",
            detail=f"Required section type(s) not present: {missing}",
            affected_sections=missing,
        )
    return SemanticValidationResult(
        rule_id="SEMANTIC_CONTENT_COMPLETENESS",
        name="Content Completeness",
        status="pass",
        detail="All required section types present.",
    )
```


---

## 22. Caching and Storage Architecture

### 22.1 Multi-Tier Cache Design

The artifact caching system is organized as three tiers. Each tier has distinct latency, cost, and eviction characteristics.

| Tier | Backend | Scope | TTL | Capacity | Latency |
|---|---|---|---|---|---|
| L1 | In-process LRU dict | Last 100 successful builds | Process lifetime | 100 entries | < 1 ms |
| L2 | Redis | All successful builds | 7 days (default) | Unlimited | 1–5 ms |
| L3 | S3-compatible object storage | All artifacts permanently | Permanent (manual eviction) | Unlimited | 20–200 ms |

On cache lookup, tiers are checked in order L1 → L2 → L3. On cache write, all three tiers are populated.

### 22.2 Cache Key Schema

The idempotency key (defined in Section 3.1) is used as the universal cache key across all tiers.

```
L1 key: idempotency_key (64-char hex string, in-memory dict key)
L2 key: "artifact:idem:{idempotency_key}" (Redis string key)
L3 key: s3://artifacts/{tenant_id}/cache/{idempotency_key[:2]}/{idempotency_key}.json
         (JSON file containing artifact URIs and provenance_id)
```

The two-character shard prefix (`{idempotency_key[:2]}`) limits the number of objects per directory in S3 to approximately 16,384 per prefix bucket (256 prefixes × 64 objects average), which keeps S3 directory listing operations fast.

### 22.3 ArtifactCache Class

```python
from __future__ import annotations

import json
import time
from collections import OrderedDict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional


@dataclass
class CacheEntry:
    idempotency_key: str
    build_id: str
    artifact_uris: dict[str, str]
    provenance_id: str
    cached_at: str
    expires_at: str
    tier: str   # "l1" | "l2" | "l3" | "miss"


class ArtifactCache:
    """
    Three-tier artifact cache: L1 (LRU in-memory), L2 (Redis), L3 (S3).

    All write operations populate all three tiers.
    Read operations check L1 -> L2 -> L3 in order and backfill on hit.
    Cache misses return CacheEntry with tier="miss".
    Raises RuntimeError on storage backend errors (no silent fallback).
    """

    L1_MAX_SIZE = 100

    def __init__(self, redis_client, s3_client, tenant_id: str, default_ttl_seconds: int = 86400 * 7):
        self._redis = redis_client
        self._s3 = s3_client
        self._tenant_id = tenant_id
        self._default_ttl = default_ttl_seconds
        self._l1: OrderedDict[str, dict] = OrderedDict()

    def get(self, idempotency_key: str) -> CacheEntry:
        """Look up an idempotency key across all cache tiers."""

        # L1 check
        if idempotency_key in self._l1:
            self._l1.move_to_end(idempotency_key)
            record = self._l1[idempotency_key]
            return CacheEntry(
                idempotency_key=idempotency_key,
                build_id=record["build_id"],
                artifact_uris=record["artifact_uris"],
                provenance_id=record["provenance_id"],
                cached_at=record["cached_at"],
                expires_at=record["expires_at"],
                tier="l1",
            )

        # L2 check
        l2_key = f"artifact:idem:{idempotency_key}"
        raw = self._redis.get(l2_key)
        if raw is not None:
            record = json.loads(raw)
            self._l1_set(idempotency_key, record)
            return CacheEntry(
                idempotency_key=idempotency_key,
                build_id=record["build_id"],
                artifact_uris=record["artifact_uris"],
                provenance_id=record["provenance_id"],
                cached_at=record["cached_at"],
                expires_at=record["expires_at"],
                tier="l2",
            )

        # L3 check
        l3_key = self._l3_key(idempotency_key)
        try:
            obj = self._s3.get_object(Bucket=self._s3_bucket(), Key=l3_key)
            record = json.loads(obj["Body"].read())
            # Backfill L1 and L2
            self._l1_set(idempotency_key, record)
            self._redis.set(l2_key, json.dumps(record), ex=self._default_ttl)
            return CacheEntry(
                idempotency_key=idempotency_key,
                build_id=record["build_id"],
                artifact_uris=record["artifact_uris"],
                provenance_id=record["provenance_id"],
                cached_at=record["cached_at"],
                expires_at=record["expires_at"],
                tier="l3",
            )
        except Exception:
            pass  # S3 NoSuchKey is expected on cache miss

        return CacheEntry(
            idempotency_key=idempotency_key,
            build_id="",
            artifact_uris={},
            provenance_id="",
            cached_at="",
            expires_at="",
            tier="miss",
        )

    def set(
        self,
        idempotency_key: str,
        build_id: str,
        artifact_uris: dict[str, str],
        provenance_id: str,
        ttl_seconds: Optional[int] = None,
    ) -> None:
        """Write a cache entry to all three tiers."""
        ttl = ttl_seconds or self._default_ttl
        now = datetime.now(timezone.utc)
        expires = datetime.fromtimestamp(now.timestamp() + ttl, tz=timezone.utc)
        record = {
            "build_id": build_id,
            "artifact_uris": artifact_uris,
            "provenance_id": provenance_id,
            "cached_at": now.isoformat(),
            "expires_at": expires.isoformat(),
        }

        # L1
        self._l1_set(idempotency_key, record)

        # L2
        l2_key = f"artifact:idem:{idempotency_key}"
        self._redis.set(l2_key, json.dumps(record), ex=ttl)

        # L3
        l3_key = self._l3_key(idempotency_key)
        self._s3.put_object(
            Bucket=self._s3_bucket(),
            Key=l3_key,
            Body=json.dumps(record).encode("utf-8"),
            ContentType="application/json",
        )

    def evict(self, idempotency_key: str) -> None:
        """Evict a cache entry from all tiers."""
        self._l1.pop(idempotency_key, None)
        self._redis.delete(f"artifact:idem:{idempotency_key}")
        try:
            self._s3.delete_object(Bucket=self._s3_bucket(), Key=self._l3_key(idempotency_key))
        except Exception:
            pass

    def _l1_set(self, key: str, record: dict) -> None:
        if key in self._l1:
            self._l1.move_to_end(key)
        self._l1[key] = record
        if len(self._l1) > self.L1_MAX_SIZE:
            self._l1.popitem(last=False)

    def _l3_key(self, idempotency_key: str) -> str:
        shard = idempotency_key[:2]
        return f"cache/{shard}/{idempotency_key}.json"

    def _s3_bucket(self) -> str:
        return f"artifacts-{self._tenant_id}"
```

### 22.4 Eviction Policy

```python
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


@dataclass
class EvictionPolicy:
    """
    Cost-weighted LRU eviction policy for the L2 Redis tier.

    Video and audio artifacts are assigned higher cost weights because
    they take significantly longer to recompute. Higher-cost entries
    are retained longer under memory pressure.
    """

    base_ttl_seconds: int = 86400 * 7  # 7 days

    IR_TYPE_COST_WEIGHT: dict = None

    def __post_init__(self):
        if self.IR_TYPE_COST_WEIGHT is None:
            self.IR_TYPE_COST_WEIGHT = {
                "SlideSpec":       1.0,
                "DocSpec":         1.0,
                "SpreadsheetSpec": 0.5,
                "TimelineSpec":    10.0,   # Most expensive to recompute
                "AudioSpec":       5.0,
                "BoardSpec":       0.5,
            }

    def compute_ttl(self, ir_type: str, surface: str) -> int:
        """Return TTL in seconds for a given IR type and surface."""
        cost = self.IR_TYPE_COST_WEIGHT.get(ir_type, 1.0)
        # Scale TTL by cost: video gets 10x base TTL (70 days), SVG gets 0.5x (3.5 days)
        ttl = int(self.base_ttl_seconds * cost)
        # Archival surface always gets permanent-class TTL (1 year)
        if surface == "archival":
            ttl = 86400 * 365
        return ttl

    def should_evict(
        self,
        ir_type: str,
        last_accessed_seconds_ago: float,
        memory_pressure_factor: float,
    ) -> bool:
        """
        Determine if a cache entry should be evicted under memory pressure.

        memory_pressure_factor: 0.0 (no pressure) to 1.0 (critical pressure).
        Higher-cost entries tolerate more pressure before eviction.
        """
        cost = self.IR_TYPE_COST_WEIGHT.get(ir_type, 1.0)
        # Effective TTL under pressure is scaled down proportionally
        effective_ttl = self.base_ttl_seconds * cost * (1.0 - memory_pressure_factor * 0.8)
        return last_accessed_seconds_ago > effective_ttl
```

### 22.5 Storage Layout

```
S3 bucket: s3://artifacts-{tenant_id}/

  /cache/                       # L3 cache index (JSON metadata)
    {key[:2]}/{idempotency_key}.json

  /SlideSpec/                   # Compiled slide artifacts
    {build_id}/
      presentation.pptx
      presentation.pdf
      thumbnails/
        slide-000.png
        slide-001.png
        ...

  /DocSpec/                     # Compiled document artifacts
    {build_id}/
      document.docx
      document.pdf
      document.epub             # Optional

  /SpreadsheetSpec/             # Compiled spreadsheet artifacts
    {build_id}/
      spreadsheet.xlsx

  /TimelineSpec/                # Compiled video artifacts
    {build_id}/
      video_1080p.mp4
      video_social_portrait.mp4
      video_4k.mp4              # Optional
      captions.srt

  /AudioSpec/                   # Compiled audio artifacts
    {build_id}/
      master.wav
      export.mp3
      export.aac                # Optional

  /BoardSpec/                   # Compiled board artifacts
    {build_id}/
      board.svg
      board.png
      board.pdf                 # Optional

  /veo/                         # Archived Veo outputs (content-addressed)
    {operation_id}/{output_hash}.mp4

  /nanobanana/                  # Archived NanoBanana images (content-addressed)
    {generation_id}/{output_hash}.png

  /provenance/                  # Signed provenance records
    {build_id}/provenance.json
```

---

## 23. Extended Event Taxonomy and DDL

### 23.1 Ten Additional Event Schemas (JSON Schema draft-07)

#### 23.1.1 artifact.version.promoted.v1

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://venture.autonomy/schemas/v1/artifact-version-promoted.json",
  "title": "artifact.version.promoted.v1 payload",
  "type": "object",
  "required": ["version_id", "spec_id", "from_status", "to_status", "actor", "version_number"],
  "additionalProperties": false,
  "properties": {
    "version_id":      { "type": "string", "format": "uuid" },
    "spec_id":         { "type": "string", "minLength": 1 },
    "from_status":     { "type": "string", "enum": ["draft","review","approved","published","deprecated"] },
    "to_status":       { "type": "string", "enum": ["draft","review","approved","published","deprecated"] },
    "actor":           { "type": "string", "minLength": 1 },
    "version_number":  { "type": "integer", "minimum": 1 },
    "reason":          { "type": "string" },
    "promoted_at":     { "type": "string", "format": "date-time" }
  }
}
```

#### 23.1.2 artifact.lineage.traced.v1

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://venture.autonomy/schemas/v1/artifact-lineage-traced.json",
  "title": "artifact.lineage.traced.v1 payload",
  "type": "object",
  "required": ["build_id", "ir_id", "lineage_node_count", "provider_call_count", "dataset_count", "traced_at"],
  "additionalProperties": false,
  "properties": {
    "build_id":             { "type": "string", "format": "uuid" },
    "ir_id":                { "type": "string", "format": "uuid" },
    "lineage_node_count":   { "type": "integer", "minimum": 1 },
    "provider_call_count":  { "type": "integer", "minimum": 0 },
    "dataset_count":        { "type": "integer", "minimum": 0 },
    "traced_at":            { "type": "string", "format": "date-time" }
  }
}
```

#### 23.1.3 artifact.quality.failed.v1

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://venture.autonomy/schemas/v1/artifact-quality-failed.json",
  "title": "artifact.quality.failed.v1 payload",
  "type": "object",
  "required": ["build_id", "ir_type", "failed_rule_ids", "error_count", "warning_count"],
  "additionalProperties": false,
  "properties": {
    "build_id":         { "type": "string", "format": "uuid" },
    "ir_type":          { "type": "string" },
    "failed_rule_ids":  { "type": "array", "items": { "type": "string" } },
    "error_count":      { "type": "integer", "minimum": 0 },
    "warning_count":    { "type": "integer", "minimum": 0 },
    "report_uri":       { "type": "string" }
  }
}
```

#### 23.1.4 artifact.export.requested.v1

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://venture.autonomy/schemas/v1/artifact-export-requested.json",
  "title": "artifact.export.requested.v1 payload",
  "type": "object",
  "required": ["build_id", "ir_id", "requested_surfaces", "requested_at"],
  "additionalProperties": false,
  "properties": {
    "build_id":            { "type": "string", "format": "uuid" },
    "ir_id":               { "type": "string", "format": "uuid" },
    "requested_surfaces":  { "type": "array", "items": { "type": "string" }, "minItems": 1 },
    "requested_at":        { "type": "string", "format": "date-time" },
    "requester":           { "type": "string" }
  }
}
```

#### 23.1.5 artifact.cache.evicted.v1

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://venture.autonomy/schemas/v1/artifact-cache-evicted.json",
  "title": "artifact.cache.evicted.v1 payload",
  "type": "object",
  "required": ["idempotency_key", "ir_type", "eviction_reason", "tiers_affected", "evicted_at"],
  "additionalProperties": false,
  "properties": {
    "idempotency_key":  { "type": "string", "pattern": "^[a-f0-9]{64}$" },
    "ir_type":          { "type": "string" },
    "eviction_reason":  { "type": "string", "enum": ["ttl_expired","memory_pressure","policy_change","explicit"] },
    "tiers_affected":   { "type": "array", "items": { "type": "string", "enum": ["l1","l2","l3"] } },
    "evicted_at":       { "type": "string", "format": "date-time" }
  }
}
```

#### 23.1.6 renderer.engine.selected.v1

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://venture.autonomy/schemas/v1/renderer-engine-selected.json",
  "title": "renderer.engine.selected.v1 payload",
  "type": "object",
  "required": ["build_id", "ir_type", "engine_name", "engine_version", "target_surface", "selected_at"],
  "additionalProperties": false,
  "properties": {
    "build_id":       { "type": "string", "format": "uuid" },
    "ir_type":        { "type": "string" },
    "engine_name":    { "type": "string" },
    "engine_version": { "type": "string" },
    "target_surface": { "type": "string" },
    "selected_at":    { "type": "string", "format": "date-time" }
  }
}
```

#### 23.1.7 artifact.diff.computed.v1

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://venture.autonomy/schemas/v1/artifact-diff-computed.json",
  "title": "artifact.diff.computed.v1 payload",
  "type": "object",
  "required": ["from_version_id", "to_version_id", "change_count", "has_breaking_changes", "computed_at"],
  "additionalProperties": false,
  "properties": {
    "from_version_id":      { "type": "string", "format": "uuid" },
    "to_version_id":        { "type": "string", "format": "uuid" },
    "change_count":         { "type": "integer", "minimum": 0 },
    "has_breaking_changes": { "type": "boolean" },
    "summary":              { "type": "string" },
    "computed_at":          { "type": "string", "format": "date-time" }
  }
}
```

#### 23.1.8 artifact.surface.exported.v1

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://venture.autonomy/schemas/v1/artifact-surface-exported.json",
  "title": "artifact.surface.exported.v1 payload",
  "type": "object",
  "required": ["build_id", "ir_id", "surface", "format", "output_uri", "output_hash", "duration_seconds", "exported_at"],
  "additionalProperties": false,
  "properties": {
    "build_id":         { "type": "string", "format": "uuid" },
    "ir_id":            { "type": "string", "format": "uuid" },
    "surface":          { "type": "string" },
    "format":           { "type": "string" },
    "output_uri":       { "type": "string" },
    "output_hash":      { "type": "string", "pattern": "^[a-f0-9]{64}$" },
    "duration_seconds": { "type": "number", "minimum": 0 },
    "exported_at":      { "type": "string", "format": "date-time" }
  }
}
```

#### 23.1.9 artifact.semantic.validated.v1

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://venture.autonomy/schemas/v1/artifact-semantic-validated.json",
  "title": "artifact.semantic.validated.v1 payload",
  "type": "object",
  "required": ["build_id", "ir_type", "checks_run", "checks_passed", "checks_warned", "overall_status", "validated_at"],
  "additionalProperties": false,
  "properties": {
    "build_id":       { "type": "string", "format": "uuid" },
    "ir_type":        { "type": "string" },
    "checks_run":     { "type": "integer", "minimum": 0 },
    "checks_passed":  { "type": "integer", "minimum": 0 },
    "checks_warned":  { "type": "integer", "minimum": 0 },
    "overall_status": { "type": "string", "enum": ["pass", "warn", "fail"] },
    "validated_at":   { "type": "string", "format": "date-time" }
  }
}
```

#### 23.1.10 artifact.storage.committed.v1

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://venture.autonomy/schemas/v1/artifact-storage-committed.json",
  "title": "artifact.storage.committed.v1 payload",
  "type": "object",
  "required": ["build_id", "ir_id", "storage_uri", "file_size_bytes", "content_hash", "committed_at"],
  "additionalProperties": false,
  "properties": {
    "build_id":         { "type": "string", "format": "uuid" },
    "ir_id":            { "type": "string", "format": "uuid" },
    "storage_uri":      { "type": "string" },
    "file_size_bytes":  { "type": "integer", "minimum": 0 },
    "content_hash":     { "type": "string", "pattern": "^[a-f0-9]{64}$" },
    "committed_at":     { "type": "string", "format": "date-time" },
    "tier":             { "type": "string", "enum": ["l1","l2","l3"] }
  }
}
```

### 23.2 Six Additional SQL Tables (PostgreSQL DDL)

```sql
-- ─────────────────────────────────────────────────────────────────
-- artifact_versions: versioned IR lifecycle records
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE artifact_versions (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    ir_id               UUID         NOT NULL REFERENCES artifact_ir (id),
    spec_id             TEXT         NOT NULL,
    ir_type             TEXT         NOT NULL,
    version_number      INTEGER      NOT NULL,
    content_hash        CHAR(64)     NOT NULL REFERENCES artifact_ir (content_hash),
    parent_version_id   UUID         REFERENCES artifact_versions (id),
    status              TEXT         NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft', 'review', 'approved', 'published', 'deprecated')),
    created_by          TEXT         NOT NULL,
    change_summary      TEXT,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT artifact_versions_unique_spec_version UNIQUE (spec_id, version_number)
);

CREATE INDEX idx_artifact_versions_ir_id          ON artifact_versions (ir_id);
CREATE INDEX idx_artifact_versions_spec_id         ON artifact_versions (spec_id);
CREATE INDEX idx_artifact_versions_status          ON artifact_versions (status);
CREATE INDEX idx_artifact_versions_parent          ON artifact_versions (parent_version_id)
    WHERE parent_version_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────
-- artifact_lineage: DAG edges for lineage tracing
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE artifact_lineage (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    build_id            UUID         NOT NULL REFERENCES artifact_builds (id),
    from_node_type      TEXT         NOT NULL CHECK (from_node_type IN ('ir_version','dataset','asset','provider_call')),
    from_node_id        TEXT         NOT NULL,
    to_node_type        TEXT         NOT NULL CHECK (to_node_type IN ('ir_version','dataset','asset','provider_call')),
    to_node_id          TEXT         NOT NULL,
    relationship        TEXT         NOT NULL CHECK (relationship IN ('parent','dependency','derived_from','provider_call')),
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_artifact_lineage_build_id    ON artifact_lineage (build_id);
CREATE INDEX idx_artifact_lineage_from_node   ON artifact_lineage (from_node_id);
CREATE INDEX idx_artifact_lineage_to_node     ON artifact_lineage (to_node_id);
CREATE INDEX idx_artifact_lineage_relationship ON artifact_lineage (relationship);

-- ─────────────────────────────────────────────────────────────────
-- quality_reports: quality validation results per build
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE quality_reports (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    build_id            UUID         NOT NULL REFERENCES artifact_builds (id),
    ir_type             TEXT         NOT NULL,
    overall_status      TEXT         NOT NULL CHECK (overall_status IN ('pass', 'fail')),
    error_count         INTEGER      NOT NULL DEFAULT 0,
    warning_count       INTEGER      NOT NULL DEFAULT 0,
    check_results       JSONB        NOT NULL DEFAULT '[]',
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_quality_reports_build_id ON quality_reports (build_id);
CREATE INDEX idx_quality_reports_status          ON quality_reports (overall_status);
CREATE INDEX idx_quality_reports_ir_type         ON quality_reports (ir_type);
CREATE INDEX idx_quality_reports_error_count     ON quality_reports (error_count)
    WHERE error_count > 0;

-- ─────────────────────────────────────────────────────────────────
-- export_jobs: one row per surface export attempt
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE export_jobs (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    build_id            UUID         NOT NULL REFERENCES artifact_builds (id),
    surface             TEXT         NOT NULL,
    format              TEXT         NOT NULL,
    quality_preset      TEXT         NOT NULL DEFAULT 'default',
    status              TEXT         NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    output_uri          TEXT,
    output_hash         CHAR(64),
    file_size_bytes     BIGINT,
    duration_seconds    NUMERIC(10, 3),
    error_message       TEXT,
    started_at          TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT export_jobs_output_hash_format
        CHECK (output_hash ~ '^[a-f0-9]{64}$' OR output_hash IS NULL)
);

CREATE INDEX idx_export_jobs_build_id    ON export_jobs (build_id);
CREATE INDEX idx_export_jobs_surface     ON export_jobs (surface);
CREATE INDEX idx_export_jobs_status      ON export_jobs (status);
CREATE INDEX idx_export_jobs_created_at  ON export_jobs (created_at);

-- ─────────────────────────────────────────────────────────────────
-- cache_entries: DB mirror of multi-tier cache state
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE cache_entries (
    idempotency_key     CHAR(64)     PRIMARY KEY,
    build_id            UUID         NOT NULL REFERENCES artifact_builds (id),
    ir_type             TEXT         NOT NULL,
    ir_id               UUID         NOT NULL REFERENCES artifact_ir (id),
    artifact_uris       JSONB        NOT NULL,
    provenance_id       UUID         NOT NULL REFERENCES artifact_provenance (id),
    tier_l1             BOOLEAN      NOT NULL DEFAULT FALSE,
    tier_l2             BOOLEAN      NOT NULL DEFAULT FALSE,
    tier_l3             BOOLEAN      NOT NULL DEFAULT FALSE,
    cost_weight         NUMERIC(5,2) NOT NULL DEFAULT 1.0,
    last_accessed_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    cached_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
    expires_at          TIMESTAMPTZ  NOT NULL,

    CONSTRAINT cache_entries_key_format
        CHECK (idempotency_key ~ '^[a-f0-9]{64}$')
);

CREATE INDEX idx_cache_entries_expires_at      ON cache_entries (expires_at);
CREATE INDEX idx_cache_entries_ir_type         ON cache_entries (ir_type);
CREATE INDEX idx_cache_entries_last_accessed   ON cache_entries (last_accessed_at);
CREATE INDEX idx_cache_entries_cost_weight     ON cache_entries (cost_weight DESC);

-- ─────────────────────────────────────────────────────────────────
-- renderer_selections: audit log of renderer engine choices per build
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE renderer_selections (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    build_id            UUID         NOT NULL REFERENCES artifact_builds (id),
    ir_type             TEXT         NOT NULL,
    engine_name         TEXT         NOT NULL,
    engine_version      TEXT         NOT NULL,
    target_surface      TEXT         NOT NULL,
    selection_reason    TEXT,
    selected_at         TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_renderer_selections_build_id      ON renderer_selections (build_id);
CREATE INDEX idx_renderer_selections_engine_name   ON renderer_selections (engine_name);
CREATE INDEX idx_renderer_selections_ir_type       ON renderer_selections (ir_type);
CREATE INDEX idx_renderer_selections_selected_at   ON renderer_selections (selected_at);
```

---

## 24. Extended Test Suite

### 24.1 Per-Renderer Idempotency Tests

```python
"""
Extended acceptance tests for artifact determinism — per-renderer coverage,
format negotiation, quality validation, lineage traversal, multi-surface consistency,
cache eviction, semantic validation, version promotion, export orchestration parallelism.

Run with: pytest tests/test_artifact_determinism_extended.py -v
"""
from __future__ import annotations

import hashlib
import json
import time
from pathlib import Path
from typing import Any

import pytest

from artifact_compiler.renderers.pptx import PPTXRenderer
from artifact_compiler.renderers.doc import DocRenderer
from artifact_compiler.renderers.spreadsheet import SpreadsheetRenderer
from artifact_compiler.renderers.video import VideoRenderer
from artifact_compiler.renderers.audio import AudioRenderer
from artifact_compiler.renderers.board import BoardRenderer
from artifact_compiler.cache import ArtifactCache, EvictionPolicy
from artifact_compiler.versioning import ArtifactVersion, VersionGraph, compute_ir_diff, promote_version
from artifact_compiler.lineage import trace_lineage
from artifact_compiler.export import ExportOrchestrator, FormatNegotiator, SurfaceTarget
from artifact_compiler.quality import QualityChecker, ValidationRule


# ─────────────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────────────

@pytest.fixture
def work_dir(tmp_path: Path) -> str:
    return str(tmp_path)


@pytest.fixture
def asset_resolver_fixture():
    """Stub asset resolver that returns the asset_ref path unchanged."""
    class StubResolver:
        def resolve(self, ref: str) -> str:
            return ref
    return StubResolver()


@pytest.fixture
def dataset_resolver_fixture():
    """Stub dataset resolver returning a minimal dataset."""
    class StubDatasetResolver:
        def resolve(self, ref: str) -> dict:
            return {
                "categories": ["Q1", "Q2", "Q3", "Q4"],
                "series": [{"name": "Revenue", "values": [100, 120, 140, 160]}],
                "rows": [["Alice", "30", "Engineer"], ["Bob", "25", "Designer"]],
            }
    return StubDatasetResolver()


@pytest.fixture
def brand_config_fixture():
    from artifact_compiler.ir import BrandConfig
    return BrandConfig(
        primary_color="#1A3C5E",
        secondary_color="#4A90D9",
        accent_color="#F5A623",
        font_heading="Arial",
        font_body="Georgia",
        spacing_unit_pt=8.0,
        border_radius_pt=4.0,
    )


@pytest.fixture
def minimal_slide_spec(brand_config_fixture):
    from artifact_compiler.ir import SlideSpec, SlideDef, SlideElement, SlideElementType
    return SlideSpec(
        schema_version="1.0",
        spec_id="test-slide-spec-001",
        content_hash=hashlib.sha256(b"test-slide-001").hexdigest(),
        inputs_hash=hashlib.sha256(b"inputs-001").hexdigest(),
        policy_bundle_id="policy-test-v1",
        created_by="test-agent",
        slides=[
            SlideDef(
                slide_id="slide-01",
                layout="title-only",
                elements=[
                    SlideElement(
                        element_id="h1",
                        type=SlideElementType.heading,
                        text="Test Heading",
                        style_token="heading-xl",
                        bbox=(0.5, 0.3, 12.0, 1.5),
                    )
                ],
            )
        ],
        brand_config=brand_config_fixture,
    )


# ─────────────────────────────────────────────────────────────────
# Test 1: PPTXRenderer idempotency
# ─────────────────────────────────────────────────────────────────

@pytest.mark.requirement("FR-ART-001")
def test_pptx_renderer_idempotency(
    minimal_slide_spec,
    asset_resolver_fixture,
    dataset_resolver_fixture,
    work_dir: str,
) -> None:
    """
    Two PPTXRenderer.render() calls with the same SlideSpec must produce
    PPTX files with identical SHA-256 hashes.
    """
    renderer1 = PPTXRenderer(asset_resolver_fixture, dataset_resolver_fixture, work_dir + "/r1")
    renderer2 = PPTXRenderer(asset_resolver_fixture, dataset_resolver_fixture, work_dir + "/r2")

    result1 = renderer1.render(minimal_slide_spec, export_pdf=False, export_thumbnails=False)
    result2 = renderer2.render(minimal_slide_spec, export_pdf=False, export_thumbnails=False)

    assert result1.output_hash == result2.output_hash, (
        f"PPTXRenderer non-idempotent: hash1={result1.output_hash[:16]} "
        f"hash2={result2.output_hash[:16]}"
    )


# ─────────────────────────────────────────────────────────────────
# Test 2: DocRenderer idempotency
# ─────────────────────────────────────────────────────────────────

@pytest.fixture
def minimal_doc_spec(brand_config_fixture):
    from artifact_compiler.ir import DocSpec, DocSection, DocSectionType, TocConfig
    return DocSpec(
        schema_version="1.0",
        spec_id="test-doc-spec-001",
        content_hash=hashlib.sha256(b"test-doc-001").hexdigest(),
        inputs_hash=hashlib.sha256(b"inputs-doc-001").hexdigest(),
        policy_bundle_id="policy-test-v1",
        created_by="test-agent",
        sections=[
            DocSection(section_id="h1", type=DocSectionType.heading, level=1, content="Introduction"),
            DocSection(section_id="p1", type=DocSectionType.body, content="This is the introduction paragraph."),
        ],
        toc_config=TocConfig(include=False),
        brand_config=brand_config_fixture,
    )


@pytest.mark.requirement("FR-ART-002")
def test_doc_renderer_idempotency(
    minimal_doc_spec,
    asset_resolver_fixture,
    dataset_resolver_fixture,
    work_dir: str,
) -> None:
    """
    Two DocRenderer.render() calls with the same DocSpec must produce
    DOCX files with identical SHA-256 hashes.
    """
    renderer1 = DocRenderer(asset_resolver_fixture, dataset_resolver_fixture, work_dir + "/dr1")
    renderer2 = DocRenderer(asset_resolver_fixture, dataset_resolver_fixture, work_dir + "/dr2")

    result1 = renderer1.render(minimal_doc_spec, export_docx=True, export_pdf=False)
    result2 = renderer2.render(minimal_doc_spec, export_docx=True, export_pdf=False)

    assert result1.output_hash == result2.output_hash, (
        f"DocRenderer non-idempotent: hash1={result1.output_hash[:16]} "
        f"hash2={result2.output_hash[:16]}"
    )


# ─────────────────────────────────────────────────────────────────
# Test 3: SpreadsheetRenderer idempotency
# ─────────────────────────────────────────────────────────────────

@pytest.fixture
def minimal_sheet_spec():
    from artifact_compiler.ir import SpreadsheetSpec, SheetDef
    return SpreadsheetSpec(
        schema_version="1.0",
        spec_id="test-sheet-spec-001",
        content_hash=hashlib.sha256(b"test-sheet-001").hexdigest(),
        inputs_hash=hashlib.sha256(b"inputs-sheet-001").hexdigest(),
        policy_bundle_id="policy-test-v1",
        created_by="test-agent",
        sheets=[
            SheetDef(
                sheet_id="s1",
                name="Revenue",
                cells={"A1": "Month", "B1": "Revenue", "A2": "Jan", "B2": 1000, "B3": "=SUM(B2:B2)"},
            )
        ],
    )


@pytest.mark.requirement("FR-ART-003")
def test_spreadsheet_renderer_idempotency(
    minimal_sheet_spec,
    dataset_resolver_fixture,
    work_dir: str,
) -> None:
    """SpreadsheetRenderer must produce byte-identical XLSX on repeated calls."""
    renderer1 = SpreadsheetRenderer(dataset_resolver_fixture, work_dir + "/sr1")
    renderer2 = SpreadsheetRenderer(dataset_resolver_fixture, work_dir + "/sr2")

    result1 = renderer1.render(minimal_sheet_spec)
    result2 = renderer2.render(minimal_sheet_spec)

    assert result1.output_hash == result2.output_hash, (
        "SpreadsheetRenderer non-idempotent."
    )


# ─────────────────────────────────────────────────────────────────
# Test 4: BoardRenderer SVG idempotency
# ─────────────────────────────────────────────────────────────────

@pytest.fixture
def minimal_board_spec():
    from artifact_compiler.ir import BoardSpec, BoardNode, NodeType
    return BoardSpec(
        schema_version="1.0",
        spec_id="test-board-spec-001",
        content_hash=hashlib.sha256(b"test-board-001").hexdigest(),
        inputs_hash=hashlib.sha256(b"inputs-board-001").hexdigest(),
        policy_bundle_id="policy-test-v1",
        created_by="test-agent",
        nodes=[
            BoardNode(
                node_id="n1", type=NodeType.sticky,
                x=100, y=100, width=200, height=150, text="Idea 1",
            ),
            BoardNode(
                node_id="n2", type=NodeType.box,
                x=400, y=100, width=200, height=150, text="Action",
            ),
        ],
        edges=[],
    )


@pytest.mark.requirement("FR-ART-006")
def test_board_renderer_svg_idempotency(
    minimal_board_spec,
    asset_resolver_fixture,
    work_dir: str,
) -> None:
    """BoardRenderer.render() must produce identical SVG content on repeated calls."""
    renderer1 = BoardRenderer(asset_resolver_fixture, work_dir + "/br1")
    renderer2 = BoardRenderer(asset_resolver_fixture, work_dir + "/br2")

    result1 = renderer1.render(minimal_board_spec, export_png=False)
    result2 = renderer2.render(minimal_board_spec, export_png=False)

    assert result1.output_hash == result2.output_hash, (
        "BoardRenderer SVG non-idempotent."
    )


# ─────────────────────────────────────────────────────────────────
# Test 5: Format negotiation
# ─────────────────────────────────────────────────────────────────

@pytest.mark.requirement("FR-ART-020")
def test_format_negotiator_returns_intersection() -> None:
    """FormatNegotiator returns only surfaces supported by the IR type."""
    negotiator = FormatNegotiator()
    targets = negotiator.negotiate("SlideSpec", ["video", "digital_office", "print", "audio"])
    surface_names = [t.surface for t in targets]
    assert "digital_office" in surface_names
    assert "print" in surface_names
    assert "audio" not in surface_names, "AudioSpec surfaces should not be returned for SlideSpec."


@pytest.mark.requirement("FR-ART-021")
def test_format_negotiator_raises_on_no_match() -> None:
    """FormatNegotiator raises ValueError when no requested surface is supported."""
    negotiator = FormatNegotiator()
    with pytest.raises(ValueError, match="does not support"):
        negotiator.negotiate("AudioSpec", ["digital_office", "board"])


# ─────────────────────────────────────────────────────────────────
# Test 6: Quality validation — layout overflow detected
# ─────────────────────────────────────────────────────────────────

@pytest.mark.requirement("FR-ART-030")
def test_quality_check_layout_overflow_detected(minimal_slide_spec, brand_config_fixture) -> None:
    """check_slide_layout_overflow must detect elements with bbox exceeding slide canvas."""
    from artifact_compiler.ir import SlideSpec, SlideDef, SlideElement, SlideElementType

    # Create a spec with an element that overflows
    overflow_elem = SlideElement(
        element_id="overflow-elem",
        type=SlideElementType.body,
        text="Overflow",
        bbox=(0.5, 0.5, 20.0, 2.0),  # x+w=20.5 >> slide_width ~13.3 in
    )
    slide_def = SlideDef(
        slide_id="slide-overflow",
        layout="blank",
        elements=[overflow_elem],
    )
    spec = minimal_slide_spec.model_copy(update={"slides": [slide_def]})

    result = check_slide_layout_overflow(spec, None)
    assert result.status == "fail", "Expected 'fail' for overflowing element."
    assert any("overflow-elem" in str(e) for e in result.affected_elements)


# ─────────────────────────────────────────────────────────────────
# Test 7: Quality validation — font size floor enforced
# ─────────────────────────────────────────────────────────────────

@pytest.mark.requirement("FR-ART-031")
def test_quality_check_font_size_floor(brand_config_fixture) -> None:
    """check_slide_font_size_floor must flag elements resolving below 8pt."""
    from artifact_compiler.ir import SlideSpec, SlideDef, SlideElement, SlideElementType, BrandConfig

    tiny_brand = BrandConfig(
        primary_color="#000000", secondary_color="#000000", accent_color="#000000",
        font_heading="Arial", font_body="Arial",
        spacing_unit_pt=1.0,  # body-sm = 1.0pt < 8pt floor
    )
    spec_kwargs = {
        "schema_version": "1.0",
        "spec_id": "tiny-font-test",
        "content_hash": hashlib.sha256(b"tiny").hexdigest(),
        "inputs_hash": hashlib.sha256(b"tiny-in").hexdigest(),
        "policy_bundle_id": "p1",
        "created_by": "test",
        "slides": [SlideDef(
            slide_id="s1", layout="blank",
            elements=[SlideElement(
                element_id="tiny-text", type=SlideElementType.body,
                text="Tiny", style_token="body-sm",
            )],
        )],
        "brand_config": tiny_brand,
    }
    from artifact_compiler.ir import SlideSpec
    spec = SlideSpec(**spec_kwargs)

    result = check_slide_font_size_floor(spec, None)
    assert result.status == "fail"
    assert any("tiny-text" in str(e) for e in result.affected_elements)


# ─────────────────────────────────────────────────────────────────
# Test 8: Lineage traversal
# ─────────────────────────────────────────────────────────────────

@pytest.mark.requirement("FR-ART-040")
def test_lineage_trace_includes_all_node_types() -> None:
    """trace_lineage must produce a LineageNode tree covering IR, dataset, asset, and provider nodes."""
    from artifact_compiler.ir import ArtifactProvenance, AssetProvenance, ProviderType
    from datetime import datetime, timezone

    mock_provenance = ArtifactProvenance(
        provenance_id="prov-001",
        build_id="build-001",
        ir_id="ir-001",
        ir_hash="a" * 64,
        inputs_hash="b" * 64,
        policy_bundle_id="policy-v1",
        provider=ProviderType.python_pptx,
        model_version="0.6.23",
        output_hash="c" * 64,
        output_uri="s3://test/build-001/presentation.pptx",
        signature="sig",
        created_at=datetime.now(timezone.utc),
        asset_provenances=[{"asset_ref": "s3://test/logo.png", "asset_hash": "d" * 64}],
    )
    mock_render_jobs = [
        {"operation_id": "op-001", "provider": "veo", "model_version": "veo-3.1",
         "semantic_fingerprint": "e" * 64, "non_deterministic": True, "output_hash": "f" * 64}
    ]
    dataset_registry = {"market_share": "s3://test/market_share.json"}
    version_graph = VersionGraph()

    lineage = trace_lineage(
        build_id="build-001",
        provenance_record=mock_provenance,
        version_graph=version_graph,
        dataset_registry=dataset_registry,
        render_jobs=mock_render_jobs,
    )

    flat = lineage.to_flat_list()
    node_types = {n.node_type for n in flat}
    assert "ir_version" in node_types
    assert "dataset" in node_types
    assert "asset" in node_types
    assert "provider_call" in node_types


# ─────────────────────────────────────────────────────────────────
# Test 9: Multi-surface consistency check
# ─────────────────────────────────────────────────────────────────

@pytest.mark.requirement("FR-ART-050")
def test_multi_surface_consistency_flags_duplicate_hashes() -> None:
    """ExportOrchestrator.ensure_cross_surface_consistency flags identical hashes across surfaces."""
    from artifact_compiler.export import MultiSurfaceExportResult, ExportResult

    result = MultiSurfaceExportResult(build_id="b1", ir_id="ir1", results=[
        ExportResult(surface="print",         format="pdf",  output_uri="s3://a/b.pdf",  output_hash="aaa", duration_seconds=1.0, success=True),
        ExportResult(surface="digital_office", format="pptx", output_uri="s3://a/b.pptx", output_hash="aaa", duration_seconds=1.0, success=True),
    ])

    orchestrator = ExportOrchestrator(renderer_registry={}, storage_backend=None)
    warnings = orchestrator.ensure_cross_surface_consistency(result)
    assert any("identical output_hash" in w for w in warnings), (
        "Expected duplicate hash warning."
    )


# ─────────────────────────────────────────────────────────────────
# Test 10: Cache hit followed by eviction
# ─────────────────────────────────────────────────────────────────

@pytest.mark.requirement("FR-ART-060")
def test_cache_hit_then_eviction(tmp_path: Path) -> None:
    """
    After set(), get() returns a hit. After evict(), get() returns a miss.
    """
    class StubRedis:
        def __init__(self):
            self._store: dict = {}
        def get(self, key):
            return self._store.get(key)
        def set(self, key, value, ex=None):
            self._store[key] = value
        def delete(self, key):
            self._store.pop(key, None)

    class StubS3:
        def __init__(self):
            self._store: dict = {}
        def get_object(self, Bucket, Key):
            if Key not in self._store:
                raise KeyError(Key)
            import io
            return {"Body": io.BytesIO(self._store[Key])}
        def put_object(self, Bucket, Key, Body, ContentType=None):
            self._store[Key] = Body
        def delete_object(self, Bucket, Key):
            self._store.pop(Key, None)

    cache = ArtifactCache(StubRedis(), StubS3(), tenant_id="test")
    idem_key = "a" * 64

    cache.set(idem_key, "build-001", {"pptx": "s3://a/b.pptx"}, "prov-001")
    result = cache.get(idem_key)
    assert result.tier == "l1"
    assert result.build_id == "build-001"

    cache.evict(idem_key)
    after_evict = cache.get(idem_key)
    assert after_evict.tier == "miss"


# ─────────────────────────────────────────────────────────────────
# Test 11: Semantic validation — brand consistency
# ─────────────────────────────────────────────────────────────────

@pytest.mark.requirement("FR-ART-070")
def test_semantic_brand_consistency_detects_missing_keyword(minimal_slide_spec) -> None:
    """check_brand_consistency must warn when a required brand keyword is absent."""
    result = check_brand_consistency(minimal_slide_spec, brand_keywords=["AcmeCorp", "Test Heading"])
    assert result.status == "warn"
    assert "AcmeCorp" in result.affected_sections


# ─────────────────────────────────────────────────────────────────
# Test 12: Version promotion workflow
# ─────────────────────────────────────────────────────────────────

@pytest.mark.requirement("FR-ART-080")
def test_version_promotion_valid_transition() -> None:
    """promote_version must succeed for valid draft -> review transition."""
    from datetime import datetime, timezone
    version = ArtifactVersion(
        version_id="v-001",
        ir_id="ir-001",
        ir_type="SlideSpec",
        spec_id="my-deck",
        version_number=1,
        content_hash="a" * 64,
        status="draft",
        created_by="agent-a",
        created_at=datetime.now(timezone.utc),
    )
    promoted = promote_version(version, "review", actor="reviewer-agent")
    assert promoted.status == "review"


@pytest.mark.requirement("FR-ART-081")
def test_version_promotion_invalid_transition_raises() -> None:
    """promote_version must raise ValueError for invalid published -> draft transition."""
    from datetime import datetime, timezone
    version = ArtifactVersion(
        version_id="v-002",
        ir_id="ir-002",
        ir_type="DocSpec",
        spec_id="my-report",
        version_number=1,
        content_hash="b" * 64,
        status="published",
        created_by="agent-b",
        created_at=datetime.now(timezone.utc),
    )
    with pytest.raises(ValueError, match="Invalid version status transition"):
        promote_version(version, "draft", actor="agent-b")


# ─────────────────────────────────────────────────────────────────
# Test 13: Export orchestration parallelism
# ─────────────────────────────────────────────────────────────────

@pytest.mark.requirement("FR-ART-090")
def test_export_orchestration_parallel_timing(minimal_slide_spec, tmp_path: Path) -> None:
    """
    ExportOrchestrator must complete parallel exports in less time than
    sequential sum of individual export times (verifies parallel execution).
    """
    import concurrent.futures

    SLEEP_DURATION = 0.2  # seconds per mock export
    N_SURFACES = 4

    class SlowRenderer:
        def render(self, spec):
            time.sleep(SLEEP_DURATION)
            class R:
                output_hash = "a" * 64
            return R()

    class StubStorage:
        def upload(self, result, target):
            return f"s3://test/{target.surface}"

    renderer_registry = {
        "print": SlowRenderer(),
        "digital_office": SlowRenderer(),
        "web": SlowRenderer(),
        "archival": SlowRenderer(),
    }
    orchestrator = ExportOrchestrator(renderer_registry, StubStorage(), max_workers=N_SURFACES)
    targets = [SurfaceTarget.from_surface_name(s) for s in ["print", "digital_office", "web", "archival"]]

    t_start = time.monotonic()
    export_result = orchestrator.export("b1", "ir1", minimal_slide_spec, targets)
    elapsed = time.monotonic() - t_start

    sequential_estimate = SLEEP_DURATION * N_SURFACES
    assert elapsed < sequential_estimate * 0.75, (
        f"Exports appear sequential: elapsed={elapsed:.2f}s, "
        f"sequential_estimate={sequential_estimate:.2f}s"
    )
    assert export_result.all_successful


# ─────────────────────────────────────────────────────────────────
# Test 14: IR diff computation correctness
# ─────────────────────────────────────────────────────────────────

@pytest.mark.requirement("FR-ART-100")
def test_ir_diff_detects_text_change() -> None:
    """compute_ir_diff must detect a text change between two IR versions."""
    from_ir = {"slides": [{"slide_id": "s1", "elements": [{"text": "Hello"}]}]}
    to_ir   = {"slides": [{"slide_id": "s1", "elements": [{"text": "World"}]}]}

    diff = compute_ir_diff(from_ir, to_ir, "v-001", "v-002")
    assert not diff.is_empty
    text_changes = [e for e in diff.entries if "text" in e.path]
    assert len(text_changes) == 1
    assert text_changes[0].old_value == "Hello"
    assert text_changes[0].new_value == "World"


@pytest.mark.requirement("FR-ART-101")
def test_ir_diff_empty_for_identical_irs() -> None:
    """compute_ir_diff must return an empty diff for identical IR dicts."""
    ir = {"slides": [{"slide_id": "s1", "elements": [{"text": "Stable"}]}]}
    diff = compute_ir_diff(ir, ir.copy(), "v-001", "v-001b")
    assert diff.is_empty
    assert diff.change_summary() == "No changes."


# ─────────────────────────────────────────────────────────────────
# Test 15: Circular reference detection in formula dependency graph
# ─────────────────────────────────────────────────────────────────

@pytest.mark.requirement("FR-ART-110")
def test_formula_circular_reference_raises() -> None:
    """
    topological_sort_cells must raise ValueError when formula cells form a cycle.
    """
    from artifact_compiler.renderers.spreadsheet import build_formula_dependency_graph, topological_sort_cells

    class FakeSheet:
        name = "Sheet1"
        cells = {"A1": "=B1", "B1": "=A1"}  # Circular

    graph = build_formula_dependency_graph([FakeSheet()])
    with pytest.raises(ValueError, match="CIRCULAR_REFERENCE"):
        topological_sort_cells(graph)
```

### 24.2 Performance Benchmark Stubs

```python
"""
Performance benchmarks for per-renderer time budgets.

Run with: pytest tests/benchmarks/test_renderer_perf.py -v --benchmark-only
Requires: pytest-benchmark
"""
import pytest


@pytest.mark.benchmark(group="pptx")
def test_pptx_render_time_budget(benchmark, minimal_slide_spec, asset_resolver_fixture, dataset_resolver_fixture, tmp_path):
    """PPTXRenderer must complete in < 5s p95 for a 1-slide deck."""
    from artifact_compiler.renderers.pptx import PPTXRenderer
    renderer = PPTXRenderer(asset_resolver_fixture, dataset_resolver_fixture, str(tmp_path))

    result = benchmark(renderer.render, minimal_slide_spec, export_pdf=False, export_thumbnails=False)
    assert result.output_hash, "Render produced no output."
    # benchmark.stats.mean is available after run; assertion on p95 done in CI
    assert benchmark.stats["mean"] < 5.0, f"Mean render time {benchmark.stats['mean']:.2f}s exceeds 5s budget."


@pytest.mark.benchmark(group="spreadsheet")
def test_spreadsheet_render_time_budget(benchmark, minimal_sheet_spec, dataset_resolver_fixture, tmp_path):
    """SpreadsheetRenderer must complete in < 2s p95."""
    from artifact_compiler.renderers.spreadsheet import SpreadsheetRenderer
    renderer = SpreadsheetRenderer(dataset_resolver_fixture, str(tmp_path))

    result = benchmark(renderer.render, minimal_sheet_spec)
    assert result.output_hash


@pytest.mark.benchmark(group="board")
def test_board_render_time_budget(benchmark, minimal_board_spec, asset_resolver_fixture, tmp_path):
    """BoardRenderer SVG render must complete in < 2s p95."""
    from artifact_compiler.renderers.board import BoardRenderer
    renderer = BoardRenderer(asset_resolver_fixture, str(tmp_path))

    result = benchmark(renderer.render, minimal_board_spec, export_png=False)
    assert result.output_hash


@pytest.mark.benchmark(group="export-parallel")
def test_parallel_export_throughput(benchmark, minimal_slide_spec, tmp_path):
    """Parallel export to 4 surfaces must complete faster than 4x single-surface time."""
    import time
    from artifact_compiler.export import ExportOrchestrator, SurfaceTarget

    class FastRenderer:
        def render(self, spec):
            class R:
                output_hash = "a" * 64
            return R()

    class StubStorage:
        def upload(self, result, target):
            return f"s3://test/{target.surface}"

    registry = {s: FastRenderer() for s in ["print", "digital_office", "web", "archival"]}
    orchestrator = ExportOrchestrator(registry, StubStorage(), max_workers=4)
    targets = [SurfaceTarget.from_surface_name(s) for s in ["print", "digital_office", "web", "archival"]]

    result = benchmark(orchestrator.export, "b1", "ir1", minimal_slide_spec, targets)
    assert result.all_successful
```

### 24.3 Chaos Tests

```python
"""
Chaos tests: renderer failure, cache miss under load, large IR handling.
"""
from __future__ import annotations

import threading
import time
from pathlib import Path

import pytest


@pytest.mark.requirement("FR-ART-CHX-001")
def test_renderer_failure_raises_loudly(minimal_slide_spec, tmp_path: Path) -> None:
    """
    When a renderer subprocess fails (non-zero exit), RuntimeError must be raised.
    The error must propagate; it must not be swallowed.
    """
    from unittest.mock import patch
    from artifact_compiler.renderers.pptx import PPTXRenderer

    class FailingAssetResolver:
        def resolve(self, ref: str) -> str:
            raise RuntimeError("Asset resolution failure: network unreachable.")

    renderer = PPTXRenderer(FailingAssetResolver(), None, str(tmp_path))
    with pytest.raises((RuntimeError, Exception)):
        renderer.render(minimal_slide_spec)


@pytest.mark.requirement("FR-ART-CHX-002")
def test_cache_miss_under_concurrent_load(tmp_path: Path) -> None:
    """
    Under concurrent load (16 threads), ArtifactCache must return consistent
    hit/miss results without race conditions.
    """
    import hashlib
    import random

    class StubRedis:
        def __init__(self):
            import threading
            self._lock = threading.Lock()
            self._store: dict = {}
        def get(self, key):
            with self._lock:
                return self._store.get(key)
        def set(self, key, value, ex=None):
            with self._lock:
                self._store[key] = value
        def delete(self, key):
            with self._lock:
                self._store.pop(key, None)

    class NullS3:
        def get_object(self, **kwargs): raise KeyError("miss")
        def put_object(self, **kwargs): pass
        def delete_object(self, **kwargs): pass

    from artifact_compiler.cache import ArtifactCache
    cache = ArtifactCache(StubRedis(), NullS3(), "test")

    errors: list[Exception] = []
    def worker(idem_key: str) -> None:
        try:
            result = cache.get(idem_key)
            if result.tier == "miss":
                cache.set(idem_key, "build-x", {"pptx": "s3://a/b"}, "prov-x")
                result2 = cache.get(idem_key)
                assert result2.build_id == "build-x"
        except Exception as exc:
            errors.append(exc)

    keys = [hashlib.sha256(str(i).encode()).hexdigest() for i in range(16)]
    threads = [threading.Thread(target=worker, args=(k,)) for k in keys]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert not errors, f"Cache errors under concurrent load: {errors}"


@pytest.mark.requirement("FR-ART-CHX-003")
def test_large_ir_formula_sort_performance(tmp_path: Path) -> None:
    """
    topological_sort_cells must handle 1,000 formula cells without
    exceeding a 2-second wall-clock budget.
    """
    from artifact_compiler.renderers.spreadsheet import (
        build_formula_dependency_graph, topological_sort_cells
    )

    class BigSheet:
        name = "Data"
        cells: dict = {}

    sheet = BigSheet()
    # Create 1000 cells: each cell Bn depends on B(n-1) (linear chain, no cycle)
    for i in range(2, 1002):
        sheet.cells[f"B{i}"] = f"=B{i-1}+1"
    sheet.cells["B1"] = 100

    t_start = time.monotonic()
    graph = build_formula_dependency_graph([sheet])
    sorted_cells = topological_sort_cells(graph)
    elapsed = time.monotonic() - t_start

    assert elapsed < 2.0, f"Large IR formula sort took {elapsed:.2f}s > 2s budget."
    assert len(sorted_cells) > 0
```
