# BytePort Absorption Spec — 2026-07-05 05:19Z

**Lane:** L2 (byteport-absorption)
**Author:** root (manager)
**Status:** PROPOSED — sponsor review required before any code lands
**Session plan:** docs/sessions/20260705-0135-execute-absorptions/00_PLAN.md

---

## 1. Vision

**BytePort is a Surface.** A single API + UI for the operator to manage
deployments, identities, compute, storage, network, and observability across
the Phenotype portfolio. It is the public-facing "control panel" the way
AWS Console is for AWS or Vercel Dashboard is for Vercel.

**BytePort is not** a competitor to AWS or a re-implementation of cloud
primitives. It is a _thin_ control plane that fronts whichever host system
is best for the workload: NVMS microVMs for system-level isolation,
PhenoCompose for container workloads, host-bare for metal, plus delegates
to AWS / GCP / Vercel / Supabase / Cloudflare for things that are not
core to our portfolio (object storage at scale, serverless edge, etc.).

**BytePort sits** at the top of the polyrepo portfolio tree. It is both
part of an internal sub-ecosystem (backed by AuthKit, substrate, thegent,
Tracera, PhenoCompose, NVMS) AND the external surface for everything the
Phenotype operator does. It is both contained in the portfolio and a
containment surface for it.

---

## 2. Surface map

| AWS / GCP / Vercel / Supabase surface | BytePort equivalent   | Backing impl                              |
| ------------------------------------- | --------------------- | ----------------------------------------- |
| EC2 / GCE / bare metal                | `bp.compute.instance` | NVMS microVMs OR host-bare                |
| ECS / GKE / Cloud Run                 | `bp.compute.service`  | PhenoCompose containers                   |
| Lambda / Cloud Functions              | `bp.compute.lambda`   | substrate + WASM OR host-bare scripts     |
| S3 / GCS / Supabase Storage           | `bp.storage.object`   | Stashly + (S3/GCS backend)                |
| EBS / Persistent Disk                 | `bp.storage.block`    | NVMS volume OR host-bare LVM              |
| DynamoDB / Firestore                  | `bp.storage.kv`       | substrate-kv OR DataKit                   |
| SQS / Pub-Sub                         | `bp.queue`            | substrate-queue OR Pine events            |
| ALB / NLB                             | `bp.network.l4`       | host-bare haproxy/envoy OR cloud LB       |
| API Gateway / Cloudflare              | `bp.network.l7`       | byteport-transport + WAF                  |
| Route 53 / Cloud DNS                  | `bp.network.dns`      | substrate + provider-aware                |
| CloudWatch / Stackdriver              | `bp.observe.metrics`  | ObservabilityKit (OTel)                   |
| CloudWatch Logs                       | `bp.observe.logs`     | byteport-otel                             |
| X-Ray / Cloud Trace                   | `bp.observe.traces`   | Tracera                                   |
| Cognito / Auth0 / Clerk               | `bp.identity.user`    | AuthKit (auth/session/JWT)                |
| Secrets Manager                       | `bp.identity.secret`  | AuthKit KMS module (PLANNED AUT-SOTA-005) |
| IAM / RBAC                            | `bp.identity.rbac`    | AuthKit + substrate-policy                |
| CloudFormation / Terraform            | `bp.deploy.manifest`  | odin.nvms + bp deploy                     |
| Vercel/Netlify (frontend)             | `bp.deploy.frontend`  | byteport-cli + Vercel/Cloudflare Pages    |
| Vercel/Supabase (data)                | `bp.deploy.data`      | DataKit + Supabase adapter                |

**Pattern:** every BytePort surface has a single canonical API; backing
impls are pluggable via a `provider` field. Default is the Phenotype
in-house impl (NVMS / PhenoCompose / substrate / AuthKit / etc.); user
can override to AWS / GCP / Vercel / Supabase / Cloudflare when needed.

---

