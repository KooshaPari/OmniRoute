# Branch protection rulesets

This file documents the ruleset applied to the `main` branch of this repo. The
ruleset is managed via GitHub API (per ADR-046). To apply or re-apply:

```bash
# Dry-run preview
gh api --method POST -H "Accept: application/vnd.github+json" \
  repos/KooshaPari/REPO/rulesets --input - <<'JSON'
$(cat .github/ruleset.json)
JSON
```

## Rules

1. **Pull request required** before merging to main.
2. **At least 1 approving review** from CODEOWNERS.
3. **All conversations resolved** before merge.
4. **No force pushes** to main.
5. **No deletion** of main.
6. **Required status checks:** CI / test, CI / fmt, CI / clippy, cargo-deny / deny,
   cargo-audit / audit.

## Bypass actors

- Repository admins (for emergency hotfixes).
- The release-bot account (for release-train tags, see `docs/release-train.md`).
