# Journey Traceability

Implements the [phenotype-infra journey-traceability standard](https://github.com/kooshapari/phenotype-infra/blob/main/docs/governance/journey-traceability-standard.md).

> **Work state note:** Parpoura is a dormant spec-first planning/architecture workspace. The traceability model below maps Parpoura's FR/SPEC/PRD artifacts to the journeys and gates they imply so that future implementation work (e.g., wake-up or registry-spine integration) has a baseline.

## Traceability Model

Every user-facing or operator-facing flow should be traceable across:

1. **FR/NFR** — requirement ID and user story from `FUNCTIONAL_REQUIREMENTS.md` and related SPEC files.
2. **Spec** — acceptance criteria, DAG/portfolio invariants, and non-regression constraints.
3. **Docs** — operator/user documentation and rich media placeholders.
4. **Code** — orchestrator, control-plane API, ledger-DB adapter, agent dispatcher, or docsite surface implementing the flow.
5. **Tests/Gates** — unit, integration, BDD, lint, and journey verification acting as autograders.
6. **Evidence** — journey manifest, recording/keyframes, and evaluation verdict.

## User-Facing and Operator-Facing Flows

| Flow | Requirement | Implementation surface | Autograder gates | Evidence status |
| --- | --- | --- | --- | --- |
| Founder reviews portfolio workstreams and DAG status | FR-VNT-ORCH-001, SPECS_INDEX | `control-plane-api`, `venture-orchestrator`, ledger-DB | API contract tests, latency fixture, BDD journey, eval verdict | Stubbed |
| Orchestrator executes workstream DAG in dependency order | FR-VNT-ORCH-002, API_EVENTS_SPEC | `venture-orchestrator`, task dispatch, event log | DAG ordering tests, blocking-on-failure tests, journey manifest | Stubbed |
| Artifact compiler produces deterministic outputs from specs | ARTIFACT_COMPILER_SPEC, TRACK_A_ARTIFACT_DETERMINISM_SPEC | artifact compiler, determinism harness | determinism replay tests, snapshot diffs, BDD journey | Stubbed |
| Treasury/compliance spec proves audit trail | TRACK_B_TREASURY_COMPLIANCE_SPEC, OPS_COMPLIANCE_SPEC | treasury/compliance surface, audit log adapter | compliance contract tests, audit fixture, eval verdict | Stubbed |
| API and event surface match OpenAPI/events specs | API_EVENTS_SPEC, TECHNICAL_SPEC | control-plane API, event bus, schema validation | schema diff tests, event roundtrip tests, journey manifest | Stubbed |
| Infrastructure and test specs gate deployment and CI | INFRASTRUCTURE_AND_TEST_SPECS, INFRASTRUCTURE_SPEC | infra-as-code, CI workflow, test orchestration | deploy smoke, security gates, journey eval | Stubbed |

## Rich Media Stubs

<!-- RICH-MEDIA-STUB type="animated-gif" subject="Portfolio review and DAG status" journey="portfolio-review-dag-status" status="TODO" -->
![Parpoura portfolio review — workstream list, DAG status, budget, and traceability IDs](../assets/rich-media/parpoura/portfolio-review-dag-status.gif)

*Expected capture: open the portfolio/workstream surface, show workstreams with budget, status, and DAG state, and trace selected items back to FR-VNT-ORCH-001.*

<!-- RICH-MEDIA-STUB type="annotated-screenshot" subject="Workstream DAG execution order" journey="workstream-dag-execution" status="TODO" -->
![Parpoura DAG execution — task order, dispatch events, failure-to-blocked transitions](../assets/rich-media/parpoura/workstream-dag-execution.png)

*Expected capture: replay a deterministic DAG fixture, show task ordering, dispatch events, and the blocked state for dependents of a failed task.*

<!-- RICH-MEDIA-STUB type="journey-eval" subject="Artifact determinism verdict" journey="artifact-determinism" status="TODO" -->
![Parpoura artifact determinism — input spec, compiled artifact, replay diff, and eval verdict](../assets/rich-media/parpoura/artifact-determinism.png)

*Expected capture: run the artifact compiler against a fixture spec, replay the compile, compare outputs, and attach a pass/fail determinism verdict.*

<!-- RICH-MEDIA-STUB type="annotated-screenshot" subject="Compliance audit trail" journey="compliance-audit-trail" status="TODO" -->
![Parpoura compliance audit — evidence, log entries, traceability IDs, and review action](../assets/rich-media/parpoura/compliance-audit-trail.png)

*Expected capture: generate a compliance evidence report from fixture activity, show audit log entries, and link back to the originating FR and SPEC.*

<!-- RICH-MEDIA-STUB type="journey-eval" subject="API and event contract verdict" journey="api-event-contract" status="TODO" -->
![Parpoura API/event contract verdict — request, response, event payload, and eval result](../assets/rich-media/parpoura/api-event-contract.png)

*Expected capture: send a deterministic API request, verify the response and emitted event against the spec, and attach a pass/fail verdict for the API/event contract.*

## Journey Manifests

Journey manifests should live in `docs/journeys/manifests/` and include:

- FR/NFR IDs and SPEC files covered by the journey;
- control-plane API, orchestrator, compiler, or compliance command used to reproduce the flow;
- deterministic fixture inputs (DAG, artifact, event, or audit payload) required for replay;
- expected screenshots/GIFs/keyframes;
- tests and gates that must pass before the journey is accepted;
- eval verdict schema and pass/fail criteria.

## Autograder Gates

Minimum gates before marking a journey complete:

- API contract tests for the control-plane surface;
- DAG ordering and failure-blocking tests for orchestrator journeys;
- determinism replay and snapshot tests for the artifact compiler;
- compliance/audit fixture tests for treasury/compliance journeys;
- schema diff tests for API/event contract journeys;
- deploy smoke and security gates for infrastructure journeys;
- doc link validation for every referenced rich media asset;
- journey manifest validation via `phenotype-journey verify` when available;
- eval verdict linked to the FR/NFR IDs and SPEC files in the manifest.

## Status

- [x] Identify initial spec-backed flows
- [x] Stub rich media embeds for expected screenshots/GIFs/evals
- [ ] Author manifests in `docs/journeys/manifests/`
- [ ] Record journey captures for each flow
- [ ] Run `phenotype-journey verify` in CI