## 3. Layered architecture tree

```
BytePort (Surface)
+- api/                       # public REST + gRPC + CLI + dashboard
+- dashboard/                 # operator UI (Tauri + Svelte)
+- control/                   # orchestration, RBAC, billing, audit
|  +- rbac/                   # auth checks per action
|  +- audit/                  # every action -> structured log
|  +- billing/                # cost attribution (optional v2)
+- identity/                  # WHO is doing this
|  +- user/                   # delegates -> AuthKit
|  +- session/                # delegates -> AuthKit session
|  +- secret/                 # delegates -> AuthKit KMS (when AUT-SOTA-005 lands)
|  +- rbac/                   # delegates -> AuthKit + substrate-policy
+- compute/                   # WHERE the workload runs
|  +- microvm/                # delegates -> NVMS
|  +- container/              # delegates -> PhenoCompose
|  +- bare/                   # delegates -> host-bare (metal)
|  +- lambda/                 # delegates -> substrate (WASM)
+- storage/                   # WHAT persists
|  +- object/                 # delegates -> Stashly + S3/GCS plug
|  +- block/                  # delegates -> NVMS volume + host-bare LVM
|  +- kv/                     # delegates -> substrate-kv + DataKit plug
|  +- queue/                  # delegates -> substrate-queue + Pine events plug
+- network/                   # HOW traffic flows
|  +- l4/                     # delegates -> host-bare haproxy/envoy + cloud LB plug
|  +- l7/                     # byteport-transport (in-house)
|  +- waf/                    # byteport-transport (modsec + rate-limit)
|  +- dns/                    # delegates -> substrate + cloud DNS plug
+- observe/                   # WHAT we see
|  +- metrics/                # ObservabilityKit (OTel)
|  +- logs/                   # byteport-otel + structured logger
|  +- traces/                 # Tracera
|  +- rum/                    # real-user monitoring (v2)
+- deploy/                    # HOW it gets there
|  +- manifest/               # odin.nvms parser
|  +- plan/                   # dry-run + diff
|  +- apply/                  # real run + state
|  +- roll/                   # rollbacks + blue/green
+- portfolio/                 # PUBLIC-FACING portfolio surface
|  +- catalog/                # delegates -> phenotype-apps (apps spine)
|  +- site/                   # portfolio pages (SvelteKit)
|  +- ai/                     # LLM-enhanced metadata (pluggable provider)
+- cli/                       # byteport-cli (Tauri sidekick + standalone)
```

**Lifted-from-existing layout (BytePort today):**

- `byteport-cli`, `byteport-dag`, `byteport-otel`, `byteport-registry-adapter`,
  `byteport-transport`, `pheno-dag`, `phenotype-types` are the existing
  Rust crates. They become the `cli/`, `compute/dag` (temp), `observe/logs`,
  `network/l7` adapter, `transport`, `compute/dag`, and shared types.
- `byteport` and `nvms` Go modules in `backend/` are the existing
  backend services. They become `control/` (orchestration + RBAC) and
  `compute/microvm/` respectively.
- `odin.nvms` manifest becomes the `deploy/manifest/` surface.

---

## 4. Absorptions IN

