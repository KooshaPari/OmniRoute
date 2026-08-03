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
