# Artifact Compiler System Spec

**Status:** draft
**Date:** 2026-02-21
**Source:** ChatGPT Conversation 6996a694
**Author:** Design synthesis from agent-driven artifact automation discussion

---

## Summary

The Artifact Compiler System is a **headless, deterministic compilation pipeline** for creating production-ready marketing and rich media artifacts (slides, videos, documents, audio, boards) without relying on SaaS editing tools or human UI automation.

Rather than agents "editing Google Slides" or "using Clipchamp," agents generate structured Intermediate Representation (IR) specifications that compile to multiple output formats via deterministic renderers. This enables:

- Autonomous multi-artifact generation at scale
- Deterministic, reproducible builds with full provenance
- Multi-format export (PPTX, PDF, MP4, WAV, SVG, HTML)
- Brand-consistent output via centralized token engines
- Validation before export (accessibility, layout, loudness, etc.)
- Integration with generative models (NanoBanana, Veo 3.1) as build-time services, not editing surfaces

This spec defines the IR family, compiler pipeline, validation layer, and integration patterns for the Venture platform.

---

## Problem Statement: The SaaS Gap

Current agent systems are constrained to:

- Writing text
- Calling APIs
- Filling templates

They do **not**:

- Own layout engines
- Own timeline/NLE engines
- Own audio DSP graphs
- Own document pagination
- Own brand token systems
- Own export pipelines

Instead, agents depend on:

- Google Slides for layout
- PowerPoint for chart rendering
- Clipchamp/iMovie for video editing
- GarageBand for audio mixing
- Miro for whiteboarding
- Manually stitching together outputs

**Consequence:** Artifacts are fragile, non-deterministic, vendor-locked, slow to iterate, and cannot scale autonomously. No true "headless" operation is possible.

**Solution:** Build artifact compilation systems. Treat artifacts as code. Generate IR → compile → render → validate → export.

---

## Core Architecture: Artifact as Code

### Conceptual Pipeline

```
Code/Structured Spec
    ↓ (Agent generates IR)
Canonical IR Layer (JSON)
    ↓ (Deterministic toolchain)
Compiler (IR-specific renderer)
    ↓ (FFmpeg, python-pptx, Pandoc, etc.)
Renderer Output (intermediate format)
    ↓ (Validation engine)
Validated Artifact
    ↓ (Multi-target export)
Export Matrix (PPTX, PDF, MP4, WAV, SVG, etc.)
```

### Key Principles

1. **Pure JSON IR**: All artifact specifications are JSON, versionable, diffable, deterministic
2. **No SaaS Dependency**: Agents own the build; SaaS becomes an export target
3. **Deterministic Build**: Idempotency key (IR hash + toolchain version + policy bundle) ensures byte-identical replay
4. **Provenance Metadata**: Every artifact export is signed with input hashes, model versions, and timestamps
5. **Brand Token Engine**: Centralized design system tokens compile to all output formats (CSS, PPTX themes, PDF styles, video overlays, audio metadata)

---

## Intermediate Representation (IR) Schema

All IR specs require:

```json
{
  "schema_version": "1.0",
  "spec_id": "deck-2026-02-21-marketing",
  "content_hash": "sha256:...",
  "inputs_hash": "sha256:...",
  "policy_bundle_id": "brand-tokens-v2-enterprise",
  "created_at": "2026-02-21T09:30:00Z",
  "metadata": {
    "created_by": "marketing-agent-v3",
    "target_surfaces": ["web", "email", "presentation"],
    "accessibility_level": "wcag-aa"
  }
}
```

### Version Control & Immutability

- IR objects are immutable once created
- Updates generate new IR with incremented version
- All builds reference specific IR + toolchain version pair
- Builds are reproducible if toolchain and dependencies are pinned

---

## Supported Artifact Types

### 1. SlideSpec (Presentations/Decks)

**Purpose:** Marketing decks, internal presentations, pitch decks, education content

**Structure:**
```json
{
  "type": "SlideSpec",
  "schema_version": "1.0",
  "slides": [
    {
      "id": "slide-1",
      "layout": "title-subtitle",
      "elements": [
        {
          "type": "heading",
          "text": "Market Overview 2026",
          "styleToken": "heading-xxl",
          "alignment": "center"
        },
        {
          "type": "chart",
          "chartType": "bar",
          "dataRef": "datasets.market-share",
          "styleToken": "chart-brand-primary"
        },
        {
          "type": "image",
          "assetRef": "s3://assets/hero-image-main.png",
          "width": 800,
          "height": 450
        }
      ],
      "speaker_notes": "Establish market context...",
      "timing": { "duration_seconds": 120 }
    }
  ],
  "metadata": {
    "aspect_ratio": "16:9",
    "font_face": "token:fonts.body",
    "brand_colors": "token:colors.primary-palette"
  }
}
```

