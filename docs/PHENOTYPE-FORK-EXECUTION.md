# Phenotype Fork Execution Contract

Status: proposed in a draft pull request. This document is a reproducibility contract, not evidence that any gate has passed.

## 1. Exact-head anchor

Every audit, benchmark, migration, screenshot run, release candidate, and deployment candidate MUST name the exact commit SHA and repository. The current planning anchor is:

- repository: `KooshaPari/OmniRoute`
- branch: `main`
- commit: `92fafe865c5291aae2c17c1b9c88fc0a6a47407f`
- tree: `d5aaac1605115320bd873e3394b7401f1d9184d5`
- commit subject: `fix(ci): correct aggregate workflow references (#489)`

Before any work begins, record the resolved ref, tree SHA, worktree status, tool versions, lockfile names and hashes, and relevant environment identifiers. A result from another commit, branch, archive, or stale artifact is historical evidence only and MUST NOT be reported as current-main evidence.

## 2. Migration order: TypeScript, then Bun

Migration work is staged and isolated from `main`.

1. Reproduce a TypeScript 7 shadow baseline from the exact anchor. Record compiler diagnostics, declaration/build output, test results, package-manager install result, lockfile state, and provenance.
2. Review and fix TS7 findings in small, independently testable changes. Preserve the pre-migration baseline and compare diagnostics before/after.
3. Do not begin Bun migration until the TS7 baseline and its required quality/security gates are green.
4. Recreate Bun support from the resulting TS7 state. Verify frozen install/lockfile parity, scripts, test execution, runtime startup, and representative provider requests under Bun.
5. Compare Node and Bun behavior for persistence, concurrency, retries, timeouts, tool calls, and error serialization. Any unexplained difference is a NO-GO.
6. Candidate integration requires a draft PR, exact-head comparison, reproducible commands, and green required checks. Divergent release-history branches are rebuild/defer candidates, not bulk-merge sources.

## 3. Verified identity and capability SSOT

The fork identity and provider capability model MUST have one canonical, versioned source of truth. It MUST include:

- repository/owner and fork lineage;
- release channel and support level;
- source commit and build timestamp;
- schema version and validator version;
- provider, model, service-kind, auth, streaming/tool-call, and availability capabilities;
- explicit unknown/unsupported values.

A validator MUST reject malformed, stale, contradictory, unsigned-or-unproven, or schema-incompatible identity/capability data. Runtime readers and generated documentation MUST consume the validated SSOT rather than duplicate hand-maintained claims. CI MUST publish the exact input, validator version, result, and artifact hash.

## 4. Deterministic Phenotype journeys

Each journey MUST declare a stable identifier, preconditions, exact source SHA, dependency/runtime versions, configuration and secret names (never secret values), input fixture hash, expected assertions, timeout policy, and cleanup behavior. The canonical set should cover:

- provider/model discovery and capability reporting;
- a representative text request;
- streaming and cancellation;
- tool-call request/response;
- retry/fallback and failure classification;
- persistence/restart behavior.

A journey is reproducible only when a second run from the same anchor produces the same protocol-level assertions or records an explained, bounded variance. Placeholder flows are not passing journeys.

## 5. Screenshot and media provenance

Screenshots are test artifacts, not decoration. For every image record:

- journey ID and step;
- exact commit SHA and tree SHA;
- browser/driver/version, viewport, OS, locale, and timezone;
- input fixture/config hash;
- capture timestamp;
- image format, dimensions, and SHA-256;
- redaction policy and verifier result.

Store a manifest beside the images. A screenshot without this sidecar, or a screenshot whose source/runtime cannot be reconstructed, is an unverified artifact and MUST NOT be used as release evidence.

## 6. CI, security, and release gates

The release gate is fail-closed. Required evidence is head-specific and includes:

- install with the declared lockfile and supported Node/Bun versions;
- typecheck/build and unit/integration tests;
- coverage and quality thresholds;
- dependency audit, license/SBOM, secret scan, and provenance/attestation;
- migration parity and representative runtime/health checks;
- journey and screenshot-manifest verification;
- rollback/restart-survival evidence;
- release artifact hashes and signature/attestation verification.

Skipped, pending, empty, external, stale, or advisory checks do not satisfy a required gate. A passing local command does not prove hosted CI, publish, deployment, rollback, or runtime success.

## 7. NO-GO policy

The candidate is NO-GO if any required evidence is missing, stale, non-reproducible, contradictory, or tied to a different head. In particular, do not merge, publish, deploy, or call a migration complete when:

- the exact-head checkout or worktree status is unproven;
- TS7 gates are incomplete before Bun work starts;
- Bun install/lockfile/runtime parity is unproven;
- identity or capabilities are declarative but not schema-validated;
- journeys or screenshots lack fixtures, provenance, or verification;
- required CI/security/release checks are empty, skipped, or failing;
- rollback or restart-survival is not demonstrated.

Every exception requires an explicit issue decision, owner, expiry, and compensating evidence. Until all gates are green on the same commit, retain the draft state and preserve all branches and artifacts.

## 8. Concrete acceptance clauses

The following clauses define acceptance for this contract. They are requirements for future implementation and are not claims that they currently pass.

