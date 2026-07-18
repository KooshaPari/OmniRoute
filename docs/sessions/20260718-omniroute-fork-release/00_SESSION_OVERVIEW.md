# OmniRoute Fork Release Session

## Goal

Reconcile the local OmniRoute checkout fleet into the KooshaPari fork, then
finish a verified package, publish, deployment, installation, and A+ security
scorecard path. This session records the evidence and forward gates; it does
not itself change source, package metadata, or workflows.

## Current anchor

- Worktree: `OmniRoute/.worktrees/reconcile-koosha-fork-20260718`.
- Branch: `reconcile/koosha-fork-20260718`.
- Audited HEAD: `9b1927a2c8683756562bf644855b1105cc986d04`.
- At audit time the worktree was clean and the branch was one commit behind
  the then-current `origin/main` (`49946c95a439967f61eb0a9ba1eb98eca1e7ef62`).
- No source, package, workflow, deployment, or security configuration is
  changed by these session documents.

## Success criteria

1. Every local checkout and candidate tip is inventoried and preserved before
   admission or exclusion.
2. A single gated reconciliation branch passes release-green checks.
3. The Koosha fork package is published with provenance, installed globally,
   and verified at runtime.
4. Deployment health and protocol smoke checks agree on one release identity.
5. OpenSSF Scorecard and repository governance evidence support an A+ target.

## Evidence policy

Preservation refs and immutable commit hashes are the source of truth for
worktrees that cannot be merged directly. Dirty or detached work is held and
never overwritten. The release DAG and exclusions are updated in the session
documents as gates produce evidence.