**Compiler Targets:**
- PPTX (python-pptx, OpenXML)
- PDF (via intermediate HTML or direct rendering)
- PNG frames (for video or thumbnail generation)
- HTML (reveal.js or similar)

**Key Subsystems:**
- Layout engine: deterministic element positioning, overflow detection
- Text rendering: font fallback, hyphenation, contrast validation
- Chart/data visualization: vega-lite or plotly compilation
- Asset resolution: S3 fetch, hashing, proxy caching

---

### 2. DocSpec (Documents/Reports)

**Purpose:** Reports, whitepapers, marketing collateral, case studies, RFP responses

**Structure:**
```json
{
  "type": "DocSpec",
  "schema_version": "1.0",
  "sections": [
    {
      "id": "section-1",
      "type": "heading",
      "level": 1,
      "content": "Executive Summary"
    },
    {
      "id": "section-2",
      "type": "body",
      "content": "This report examines...",
      "styleToken": "body-text",
      "citations": [
        {
          "text": "market research",
          "ref": "cite-001",
          "url": "https://..."
        }
      ]
    },
    {
      "id": "section-3",
      "type": "table",
      "dataRef": "datasets.financial-summary",
      "columns": ["metric", "2024", "2025", "2026"]
    }
  ],
  "output_channels": {
    "web": { "format": "html", "breakpoints": [480, 768, 1024] },
    "email": { "format": "html", "width": 600 },
    "pdf": { "format": "pdf", "page_size": "a4", "margins": "1in" }
  },
  "constraints": {
    "max_page_length": 20,
    "min_heading_level": 1
  }
}
```

**Compiler Targets:**
- DOCX (python-docx, OpenXML)
- PDF (Pandoc + WeasyPrint or custom engine)
- HTML (responsive, with CSS grid/flexbox)
- Markdown (for version control)

**Key Subsystems:**
- Markdown → AST → output format pipeline
- Pagination enforcement with deterministic rules
- Citation/reference management
- Table layout with column width distribution
- Image placement with caption anchoring

---

### 3. TimelineSpec (Video/Motion)

**Purpose:** Marketing videos, demo videos, presentation-to-video transformation, b-roll sequences, cinematic content

**Structure:**
```json
{
  "type": "TimelineSpec",
  "schema_version": "1.0",
  "metadata": {
    "duration_seconds": 45,
    "frame_rate": 30,
    "resolution": "1920x1080",
    "aspect_ratio": "16:9"
  },
  "scenes": [
    {
      "id": "scene-1",
      "type": "slide-to-video",
      "slide_ref": "deck-main:slide-3",
      "duration_seconds": 5,
      "motion": {
        "type": "ken-burns",
        "zoom": 1.08,
        "pan_direction": "left"
      },
      "overlay": {
        "type": "text-lower-third",
        "text": "Product Benefits",
        "duration_seconds": 3
      }
    },
    {
      "id": "scene-2",
      "type": "generated",
      "generator": "veo-3.1",
      "prompt": "Professional office setting, person presenting to camera",
      "reference_images": ["keyframe-1.png", "keyframe-2.png"],
      "duration_seconds": 8
    },
    {
      "id": "scene-3",
      "type": "composite",
      "clips": [
        {
          "asset": "s3://clips/intro-animation.mp4",
          "start": 0,
          "duration": 3,
          "layer": 0
        },
        {
          "asset": "s3://clips/product-demo.mp4",
          "start": 2,
          "duration": 6,
          "layer": 0,
          "opacity": 0.8
        }
      ],
      "transitions": [
        {
          "at": 2,
          "type": "crossfade",
          "duration": 1
        }
      ]
    }
  ],
  "audio": {
    "tracks": [
      {
        "id": "narration",
        "type": "voiceover",
        "script_ref": "script-main",
        "tts_config": {
          "voice": "en-US-Neural2-C",
          "rate": 1.0
        }
      },
      {
        "id": "music",
        "type": "bgm",
        "asset": "s3://audio/background-music.wav",
        "ducking": {
          "target_track": "narration",
          "reduction_db": -6,
          "attack_ms": 100,
          "release_ms": 200
        }
      }
    ]
  },
  "captions": {
    "enabled": true,
    "language": "en-US",
    "style": "burn-in"
  },
  "export": {
    "formats": ["mp4", "webm", "mov"],
    "quality_presets": ["720p", "1080p", "4k"]
  }
}
```

