# Owner-bound pre-write integration contract

Status: proposed design; no recovery or production admission is implemented by this document. Related work: PR #815 provides a point-in-time collision audit and a broader maintenance design; PR #825 makes status read-only; PR #827 validates staged snapshots. None establishes continuous ownership.

## Placement and existing mutation paths

On the main-branch source reviewed at cd9ca9fd1c872d95fa9377c9b000c0cd57518293, `getDbInstance` in `src/lib/db/core.ts` can rename a probe-failed backup back to the primary path before probing. Its legacy-schema handling can drop a table, checkpoint, rename the main file and unlink sidecars; the probe-failure path can rename the database. It then opens writable, sets WAL mode, creates schema and indexes, runs column healers and seeds the ledger before `runMigrations`. Consequently, a backup or guard only inside `runMigrations` cannot protect the pre-runner changes. The separate CLI database opener and other processes are additional writers; a server-only flag cannot fence them.

## Required integration sequence for an existing database

1. Before any restore, rename, unlink, writable open or SQLite pragma that can mutate persistent state, resolve the intended database and candidate recovery files, then enter a maintenance coordinator. Paths alone are insufficient identity: capture and revalidate file identity and relevant sidecars, and reject ambiguous aliases, replacements, unknown participants and unsupported filesystems.
2. Stop admissions and drain all registered request, stream, job, accounting and CLI writers. An accepted operation must reach its durable outcome or the gate fails. Obtain acknowledgements from every owner and hold a fenced ownership epoch; timeout, loss of an owner, or any unregistered or incompatible writer blocks the operation. Process enumeration alone cannot prove this property.
3. Under uninterrupted ownership, take a WAL-consistent snapshot of the actual source state. Validate structural integrity, preserve the snapshot and record its digest and source identity; verify publication and durability on the target platform. Snapshot validity and ownership must be established together. A database with a failed probe or uncertain sidecars requires a separate preservation workflow; do not make a fallback rename or restore to get past this gate.
4. Keep the same ownership epoch through writable open, initialization, migration and postconditions. Immediately before the first persistent write, revalidate source and sidecar identity, snapshot binding, inventory and ownership. If the adapter or platform cannot prove the binding, abort without a write. Protect both filesystem mutation and database mutation; a SQLite transaction alone cannot fence path replacement or non-cooperating older binaries.
5. For each supported recovery recipe, recheck exact migration identities and data preconditions under the required SQLite lock; atomically commit the recipe and an append-only receipt. On unknown commit outcome, inspect the durable receipt and database state before any retry. Verify relevant row preservation, foreign keys, integrity and application behavior before releasing ownership and resuming admission.

Fresh creation is a separate explicit case: prove the target and preserved recovery candidates are absent while holding an ownership protocol that prevents creation races. A setup-created skeleton is an existing database for snapshot purposes even when migration heuristics call it new. Cloud in-memory and build stubs require their own explicitly tested policy and must not become implicit bypasses for local persistent storage.

## Contract for source changes

Introduce one owner-scoped startup coordinator before the first branch that can alter the database or recovery files. It should return an opaque, non-forgeable in-process capability only after all prerequisites above succeed; pass that capability to each persistent startup, backup, migration and recovery boundary, and reject absent, expired, wrong-database or wrong-epoch capabilities. Its issuance must be backed by cross-process fencing, not merely by the object itself. Release only after postconditions and owner acknowledgements; errors leave admission closed and preserve recovery evidence. Define how existing instances and standalone CLI commands participate before enabling enforcement.

Do not call an asynchronous backup as fire-and-forget from the synchronous `getDbInstance` path. Either restructure initialization so snapshot completion and failures are awaited before any write, or provide a proven synchronous mechanism with equivalent guarantees. Never catch a failed backup and proceed. Select a supported adapter and locking strategy only after proving that its backup can complete under the chosen ownership and transaction arrangement; do not assume an online backup can run under an exclusive lock.

The coordinator must treat restored candidates as distinct source identities, and must not automatically replace the primary database or delete sidecars on an error. Recovery from a probe failure is a distinct operation with its own validated source and ownership binding.

## Acceptance witnesses

- Instrument actual core startup and standalone CLI openers on disposable databases. For existing databases, prove every persistent mutation occurs after ownership, completed validated backup and final revalidation. Inject failure at every gate and verify database, WAL, SHM, recovery candidates and existing backups remain accounted for and no initialization mutation occurs.
- Exercise active WAL with committed data not yet checkpointed, concurrent commits, late and non-cooperating writers, hard links or aliases, path and sidecar replacement, ownership loss and a second opener. Unknown or unfenced writers must prevent mutation.
- Crash around snapshot creation, validation, publication, first write, transaction commit and receipt acknowledgement. Restart must classify the state without blind replay or overwriting later writes. Test both successfully closed and failed-to-close validation handles.
- Cover fresh creation races, setup skeletons, legacy-schema paths, probe failure, repeated startup, migration collision, adapters and packaged runtime. Measure backup duration and memory for realistic large databases; verify Windows durability and behavior instead of assuming POSIX semantics.
- Include negative controls that deliberately omit a writer, invalidate a capability, replace an identity, corrupt a snapshot and simulate drain timeout; each must refuse execution. Fixture success does not establish live deployment, request continuity or data-preservation acceptance.

No live database, service or production recovery is authorized by this design.
