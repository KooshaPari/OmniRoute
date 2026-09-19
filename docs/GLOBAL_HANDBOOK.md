# Phenotype Global Handbook

**Pinned revision: 2026-09-16. Supersedes all prior loose policy documents.**

This is the single canonical reference for agent behavior, quality gates, portfolio
management, ecosystem evolution, delivery packaging, and creative production across
all Phenotype repositories. Every repo should carry this as its handbook section.

---

## 1. Governing Principles

1. **Ecosystem-first.** Prefer reusing, modifying, adapting or wrapping a suitable
   existing capability over building a parallel one. Optimize total ecosystem value,
   not one repository's cleanliness.
2. **Evidence over claims.** A merged PR is not proof. A test count is not coverage.
   A screenshot is not E2E. Every assertion needs a dated observation with tool identity.
3. **Semantic compression.** Complexity is a defect when it does not buy semantics.
   Collapse duplicates, reduce fan-out, split along domain boundaries.
4. **Honest completion.** Unknown, blocked, skipped, quarantined and stale are not pass.
   Never fake a receipt or manufacture progress.
5. **Depth-first delivery.** Close useful bounded work completely before starting new work.
   A source branch, PR, integrated revision, verification run, release asset, and installed
   binary are different identities and states.

---

## 2. Agent Operating Protocol

### 2.1 Session Start

1. Locate the repo/worktree, existing audit paths, current source/BOM, previous
   assessment and checkpoint, accepted policies, permissions, and work claims.
2. Recover or derive intent from the parent mandate. For agent-born repos, record
   genesis rationale. Missing provenance is a finding, not automatic uselessness.
3. Never overwrite another worker's dirty state. Preserve existing source/report
   identities.

### 2.2 Execution

1. Choose the strongest useful next acceptance target. If a material assumption is
   untested, choose an experiment.
2. Construct the assignment: success, failure, exclusions, criteria, checks, fixtures,
   evidence needs, environment.
3. Freeze the epoch. Pin assignment/profile/evaluator revisions and scope. A later
   correction is a new baseline with recorded delta.
4. Measure using existing deterministic tools plus anchored semantic review. Collect
   raw evidence at the subject snapshot.
5. Verify separately. Reproduce using a verifier path the builder cannot silently change.
   Another prompt or model alone is not independence.

### 2.3 Completion

1. Append accepted results, unknowns, counterexamples, decisions, and attempts.
2. Update a concise checkpoint referencing exact records and next action.
3. Return: assignment epoch, subject identity, scoped maturity, evidence limits,
   actual commands/observations, findings, next action, remaining resources, restart packet.
4. A new worker must be able to continue without relying on previous narrative memory.

---

## 3. Quality Gates

### 3.1 Coverage Floors (Independent, Non-Averaged)

| Family                         | Floor  | Denominator                      |
| ------------------------------ | ------ | -------------------------------- |
| Unit (structural + behavioral) | >= 85% | Reviewed eligible inventory      |
| Integration                    | >= 85% | Boundary/contract denominator    |
| E2E                            | >= 85% | Declared journeys                |
| Mutation                       | >= 85% | Non-equivalent mutants           |
| Critical obligations           | 100%   | All selected checks run and pass |

### 3.2 What Does NOT Count as Pass

- Skipped tests, unavailable backends, empty collections, crashes, timeouts
- Quarantined flakes
- Combined/supplemental reports as primary evidence
- Test counts without coverage denominators
- PR comments resolved as proof
- Screenshots as E2E

### 3.3 Negative Controls

Seed missing inputs, wrong revisions, invalid denominators, absent tools, malformed
reports, and actual failed product behavior. Demonstrate nonzero/blocked final gate
results. An LLM judge may supplement qualitative evaluation; it cannot return canned
success on missing evidence.

### 3.4 Evidence Security

Record source/artifact/tool/config identity, timestamps, environment, command, selection,
exit/result. Hashes prove retained bytes; they do not authenticate producer, authorization,
or truth. Independent reviewers and trusted native adapters remain required.

---

## 4. Portfolio Management

### 4.1 Subject Identity

Bind each subject to immutable repository/product identity. Names and counts are
observations. Renaming a fixture retains subject relationships and source lineage.

### 4.2 Three Concurrent Tracks

1. **Comprehension** — explanatory atlas, per-product dossiers
2. **Qualification** — independent proof, conformance, benchmarks
3. **Simplification/Delivery** — reduce burden, install CVP

None waits for a complete implementation. A known repair need not wait for a perfect atlas.

### 4.3 CVP (Current Viable Product)

The fastest deployable, installable, coherent and supportable version of the currently
accepted feature horizon. Do not cut accepted functionality to claim MVP. Do not keep
adding breadth while packaging, durability, quality or polish remain unfinished.

### 4.4 Product States