**Compiler Targets:**
- MP4/MOV (FFmpeg)
- WebM (FFmpeg)
- ProRes (for archival/professional use)

**Key Subsystems:**
- Slide → PNG rendering (LibreOffice headless or custom engine)
- Generative video integration (Veo 3.1 async job orchestration, 2-day download window, watermark handling)
- FFmpeg filtergraph generation from timeline IR
- Ken Burns / pan-zoom motion calculation
- Audio mixing with sidechain compression for ducking
- Caption/subtitle burn-in with timing alignment
- Video codec selection and quality presets

---

### 4. AudioSpec (Audio/Music)

**Purpose:** Voiceovers, podcast editing, music mixing, sound design, audio narration for videos

**Structure:**
```json
{
  "type": "AudioSpec",
  "schema_version": "1.0",
  "metadata": {
    "sample_rate": 48000,
    "bit_depth": 24,
    "channels": 2,
    "target_loudness_lufs": -16,
    "target_loudness_tp_lufs": -1.5
  },
  "script_segments": [
    {
      "id": "segment-1",
      "text": "Welcome to our product demo.",
      "voice_config": { "voice": "en-US-Neural2-C", "rate": 1.0 },
      "start_time_ms": 0,
      "duration_ms": 3000
    }
  ],
  "tracks": [
    {
      "id": "narration",
      "type": "voiceover",
      "segments": ["segment-1"],
      "processing": {
        "normalize": true,
        "eq": "token:audio.narration-eq"
      }
    },
    {
      "id": "background",
      "type": "ambient",
      "asset": "s3://audio/ambient-office.wav",
      "volume_db": -20,
      "loop": true
    },
    {
      "id": "music",
      "type": "bgm",
      "asset": "s3://audio/royalty-free-track.wav",
      "start_time_ms": 0,
      "volume_db": -9,
      "fade": {
        "in_ms": 500,
        "out_ms": 1000
      }
    },
    {
      "id": "sfx",
      "type": "sound-effects",
      "events": [
        {
          "at_ms": 5000,
          "asset": "s3://sfx/notification-ping.wav",
          "volume_db": -6
        }
      ]
    }
  ],
  "mixing": {
    "ducking_rules": [
      {
        "source": "music",
        "target": "narration",
        "reduction_db": -8,
        "attack_ms": 50,
        "release_ms": 100
      }
    ],
    "compressor": {
      "threshold": -20,
      "ratio": 4,
      "attack_ms": 10,
      "release_ms": 100
    }
  },
  "export": {
    "formats": ["wav", "mp3"],
    "bit_rates": { "mp3": "192k" }
  }
}
```

**Compiler Targets:**
- WAV (lossless master)
- MP3 (lossy, streaming)
- AAC (mobile)

**Key Subsystems:**
- TTS integration (Google Cloud TTS, ElevenLabs, or local models)
- Loudness normalization (ITU-R BS.1770-4 via FFmpeg or Librosa)
- Multi-track mixing with automatable ducking
- EQ, compression, reverb via FFmpeg filters or SoX
- Silence detection and trimming
- Fade in/out automation
- Format conversion and encoding

---

### 5. BoardSpec (Whiteboards/Diagrams)

**Purpose:** Miro-like whiteboards, flowcharts, diagrams, concept maps, collaborative sketches

**Structure:**
```json
{
  "type": "BoardSpec",
  "schema_version": "1.0",
  "metadata": {
    "canvas_width": 2400,
    "canvas_height": 1800,
    "zoom_level": 1.0
  },
  "nodes": [
    {
      "id": "node-1",
      "type": "sticky",
      "text": "Customer Problem",
      "x": 100,
      "y": 200,
      "width": 200,
      "height": 150,
      "style_token": "sticky-primary",
      "z_index": 1
    },
    {
      "id": "node-2",
      "type": "box",
      "text": "Our Solution",
      "x": 400,
      "y": 200,
      "width": 200,
      "height": 150,
      "border_color": "token:colors.primary",
      "border_width": 2
    },
    {
      "id": "node-3",
      "type": "image",
      "asset_ref": "s3://images/product-mockup.png",
      "x": 700,
      "y": 150,
      "width": 300,
      "height": 250
    }
  ],
  "edges": [
    {
      "id": "edge-1",
      "from": "node-1",
      "to": "node-2",
      "type": "arrow",
      "label": "leads to",
      "style": "solid",
      "color": "token:colors.secondary"
    }
  ],
  "animation_steps": [
    {
      "step": 1,
      "duration_ms": 500,
      "elements": ["node-1"],
      "animation": "fade-in"
    },
    {
      "step": 2,
      "duration_ms": 500,
      "elements": ["edge-1"],
      "animation": "draw"
    },
    {
      "step": 3,
      "duration_ms": 500,
      "elements": ["node-2"],
      "animation": "fade-in"
    }
  ],
  "export": {
    "formats": ["svg", "pdf", "png", "html-interactive"]
  }
}
```

