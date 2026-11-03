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
