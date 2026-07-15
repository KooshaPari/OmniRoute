# Decision: Authvault archive, AuthKit canonical

**Date:** 2026-07-05
**Decider:** root (sponsor review requested)
**Status:** RECOMMENDATION -- awaiting sponsor go/no-go

---

## TL;DR

**Delete: `Authvault`**
**Keep: `AuthKit`**

AuthKit is the canonical Rust auth boundary in the KooshaPari phenotype
ecosystem. It is the explicit successor to Authvault. Archiving Authvault
removes the duplicate without losing functionality.

---

## Evidence

### AuthKit (canonical, keeper)

- Path: `/Users/kooshapari/CodeProjects/Phenotype/repos/AuthKit/`
- README opening line: "AuthKit is the canonical Rust auth boundary in the
  KooshaPari phenotype ecosystem."
- README states AuthKit is "the successor to the now-archived `Authvault`
  repository and absorbs the FRs that landed in `Authvault` worktrees but were
  never merged into `Authvault` main before the archive marker (commit
  `c7994b9`)."
- Already ships: **FR-AUTHV-018** -- PKCE state-to-session binding at
  middleware (PR #1, SHIPPED in this crate).
- Planned (AUT-SOTA-001..007): Asymmetric key rotation, OIDC discovery,
  WebAuthn, TOTP, KMS-backed secrets, DPoP, rate-limiting.
- Traceability table: `specs/requirements/authkit-frnfr.md`
- Stack: Rust crate (axum/tower middleware), Cargo workspace.
- Last modified: 2026-07-04 (active).

### Authvault (legacy, deletion candidate)

- Path: `/Users/kooshapari/CodeProjects/Phenotype/repos/Authvault/`
- Self-described status: ACTIVE, 70% progress, "Hexagonal auth framework
  (OAuth2/JWT/RBAC); security+session+token audits complete, updated
  2026-06-02."
- Last modified: 2026-06-30 (older than AuthKit).
- Contains a sub-folder `authkit/` -- an embedded copy/symlink, suggesting
  overlap with the canonical AuthKit crate.
- Has Cargo.toml + package.json -- mixed stack, suggests prior partial Rust
  migration. PKCE work landed here first, then was re-implemented in
  AuthKit.
- Worktrees absorbed into AuthKit; main branch never received the merge
  (per AuthKit README's archive-marker note).

### Cross-pollution

The two repos overlap in scope (both implement OAuth2/JWT/RBAC). The
authoritative claim in the AuthKit README is decisive: it calls itself
"canonical" and "successor." Authvault's self-claim of "ACTIVE" is
stale -- it has not absorbed the work its worktrees produced.

---

## Risks of the decision

| Risk | Mitigation |
|------|------------|
| A downstream consumer still depends on Authvault's HTTP surface | Search for `Authvault` / `authvault` imports across the polyrepo before archive. If found, add a deprecation shim to AuthKit's re-exports. |
| FRs/audit reports reference Authvault FR IDs (e.g. FR-AUTHV-018) | Keep the FR ID naming. AuthKit already preserves `FR-AUTHV-018`. The "AUTHV" namespace stays meaningful as historical lineage. |
| Public API parity | Authvault exposes an HTTP/REST surface; AuthKit exposes Rust traits + axum middleware. Document the migration path in AuthKit README. |
| GitHub repo deletion is irreversible at the org level | Convert to public archive (read-only) BEFORE any deletion. Add `archived: true` flag, README banner, then never push. |

---

## Concrete next steps

1. Add a deprecation banner at the top of Authvault README pointing to AuthKit.
2. Set Authvault GitHub repo to `archived: true` (read-only).
3. Cross-link AuthKit README to mention this is the canonical home.
4. Sweep the polyrepo for `Authvault` references; produce a redirect doc.
5. After 1 release cycle (or per user direction), the Authvault directory
   itself can be removed from local clones via `git remote remove`.

---

## Counter-argument considered

Could Authvault be the keeper and AuthKit archived? No:
- AuthKit has the actively maintained code, the merged PRs, and a spec
  traceability table.
- Authvault's worktrees were abandoned (the "archive marker" in c7994b9).
- AuthKit explicitly claims canonical status in its README and FR history.

The decision is one-way.

---

## Sponsor question (single)

Confirm: archive Authvault, keep AuthKit? If yes, root proceeds to write
the deprecation banner and the polyrepo cross-link sweep.
