# ADR-001: Headless Artifact Compiler vs SaaS Integration

**date:** 2026-02-21
**status:** ACCEPTED
**decision:** Build headless artifact compiler (in-process IR rendering) rather than integrate third-party SaaS

---

## Context

### Problem

Venture needs to generate production artifacts (slides, documents, timelines, audio scripts, org charts) as part of autonomous agent workflows. Three options were evaluated:

1. **Headless Compiler** (in-process): IR schema → render → export pipeline, deterministic, full ownership
2. **SaaS Integration** (external): Third-party API (Canva, Figma, etc.), easier UX but less control
3. **Hybrid** (internal IR + optional SaaS export): IR first, SaaS as optional destination

### Constraints

- **Determinism**: Artifact builds must be reproducible (same input → same hash)
- **Autonomy**: No human-in-the-loop during agent execution
- **Auditability**: Full artifact lineage (IR → provenance metadata → output)
- **Multi-artifact**: Must support 5+ artifact types (slides, docs, timelines, audio, boards)
- **Compliance**: Treasury integration means spend tracking and policy enforcement per artifact

### Alternatives Considered

| Option | Pros | Cons | Decision |
|--------|------|------|----------|
| **Headless** | Deterministic, full control, no external deps, auditability, policy-native | Build complexity, design effort, schema freeze required | ✅ CHOSEN |
| **SaaS Integration** | Easy UX, pre-built designs, no render engine | Non-deterministic, vendor lock-in, slower, harder to audit | ❌ REJECTED |
| **Hybrid** | Best of both | Complexity, dual maintenance, mixed control | ⚠️ FUTURE OPTION |

---

## Decision

**Build a headless artifact compiler** as the primary artifact generation subsystem.

### What This Means

1. **IR Schema Family Frozen**: SlideSpec, DocSpec, TimelineSpec, AudioSpec, BoardSpec (v1.0) locked in ARTIFACT_COMPILER_SPEC.md
2. **Deterministic Build Pipeline**: Input schema → render engine → output file with provenance metadata
3. **No External Render SaaS**: Canva, Figma, etc. are not integrated as primary targets
4. **Native Cost Tracking**: Each artifact build emits spend events tied to TRACK_B treasury system
5. **Replay Guarantee**: Same IR + render version → identical output byte-for-byte (for archive/audit)

### Architecture

```
Artifact Request
  ↓
[IR Schema Validation]
  ↓
[Render Engine Dispatch]
  ├─ SlideSpec → PDF/PNG renderer
  ├─ DocSpec → HTML/Markdown renderer
  ├─ TimelineSpec → SVG/JSON renderer
  ├─ AudioSpec → SSML → audio encoder
  └─ BoardSpec → SVG/PNG renderer
  ↓
[Provenance Attachment] (hash, timestamp, render version, trace_id)
  ↓
[Output Export] (blob store + ledger entry)
  ↓
[Spend Event] (tied to TRACK_B)
```

### Renderer Implementations

| Artifact Type | Renderer | Output Format | Notes |
|---------------|----------|---------------|-------|
| SlideSpec | Custom (Python/Go) | PDF, PNG | Deterministic typography via embedded fonts |
| DocSpec | Markdown → HTML | HTML, Markdown | Standard Markdown rendering |
| TimelineSpec | SVG templating | SVG, PNG | Deterministic layout via constraint solver |
| AudioSpec | SSML → TTS | WAV, MP3 | Deterministic via fixed TTS provider + pitch/speed params |
| BoardSpec | Canvas rendering | SVG, PNG | Deterministic grid-based layout |

---

## Rationale

### Why Headless, Not SaaS?

1. **Determinism**: Critical for compliance and audit. SaaS APIs drift (UI changes, version upgrades); headless IR+renderer stays frozen.
2. **Autonomy**: No rate limits, no external approval gates, no async callback dependencies.
3. **Cost Control**: Spend is deterministic and predictable; no surprise API charges.
4. **Audit Readiness**: Full lineage (agent → IR → render → output → ledger entry); SaaS integration breaks this chain.
5. **Integration with TRACK_B**: Directly emits spend events; SaaS integration would require translation layer.

### Why Not SaaS Later?

