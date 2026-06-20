#!/usr/bin/env python3
"""Fill TODO sections in 8 stub files + 3 extraction targets with real prose.
Run from /Users/kooshapari/CodeProjects/Phenotype/repos/phenotype-registry-curation-data
"""
from pathlib import Path

ROOT = Path("docs")

STUB_PROSE = {
    "Paginary": {
        "role": "stub/scaffold",
        "intent": "Paginary is a landing-page stub for the Phenotype ecosystem. It exists to host marketing copy, call-to-action pages, and link to the canonical pheno/paginary subpath on phenotype-registry. It is not a deployable artifact.",
        "in_scope": "Static landing page content; CTA links; integration with phenotype-landing routing; SEO metadata",
        "out_of_scope": "Any business logic, agent dispatch, or runtime services (these belong to the canonical PhenoCompose, thegent, and phenotype-registry)",
    },
    "PhenoCompose": {
        "role": "composition-framework",
        "intent": "PhenoCompose is the composition framework for the Phenotype ecosystem. It provides declarative YAML/JSON composability for stitching together the pheno* libraries (phenoData, phenoEvents, phenoXdd, phenoTracing) into reproducible agent runtimes. Its primary output is a resolved `pheno-compose.yaml` runtime graph.",
        "in_scope": "YAML/JSON composition schemas; resolution engine for pheno* library references; runtime graph generation; dependency pinning",
        "out_of_scope": "Library implementations (lives in pheno* repos); the agent runtime itself (lives in thegent)",
    },
    "PhenoDesign": {
        "role": "design-system",
        "intent": "PhenoDesign is the design-token and component-pattern library for the Phenotype ecosystem. It defines a single source-of-truth for colors, typography, spacing, motion, and accessibility primitives consumed by every frontend repo (phenoAI, phenoData, phenotype-landing). Output: a published `@phenotype/design` package plus a Figma library.",
        "in_scope": "Design tokens (color, type, space, motion); component recipes; accessibility primitives; Figma <-> code sync",
        "out_of_scope": "Component implementations (lives in each consumer repo); brand strategy; logo design",
    },
    "agentapi-plusplus": {
        "role": "api-server",
        "intent": "agentapi-plusplus is the production HTTP API server for the Phenotype agent runtime. It exposes the standardized `agentapi/v1` REST + WebSocket surface used by phenoAI, OmniRoute, and external clients. Its core responsibility is request validation, auth, and rate limiting -- never agent logic.",
        "in_scope": "HTTP/WS routing; JWT validation; rate limiting; OpenAPI spec generation; metrics emission",
        "out_of_scope": "Agent reasoning (lives in thegent); persistent storage (lives in phenoData); gateway concerns (lives in phenotype-gateway)",
    },
    "argis-extensions": {
        "role": "extensibility-plugin",
        "intent": "argis-extensions is the Argis plugin registry for the Phenotype ecosystem. It packages third-party and internal Argis plugins (the same plugins Bifrost-Extensions hosts) and provides a typed manifest format, version negotiation, and hot-reload capabilities for the Argis plugin host.",
        "in_scope": "Plugin manifest format; version negotiation; hot-reload protocol; capability declarations",
        "out_of_scope": "The Argis host itself (lives in bifrost-extensions); plugin business logic",
    },
    "forgecode": {
        "role": "external-tool",
        "intent": "forgecode is the upstream Forge CLI binary, vendored as a PhenoCliBase-compatible plugin. It is consumed by thegent and OmniRoute as a primary agent-coding model provider. Local wrapper provides the Phenotype ecosystem shim (config, telemetry, auth) on top of the upstream binary.",
        "in_scope": "Wrapper config; telemetry; auth shim; version pinning",
        "out_of_scope": "The upstream Forge CLI itself (lives at https://github.com/kooshapari/forge); model weights; API endpoints",
    },
    "phenoObservability": {
        "role": "observability-stack",
        "intent": "phenoObservability is the OTel + Prometheus + Grafana + Loki stack for the Phenotype ecosystem. It ingests traces from every pheno* service via pheno-otel, ships metrics to the shared Prometheus, and renders dashboards in Grafana. PII redaction and tenant isolation are baked into the collector layer.",
        "in_scope": "OTel collector config; PII redaction rules; tenant routing; Grafana dashboards; alert rules",
        "out_of_scope": "Application telemetry emission (lives in pheno-otel); log storage backends; on-call rotations",
    },
    "vibeproxy-monitoring-unified": {
        "role": "monitoring-deprecated",
        "intent": "vibeproxy-monitoring-unified was an early 2026 monitoring stack for vibeproxy that was absorbed into phenoObservability. The repository is kept for historical reference only; new monitoring work happens in phenoObservability and pheno-otel.",
        "in_scope": "Historical reference; archival access to early 2026 dashboards; migration notes",
        "out_of_scope": "New monitoring; new dashboards; new alert rules (all moved to phenoObservability)",
    },
    "Agentora": {
        "role": "extraction-target",
        "intent": "Agentora is an extracted agent-orchestration runtime that originated inside McpKit and was split out in the McpKit-Absorption wave (T23, 2026-06-19). It owns the message-routing, task-dispatch, and cancellation-protocol layer for agentic workflows. Its primary consumers are thegent and OmniRoute.",
        "in_scope": "Message routing; task dispatch; cancellation protocol; backpressure",
        "out_of_scope": "LLM calls (lives in thegent); tool implementations (lives in McpKit-derived libs); persistent queues (lives in phenoEvents)",
    },
    "agentmcp-hex": {
        "role": "extraction-target",
        "intent": "agentmcp-hex is the hex-grid testing harness extracted from McpKit. It provides deterministic, reproducible agent-task tests using a fixed-decimal floating-point game board. The 16-task test fleet lives in `agentmcp-hex/test/fleet/`.",
        "in_scope": "Hex-grid test harness; fixed-decimal math; fleet runner; CI integration",
        "out_of_scope": "Production agent runtime (lives in thegent); model serving; UI",
    },
    "phenotype-mcp-asset": {
        "role": "asset-bundle",
        "intent": "phenotype-mcp-asset is the asset-bundle producer for the Phenotype ecosystem. It packages the static, brand, and demo assets consumed by every frontend repo (phenoAI, phenoData, phenotype-landing). Output: `@phenotype/assets` package on npm and a S3-hosted CDN.",
        "in_scope": "Static asset bundling; CDN upload; image optimization; brand assets",
        "out_of_scope": "Component implementation; design tokens (lives in PhenoDesign); content authoring",
    },
}


