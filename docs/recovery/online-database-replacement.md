# Safe database replacement follow-up

Online SQLite restore and import are unavailable until the application can prove that it owns all writers for the database being replaced. Keep the current database and its backup for an operator-led offline recovery; stopping one connection alone does not prove the absence of other writers.

Before re-enabling either endpoint:

- Acquire cross-process exclusive ownership tied to the exact database and prevent new writes across every server and background worker; drain existing work and fail closed if ownership cannot be established.
- Take and verify a fresh, WAL-consistent pre-replacement backup while that ownership is held. Preserve the database and all sidecars on every failure path.
- Validate the candidate read-only, stage replacement durably, handle crashes and rollback, reopen safely, clear stale state and verify integrity before reopening write admission.
- Exercise concurrent writers, overlapping operations, timeouts, stale handles, crashes at each replacement stage, and recovery on Windows and other supported platforms. Compare all material rows and artifacts before and after with independent negative controls.
- Restore explicit API behavior and user guidance only after an end-to-end witness demonstrates these guarantees. Backup inspection and export remain separate from replacement.