SaaS integration remains a **future option** (see ADR-NNN-SaaS-export-targets):
- Once headless IR is stable, can export SlideSpec → Canva design (one-way)
- Canva becomes optional **destination**, not primary generation mechanism
- Users get "polish in SaaS" only if they explicitly opt in post-generation

---

## Consequences

### Positive

1. ✅ Deterministic artifact generation (Foundation for TRACK_A)
2. ✅ Native integration with spend tracking (TRACK_B treasury)
3. ✅ Full auditability from agent intent → artifact → ledger
4. ✅ No external API dependencies or rate limits
5. ✅ Schema freezing enables long-term replay guarantees
6. ✅ Simpler control plane (no async callback state)

### Negative

1. ❌ **Rendering complexity**: Must build/maintain 5 specialized renderers
2. ❌ **Design sophistication**: Headless outputs may look less polished than SaaS-native
3. ❌ **Typography lock-in**: Fonts and styling frozen at v1.0; no easy updates
4. ❌ **Learning curve**: Agents must learn IR schema (vs. native SaaS design tools)

### Mitigation

| Risk | Mitigation |
|------|-----------|
| Rendering complexity | Use established libraries (reportlab, drawsvg, etc.); build incrementally (Phase 2 only DocSpec, Phase 3 add SlideSpec, etc.) |
| Design sophistication | Accept v1 outputs as "functional not beautiful"; SaaS export option in v2 for polish |
| Typography lock-in | Freeze fonts and styles at v1.0; document constraints clearly; separate design v2 work into future ADR |
| Agent learning | Provide agent library with IR builders; auto-suggest IR fields based on context |

---

## CIV Integration Notes

### CIV → Venture Artifact Export (Integration Point 1)

This decision enables a key integration point with CIV:

**CIV simulation outputs can become Venture artifacts:**
- CIV time-series (population, economy, energy) → TimelineSpec
- CIV policy decisions → DocSpec
- CIV org hierarchy → BoardSpec
- CIV citizen journeys → combination of SlideSpec + TimelineSpec

**Alignment:**
- CIV's tick-based state → Venture's IR snapshot
- Deterministic artifact generation mirrors CIV's deterministic simulation
- Spend tracking (Venture) can model "cost of visualization" in CIV's energy accounting

### Replay Guarantee (Integration Point 5)

Headless compiler enables CIV-Venture replay:
- Same CIV tick snapshot → same IR → same artifact bytes
- Supports auditing CIV decisions: "what policy decisions led to this artifact?"

---

## Validation & Next Steps

### Validation Criteria (Before Phase 1 Starts)

- [ ] SlideSpec and DocSpec IR schemas frozen and validated against rendering constraints
- [ ] Prototype renderers confirm determinism (byte-for-byte reproducibility tested)
- [ ] Provenance metadata schema defined and integrated with TRACK_B ledger
- [ ] Cost model for rendering (compute per artifact type) defined
- [ ] Agent library for IR builders designed and approved

### Phase Milestones

1. **Phase 1** (Foundation): DocSpec renderer + IR schema validation
2. **Phase 2** (Expansion): SlideSpec + TimelineSpec renderers
3. **Phase 3** (Audio+Board): AudioSpec + BoardSpec renderers
4. **Phase 4** (Optimization): Performance, caching, incremental builds
5. **Phase 5** (SaaS Bridge): Optional export targets (future ADR)

### Related ADRs

- ADR-002: Joule-Treasury integration (spend tracking for artifacts)
- ADR-NNN: SaaS export targets (future, v2+)
- ADR-NNN: Typography v2 upgrade (future, if design debt accrues)

---

## References

- **Artifact Compiler Spec**: `ARTIFACT_COMPILER_SPEC.md`
- **Track A Determinism Spec**: `TRACK_A_ARTIFACT_DETERMINISM_SPEC.md`
- **Product Model**: `PRODUCT_MODEL.md` (artifact generation as core feature)
- **Integration Points**: `../SPECS_INDEX.md` (Integration Point 1: CIV artifact export)

---

**Decision Made By:** Venture Autonomy Platform Team
**Implementation Lead:** Venture Platform Engineering
**Last Updated:** 2026-02-21
