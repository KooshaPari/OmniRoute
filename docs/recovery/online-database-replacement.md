# Safe database replacement follow-up

Online SQLite restore and import are unavailable until the application can prove that it owns all writers for the database being replaced. Keep the current database and its backup for an operator-led offline recovery; stopping one connection alone does not prove the absence of other writers.

Before re-enabling either endpoint:

- Acquire cross-process exclusive ownership tied to the exact database and prevent new writes across every server and background worker; drain existing work and fail closed if ownership cannot be established.
- Take and verify a fresh, WAL-consistent pre-replacement backup while that ownership is held. Preserve the database and all sidecars on every failure path.
- Validate the candidate read-only, stage replacement durably, handle crashes and rollback, reopen safely, clear stale state and verify integrity before reopening write admission.
- Exercise concurrent writers, overlapping operations, timeouts, stale handles, crashes at each replacement stage, and recovery on Windows and other supported platforms. Compare all material rows and artifacts before and after with independent negative controls.
- Restore explicit API behavior and user guidance only after an end-to-end witness demonstrates these guarantees. Backup inspection and export remain separate from replacement.

Startup now refuses automatic recovery when a legacy schema or failed probe would otherwise move or rebuild a database, and refuses fresh creation when the main file is missing but SQLite sidecars remain. These checks preserve those specific files; they do not prevent another process from opening or changing the database between checks, and they do not establish exclusive ownership. The existing setup-shaped database freshness heuristic remains in use: its schema does not prove provenance, and a damaged database can look identical to a legitimate setup. Resolve that ambiguity and verify all startup writers before making a no-loss or ownership claim.

The sql.js fallback refuses to open an existing database while a WAL or rollback journal sidecar is present, because its in-memory load does not replay those files. The startup file check also runs before the asynchronous initializer's first driver probe. These point-in-time checks do not prevent another writer from creating a sidecar after inspection, cover cached sql.js adapters, or establish cross-process ownership.

The CLI database opener also refuses to create a missing main file when SQLite sidecars or preserved probe-failed files exist. This check does not prevent a file appearing after inspection; CLI schema and pragma writes on an existing database still lack a writer fence and pre-write snapshot.

The CLI restore command also refuses replacement of database and configuration files until the ownership protocol is available; `restore --list` remains available. The refusal is not an implementation of offline recovery. Preserve the current data and backup until a verified recovery procedure is in place.

CLI SQLite backup now requires the directly opened better-sqlite3 online backup API and fails if that capability is unavailable; Bun and node:sqlite fallback adapters are not accepted because their backup methods can fall back to an unsafe raw copy. Install a working better-sqlite3 native binding to use this CLI path. The CLI stages the SQLite snapshot in a unique temporary directory, checks its integrity, and publishes it with a hard link that fails if the destination already exists. Encrypted SQLite backups are refused until private encrypted staging is verified. The full backup bundle is not transactional, crash durability is not established, and none of these checks establish writer ownership.

The standalone `bin/restore-data.sh` operation is also unavailable: it previously removed the target and SQLite sidecars before copying the snapshot and could fall back to a raw pre-restore copy. The script now refuses replacement, including with `--yes`; this preserves the files but does not establish writer ownership or perform offline recovery.