Track independently: `WORKING`, `PUBLISHED`, `INTEGRATED`, `VERIFIED`, `PACKAGED`,
`INSTALLED`, `RELEASED`, `ADOPTED`. Identify exact next state transition and acceptance evidence.

---

## 5. Ecosystem-First Evolution (Rev 1.1)

### 5.1 Governing Rule

> Prefer reusing, modifying, adapting or narrowly wrapping a suitable existing
> capability over a parallel bespoke implementation. Evolve with supported consumers
> and credible future uses in view.

### 5.2 Before Creating Another Implementation

1. Locate capability in subject, siblings, declared consumers, extractions, external projects.
2. Compare: use as-is; extend current owner; adapt at boundary; improve shared contract;
   contribute upstream; maintain focused patch; keep separate; implement new.
3. An owned deficiency is normally a candidate for owned upstream improvement, not
   a reason for each consumer to carry a local copy.

### 5.3 Consumer Classification

| Tier               | Required Evidence                                             |
| ------------------ | ------------------------------------------------------------- |
| Current, supported | Real entrypoints, versions, platforms, compatibility envelope |
| Committed/planned  | Accepted requirement, sponsor, bounded near-term use          |
| Plausible future   | Use case, assumptions, inexpensive seam                       |
| Unknown/external   | Incomplete reachability, public policy, risk-based rollout    |

### 5.4 Write Coordination

Source owner prepares change; consumer owners supply contracts; integration owner
coordinates manifests; independent verifier evaluates behavior. A worker can identify
and prepare a cross-repo improvement without write access everywhere.

---

## 6. Delivery and Packaging

### 6.1 Do Not Stop at Build

For a macOS GUI CVP:

- Build a real `.app` from clean checkout
- Install outside source repo (`~/Applications` for internal)
- Verify bundle ID, version, icon, architecture, platform data paths
- Launch with no repo cwd, developer shell, or build tree
- Exercise first run, core task, save/restart, error/recovery, settings
- Capture phenotype-journeys evidence
- Tie tested SHA, artifact digest, and release artifact together

For CLI/library/service: use the role-specific equivalent. Do not manufacture a GUI
solely to satisfy the packaging rule.

### 6.2 Installation Verification

- Verify Finder/`open -b` launch and Spotlight/LaunchServices discoverability
- No repo cwd required
- No developer shell required
- No sibling checkout or build tree required

### 6.3 Rollback History

Traceable deployment and rollback history required. Source documentation and work
records remain with each subject repository.

---

## 7. Creative and Visual Production

### 7.1 Design Direction

Authored, spatial, interactive experiences — not posters with animation attached.
Spatial blocking and interaction architecture, not a claim of photoreal art direction.

### 7.2 Asset Workflow

Editable source -> inspected renders -> semantically named GLB -> interaction ->
desktop/mobile/fallback validation. Never substitute a static screenshot for an
interactive feature.

### 7.3 Production Boundaries

- Automated screenshot diffs are supporting evidence, not taste judgment
- "Workflow coverage" does not mean every application/plugin/target has passed E2E
- Native Adobe/Blender/Rive rendering requires on-device verification
- Technical shapes are canaries, not finished identity or character art

### 7.4 Visual/Polish Gate

Exercise and review: first-run, empty, loading, normal, partial, error, degraded/offline,
recovery, settings, upgrade states. Check hierarchy, typography, density, spacing, clipping,
resizing, keyboard focus, destructive confirmations, native conventions, accessibility,
perceived performance.

---

## 8. Assessment and Audit

### 8.1 Assessment Kit Protocol

1. Resolve real subject, audit owner, worktree, mandate, current context, checkpoint.
2. Reuse accepted audit path and stable schema contracts.
3. Create assignment capsule. Inventory observations, claims, assumptions, missing
   requirements, opportunities separately.
4. Bind criteria to actual instruments. Use deterministic tools first.
5. Produce canonical JSON results and evidence references at exact subject snapshot.
6. Evaluate maturity by slice and independent axes.
7. Generate Markdown, HTML, JSON, YAML, JSONL views. Run both core and dossier checks.

### 8.2 Required Return

- Completed dossier path and exact subject/epoch
- Actual evidence gathered
- Explicit limits
- Slice-specific maturity
- Top findings with ownership
- Next action and countercase
- Restart packet

### 8.3 Dossier Contents

Each product dossier covers: identity, scope, obligations, dissatisfaction records,
candidate implementation, comparative plan, next bounded task, required permission,
expected proof.

---

## 9. Storage and Infrastructure

### 9.1 Storage Agent Toolkit

Nine workflow templates for multi-host storage operations. Does not install tools,
connect hosts, provide an executor, enforce permissions, or authorize cleanup.

### 9.2 Adoption Sequence

