# Slack webhook rotation — `SLACK_FLEET_WEBHOOK`

The fleet-substrate cron (and the GitHub Actions backup) alert to a single
Slack Incoming Webhook pointed at `#phenotype-fleet`. This document defines
the rotation policy and the audit log.

## Where the webhook is stored

| Layer              | Path                                                                                  | Mode   |
| :----------------- | :------------------------------------------------------------------------------------ | :----- |
| Heavy-runner       | `/etc/phenotype-fleet.env` (env-var-only file, sourced by `~/.bashrc` / `~/.zshrc`)   | 0600   |
| GitHub Actions     | Repo → Settings → Secrets → `SLACK_FLEET_WEBHOOK` (in `KooshaPari/phenotype-tooling`) | secret |
| Env-var name       | `SLACK_FLEET_WEBHOOK`                                                                  | n/a    |

The webhook URL is **never** committed to git, never written to a `WORKLOG.md`,
never pasted in a PR description, never stored in 1Password/Keychain entries
that are shared.

## Rotation cadence

**Quarterly** (1st Tuesday of Jan / Apr / Jul / Oct, by 09:00 PDT).
The cadence aligns with the registry refresh (ADR-043) and the substrate
audit (ADR-041) — three quarterly cadences share the 1st-Tuesday-of-quarter
slot.

The next-rotation date is computed from the `last_rotated` row in the audit
log table below; the rotation is the responsibility of the on-call
orchestrator.

## Rotation procedure

1. **Revoke the old webhook** in Slack admin:
   `Slack → Apps → Incoming Webhooks → #phenotype-fleet → Remove`.
2. **Create a new webhook** for `#phenotype-fleet` (same channel, same
   app or a freshly-installed app — either is fine; app-rotation is
   independent of webhook-rotation).
3. **Update the env file** on the heavy-runner:
   ```bash
   sudo sed -i "s|^SLACK_FLEET_WEBHOOK=.*|SLACK_FLEET_WEBHOOK=<NEW-URL>|" /etc/phenotype-fleet.env
   sudo chmod 0600 /etc/phenotype-fleet.env
   cat /etc/phenotype-fleet.env   # verify
   ```
4. **Update the GitHub Actions secret** in `KooshaPari/phenotype-tooling`:
   `Settings → Secrets and variables → Actions → SLACK_FLEET_WEBHOOK → Update`.
5. **Force a re-run** of the workflow `fleet-substrate-tools-backup.yml`
   via `gh workflow run` to verify the new webhook posts.
6. **Append a row** to the audit log below (do **not** paste the new URL;
   record only the Slack app / webhook ID — the 4-character suffix after
   the last `/`).

## Audit log

| Date (UTC) | Rotated by        | New webhook suffix | Reason                                            |
| :--------- | :---------------- | :----------------- | :------------------------------------------------ |
| 2026-06-18 | orchestrator (KP) | `XXXX` (initial)   | First install (ADR-044 T27.1)                     |
| _next_     | _on-call_         | _tbd_              | Quarterly rotation (1st Tue of next quarter, 09:00 PDT) |

> The webhook suffix is the 4-character string after the last `/` in the
> `hooks.slack.com/services/...` URL. It is sufficient to correlate an alert
> to a specific webhook install; the full URL is **not** recorded.

## Compromised-webhook emergency rotation

If a webhook URL is leaked (commit, screenshot, chat, etc.), rotate
**immediately** (do not wait for the quarterly cadence):

1. Revoke the leaked webhook in Slack admin.
2. Create a new one.
3. Update both layers (heavy-runner env file + GitHub secret).
4. Add an `EMERGENCY` row to the audit log with reason `leaked-via-<channel>`.
5. Post a one-line announcement in `#phenotype-fleet`: "webhook rotated;
   previous URL is revoked".

The leak response itself should be ≤ 15 min wall-clock; revoke-then-rotate
removes any future use of the leaked URL.