| Capability                          | Source repo                         | Target BytePort module               | Migration path                                    |
| ----------------------------------- | ----------------------------------- | ------------------------------------ | ------------------------------------------------- |
| Auth/session/JWT                    | AuthKit                             | `identity/user`, `identity/session`  | Reuse existing crate; wire into bp.api middleware |
| OIDC + WebAuthn + TOTP + DPoP + KMS | AuthKit (PLANNED AUT-SOTA-001..007) | `identity/*`                         | Reuse as features land                            |
| RBAC policies                       | substrate-policy                    | `identity/rbac`                      | Embed in bp.control                               |
| Audit log                           | substrate-audit                     | `control/audit`                      | Embed in bp.control                               |
| Dispatch / orchestrator             | substrate                           | `control/orchestration`              | Embed in bp.control                               |
| Agent dispatch CLI                  | thegent                             | `cli/thegent-bridge`                 | New module in bp.cli                              |
| Trace spine                         | Tracera                             | `observe/traces`                     | Reuse Tracera SDK; wire OTel export               |
| Container runtime                   | PhenoCompose                        | `compute/container`                  | Reuse PhenoCompose SDK                            |
| MicroVM runtime                     | NVMS                                | `compute/microvm`                    | Reuse NVMS Go module + Rust shim                  |
| Config                              | Configra + Conft                    | `deploy/manifest` (config section)   | Consolidate into odin.nvms                        |
| AI gateway                          | OmniRoute                           | `compute/lambda` (AI inference slot) | Embed as provider via byteport-transport          |
| Events                              | Pine                                | `storage/queue`                      | Reuse Pine as plug                                |
| Helpers                             | Sidekick                            | scattered utilities                  | Re-import as `bp.util`                            |
| OTel                                | ObservabilityKit                    | `observe/metrics`, `observe/logs`    | Reuse                                             |
| Alerting                            | KWatch                              | `observe/alerts` (v2)                | New, gated                                        |
| Data / migrations                   | DataKit                             | `deploy/data`, `storage/block`       | Reuse for state mgmt                              |
| Object storage                      | Stashly                             | `storage/object`                     | Reuse; add cloud plugs                            |
| VCS-aware deploys                   | PhenoVCS                            | `deploy/roll` (v2)                   | Optional v2; n/a v1                               |
| Viz / portfolio                     | MelosViz                            | `portfolio/site` (optional)          | Optional v2                                       |
| Test framework                      | TestingKit                          | `cli/test`                           | New, gated                                        |
| Bench                               | HeliosBench                         | `cli/bench`                          | New, gated                                        |
| Portfolio catalog                   | phenotype-apps                      | `portfolio/catalog`                  | Read-only dependency                              |

**Rule of thumb for what gets absorbed:** if the source repo is a _generic
building block_ (AuthKit, substrate, NVMS, PhenoCompose, ObservabilityKit,
Tracera, DataKit, Stashly, Pine), it gets absorbed as a BytePort module
or a plug. If it is _Phenotype-portfolio-specific_ (phenotype-apps,
MelosViz), it gets _referenced_ not absorbed. If it is a _one-off tool_
(HeliosBench, TestingKit, KWatch), it gets absorbed as a CLI subcommand
under `bp.<verb>`, not a top-level surface.

---

## 5. What stays OUT of BytePort

- **All frontends** (frontend/web, frontend/web/src-tauri). They ARE
  BytePort's frontend; they are not absorbed into another repo.
- **OmniRoute internals.** OmniRoute is an AI inference gateway; BytePort
  fronts it via `compute/lambda` provider. OmniRoute remains its own repo.
- **AgilePlus internals.** AgilePlus is PM/portfolio; BytePort reads from
  `phenotype-apps` catalog; doesn't import AgilePlus code.
- **AuthKit internals** (the crate itself). BytePort uses AuthKit as a
  library; doesn't copy code.
- **Anything portfolio-specific** (phenotype-org-audits, melosviz, etc.).
  BytePort references these as data sources, not as code deps.

---

## 6. Phased plan (8 phases)

### Phase 1 — Foundation + byteport-cli unification (4 weeks)

- **Scope:** consolidate `byteport-cli` and `byteport-dag` into a single
  CLI crate; add `bp deploy` and `bp status`; wire AuthKit middleware.
- **Deliverables:** single `byteport-cli` crate (≤2k lines, split into
  submodules), AuthKit middleware in `bp.api`, odin.nvms parser v1.
- **Exit criteria:** `bp deploy` works against a local NVMS for a
  hello-world odin.nvms; CI green; coverage ≥85%.
