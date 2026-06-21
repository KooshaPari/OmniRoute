# GitHub Purge Request Template - 2026-06-20 Secret Spill

Use this after provider-side revocation/rotation and history remediation.
Do not include secret values in the support request.

## Request

Please purge cached views and unreachable objects for a secret-spill incident in
`KooshaPari/phenotype-registry`.

The repository was public when GitHub secret scanning reported exposed
credentials. It has since been made private, repository Actions are disabled,
and a branch exposing the initially reported path was deleted. We have rotated
or revoked the affected credentials and rewritten/deleted retained refs that
contained the exposed material.

## Repository

- Owner/repo: `KooshaPari/phenotype-registry`
- Incident date: 2026-06-20
- Initial reported commit: `94f8bb0530351f44665601e3110ac8a46dfb57cf`
- Initial reported path:
  `docs/curated-prompts/claude-code/2026-04/4886fd36d2917354.md`

## Path Families To Purge

- `docs/curated-prompts/**`
- `docs/curated-prompts/**/_orphan/**`
- `docs/curated-plans/**`
- `docs/07-reports/archive/**`
- `docs/guides/**`
- `docs/other/**`
- `frontend/disable/bun-types@*/**`
- `default/bun-types@*/**`
- `ARCHIVE/CONFIG/default/bun-types@*/**`
- `tests/unit/api/test_api_key_security.py`
- `GITHUB_APP_REGISTRATION.md`

## Alert Types Observed

- GitHub personal access token
- Cloudflare account API token
- Cloudflare user API token
- npm access token
- OpenAI API key
- Supabase secret key
- Supabase service key
- Google API key
- Google OAuth refresh token
- Sentry personal token
- Tailscale API key
- Discord bot token
- Vercel API key
- crates.io API token
- Stripe API key
- WorkOS staging API key
- Highnote test key

## Confirmation Checklist

Before submitting this request, run:

```powershell
python scripts\incident-purge-readiness.py
```

Before checking "Current default branch scan is clean," run this on the current
`main` checkout:

```powershell
python scripts\retained-history-secret-scan.py --worktree-root . --fail-on-findings
```

The scanner output is sanitized and reports finding labels plus paths only, not
matched values.

The gate is sanitized and must fail until the provider inventory and checklist
below are complete. Use this mode to verify the current blocked posture:

```powershell
python scripts\incident-purge-readiness.py --expect-blocked
```

- [ ] Provider-side credentials have been revoked or rotated.
- [ ] Retained refs have been rewritten or deleted.
- [ ] Stale branches and tags have been pruned.
- [ ] Current default branch scan is clean.
- [ ] Full-history scan after rewrite is clean.
- [ ] Local sanitized evidence notes pass
      `python scripts\incident-evidence-guard.py incident-evidence\2026-06-20`.
- [ ] Repository owner accepts that forks/clones outside GitHub control cannot be
      purged by GitHub Support.

After the purge request is submitted or cached-object risk is explicitly
accepted by the owner, update the sanitized incident command sheet and rerun:

```powershell
python scripts\incident-reopen-readiness.py
```
