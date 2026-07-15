//! Domain models. One struct per top-level table; rows map 1:1 to columns.

use chrono::{DateTime, Utc};
use indexmap::IndexMap;
use serde::{Deserialize, Serialize};

use crate::ids::*;

// ─── tenants ───────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Tenant {
    pub id: TenantId,
    pub slug: String,
    pub display_name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub contact_email: Option<String>,
    pub status: TenantStatus,
    pub plan: TenantPlan,
    #[serde(default, skip_serializing_if = "IndexMap::is_empty")]
    pub settings: IndexMap<String, serde_json::Value>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TenantStatus { Active, Suspended, Deleted }

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TenantPlan { Free, Pro, Enterprise, Internal }

// ─── workspaces ────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Workspace {
    pub id: WorkspaceId,
    pub tenant_id: TenantId,
    pub slug: String,
    pub display_name: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ─── api_keys ──────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ApiKey {
    pub id: ApiKeyId,
    pub tenant_id: TenantId,
    pub workspace_id: WorkspaceId,
    /// SHA-256 of the key. The cleartext is never stored.
    pub key_hash: String,
    /// Human-readable label.
    pub label: String,
    pub status: ApiKeyStatus,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_used_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub expires_at: Option<DateTime<Utc>>,
    #[serde(default, skip_serializing_if = "IndexMap::is_empty")]
    pub metadata: IndexMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ApiKeyStatus { Active, Revoked, Expired }

// ─── provider_records ──────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ProviderRecord {
    pub id: ProviderRecordId,
    pub tenant_id: TenantId,
    pub workspace_id: WorkspaceId,
    pub provider_name: String,
    pub kind: String,
    pub base_url: Option<String>,
    /// Encrypted credential blob.
    pub credential: Option<String>,
    pub enabled: bool,
    pub rate_limit_rpm: Option<u32>,
    #[serde(default, skip_serializing_if = "IndexMap::is_empty")]
    pub metadata: IndexMap<String, serde_json::Value>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ─── models ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ModelRecord {
    pub id: ModelId,
    pub provider_id: ProviderRecordId,
    pub model_name: String,
    pub display_name: Option<String>,
    pub context_window: Option<u32>,
    pub max_output_tokens: Option<u32>,
    pub input_modalities: Vec<String>,
    pub output_modalities: Vec<String>,
    pub supports_tools: bool,
    pub supports_vision: bool,
    pub supports_streaming: bool,
    pub supports_reasoning: bool,
    pub cost_input_per_1k: Option<f64>,
    pub cost_output_per_1k: Option<f64>,
    pub enabled: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ─── call_logs ─────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CallLog {
    pub id: CallLogId,
    pub tenant_id: TenantId,
    pub workspace_id: WorkspaceId,
    pub api_key_id: Option<ApiKeyId>,
    pub provider_id: Option<ProviderRecordId>,
    pub model_id: Option<ModelId>,
    pub model_name: String,
    pub status: CallLogStatus,
    pub http_status: Option<u16>,
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
    pub cost_usd: Option<f64>,
    pub duration_ms: u32,
    pub started_at: DateTime<Utc>,
    pub finished_at: Option<DateTime<Utc>>,
    pub error_kind: Option<String>,
    pub error_message: Option<String>,
    pub request_id: String,
    pub session_id: Option<SessionId>,
    #[serde(default, skip_serializing_if = "IndexMap::is_empty")]
    pub metadata: IndexMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CallLogStatus { Success, Error, Timeout, Cancelled, Pending }

// ─── combos ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Combo {
    pub id: ComboId,
    pub tenant_id: TenantId,
    pub workspace_id: WorkspaceId,
    pub name: String,
    pub strategy: String,
    pub enabled: bool,
    pub members: Vec<ComboMember>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ComboMember {
    pub provider_id: ProviderRecordId,
    pub model_id: ModelId,
    pub weight: f32,
    pub enabled: bool,
}

// ─── feature_flags ─────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct FeatureFlag {
    pub key: String,
    pub tenant_id: Option<TenantId>,
    pub enabled: bool,
    pub updated_at: DateTime<Utc>,
}
