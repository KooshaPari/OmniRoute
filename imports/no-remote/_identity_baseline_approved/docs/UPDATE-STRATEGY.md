# Update strategy — ArgisMonitor

> **Status (Gate 5, file-only):** in-app notifier already exists
> (upstream's `update-notifier` integration); the new
> `argismonitor upgrade` subcommand + nightly workflow are added below.

## Channels

| Channel | Tag shape | Cadence | Where it lands |
|---------|-----------|---------|----------------|
| stable | `v<MAJOR>.<MINOR>.<PATCH>` | on demand | npm `latest` |
| rc | `v<MAJOR>.<MINOR>.<PATCH>-rc.<n>` | per RC | npm `next` |
| historic | any older | on publish of newer stable | npm `historic` (defense vs. dist-tag clobbering) |
| nightly | `v<MAJOR>.<MINOR>.<PATCH>-nightly.<YYYYMMDD>` | every day at 02:00 UTC | npm `nightly` (publish workflow; not a GitHub Release) |

## CLI subcommand: `argismonitor upgrade`

Additive, ships in Gate 7. Documented here so the workflow can be
planned in lockstep.

```text
argismonitor upgrade
  --check           Show what would update, don't change anything.
  --apply           Run npm install -g argismonitor@<latest>.
  --channel stable  Use dist-tag 'latest' (default).
  --channel rc      Use dist-tag 'next'.
  --channel nightly Use dist-tag 'nightly'.
  --target <semver> Pin a specific version.
  --dry-run         Show the resolved plan; don't change anything.
```

Behavior:

1. Read `~/.argismonitor/.update-channel` (default `stable`).
2. Resolve target via `npm view argismonitor dist-tags.<channel>`.
3. Compare to current `argismonitor --version`.
4. If newer, print a colored diff and (unless `--check`/`--dry-run`)
   invoke `npm install -g argismonitor@<target>`.
5. Honor `OMNIROUTE_LEGACY=1` for users who run via the legacy alias.

The implementation lives at
`bin/cli/commands/upgrade.mjs` (Gate 7) and is registered in
`bin/cli/program.mjs`.

## In-app notifier (existing)

`update-notifier` is already wired into `bin/argismonitor.mjs`
(was `bin/omniroute.mjs`). It checks npm once per 24h and emits a
notice on exit. Behavior unchanged in this fork; messages are
rewritten to point at `argismonitor` instead of `omniroute`.

## Nightly workflow

`.github/workflows/argismonitor-nightly.yml` runs at 02:00 UTC daily.
It tags a `v*-nightly.<date>` artifact but does **not** publish to npm
`@latest`. Promotion to `latest` happens only via the manual release
flow (`argismonitor-publish.yml` on a `release: released` event).

## File-only proof (this gate)

```
.github/workflows/argismonitor-nightly.yml    ← nightly tag workflow
bin/cli/commands/upgrade.mjs                  ← (Gate 7) upgrade subcommand
docs/UPDATE-STRATEGY.md                       ← this file
```

## Reference

- [`PUBLISHING.md`](./PUBLISHING.md) — registry matrix + secret checklist
- [`RENAMES-STRATEGY.md`](./RENAMES-STRATEGY.md) — migration window for legacy aliases