**Compiler Targets:**
- SVG (vector, web-ready)
- PDF (print-ready)
- PNG (raster snapshot)
- HTML Canvas (interactive)
- Optional: Miro API export (if integration desired)

**Key Subsystems:**
- Spatial layout engine (collision detection, auto-align)
- Connection routing (orthogonal or Bezier curves)
- Animation sequencing for reveal patterns
- Responsive scaling and breakpoint handling
- Accessibility text layers

---

### 6. Other Artifact Types (Future Extensions)

- **InfographicSpec**: Data visualization, statistical graphics
- **EmailSpec**: Responsive email templates with MJML/Stripo compilation
- **WebPageSpec**: Landing pages, website sections
- **SocialMediaSpec**: Instagram cards, Twitter threads, TikTok scripts
- **PresentationThemeSpec**: Reusable design systems, brand guidelines as code

---

## Compiler Pipeline

### Stage 1: Spec Validation

Input: Raw IR (JSON)

**Checks:**
- Schema conformance (against JSON schema)
- Content hash verification
- Mandatory fields present
- Asset references resolvable (ping S3, check URLs)
- Circular dependency detection
- Data type validation

**Output:** Validated IR object (or fail with detailed error)

---

### Stage 2: Planning & Dependency Resolution

Input: Validated IR

**Actions:**
- Resolve all `dataRef` references (look up in dataset registry)
- Fetch asset metadata (size, format, hash)
- Determine compilation order (topological sort if spec has dependencies)
- Allocate temporary working directory
- Estimate resource requirements (CPU, memory, time)

**Output:** Compilation manifest with dependency DAG

---

### Stage 3: Compilation (Rendering)

Input: Manifest + resolved dependencies

**For each artifact type:**

**SlideSpec:**
1. For each slide, lay out elements (grid/flex positioning)
2. Render text with selected fonts
3. Generate charts via Vega-Lite → SVG
4. Embed images with asset hashing
5. Build final PPTX/PDF via python-pptx or equivalent

**TimelineSpec:**
1. Render slide → PNG frames (or fetch pre-rendered)
2. For generative scenes (Veo), orchestrate async job + polling + download before 2-day TTL
3. Generate FFmpeg filtergraph from timeline IR
4. Execute FFmpeg with muxed audio
5. Validate output video properties

**AudioSpec:**
1. Generate TTS for script segments (parallel if possible)
2. Mix all audio tracks via FFmpeg or SoX
3. Apply loudness normalization
4. Apply compression/EQ
5. Encode to target formats

**DocSpec:**
1. Parse Markdown → AST
2. Apply style tokens to headings, body, etc.
3. Insert images and tables with constraints
4. Enforce pagination (max lines per page, orphan/widow prevention)
5. Render via Pandoc → DOCX/PDF or WeasyPrint → PDF

**BoardSpec:**
1. Calculate node positions (apply constraints, collision detection)
2. Route edges (orthogonal or curved)
3. Render SVG or canvas output
4. Generate animation script if needed

**Output:** Compiled artifacts (PPTX, MP4, WAV, PDF, SVG, etc.)

---

### Stage 4: Validation

Before export, validate:

**Layout:**
- No text overflow
- Element collision detection
- Minimum font sizes readable
- Image aspect ratio preservation

**Brand Consistency:**
- Color palette adherence
- Font usage correctness
- Logo placement conformance

**Accessibility:**
- Color contrast (WCAG AA/AAA)
- Alt text presence (for images)
- Caption completeness (for video, time-aligned)
- Heading hierarchy (no skipped levels)

**Media-Specific:**
- **Video:** Frame rate, resolution, codec support, subtitle sync
- **Audio:** Loudness (LUFS), peak levels, bit depth, sample rate
- **Documents:** Page count, word count, spelling/grammar (optional)
- **Slides:** Readability distance, visual balance

