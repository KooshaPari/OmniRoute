# vibeproxy-monitoring-unified — Boundary

> Stub boundary file generated on 2026-06-18 by `scripts/render-stubs.py`
> for canonical repos with no curated prompts yet.

## In Scope

- Governance + specification home (`SPEC.md`, `AGENTS.md`, `CLAUDE.md`, `FUNCTIONAL_REQUIREMENTS.md`) for shared VibeProxy monitoring configuration
- Standardized liveness / readiness / startup probe semantics across VibeProxy services
- Prometheus + Grafana surfaces (dashboards, recording rules) for probe latency, availability, error-budget tracking
- Alert definitions: threshold-based, rate-of-change, composite, with escalation policies
- Tooling config: `cliff.toml` (changelog), `mise.toml` (tool versions), `.pre-commit-config.yaml`, `.editorconfig`
- Repo-local worklog surface at `docs/worklogs/worklog.md` for service-specific findings

## Out of Scope

| Not here | Lives in | Reason |
| -------- | -------- | ------ |
| Concrete dashboards / alert rules / Prometheus recording rules (assets) | this-repo (planned, not yet added) | per the README "Future Implementation Targets" section; assets land only after VibeProxy service inventory + ownership are confirmed |
| Example Kubernetes / Docker health-check config | this-repo (planned) | Same gate; under SPEC-driven rollout |
| Per-service runtime configuration | each VibeProxy service repo | Service-local config stays local; this repo owns shared config only |
| Cross-repo worklog aggregation | parent Phenotype governance (worklog-schema circle) | Service findings roll up to the org-level worklog, not the other way around |
| LLM cost / usage tracking | `Tokn` `tokenledger` | Cost tracking is a different domain; monitoring here is service-health, not spend |

## Crossings

| Crossing | Direction | Surface | Status |
| -------- | --------- | ------- | ------ |
| Probe semantics for VibeProxy services | this-repo→VibeProxy service repos | Shared K8s/Docker config | amber — `vibeproxy` exists; other VibeProxy services TBD |
| OpenTelemetry SDK consumption | VibeProxy services → `phenoObservability` | OTel collector | green |
| Worklog rollup | this-repo→parent Phenotype worklog | Markdown | green |
| Rollout governance | this-repo→`phenotype-infra` (planned, per § 6 G19) | ADR | red — `vibeproxy-monitoring-unified` slated for retirement into phenotype-infra |
| Specification source-of-truth | this-repo→`phenotype-registry` registry index | doc link | green |

## Review cadence

Weekly per ADR-024. Refresh by `scripts/render-per-repo.py --force`
once any prompt binds to this repo.

## Source-of-Truth

- ECOSYSTEM_MAP.md § 6 (role classification)
- docs/intent/vibeproxy-monitoring-unified.md (intent statement)
- docs/registries.md (Capability & Intent SSOT layer)
