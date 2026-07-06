// A single ledger entry: one routed call's cost in micro-cents.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct LedgerEntry {
    pub request_id: String,
    pub tenant_id: String,
    pub provider: String,
    pub model: String,
    pub cost_microcents: u64,
    pub ts_unix_ms: u64,
}

/// An aggregate snapshot: total spend per tenant over a window.
/// Returned to the TS engine for budget enforcement.
#[derive(Debug, Clone, Default, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct LedgerSnapshot {
    pub window_start_unix_ms: u64,
    pub window_end_unix_ms: u64,
    pub total_microcents: u64,
    pub by_tenant: Vec<TenantSpend>,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct TenantSpend {
    pub tenant_id: String,
    pub total_microcents: u64,
}
