# ADR-023: SDK Consolidation Decision

**Status:** Accepted (proposed 2026-06-25)
**Deciders:** forge session (issue triage for [#134](https://github.com/KooshaPari/phenotype-registry/issues/134) + [#135](https://github.com/KooshaPari/phenotype-registry/issues/135))
**Refs:** [ADR-ECO-017](./ADR-ECO-017-substrate-schema-conventions.md)
(substrate schema conventions — `tier: phenotype-sdk` + `tier: federated-service`
definitions), [ADR-ECO-007-gateway-merge-superset](./ADR-ECO-007-gateway-merge-superset.md)
(PhenoFastMCP + PhenoMCPServers ownership), monorepo ADR-008
("dispatch-mcp as sole MCP server" — the historic decision being
qualified here), monorepo ADR-013 (substrate model), monorepo ADR-014
(hexagonal L4 ports + adapters), [DOMAIN_ROLES.md](../DOMAIN_ROLES.md)
(`connect` role owner set), `registry/domain-roles.json` v1.2.0
(`connect` + `mcp-servers` + `mcp-framework` domain entries),
[ADR-ECO-022](./ADR-ECO-022-compute-infra-subtree-registry-correction.md)
(ECOSYSTEM_MAP registry-correction precedent for amending an older
decision with a clarified scope).

## Context

The Phenotype fleet has three artefacts that **all touch the MCP
surface** but historically did not have a clear, machine-checked
boundary between them:

| Artefact | Repo | Role per DOMAIN_ROLES.md | What it owns |
|---|---|---|---|
| Phenotype Python SDK | `KooshaPari/phenotype-python-sdk` | `py-sdk-index` (`phenotype-python-sdk`) | Typed **client libraries** for the Phenotype compute mesh — OCI/GCP/AWS, Tailscale mesh, OTel observability. Consumed by Pyron, DevHex tests, and downstream agents. |
| Phenotype Go SDK | `KooshaPari/phenotype-go-sdk` | `platform` (`phenotype-go-sdk`) | Typed **client libraries** for the Go side of the fleet (DevHex, devenv-abstraction, MCP HTTP/SSE edges per `connect` role). |
| PhenoMCPServers | `KooshaPari/PhenoMCPServers` | `connect` `also:` + `mcp-servers` (canonical domain entry) | **Catalog SSOT for deployable MCP servers** — defines *what endpoints exist* and *what their schema is*. |
| PhenoFastMCP (`*` repos) | `KooshaPari/PhenoFastMCP`, `KooshaPari/PhenoFastMCP-rust` | `connect` `also:` + `mcp-framework` | **MCP framework substrate** (Python + Rust implementations). Builds servers and clients on top of the wire protocol. |
| substrate | `KooshaPari/substrate` | `connect` (core `repo`) | Runtime substrate (`engine-agentapi`, MCP dispatch runtime absorbed from `cheap-llm-mcp`, `dispatch-mcp`, `thegent-dispatch` per ADR-019). |
| dispatch-mcp | `KooshaPari/dispatch-mcp` | (now archived; absorbed into `substrate` per ADR-019) | A **specific MCP server** — the dispatch routing layer. Was historically described as "Sole MCP server per ADR-008." |

Two issues were opened against this registry that need a canonical
answer:

### Issue [#134](https://github.com/KooshaPari/phenotype-registry/issues/134) — dispatch-mcp ADR-008 claim vs PhenoMCPServers catalog SSOT

`KooshaPari/dispatch-mcp`'s README/description historically claimed
**"Phenotype dispatch MCP — provider routing & cost tracking. Sole
MCP server per ADR-008."** This appears to conflict with the
catalog-SSOT claim of `KooshaPari/PhenoMCPServers` (per ADR-017 +
ADR-ECO-007). After 2026-06-17 the dispatch runtime itself was
absorbed into `substrate` (ADR-019); the `dispatch-mcp` repository
became a documentation shim rather than a runtime. The ADR-008
historical consolidation decision is from the pre-PhenoMCPServers
era, and its "sole MCP server" wording is now an over-broad claim.

### Issue [#135](https://github.com/KooshaPari/phenotype-registry/issues/135) — phenotype-python-sdk + phenotype-go-sdk overlap with PhenoMCPServers

Both SDKs claim to **consolidate McpKit** (the MCP framework SDK that
was archived 2026-06-17). PhenoMCPServers also holds MCP server
implementations. The relationship between "SDK that *consumes* MCP
servers" and "catalog that *lists* MCP servers" needs to be
formalized — currently it lives only in prose in
`DOMAIN_ROLES.md` §"connect" + §"Anti-patterns" and is not enforced
by `scripts/validate-catalog.py`.

## Decision

1. **PhenoMCPServers is the SSOT for the MCP server catalog** — it
   defines *what* MCP servers exist, *what their schemas are*, and
   *what their lifecycle status is*. This is the **WHAT** layer.

2. **phenotype-python-sdk and phenotype-go-sdk are CLIENT LIBRARIES**
   that consume the PhenoMCPServers catalog at build time to generate
   typed clients. This is the **HOW** layer.

3. **PhenoFastMCP (`*` repos) is the MCP FRAMEWORK** — the runnable
   framework substrate that both PhenoMCPServers (server-side) and
   the SDKs (client-side) build on. This is the **WITH-WHAT** layer.

4. **substrate is the RUNTIME** — the long-running executable that
   hosts the MCP dispatch runtime (absorbed from `dispatch-mcp`,
   `cheap-llm-mcp`, `thegent-dispatch` per ADR-019).

5. **dispatch-mcp is one specific MCP server** (now a thin runtime
   shim over `substrate`'s `engine-dispatch`). ADR-008's claim that
   `dispatch-mcp` was "the sole MCP server" is hereby **qualified**:
   `dispatch-mcp` was the **canonical orchestrator for the dispatch
   domain** at the time ADR-008 was written, but it was never the
   registry of record for all MCP servers — that role belongs to
   PhenoMCPServers.

The four artefacts are therefore **complementary, not competing**.
Each owns one layer of the stack:

```
┌─────────────────────────────────────────────────────────────────┐
│  WHAT  │  PhenoMCPServers       (catalog SSOT — server schemas) │
├─────────────────────────────────────────────────────────────────┤
│  HOW   │  phenotype-python-sdk  (typed Python clients)           │
│        │  phenotype-go-sdk      (typed Go clients)               │
├─────────────────────────────────────────────────────────────────┤
│  WITH  │  PhenoFastMCP          (framework substrate, py+rust)   │
│        │  PhenoFastMCP-rust                                          │
├─────────────────────────────────────────────────────────────────┤
│  RUN   │  substrate             (runtime — dispatch engine, etc) │
│        │  └─ engine-dispatch (ex dispatch-mcp runtime per ADR-019) │
└─────────────────────────────────────────────────────────────────┘
```

### What changes in `registry/domain-roles.json`

The `connect` domain entry already lists
`["PhenoFastMCP", "PhenoMCPServers", "Authvault"]` as `also:` — this
ADR ratifies that and adds the explicit cross-references below:

- `connect` role owns: MCP wire, auth, identity, **and the catalog**
- `mcp-servers` (`PhenoMCPServers`) is the **registry of record**
- `mcp-framework` (`PhenoFastMCP`) is the **framework substrate**
- `py-sdk-index` (`phenotype-python-sdk`) is the **typed client
  facade for Python**
- `platform` (`phenotype-go-sdk`) is the **typed client facade for
  Go**

### What changes in ADR-008's wording

ADR-008 (historical, in `docs/monorepo-state/docs/adr/`) said
"dispatch-mcp as sole MCP server." Going forward that wording is
amended to:

> **ADR-008 (amended 2026-06-25 by ADR-023):** `dispatch-mcp` is the
> canonical orchestrator for the **dispatch domain** (provider
> routing & cost tracking). It is **not** the registry of record
> for all MCP servers — that role belongs to `PhenoMCPServers` per
> ADR-017 + ADR-ECO-007.

### New MCP server onboarding rule (codified)

1. **First** — register the new server in
   `KooshaPari/PhenoMCPServers/catalog.json` with full schema,
   lifecycle status, and cross-refs to its framework substrate
   (PhenoFastMCP) and runtime substrate (substrate / dispatch-mcp).
2. **Then** — the `pheno-dag` engine (PR [#370](https://github.com/KooshaPari/phenotype-registry/pull/370))
   auto-emits a typed client stub into **both**
   `phenotype-python-sdk` and `phenotype-go-sdk` from the catalog
   entry. No hand-written SDK wrappers.
3. **Then** — `scripts/validate-catalog.py` (per ADR-ECO-017) checks
   that the catalog entry's `tier`, `role`, and `boundary` fields
   match the SDK's generated wrapper.
4. **Never** — add an MCP server definition to a SDK directly
   bypassing the catalog. This is the "shadow SDK definition"
   anti-pattern ADR-023 explicitly forbids.

## Rationale

- **Honour existing decisions** — ADR-017 already named
  PhenoMCPServers the MCP catalog, ADR-ECO-007 already listed
  PhenoFastMCP + PhenoMCPServers as `connect`-role owners, and
  ADR-019 already absorbed the dispatch runtime into substrate. ADR-023
  is the consolidation that ties those threads together.
- **One SSOT, three derived layers** — the catalogue/clients/framework
  /runtime split is exactly how ADR-013 (substrate model) +
  ADR-017 (substrate schema) already organise the rest of the fleet
  (e.g. `Configra` is the SSOT for config; `phenotype-config` Py edge
  is the typed client; `pheno-config`/`settly` are the underlying
  libraries; `phenotype-config-loader` is the runtime loader).
  Applying the same model to the MCP surface eliminates the
  "where does this server live?" question permanently.
- **Machines can check it** — `scripts/validate-catalog.py` already
  enforces `tier` ∈ `{pheno-lib, phenotype-sdk, phenotype-framework,
  federated-service}` and `role` ∈ DOMAIN_ROLES.md. The SDK↔catalog
  consistency check from Decision §4 step 3 is a small extension to
  that validator (one new rule).
- **Closes both issues with one decision** — the two open issues
  are not independent; they are two facets of the same missing
  boundary document. ADR-023 provides it.

## Consequences

### Positive

- PhenoMCPServers becomes the **registry of record** for new MCP
  server additions. No more "where do I add a new server?" tickets.
- `phenotype-python-sdk` and `phenotype-go-sdk` consume
  `PhenoMCPServers/catalog.json` at build time → typed clients are
  auto-emitted. Reduces hand-written SDK surface area; eliminates
  drift between SDK wrappers and the actual server schema.
- `pheno-dag` (PR [#370](https://github.com/KooshaPari/phenotype-registry/pull/370))
  gets a concrete consumer: codegen from catalog to SDK. This was
  its missing first use case.
- The auditor fleet (PR [#366](https://github.com/KooshaPari/phenotype-registry/pull/366))
  gets a new audit to add: "every `tools/mcp/` entry must appear in
  `PhenoMCPServers/catalog.json`" (and vice-versa: every catalog
  entry with `lifecycle: active` must have at least one SDK
  consumer).
- ADR-008's historical claim is qualified in-place (no rewrite
  needed — additive amendment) so old work citing ADR-008 still
  resolves correctly.

### Negative / costs

- **Codegen pipeline must be built** — `pheno-dag` does not yet
  emit SDK stubs from catalog entries. This is a concrete work item
  (T-SDK-CG-1) tracked under PR #370's roadmap.
- **Catalog must be machine-readable** — `PhenoMCPServers/catalog.json`
  needs a stable schema. Today it is partly hand-maintained. A
  schema + validator will need to land (T-CAT-SCHEMA-1).
- **Historical SDK wrappers need reconciliation** — a sweep to
  identify SDK modules that *only* exist because someone bypassed
  the catalog. Expected to be small (T-SDK-SWEEP-1) but real.

### Required follow-up PRs

| Work item | Description | Owner |
|---|---|---|
| `T-CAT-SCHEMA-1` | Add `PhenoMCPServers/catalog.schema.json` + validator | PhenoMCPServers repo |
| `T-SDK-CG-1` | `pheno-dag` codegen: catalog → Python + Go client stubs | phenotype-registry |
| `T-SDK-SWEEP-1` | Sweep SDKs for shadow definitions; route through catalog | phenotype-python-sdk + phenotype-go-sdk |
| `T-AUD-MCP-1` | Auditor-fleet rule: catalog↔SDK consistency (extend PR #366) | phenotype-registry |
| `T-DISPATCH-README-1` | Update `KooshaPari/dispatch-mcp` README to reflect the ADR-023 amended scope (delete "sole MCP server" wording) | dispatch-mcp repo |

## Alternatives considered

- **A: Merge phenotype-python-sdk + phenotype-go-sdk into
  PhenoMCPServers** — would conflate the WHAT (catalog) and HOW
  (client facade) layers. Rejected: ADR-013 already split substrate
  responsibilities this way for config and we want consistency.
- **B: Make phenotype-python-sdk the catalog SSOT and absorb
  PhenoMCPServers into it** — wrong direction. The catalog lives at
  the server-implementation level; SDKs are downstream consumers.
  PhenoMCPServers predates the SDK consolidation moves and is the
  natural authority.
- **C: Keep ADR-008's "sole MCP server" claim and add an exception
  clause for PhenoMCPServers** — fragile. ADR-023 instead *qualifies*
  ADR-008 with a clear scope, which is more durable than carving
  exceptions.
- **D: Do nothing — leave the two issues open** — issues #134 and
  #135 would remain as persistent drift sources. The auditor fleet
  (PR #366) would also have no rule to enforce this. Rejected.

## Related

- **Closes** [#134](https://github.com/KooshaPari/phenotype-registry/issues/134) —
  dispatch-mcp ADR-008 claim vs PhenoMCPServers catalog SSOT
  reconciliation
- **Closes** [#135](https://github.com/KooshaPari/phenotype-registry/issues/135) —
  phenotype-python-sdk + phenotype-go-sdk vs PhenoMCPServers
  consolidation
- **Builds on** [#370](https://github.com/KooshaPari/phenotype-registry/pull/370) —
  `pheno-dag` execution engine (provides the codegen substrate)
- **Builds on** [#366](https://github.com/KooshaPari/phenotype-registry/pull/366) —
  continuous auditor fleet (will gain the catalog↔SDK consistency
  rule `T-AUD-MCP-1`)
- **Amends** monorepo ADR-008 ("dispatch-mcp as sole MCP server")
  with the scope qualification above
- **Aligns with** [ADR-ECO-017](./ADR-ECO-017-substrate-schema-conventions.md) —
  `tier: phenotype-sdk` (SDKs) + `tier: federated-service`
  (PhenoMCPServers)
- **Aligns with** [ADR-ECO-007-gateway-merge-superset](./ADR-ECO-007-gateway-merge-superset.md) —
  PhenoFastMCP + PhenoMCPServers as `connect`-role `also:` owners
- **Aligns with** [ADR-ECO-019](./ADR-ECO-019-nanovms-sandbox-hardening.md)
  — substrate absorbed the dispatch runtime; ADR-023 makes the SDK
  + catalog side of that absorption coherent