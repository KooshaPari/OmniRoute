# Journey Traceability

Implements the [phenotype-infra journey-traceability standard](https://github.com/kooshapari/phenotype-infra/blob/main/docs/governance/journey-traceability-standard.md).

## Traceability Model

Every developer-facing or operator-facing flow should be traceable across:

1. **FR/NFR** — requirement ID and user story from `docs/SPEC.md` and `PRD.md`.
2. **Spec** — MCP lifecycle, tool/resource/prompt contract, transport, security, and non-regression constraints.
3. **Docs** — SDK documentation and rich media placeholders.
4. **Code** — registry, generator, binding, client/server primitive, transport, or QA harness implementing the flow.
5. **Tests/Gates** — unit, integration, contract, protocol compliance, lint, and journey verification acting as autograders.
6. **Evidence** — journey manifest, recording/keyframes, and evaluation verdict.

## Developer-Facing Flows

| Flow | Requirement | Implementation surface | Autograder gates | Evidence status |
| --- | --- | --- | --- | --- |
| Registry defines canonical MCP tool/resource/prompt contract | SPEC §2, §3.2-3.4 | `registry.yaml`, schema validation, generated docs | registry schema tests, contract snapshot tests, journey manifest | Stubbed |
| Generate typed SDK bindings from registry | SPEC §2.2, §5 | language generators, Python/Go/TypeScript/Rust bindings | generator fixture tests, cross-language snapshot tests, eval verdict | Stubbed |
| Client invokes server tool with valid request/response schema | SPEC §3.2, §4.4-4.5 | client/server primitives, message layer, transport | protocol compliance tests, client/server integration tests, BDD journey | Stubbed |
| Resource and prompt APIs preserve parity across languages | SPEC §3.3-3.4, §5 | resource/prompt bindings in each SDK | parity tests, fixture roundtrips, journey eval | Stubbed |
| Security checks reject invalid auth/input/sandbox cases | SPEC §7 | auth/authorization layer, validation, sandbox boundaries | security contract tests, fuzz/negative fixtures, gate evidence | Stubbed |
| QA harness proves MCP protocol compliance | SPEC §8 | QA framework, compliance suite, benchmark fixtures | compliance suite, lint/typecheck, performance guardrails | Stubbed |

## Rich Media Stubs

<!-- RICH-MEDIA-STUB type="annotated-screenshot" subject="Registry contract to generated SDK surfaces" journey="registry-to-sdk-surfaces" status="TODO" -->
![McpKit registry to SDK surfaces — registry entry, generated binding, docs, and contract snapshot](../assets/rich-media/mcpkit/registry-to-sdk-surfaces.png)

*Expected capture: select one tool/resource/prompt from `registry.yaml`, show generated SDK surfaces in at least two languages, and annotate the contract snapshot that prevents drift.*

<!-- RICH-MEDIA-STUB type="animated-gif" subject="Client/server tool invocation" journey="client-server-tool-invocation" status="TODO" -->
![McpKit client/server tool invocation — request, validation, server execution, response, and trace](../assets/rich-media/mcpkit/client-server-tool-invocation.gif)

*Expected capture: run a deterministic client/server fixture, invoke a tool, show schema validation, response payload, and trace/audit evidence.*

<!-- RICH-MEDIA-STUB type="journey-eval" subject="Cross-language parity verdict" journey="cross-language-parity" status="TODO" -->
![McpKit cross-language parity verdict — Python, Go, TypeScript, and Rust contract outputs compared](../assets/rich-media/mcpkit/cross-language-parity.png)

*Expected capture: execute equivalent resource/prompt fixtures across bindings and attach a pass/fail verdict showing parity or explicit known gaps.*

<!-- RICH-MEDIA-STUB type="annotated-screenshot" subject="Security rejection evidence" journey="security-negative-fixtures" status="TODO" -->
![McpKit security negative fixtures — invalid auth, invalid input, sandbox rejection, and error codes](../assets/rich-media/mcpkit/security-negative-fixtures.png)

*Expected capture: run negative fixtures for authentication, authorization, input validation, and sandbox boundaries; annotate expected error classes and codes.*

<!-- RICH-MEDIA-STUB type="journey-eval" subject="Protocol compliance suite verdict" journey="protocol-compliance-suite" status="TODO" -->
![McpKit protocol compliance verdict — lifecycle, tools, resources, prompts, notifications, and roots](../assets/rich-media/mcpkit/protocol-compliance-suite.png)

*Expected capture: run the QA compliance suite and attach a verdict covering lifecycle, tool, resource, prompt, notification, and root management behavior.*

## Journey Manifests

Journey manifests should live in `docs/journeys/manifests/` and include:

- SPEC section and FR/NFR IDs covered by the journey;
- registry fixture, generated binding, SDK command, or protocol test entrypoint used to reproduce the flow;
- deterministic request/response fixtures required for replay;
- expected screenshots/GIFs/keyframes;
- tests and gates that must pass before the journey is accepted;
- eval verdict schema and pass/fail criteria.

## Autograder Gates

Minimum gates before marking a journey complete:

- registry schema validation;
- generator fixture and snapshot tests;
- cross-language parity tests for generated bindings;
- MCP client/server protocol compliance tests;
- negative security fixtures for auth, validation, and sandbox cases;
- lint/typecheck gates for each active binding;
- doc link validation for every referenced rich media asset;
- journey manifest validation via `phenotype-journey verify` when available;
- eval verdict linked to the SPEC sections and FR/NFR IDs in the manifest.

## Status

- [x] Identify initial SDK and protocol-compliance flows
- [x] Stub rich media embeds for expected screenshots/GIFs/evals
- [ ] Author manifests in `docs/journeys/manifests/`
- [ ] Record journey captures for each flow
- [ ] Run `phenotype-journey verify` in CI