**Operational:**
- File size within limits
- Encoding succeeded
- No corrupted blocks
- Hash verification of outputs

**Output:** Validation report (pass/fail with details)

---

### Stage 5: Export Matrix

Input: Validated artifacts

**For each target surface:**

1. **Web Export**
   - Convert to web-friendly formats (WebM, MP4 H.264, WOFF fonts, SVG)
   - Compress images (WebP, progressive JPEG)
   - Minify CSS/JS
   - Generate responsive breakpoints

2. **Email Export**
   - Inline CSS (for email client compatibility)
   - Convert images to base64 or CDN-hosted
   - Test email rendering (Litmus, Email on Acid simulation)

3. **Print Export**
   - High-DPI versions (300 DPI for PDFs)
   - CMYK color space (if needed)
   - Bleed/trim marks
   - Font embedding

4. **SaaS Platform Export**
   - Generate proprietary APIs (Google Slides API, PowerPoint API, Miro API)
   - Map IR tokens to platform-specific theme objects
   - Upload to respective cloud platforms
   - Optional: auto-create shareable links

5. **Archival Export**
   - High-quality master formats (ProRes, WAV FLAC)
   - Provenance metadata embedding
   - Checksums for integrity verification

**Output:** Multi-format artifact package ready for distribution

---

### Stage 6: Provenance & Logging

For every artifact, emit and store:

```json
{
  "artifact_id": "deck-2026-02-21-marketing",
  "build_id": "build-12345",
  "idempotency_key": "sha256(ir_hash + toolchain_version + policy_bundle_id + target_surface)",
  "inputs": {
    "ir_hash": "sha256:...",
    "asset_hashes": {
      "image-1.png": "sha256:...",
      "dataset.json": "sha256:..."
    },
    "brand_tokens_hash": "sha256:..."
  },
  "toolchain": {
    "python_pptx": "0.6.23",
    "ffmpeg": "6.1.1",
    "pandoc": "3.1.8"
  },
  "generators": [
    {
      "type": "veo",
      "model": "veo-3.1-generate-preview",
      "scene_ids": ["scene-2"],
      "operation_ids": ["op-abc123"],
      "prompts_hash": "sha256:..."
    }
  ],
  "outputs": {
    "primary": {
      "format": "mp4",
      "path": "s3://artifacts/deck-2026-02-21-marketing.mp4",
      "hash": "sha256:...",
      "size_bytes": 125000000
    },
    "variants": [
      {
        "format": "webm",
        "path": "s3://artifacts/deck-2026-02-21-marketing.webm",
        "hash": "sha256:..."
      }
    ]
  },
  "validation": {
    "status": "pass",
    "checks": [
      { "name": "schema", "status": "pass" },
      { "name": "layout_overflow", "status": "pass" },
      { "name": "color_contrast", "status": "pass", "failures": [] },
      { "name": "caption_completeness", "status": "pass", "coverage_percent": 100 }
    ]
  },
  "performance": {
    "total_time_seconds": 342,
    "stages": {
      "validation": 2,
      "compilation": 320,
      "export": 20
    }
  },
  "created_at": "2026-02-21T10:45:00Z",
  "created_by": "marketing-agent-v3"
}
```

This provenance log enables:
- Deterministic replay (byte-identical if inputs/toolchain unchanged)
- Audit trail for compliance
- Cost tracking (compute per artifact)
- Debugging (which stage failed)
- Generative asset verification (which model versions used)

---

## Headless Execution Model

### Key Principle

**No UI automation. No browser. No manual steps.**

Agents interact solely via:

1. **Spec Generation API**
   ```
   POST /artifacts/ir/validate
   POST /artifacts/ir/compile
   ```

2. **Asset Gateway**
   ```
   PUT /assets/{assetId}  # Upload
   GET /assets/{assetId}  # Fetch metadata
   ```

3. **Build Orchestration API**
   ```
   POST /builds
   GET /builds/{buildId}
   GET /builds/{buildId}/logs
   ```

4. **Export API**
   ```
   GET /artifacts/{artifactId}/export?format=mp4&quality=1080p
   ```

### Agent Workflow

1. **Spec Generation Agent**
   - Receives task (e.g., "create 10-slide deck for product launch")
   - Generates SlideSpec JSON
   - Calls `POST /artifacts/ir/validate`

