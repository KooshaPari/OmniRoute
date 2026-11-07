# Guarded additive recovery assessment

This is an offline assessment, not a repair command. It extends the collision inventory in PR #815 and does not establish the ownership, durable snapshot or startup boundary described in PRs #827 and #828. PR #825's main-schema work remains a separate dependency. Every assessment explicitly denies authorization to write.

The four recipes identify the exact installed v3.8.52 SQL bytes and the historical displaced ledger names observed in a protected snapshot. They classify only the target table and specified column metadata. A missing-column candidate is not proof that a migration should run; a present-column result is not proof of semantic equivalence. Partial or incompatible columns and changed identities fail closed. Other collision identities remain unclassified.

## Required executor contract before implementation

1. A single recovery owner must bind a live database and its sidecars by verified handles, prevent competing writers and remain continuously held through the final verification. A process ID, pathname, JSON receipt or test flag alone does not prove ownership. The owner must fail closed if its guarantee or identity is lost.
2. The same owner must produce and validate a WAL-consistent, access-controlled backup before any mutation. Bind the verified snapshot identity and contents to the source and publication operation; a pathname hash or SQLite integrity check alone does not establish that binding. Prove failure, crash and handoff behavior on supported filesystems and drivers.
3. Re-read the live ledger, exact migration bytes and schema under that ownership. Compare them to a separately reviewed, signed-off repair plan with an explicit migration identity and SQL hash. Refuse drift, unsupported drivers, ambiguous or partial schema, unknown migrations and unexpected existing rows or objects.
4. For each separately approved additive operation, transactionally apply only the intended missing column changes, verify resulting metadata, and establish data invariants. Ledger handling is a distinct decision: do not rewrite, replace, delete or silently mark historical entries based on this classifier. Capture before/after evidence without credential values.
5. Retain owner and backup through read-only validation, application-level checks and an explicit handoff. Failure leaves the service inhibited and preserves evidence; do not infer a successful repair from a committed DDL statement, a receipt or an integrity check.

Tests must include competing owners and writers, source/sidecar and staging replacement, partial columns, SQL hash mismatch, backup/validation/publication failure, cancellation, transaction rollback, process crash, ambiguous commit and safe retry. Existing clone evidence covers selected SQLite DDL and row-value checks only; it does not establish this contract. No live repair is enabled here.
