// Cost ledger: per-call entries plus an aggregate snapshot for
// budget / quota enforcement. The TS engine reads the snapshot
// over FFI; the entries are flushed in batches by the ledger port.

mod ledger;

pub use ledger::{LedgerEntry, LedgerSnapshot, TenantSpend};