2. **Asset Management Agent**
   - Fetches brand images, datasets from S3
   - Uploads to asset gateway if new
   - Returns asset URIs for inclusion in IR

3. **Build Orchestration Agent**
   - Submits validated IR to compiler
   - Polls build status
   - Monitors resource usage (LLM costs for TTS, generative video, etc.)

4. **Export Agent**
   - Once compilation completes, triggers multi-format export
   - Distributes to storage targets (S3, email, shared links)
   - Emits completion event

### No Human in Loop

- Agents never need to "check" visual output before export
- Validation gates ensure correctness
- If validation fails, agent modifies spec and recompiles
- Export happens automatically once validation passes

---

## Integration with Venture Platform

### 1. Connection to TECHNICAL_SPEC.md

The Artifact Compiler is a **subsystem of the Venture-Autonomy Control Plane**.

**Relevant sections from TECHNICAL_SPEC.md:**

- **Artifact Compiler Subsystem:** IR specs, build pipeline, provenance
- **Tool Permission Engine:** Artifacts can only be compiled if agent has `artifact:compile` permission
- **Workflow Orchestration:** Artifact compilation is a workflow step; emits events on completion

**Integration Points:**

```
Agent Task Request
    → Workflow Orchestrator
        → [Task: "generate slide deck"]
            → Artifact Compiler (validates spec, compiles)
            → Event Bus (emits artifact.build.completed.v1)
            → Agent receives callback with artifact URI
```

---

### 2. Connection to TRACK_A_ARTIFACT_DETERMINISM_SPEC.md

**Full alignment.** This spec extends the determinism contract:

**Idempotency guarantee:**
```
Idempotency_Key = Hash(
  ir_hash +
  toolchain_version +
  policy_bundle_id +
  target_surface
)

If Idempotency_Key matches prior build:
  → Retrieve cached output (byte-identical)
  → Skip compilation if desired
```

**Provenance & Replay:**
```
Every artifact build emits:
  artifact.ir.registered.v1
  artifact.build.started.v1
  artifact.build.completed.v1
  artifact.provenance.attested.v1
  artifact.replay.verified.v1 (if deterministically replayed)
```

**Veo/NanoBanana Generative Assets:**

Section 4.3 of TRACK_A_ARTIFACT_DETERMINISM_SPEC covers:
- Provider call orchestration (veo-3.1, fallback routing)
- Non-deterministic provider handling (artifact fingerprinting + semantic-equivalence validation)
- Signed provenance records for each generated asset

**This spec adds:**
- TimelineSpec → scene plan → provider prompt pack → render jobs contract
- FFmpeg filtergraph generation from deterministic IR
- 2-day Veo output download/caching before TTL expiry

---

### 3. Connection to API_EVENTS_SPEC.md

**Event Topics Generated by Artifact Compiler:**

```
artifact.ir.registered.v1
  → Event: IR object persisted to database
  → Payload: { ir_id, ir_type, content_hash, schema_version }

artifact.build.started.v1
  → Event: Compilation commenced
  → Payload: { build_id, ir_id, idempotency_key, stage }

artifact.build.completed.v1
  → Event: Artifact successfully compiled and validated
  → Payload: {
      build_id,
      artifact_id,
      formats: [mp4, pdf],
      validation_status: "pass",
      duration_seconds: 342,
      storage_uris: { mp4: "s3://...", pdf: "s3://..." }
    }

artifact.build.failed.v1
  → Event: Compilation failed at stage X
  → Payload: { build_id, stage, error_code, error_message }

artifact.provenance.attested.v1
  → Event: Provenance signature generated
  → Payload: {
      build_id,
      provider,
      model,
      signature,
      inputs_hash,
      outputs_hash
    }

artifact.validation.failed.v1
  → Event: Artifact did not pass validation gate
  → Payload: {
      build_id,
      check: "color_contrast",
      details: [ { element_id: "...", failure_reason: "..." } ]
    }

artifact.exported.v1
  → Event: Artifact exported to target surface
  → Payload: {
      artifact_id,
      target: "email",
      export_format: "html",
      uri: "s3://emails/..."
    }
```

**Event Envelope (per API_EVENTS_SPEC.md):**

```json
{
  "event_id": "evt-uuid",
  "event_type": "artifact.build.completed.v1",
  "workflow_id": "wf-123",
  "policy_version": "2026-02",
  "payload": { /* as above */ },
  "trace_id": "trace-xyz",
  "created_at": "2026-02-21T10:45:30Z"
}
```

---

### 4. Capital & Cost Tracking