### 8.1 Identity and capability SSOT

- The canonical root manifest path is `.fork-identity.json`; no second hand-maintained identity/capability manifest is authoritative.
- The manifest MUST be UTF-8 JSON with top-level keys `schemaVersion`, `repository`, `fork`, `release`, `provenance`, `validator`, `capabilities`, `inputs`, and `integrity`. `schemaVersion` MUST be an exact supported value (initially `1.0`); unknown versions fail closed.
- `repository` MUST contain `owner` and `name`; `fork` MUST contain `lineage`; `release` MUST contain `channel` and `supportLevel`; `provenance` MUST contain 40-hex `sourceCommit`, 40-hex `sourceTree`, and RFC3339 `buildAt`; `validator` MUST contain `name` and `version`.
- Every capability entry MUST contain `provider`, `model`, `serviceKind`, `auth`, `streaming`, `toolCalls`, and `availability`; unknown values MUST be explicit (for example `"unknown"`) rather than omitted.
- `inputs` MUST list repository-relative paths and SHA-256 digests for the lockfile(s), source manifest, and each evidence artifact used to produce the manifest. Paths are normalized with forward slashes and MUST NOT escape the repository.
- Canonical content is UTF-8 JSON with no BOM, object keys sorted lexicographically at every level, and arrays in their declared semantic order. `integrity.contentSha256` is SHA-256 of that canonical projection after removing the entire `integrity` object and the mutable `provenance.buildAt`, `provenance.sourceCommit`, and `provenance.sourceTree` fields. This exclusion is the explicit rule preventing self-referential commit/tree hashing; those fields are checked separately against the target ref.
- `integrity` MUST contain `contentSha256` and a verifiable `attestation`. The accepted attestation is a Sigstore DSSE/cosign bundle binding the manifest digest and `provenance.sourceCommit`; an absent, unverifiable, or mismatched bundle fails closed.
- The validator command, report schema, and mutation fixtures MUST be versioned in-repository. CI MUST validate the manifest, recompute all listed hashes, check the exact source commit/tree, and reject malformed, stale, contradictory, unsigned, or self-inconsistent data. README, generated docs, `docs/SSOT.md`, and CODEOWNERS references MUST resolve to this manifest or be marked historical.

### 8.2 Docset/wiki strategy

- The canonical published documentation is a pinned MkDocs Material docset built from `docs/` using the exact versions in `docs/requirements.lock` and `mkdocs.yml`; no alternate renderer is acceptance-authoritative.
- A clean, network-disabled build MUST run `python -m mkdocs build --strict --clean` from the lockfile environment and emit a deterministic build manifest containing source SHA/tree, renderer versions, generated paths, and SHA-256 digests.
- The build MUST fail on broken links, missing assets, duplicate routes, unexpected generated files, warnings, or nondeterministic manifest output. Wiki publication is a separate dry-run using least-privilege `contents:write`, reviewable page diff, post-write hash verification, and recorded rollback/page provenance; a wiki dry-run is not a successful deployment.

### 8.3 Journeys and media

- Canonical journeys MUST run with checked-in offline fixtures/mocks and an explicit network policy (default `deny`), fixed seed, locale, timezone, browser/driver, viewport, color scheme, and dependency/runtime versions.
- Each machine-readable result MUST have sibling `.json` and `.sha256` sidecars containing journey ID, fixture ID/hash, capture command, source SHA/tree, and source-asset hash. Secret values MUST never be written.
- A no-network verifier MUST run twice from clean worktrees and compare byte-identical result, manifest, and sidecar outputs; any variance requires a declared bounded-variance rule and remains non-release evidence until explained. Missing sidecars, placeholders, network access, or unexplained variance fail closed.

### 8.4 Performance evidence

- The benchmark input MUST include a canonical sorted route/provider inventory and its SHA-256. It MUST collect real (not synthetic) samples: at least 10 steady-state requests and 30 streaming requests per declared scenario.
- Reports MUST include p50/p95/p99, TTFT/TTLT, 5xx/timeouts, raw sample digests, runtime/tool versions, and exact source SHA/tree. Missing, duplicate, partial, or synthetic samples fail closed; readiness, SSE abort/cleanup, and no-orphan-resource tests are required.
- Baselines are immutable exact-SHA artifacts with pinned action/tool versions; comparisons against another head, mutable branch, or unverified sample are invalid.

### 8.5 CI, release, and deployment provenance

- CI MUST retain the complete protected-check inventory, startup logs, run IDs, runner matrix, permissions, and action SHAs. The supported matrix explicitly includes Node 24, Node 26, and Bun 1.3.10 with frozen lockfile installs; fallback installs and allow-missing behavior are prohibited.
- Release artifacts MUST record tested source SHA/tree, artifact digest, signature/attestation verification, published URL, and representative health and journey checks. Rollback/redeploy evidence MUST identify the prior and candidate artifact digests and show restart survival. A wrapper exit code or skipped job is not proof of success.

All clauses above remain proposed until implemented and independently verified. Retain this PR as draft/NO-GO until the evidence is collected on one exact commit; no merge, release, deployment, or completion claim follows from this document alone.