- **Risks:** byteport-cli + byteport-dag consolidation may surface dead
  code paths; ship small, no compat shims.

### Phase 2 — Identity plane (3 weeks)

- **Scope:** wire AuthKit fully into `bp.identity.*`. Add `bp iam`
  subcommand (list/create/delete users, rotate keys).
- **Deliverables:** `bp.identity.user`, `bp.identity.session`,
  `bp.identity.secret` modules; `bp iam` CLI; integration tests with
  AuthKit test harness.
- **Exit criteria:** end-to-end test: create user, grant role, login,
  call `bp deploy` — passes; session token is AuthKit-issued.
- **Risks:** depends on AuthKit's AUT-SOTA-002/005/006 landing. Pin to
  the version that ships them; if not shipped, gate.

### Phase 3 — Compute plane (5 weeks)

- **Scope:** `bp.compute.microvm` (NVMS), `bp.compute.container`
  (PhenoCompose), `bp.compute.bare` (metal). Pluggable.
- **Deliverables:** three compute modules + `bp compute ls/up/destroy`
  CLI; integration with odin.nvms `compute:` block.
- **Exit criteria:** `bp compute up --image nginx --provider nvms` works;
  same command with `--provider pheno-compose` works; bare path is
  manual/host-driven (no test required).
- **Risks:** PhenoCompose 55/100 maturity, NVMS 52/100 maturity (R-A from
  prior session). Phase 3 cannot be unblocked by root; flag for
  PhenoCompose/NVMS teams.

### Phase 4 — Storage plane (3 weeks)

- **Scope:** `bp.storage.object` (Stashly + S3 plug), `bp.storage.kv`
  (DataKit + Dynamo plug), `bp.storage.queue` (substrate + SQS plug).
- **Deliverables:** three storage modules + `bp storage ls/get/put` CLI.
- **Exit criteria:** round-trip: write an object, read it back, across
  two providers.
- **Risks:** plug maturity varies; keep default = in-house; cloud plugs
  in v1.5.

### Phase 5 — Network plane (4 weeks)

- **Scope:** `bp.network.l4` (envoy + cloud LB), `bp.network.l7`
  (byteport-transport), `bp.network.dns` (substrate + cloud DNS).
- **Deliverables:** three network modules; TLS termination; WAF rules
  via byteport-transport; `bp net ls/route` CLI.
- **Exit criteria:** end-to-end test: deploy a service, expose it via
  `bp net route`, hit it from outside; 200 OK; WAF blocks bad input.
- **Risks:** L7 deep stack; phase this with byteport-transport maintainer.

### Phase 6 — Observe plane (3 weeks)

- **Scope:** `bp.observe.metrics` (OTel via ObservabilityKit),
  `bp.observe.logs` (structured + byteport-otel),
  `bp.observe.traces` (Tracera SDK).
- **Deliverables:** three observe modules; `bp observe tail/metrics/trace`
  CLI; default dashboard panel.
- **Exit criteria:** every `bp deploy` emits a deploy span, metric, and
  log; dashboard shows it.
- **Risks:** OTel SDK version pinning; trace context propagation across
  compute providers.

### Phase 7 — Deploy + portfolio (4 weeks)

- **Scope:** `bp.deploy.manifest` (odin.nvms), `bp.deploy.plan` (dry-run),
  `bp.deploy.apply`, `bp.deploy.roll`; `bp.portfolio.catalog` (read from
  phenotype-apps), `bp.portfolio.site`, `bp.portfolio.ai`.
- **Deliverables:** deploy pipeline; portfolio site auto-generates
  entries; LLM metadata (pluggable provider).
- **Exit criteria:** a deployed project shows up on the portfolio site
  with LLM-generated description; rollback works.
- **Risks:** LLM provider lock-in (Tenet 5 says pluggable; keep it that
  way); portfolio site may not need BytePort at all (it might be
  better as a separate site repo).