Artifact compilation has real costs:

**LLM Costs (if TTS):**
- `AudioSpec` with TTS integration calls Google Cloud TTS or similar
- Cost tracked per segment, per artifact

**Generative Model Costs (Veo, NanoBanana):**
- TimelineSpec with `generator: "veo-3.1"` triggers Veo 3.1 API calls
- Quota-limited (e.g., 10 RPM, 4 videos/request per Google Cloud docs)
- Cost tracked per generated scene

**Compute Costs (FFmpeg, Pandoc, etc.):**
- Compiler runs on agents' compute budget
- Storage + bandwidth for asset gateway

**Integration with Treasury:**

Events emitted:
```
money.intent.created.v1
  → Artifact compilation estimated to cost $X

money.authorization.decided.v1
  → Authorization granted (within artifact budget cap)

ledger.entry.created.v1
  → Recorded $X debit against venture's operating budget
```

---

## Quality Gates & Validation

### Pre-Compilation Checks

1. **IR Schema Validation**
   - JSON schema conformance
   - Required fields present
   - Type checking (strings, numbers, enums)

2. **Asset Resolution**
   - All `assetRef` URIs are reachable
   - Asset hashes match expected values
   - Sufficient permissions to access

3. **Data Reference Validation**
   - All `dataRef` lookups resolve in dataset registry
   - Data shapes match expected schema
   - No circular dependencies

### Compilation Checks

4. **Layout Validation**
   - Text overflow detection (warn/fail threshold)
   - Element collision detection
   - Image aspect ratio preservation
   - Minimum font size enforcement (10pt readable threshold)

5. **Brand Consistency**
   - Color palette adherence (allow ±2% deviation for rendering)
   - Font family matching (with fallback hierarchy)
   - Logo placement within safe zones

6. **Accessibility Compliance**
   - WCAG AA color contrast (4.5:1 for normal text, 3:1 for large)
   - Image alt text completeness
   - Heading hierarchy validation
   - Video caption synchronization (< 100ms drift)
   - Audio loudness (target LUFS must be achieved)

### Post-Compilation Checks

7. **Output Integrity**
   - File corruption detection
   - Codec validity (VideoInspector, ffprobe)
   - Audio loudness verification (post-rendering)
   - PDF/DOCX structure validation

8. **Performance Checks**
   - File size within limits (e.g., < 500MB for video)
   - Encoding bitrate acceptable for target platform
   - Duration matches timeline spec

### Validation Reporting

Agents receive detailed validation report:

```json
{
  "status": "fail",
  "failures": [
    {
      "check": "color_contrast",
      "severity": "error",
      "affected_elements": [
        {
          "element_id": "slide-5:heading",
          "actual_ratio": 3.2,
          "required_ratio": 4.5,
          "suggestion": "Darken text color or lighten background"
        }
      ]
    },
    {
      "check": "layout_overflow",
      "severity": "warning",
      "affected_elements": [
        {
          "element_id": "slide-3:body-text",
          "overflow_lines": 2,
          "suggestion": "Reduce font size by 1pt or trim content"
        }
      ]
    }
  ],
  "warnings": [ /* ... */ ],
  "recommendations": [ /* ... */ ]
}
```

Agents can **automatically remediate** by:
- Adjusting style tokens
- Trimming content
- Rebalancing layout
- Regenerating IR and recompiling

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Agent Layer                              │
│  ┌──────────────────┐  ┌──────────────┐  ┌───────────────┐ │
│  │ Spec Generation  │  │ Asset Mgmt   │  │ Build Orch.   │ │
│  │ Agent            │  │ Agent        │  │ Agent         │ │
│  └────────┬─────────┘  └──────┬───────┘  └───────┬───────┘ │
└───────────┼────────────────────┼──────────────────┼────────┘
            │                    │                  │
            │ (JSON IR)          │ (Asset URIs)    │ (Poll status)
            ▼                    ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│          Artifact Compilation Control Plane                 │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           Spec Validation & Planning                 │  │
