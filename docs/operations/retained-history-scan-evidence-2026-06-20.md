# Retained History Scan Evidence - 2026-06-20

This evidence note is sanitized. It records scanner scope and outcomes without
secret values.

## Why This Exists

GitHub secret scanning is unavailable while `KooshaPari/phenotype-registry` is
private. During the incident, retained refs were rewritten and scanned with a
local mirror. This repository now includes `scripts/retained-history-secret-scan.py`
so the check can be repeated before reopening the repository or re-enabling
automation.

## Current Verified Result

Source: remote-derived bare mirror after retained-history rewrite and ref push.
Scanner: `scripts/retained-history-secret-scan.py --fail-on-findings`.

```json
{
  "scanned_blobs": 2271,
  "skipped_large_blobs": 1,
  "skipped_binary_blobs": 0,
  "nonzero_findings": {}
}
```

The scan covered high-confidence patterns for GitHub, npm, Sentry, OpenAI, AWS,
private key blocks, Discord bot tokens, Google API keys, Stripe keys,
authorization headers, cookie headers, OAuth refresh-token fields, SSNs, and
Luhn-valid card numbers.

## Re-run Procedure

From a fresh mirror clone:

```bash
git clone --mirror https://github.com/KooshaPari/phenotype-registry.git phenotype-registry.git
python scripts/retained-history-secret-scan.py phenotype-registry.git --fail-on-findings
```

If the repository is still private, authenticate first with a GitHub token that
has repository read access.

## Remaining Gates

- Provider-side credential rotation evidence must be recorded outside git.
- GitHub Support purge must be requested for cached and unreachable objects.
- A fresh scan must pass after GitHub Support purge or after GitHub secret
  scanning is available again.
- This evidence note and issue #320 must be reviewed before any public reopening.