### Phase 8 — Polish + public preview (2 weeks)

- **Scope:** operator UX pass, docs, examples, community feedback.
- **Deliverables:** docs site (byteport.dev), 10+ example projects,
  `bp init` wizard, public preview.
- **Exit criteria:** 3+ early adopters use it without filing bugs.
- **Risks:** scope creep; ship small and iterate.

**Total:** ~28 weeks (7 months) for v1.0 from clean slate.

---

## 7. Open questions for sponsor

1. **Surface + identity vs Surface only.** The framing in this turn
   (D5) is "BOTH but after absorptions done." Confirm: BytePort Phase 2
   (identity) is in scope for v1.0, or pushed to v1.5.
2. **Compute delegation strategy.** If PhenoCompose and NVMS stay
   below BytePort, who owns the SDK contract? Recommendation: BytePort
   team defines the trait; PhenoCompose and NVMS teams implement it.
3. **Cloud plugs (AWS/GCP/Vercel/Supabase) in v1 or v1.5?** v1.5
   recommendation keeps scope small.
4. **Portfolio site as separate repo or embedded in BytePort?**
   Recommendation: separate repo (`byteport-portfolio-site`) to keep
   `frontend/web/src-tauri` and `frontend/web` as the only BytePort UI.
5. **CLI distribution.** `byteport-cli` as a single binary? Tauri
   sidekick? Both? Recommendation: both, with the Tauri sidekick as a
   thin wrapper that calls `byteport-cli`.
6. **Backwards compat with existing byteport Go services.** Phase 1
   keeps the Go services running alongside Rust; Phase 3+ replaces
   them. Aggressive change policy says NO compat shims. Confirm: full
   cutover in Phase 3, no shims.
7. **License.** BytePort's current `Cargo.toml` says BSL. Recommendation:
   keep BSL for v1.0; re-evaluate at v1.5.

---

## 8. ADR-style decision log

| #     | Decision                                                                               | Rationale                                                          | Status   |
| ----- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | -------- |
| AD-1  | BytePort is a Surface, not a re-impl of cloud primitives                               | It is the operator's control panel for the Phenotype portfolio     | proposed |
| AD-2  | Back every surface with a pluggable provider (NVMS / PhenoCompose / substrate / cloud) | Operator can pick the right tool; default = in-house               | proposed |
| AD-3  | AuthKit is THE identity plane (no Authvault-style alternatives)                        | D1 already settled this; consistency                               | proposed |
| AD-4  | substrate is THE control plane (dispatch + RBAC + audit)                               | Already built; reuse                                               | proposed |
| AD-5  | Tracera is THE trace plane                                                             | Tracera spec-008 in flight; reuse                                  | proposed |
| AD-6  | ObservabilityKit is THE OTel plane                                                     | OTel is the API surface; ObservabilityKit is the Phenotype wrapper | proposed |
| AD-7  | Frontend stays in BytePort repo (Tauri + Svelte)                                       | No benefit to splitting                                            | proposed |
| AD-8  | Portfolio site is a separate repo                                                      | Different lifecycle; can ship without BytePort                     | proposed |
| AD-9  | Phased 8-phase plan, 28 weeks, Gantt-style                                             | Predictable; can pause between phases                              | proposed |
| AD-10 | License stays BSL for v1.0                                                             | Matches Phenotype portfolio default; review at v1.5                | proposed |

---

## 9. Out of this spec (deferred)

- Detailed API contract (OpenAPI 3.1) — produced in Phase 1.
- Detailed CLI spec (man pages) — produced in Phase 1.
- Operator personas + journey maps — produced in Phase 1 (refine USER_JOURNEYS.md).
- Migration guide for existing byteport users — produced at v1.0.
- Public website + docs site — produced in Phase 8.

---

**End of spec.** Awaiting sponsor sign-off on AD-1..10 and open questions
1-7 before any code change. Recommended review window: 24h.