│  │  • Schema check  • Asset resolution  • DAG compute   │  │
│  └────────────────────────┬─────────────────────────────┘  │
│                           │                                 │
│  ┌────────────────────────▼─────────────────────────────┐  │
│  │              Compiler Pipeline                       │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────┐ │  │
│  │  │SlideSpec │  │TimelineSpec  │AudioSpec │ ...    │ │  │
│  │  │Compiler  │  │ Compiler  │  │ Compiler │        │ │  │
│  │  │(python- │  │ (FFmpeg)  │  │ (SoX,   │ │        │ │  │
│  │  │ pptx)   │  │           │  │ Librosa) │        │ │  │
│  │  └─────┬────┘  └────┬──────┘  └────┬────┘ └──────┘ │  │
│  │        │            │              │              │  │
│  │        └────────────┼──────────────┘              │  │
│  │                     ▼                              │  │
│  │         [Intermediate Format Artifacts]           │  │
│  └─────────────────────┬──────────────────────────────┘  │
│                        │                                 │
│  ┌─────────────────────▼──────────────────────────────┐  │
│  │          Validation Engine                        │  │
│  │  • Layout, brand, accessibility, media checks     │  │
│  └─────────────────────┬──────────────────────────────┘  │
│                        │                                 │
│              [Pass/Fail with Details]                   │
│                        │                                 │
│  ┌─────────────────────▼──────────────────────────────┐  │
│  │          Export Matrix Generator                  │  │
│  │  • Web (WebM, WOFF)                               │  │
│  │  • Email (inline CSS, base64)                     │  │
│  │  • Print (300 DPI, CMYK)                          │  │
│  │  • SaaS (Google Slides API, Miro API)             │  │
│  │  • Archival (ProRes, WAV FLAC)                    │  │
│  └─────────────────────┬──────────────────────────────┘  │
│                        │                                 │
│                [Multi-Format Package]                   │
│                        │                                 │
│  ┌─────────────────────▼──────────────────────────────┐  │
│  │    Provenance & Event Emission                    │  │
│  │    • artifact.build.completed.v1                  │  │
│  │    • artifact.provenance.attested.v1              │  │
│  │    • artifact.exported.v1                         │  │
│  └─────────────────────┬──────────────────────────────┘  │
└────────────────────────┼─────────────────────────────────┘
                         │
            ┌────────────┴────────────┐
            ▼                         ▼
        [S3/Storage]            [Event Bus]
        [Signed URLs]      (to downstream systems)
```

---

## Open Questions & Gaps

1. **Determinism of Generative Models**
   - Veo 3.1 is non-deterministic. How do we handle semantic equivalence validation?
   - Should we pin specific model versions in policy bundles?
   - How do we cache and verify Veo outputs across multiple builds?

2. **Real-Time Feedback Loops**
   - Agents currently receive async build notifications. Should we support real-time streaming of build logs?
   - Would incremental compilation (only recompile changed elements) be valuable?

3. **Cost Prediction**
   - Can we predict compilation cost before submission (for budget approval)?
   - How do we handle cost overruns mid-build?

4. **A/B Testing Artifacts**
   - Should agents be able to request N variants (e.g., 5 color schemes) in a single batch?
   - How do we handle parallel builds and resource contention?

5. **Custom Rendering Engines**
   - Should agents be able to plug in custom compilers for novel IR types?
   - What's the safety boundary?

6. **Integration with Miro, Figma, Notion**
   - Is bidirectional sync needed (IR ↔ Miro format)?
   - Or is one-way export (IR → Miro API) sufficient?

7. **Performance & Scaling**
   - What's the throughput target (artifacts/hour)?
   - Should we implement caching of intermediate compilation stages (PNG frames, FFmpeg segments)?

8. **IR Versioning & Migration**
   - How do we handle schema evolution (e.g., adding new SlideSpec field)?
   - Should we support backward-compatible IR versions?

9. **Artifact Dependencies**
   - Can one artifact reference another (e.g., TimelineSpec references SlideSpec)?
   - Should we support composition?

10. **Security & Prompt Injection**
    - How do we prevent malicious IR specs from executing arbitrary code?
    - Should IR be validated against a "safe schema" before compilation?

---

## Next Steps

1. **Implement reference compilers** for each IR type (SlideSpec first)
2. **Deploy asset gateway** with S3 integration
3. **Build validation engine** with rule library
4. **Integrate with Venture event bus** and workflow orchestrator
5. **Add cost tracking** to treasury system
6. **Test deterministic replay** across multiple builds
7. **Design internal capital market** for artifact compilation (if large-scale)
8. **Extend with additional IR types** as needed

---

## Related Specs

- `TECHNICAL_SPEC.md` — Venture-Autonomy control plane
- `TRACK_A_ARTIFACT_DETERMINISM_SPEC.md` — Deterministic build/replay contract, Veo/NanoBanana integration
- `API_EVENTS_SPEC.md` — Event topics and envelope format

---

**End of Artifact Compiler System Spec**
