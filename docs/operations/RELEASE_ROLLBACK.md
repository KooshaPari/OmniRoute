# Release Rollback Playbook

> W9.25 — 30-minute RTO for any `v3.8.X` release that ships green and breaks
> in production. This is the runbook, not a script. The script is
> `.github/workflows/release-rollback.yml`.

## When to roll back

Roll back when ANY of the following is true and is traceable to a release
that just shipped (within 24h):

| Signal | Likely cause | Decision |
|---|---|---|
| `/healthz` 5xx spike (>5% in 10min) | image boots, route handler panics | **ROLLBACK** |
| `npm install @kooshapari/omniroute@<v>` fails or `npm view` returns the wrong version | registry push raced (W9.05 / W9.10 class) | **ROLLBACK** |
| Security advisory lands on a dep we just bumped | W9.10 gate false-negative | **ROLLBACK +** pin via `npm-shrinkwrap` |
| `docker pull kooshapari/omniroute:<v>` returns 404 | manifest push failure | **Re-publish, do not roll back** |
| Trivy CRITICAL gate red on a published image | W9.10 false-negative on Debian base | **ROLLBACK** |
| Maintainer reports breaking change in upstream `diegosouzapw/OmniRoute` `main` | rebase race | **Hotfix, do not roll back** |

**Rule of thumb:** if a `latest` install is broken for 5+ users, you roll back.
If a `next` install is broken, you do not — `next` is by definition unstable.

## Triage (T+0 to T+5 min)

1. **Confirm the regression.** Open a dashboard query for the version-string
   histogram. Reject the "I think it's this release" hypothesis until you see
   the actual data.

   ```bash
   gh run list -L 5 --workflow "auto-release"    # what shipped
   gh run view   <RUN_ID> --json conclusion,name,headBranch
   ```

2. **Identify the failing version.** Run the introspection in `bin/upstream-intel.mjs`
   (or just look at the failed run's title).

3. **Decide the path:**
   - *Roll back* (this doc): the version on the wire is broken; you need a
     good version back in its slot.
   - *Hotfix*: ship a new patch release. Use the W9.23 patch-release workflow
     with `revert` commits.

## Path A: Rollback (npm + Docker + GH Release)

T+5 → T+20 min. Each step is idempotent — re-running is safe.

### 1. Pick a known-good version

```bash
git tag -l 'v[0-9]*' --sort=-version:refname | head -10
git log --oneline -1 v<GOOD_VERSION>
```

`v3.8.4X` (the last green release) is almost always correct. If the user
files the issue within 24h of a release, you usually want the immediately
prior version.

### 2. Restore npm `dist-tag:latest`

```bash
npm dist-tag add @kooshapari/omniroute@<GOOD_VERSION> latest
# Re-publish: dist-tag changes are immediate
```

If `<BROKEN_VERSION>` is already on `latest`, you need to demote it first:

```bash
npm dist-tag rm  @kooshapari/omniroute@<BROKEN_VERSION> latest
npm dist-tag add @kooshapari/omniroute@<GOOD_VERSION>   latest
```

### 3. Repoint Docker `:latest`

```bash
docker buildx imagetools create \
  -t kooshapari/omniroute:latest \
  kooshapari/omniroute@sha256:<GOOD_DIGEST>     # the digest of the green image

docker buildx imagetools create \
  -t ghcr.io/kooshapari/omniroute:latest \
  ghcr.io/kooshapari/omniroute@sha256:<GOOD_DIGEST>
```

> **Tip:** the digests are listed in the green run's `merge` job output under
> "Export digests".

### 4. Re-tag the GitHub Release

```bash
gh release edit v<BROKEN_VERSION> --draft=false
# Move the old release notes; do NOT delete the broken one (audit trail).
gh release upload v<GOOD_VERSION> /tmp/digests/*  # if not already attached
```

### 5. Verify

```bash
# Sanity: install the version that anyone running `npm i -g` would get.
npm install -g @kooshapari/omniroute
omniroute --version
# Should match <GOOD_VERSION>

# Sanity: pull the image a real consumer would use.
docker run --rm kooshapari/omniroute:latest --version
```

### 6. Communicate

- Edit the broken GH Release body to add a `> ⛔ ROLLED BACK at <UTC> — use v<GOOD_VERSION>` banner.
- Post a thread in `#releases` (or the project's chat) with: broken version, good version, root cause, ETA for the fix.
- File an incident under `docs/incidents/<DATE>-<BROKEN_VERSION>.md` (template in `docs/incidents/TEMPLATE.md`).

## Path B: Hotfix

T+5 → T+30 min. Use when a rollback would strand users (e.g. breaking migration
the user depends on).

1. Branch off `main` at the last green commit.
2. Revert the offending commits with `git revert <SHA>`.
3. Trigger the `auto-release` workflow on the hotfix branch (it auto-resolves to `patch` channel).
4. Promote `patch` to `latest` once the canary passes (`npm dist-tag add ... latest`).

## Path C: Compensating flag (no version change)

T+5 → T+15 min. Use when the bug is environment-specific and a feature flag
already exists.

```bash
# Example: temporarily disable a provider that's panicking in the wild.
gh workflow run "feature-flag-rollout.yml" \
  -f provider=opencode -f enabled=false
```

This is the lowest-risk path. Use it before any rollback.

## Postmortem (T+24h → T+72h)

Write a blameless postmortem. Template: `docs/incidents/TEMPLATE.md`.
Required sections: Timeline, Root cause, Contributing factors, Action items
(owners + due dates), What went well, What we missed.

File the action items as a tracking issue with label `postmortem-action`.

## See also

- `.github/workflows/release-rollback.yml` — the manual workflow that runs
  Path A steps 2-3 with one click.
- `docs/incidents/TEMPLATE.md` — postmortem template.
- `docs/security/SUPPLY_CHAIN.md` — SLSA / provenance context.