1. Authorize read-only host/volume survey
2. Validate collector on small permitted tree
3. Verify coverage and reports
4. Establish independent backup plus restore evidence
5. Implement and review approved-plan executor
6. Add SSH in one direction first, then the other

### 9.3 Policy

All host lists and roots intentionally empty. All mutations disabled. Runtime adapters
and OS permissions must enforce policy independently of documents.

---

## 10. Control Systems

### 10.1 Cross-System Control Plane

Reconciles four coupled systems:

1. BytePort/local-cloud lifecycle
2. Assessment Dossier convergence
3. Emergent Garden/ResearchLedger continuation
4. Quota-aware semantic review control

### 10.2 Operational Status

No operational approval implied. Target-environment acceptance tests remain unrun.
No personal host, repository, provider billing or deployment was modified.

---

## 11. Schema and Interchange

### 11.1 Record Types

- **Observation**: authenticated source, immutable repo ID, resolved revision,
  path/blob/artifact digest, acquisition boundary, timestamp
- **Claim**: references observations, states inferred/reported/proposed/measured
- **Decision**: names authority and scope
- **Derived View**: never converts claims into decisions silently

### 11.2 Measurement Cell

Every required measurement cell is independent:
subject x capability x language/runtime x platform x feature/build profile x family x metric x revision

### 11.3 Package Validation

`python scripts/validate_package.py .` and `python -m unittest discover -s tests -v`
validate package structure only. They do not authenticate producers, approve work,
verify remote signatures, or execute product tests.

---

## 12. What Is NOT In This Document

- Product-specific specifications (see per-product DOSSIER.md)
- Repository-specific instructions (see per-repo AGENTS.md)
- Executed benchmarks or test results (see evidence directories)
- Approved migrations or deployment orders
- Permission grants for mutation, publication, or deletion
- Resolved SROC/CDP terminology (remains ambiguous)

---

## Appendix A: Source Inventory

| #   | Source                                | Version     | Key Contribution                                                                                                             |
| --- | ------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 1   | docs-5                                | rev 1.4     | Atlas, assurance, ecosystem-first, specification, federation, proof grading, 33 product dossiers (strict superset of docs-3) |
| 2   | docs-3                                | rev 1.1     | Archived atlas (superseded by docs-5; preserved at `docs/_archive/docs-3/`)                                                  |
| 3   | docs-2                                | —           | Prior atlas version (superseded by docs-3)                                                                                   |
| 4   | portfolio-delivery-readiness-v3       | v3          | Delivery contracts, audit findings, work packages                                                                            |
| 5   | portfolio-assurance-v2                | v2          | Independent coverage, 85% floors, negative controls                                                                          |
| 6   | product-evaluation-protocol-v0.2      | v0.2        | Agent evaluation/improvement loop                                                                                            |
| 7   | agent-lab-assessment-dossiers-v1.1    | v1.1        | Dossier protocol, assessment kit                                                                                             |
| 8   | phenotype_control_systems_docset_v0.3 | v0.3        | Cross-system control plane                                                                                                   |
| 9   | storage-agent-toolkit                 | —           | Multi-host storage workflows                                                                                                 |
| 10  | phenodesign-scene-experiences-v3      | v3          | Scene direction, specimen, 18 skills                                                                                         |
| 11  | phenoDesign-visual-production-v2      | v2          | Cross-media authoring, 26 workflows                                                                                          |
| 12  | frontend-3d-agent-kit                 | —           | 3D/interaction, 18 skills, Blender                                                                                           |
| 13  | phenotype-cvp-audit-2026-09-14        | —           | Fresh GitHub CVP pass, execution addendum                                                                                    |
| 14  | docs-5/CHANGELOG-V1.{2,3,4}.md        | 1.2/1.3/1.4 | Federation protocol, proof grading, 29 new product dossiers                                                                  |
| 15  | docs-3/REVISION-1.1.md                | 1.1         | Historical: ecosystem-first delta, consumer impact                                                                           |

## Appendix B: Quick Reference Commands

```bash
# Package validation
python scripts/validate_package.py .
python -m unittest discover -s tests -v

# Coverage measurement
python scripts/measure_reference.py

# Storage toolkit
# Start with INVENTORY.md, then skills/

# Agent lab
# Read MASTER-ASSESSMENT-KIT.md, then one executed dossier

# Product evaluation
# Read START-HERE-AGENT.md, then PRODUCT-EVALUATION-PROTOCOL-v0.2.md

# Creative production
python scripts/probe_tools.py
python scripts/browser_check.py --transport inline --out evidence/local-browser
python integration/install.py --repo /path/to/repo --apply
```

## Appendix C: Revision History

| Date       | Change                                | Author        |
| ---------- | ------------------------------------- | ------------- |
| 2026-09-16 | Initial consolidation from 13 sources | Jcode (agent) |

---

_This document is pinned. Subsequent changes require explicit revision and re-pinning._