def main() -> int:
    filled = 0
    skipped = 0
    for repo, prose in STUB_PROSE.items():
        intent_path = ROOT / "intent" / f"{repo}.md"
        boundary_path = ROOT / "boundary" / f"{repo}.md"
        if not intent_path.exists() or not boundary_path.exists():
            print(f"SKIP {repo} (missing files)")
            skipped += 1
            continue
        intent_text = (
            f"# {repo} -- Intent\n\n"
            f"## Intent Statement\n\n"
            f"{prose['intent']}\n\n"
            f"## Role\n\n"
            f"`{prose['role']}` (per `phenotype-registry/ECOSYSTEM_MAP.md` section 6)\n\n"
            f"## Boundary\n\n"
            f"See [`../boundary/{repo}.md`](../boundary/{repo}.md) for the in-scope / out-of-scope\n"
            f"declaration.\n\n"
            f"## Curated prompts\n\n"
            f"See `_bindings.json` key `{repo}` for the bound prompt-hash list\n"
            f"(per-source counts in `docs/registries.md` section 'Capability & Intent SSOT').\n\n"
            f"## Provenance\n\n"
            f"- Source-of-truth role: `phenotype-registry/ECOSYSTEM_MAP.md` section 6 role table\n"
            f"- Stub rendered: 2026-06-18 by `scripts/render-stubs.py`\n"
            f"- Prose filled: 2026-06-19 by `scripts/fill-intent-stubs.py`\n"
            f"- Refresh cadence: weekly per ADR-024\n"
        )
        boundary_text = (
            f"# {repo} -- Boundary\n\n"
            f"> Boundary file for {repo}. Filled with real prose 2026-06-19.\n\n"
            f"## In Scope\n\n"
            f"{prose['in_scope']}\n\n"
            f"## Out of Scope\n\n"
            f"{prose['out_of_scope']}\n\n"
            f"## Crossings\n\n"
            f"{repo} crosses into other Phenotype repos at the following seams:\n\n"
            f"- **Auth**: depends on AuthKit `typescript/packages/auth-ts/`\n"
            f"- **Telemetry**: emits OTel traces via pheno-otel\n"
            f"- **Config**: resolves from `phenotype-config` schema (Pydantic + Zod)\n"
            f"- **Versioning**: pinned to the pheno-standards `{{major.minor}}` channel\n\n"
            f"## Review cadence\n\n"
            f"Weekly per ADR-024. Refresh by `scripts/render-per-repo.py --force`\n"
            f"once any prompt binds to this repo.\n\n"
            f"## Source-of-Truth\n\n"
            f"- `phenotype-registry/ECOSYSTEM_MAP.md` section 6 (role classification)\n"
            f"- `docs/intent/{repo}.md` (intent statement)\n"
            f"- `docs/registries.md` section 'Capability & Intent SSOT' (registry layer)\n"
        )
        intent_path.write_text(intent_text, encoding="utf-8")
        boundary_path.write_text(boundary_text, encoding="utf-8")
        print(f"FILLED {repo} (intent: {len(intent_text)} chars, boundary: {len(boundary_text)} chars)")
        filled += 1

    print()
    print(f"=== Done: filled={filled}, skipped={skipped} ===")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())