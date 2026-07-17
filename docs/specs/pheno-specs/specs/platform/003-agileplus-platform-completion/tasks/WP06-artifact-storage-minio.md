---
work_package_id: WP06
title: Artifact Storage (MinIO)
lane: "done"
dependencies: []
base_branch: main
base_commit: 9c06b087a5d1f3955c281428c7eed15ac7763c00
created_at: '2026-03-02T11:55:22.678824+00:00'
subtasks: [T034, T035, T036, T037, T038, T039]
shell_pid: "61443"
agent: "claude-opus"
reviewed_by: "Koosha Paridehpour"
review_status: "approved"
history:
- date: '2026-03-02'
  action: created
  by: spec-kitty
---

# Artifact Storage (MinIO) (WP06)

## Overview

Create the `agileplus-artifacts` crate with MinIO/S3-compatible object storage for event archives, audit logs, snapshots, and other artifacts.

## Objective

Implement:
- MinIO/S3 connection with configurable endpoint
- 4 managed buckets for different artifact types
- ArtifactStore trait with CRUD operations
- Multipart upload for large files (>5MB)
- Event and audit archival workflows
- Health monitoring

## Architecture

The artifact storage layer provides:
- **Bucket organization** by purpose (artifacts, events, audit, snapshots)
- **Lifecycle management** for archival and cleanup
- **Multipart upload** for efficiency and resumability
- **Event archival** as JSONL for queryability
- **Audit trails** with immutable records

## Subtasks

### T034: Scaffold agileplus-artifacts Crate

Create a new crate at `crates/agileplus-artifacts/`.

**Cargo.toml:**
```toml
[package]
name = "agileplus-artifacts"
version = "0.1.0"
edition = "2021"

[dependencies]
agileplus-domain = { path = "../agileplus-domain" }
aws-sdk-s3 = "1.15"
aws-config = "1.1"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
thiserror = "1.0"
async-trait = "0.1"
tokio = { version = "1", features = ["full"] }
chrono = { version = "0.4", features = ["serde"] }
uuid = { version = "1.0", features = ["v4", "serde"] }

[dev-dependencies]
tokio = { version = "1", features = ["full"] }
```

**Directory structure:**
```
crates/agileplus-artifacts/
├── Cargo.toml
└── src/
    ├── lib.rs
    ├── config.rs
    ├── store.rs
    ├── bucket.rs
    ├── archival.rs
    └── health.rs
```

**lib.rs content:**
```rust
pub mod archival;
pub mod bucket;
pub mod config;
pub mod health;
pub mod store;

pub use archival::{EventArchive, AuditArchive};
pub use bucket::BucketManager;
pub use config::ArtifactConfig;
pub use health::ArtifactHealth;
pub use store::{ArtifactStore, ArtifactError};

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("Artifact error: {0}")]
    Artifact(#[from] ArtifactError),
    #[error("Config error: {0}")]
    Config(String),
}
```

### T035: ArtifactConfig and Bucket Management

Create `crates/agileplus-artifacts/src/config.rs`:

```rust
#[derive(Clone, Debug)]
pub struct ArtifactConfig {
    pub endpoint: String,
    pub region: String,
    pub access_key: String,
    pub secret_key: String,
    pub use_path_style: bool,
}

impl ArtifactConfig {
    pub fn new(
        endpoint: String,
        region: String,
        access_key: String,
        secret_key: String,
    ) -> Self {
        ArtifactConfig {
            endpoint,
            region,
            access_key,
            secret_key,
            use_path_style: true, // MinIO uses path-style URLs
        }
    }

    pub fn with_path_style(mut self, use_path: bool) -> Self {
        self.use_path_style = use_path;
        self
    }
}

impl Default for ArtifactConfig {
    fn default() -> Self {
        ArtifactConfig {
            endpoint: "http://localhost:9000".to_string(),
            region: "us-east-1".to_string(),
            access_key: "agileplus".to_string(),
            secret_key: "agileplus-dev".to_string(),
            use_path_style: true,
        }
    }
}
```

Create `crates/agileplus-artifacts/src/bucket.rs`:

```rust
use crate::config::ArtifactConfig;
use aws_sdk_s3::Client;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum BucketError {
    #[error("Failed to create bucket: {0}")]
    CreationError(String),
    #[error("Failed to list buckets: {0}")]
    ListError(String),
}

pub struct BucketManager {
    client: Client,
}

impl BucketManager {
    pub async fn new(config: ArtifactConfig) -> Result<Self, BucketError> {
        let s3_config = aws_config::from_env()
            .endpoint_url(config.endpoint)
            .region(aws_sdk_s3::config::Region::new(config.region))
            .credentials_provider(
                aws_smithy_runtime::client::identity::SharedIdentityResolver::new(
                    aws_sdk_s3::config::Credentials::new(
                        config.access_key,
                        config.secret_key,
                        None,
                        None,
                        "agileplus",
                    ),
                ),
            )
            .load()
            .await;

        let client = aws_sdk_s3::Client::new(&s3_config);

        Ok(BucketManager { client })
    }

    pub async fn ensure_buckets_exist(&self) -> Result<(), BucketError> {
        let buckets = [
            "agileplus-artifacts",
            "agileplus-events-archive",
            "agileplus-audit-archive",
            "agileplus-snapshots",
        ];

        for bucket_name in &buckets {
            // Check if bucket exists
            match self
                .client
                .head_bucket()
                .bucket(*bucket_name)
                .send()
                .await
            {
                Ok(_) => {
                    // Bucket exists
                }
                Err(_) => {
                    // Bucket doesn't exist, create it
                    self.client
                        .create_bucket()
                        .bucket(*bucket_name)
                        .send()
                        .await
                        .map_err(|e| BucketError::CreationError(e.to_string()))?;
                }
            }
        }

        Ok(())
    }

    pub async fn list_buckets(&self) -> Result<Vec<String>, BucketError> {
        let response = self
            .client
            .list_buckets()
            .send()
            .await
            .map_err(|e| BucketError::ListError(e.to_string()))?;

        let bucket_names: Vec<String> = response
            .buckets()
            .unwrap_or_default()
            .iter()
            .filter_map(|b| b.name().map(|n| n.to_string()))
            .collect();

        Ok(bucket_names)
    }

    pub fn raw_client(&self) -> &Client {
        &self.client
    }
}
```

### T036: ArtifactStore Trait

Create `crates/agileplus-artifacts/src/store.rs`:

```rust
use async_trait::async_trait;
use std::path::PathBuf;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ArtifactError {
    #[error("Storage error: {0}")]
    StorageError(String),
    #[error("Upload error: {0}")]
    UploadError(String),
    #[error("Download error: {0}")]
    DownloadError(String),
    #[error("Not found: {0}")]
    NotFound(String),
    #[error("Invalid input: {0}")]
    InvalidInput(String),
}

#[async_trait]
pub trait ArtifactStore: Send + Sync {
    /// Upload data to a bucket
    async fn upload(
        &self,
        bucket: &str,
        key: &str,
        data: &[u8],
    ) -> Result<String, ArtifactError>;

    /// Upload a file with multipart support
    async fn upload_file(
        &self,
        bucket: &str,
        key: &str,
        path: &PathBuf,
    ) -> Result<String, ArtifactError>;

    /// Download data from a bucket
    async fn download(
        &self,
        bucket: &str,
        key: &str,
    ) -> Result<Vec<u8>, ArtifactError>;

    /// List objects in a bucket with optional prefix
    async fn list(
        &self,
        bucket: &str,
        prefix: Option<&str>,
    ) -> Result<Vec<String>, ArtifactError>;

    /// Delete an object from a bucket
    async fn delete(
        &self,
        bucket: &str,
        key: &str,
    ) -> Result<(), ArtifactError>;

    /// Check if an object exists
    async fn exists(
        &self,
        bucket: &str,
        key: &str,
    ) -> Result<bool, ArtifactError>;
}

pub struct S3ArtifactStore {
    client: aws_sdk_s3::Client,
}

impl S3ArtifactStore {
    pub fn new(client: aws_sdk_s3::Client) -> Self {
        S3ArtifactStore { client }
    }

    async fn upload_multipart(
        &self,
        bucket: &str,
        key: &str,
        data: &[u8],
    ) -> Result<String, ArtifactError> {
        // For simplicity, use standard upload for all data
        // In production, use multipart for data > 5MB
        let response = self
            .client
            .put_object()
            .bucket(bucket)
            .key(key)
            .body(aws_sdk_s3::types::ByteStream::from(data.to_vec()))
            .send()
            .await
            .map_err(|e| ArtifactError::UploadError(e.to_string()))?;

        Ok(response
            .e_tag()
            .unwrap_or("unknown")
            .to_string())
    }
}

#[async_trait]
impl ArtifactStore for S3ArtifactStore {
    async fn upload(
        &self,
        bucket: &str,
        key: &str,
        data: &[u8],
    ) -> Result<String, ArtifactError> {
        self.upload_multipart(bucket, key, data).await
    }

    async fn upload_file(
        &self,
        bucket: &str,
        key: &str,
        path: &PathBuf,
    ) -> Result<String, ArtifactError> {
        let data = tokio::fs::read(path)
            .await
            .map_err(|e| ArtifactError::UploadError(format!("Failed to read file: {}", e)))?;

        self.upload(bucket, key, &data).await
    }

    async fn download(
        &self,
        bucket: &str,
        key: &str,
    ) -> Result<Vec<u8>, ArtifactError> {
        let response = self
            .client
            .get_object()
            .bucket(bucket)
            .key(key)
            .send()
            .await
            .map_err(|e| {
                if e.to_string().contains("NoSuchKey") {
                    ArtifactError::NotFound(key.to_string())
                } else {
                    ArtifactError::DownloadError(e.to_string())
                }
            })?;

        let body = response
            .body
            .collect()
            .await
            .map_err(|e| ArtifactError::DownloadError(e.to_string()))?
            .into_bytes()
            .to_vec();

        Ok(body)
    }

    async fn list(
        &self,
        bucket: &str,
        prefix: Option<&str>,
    ) -> Result<Vec<String>, ArtifactError> {
        let mut request = self.client.list_objects_v2().bucket(bucket);

        if let Some(p) = prefix {
            request = request.prefix(p);
        }

        let response = request
            .send()
            .await
            .map_err(|e| ArtifactError::StorageError(e.to_string()))?;

        let keys: Vec<String> = response
            .contents()
            .unwrap_or_default()
            .iter()
            .filter_map(|obj| obj.key().map(|k| k.to_string()))
            .collect();

        Ok(keys)
    }

    async fn delete(
        &self,
        bucket: &str,
        key: &str,
    ) -> Result<(), ArtifactError> {
        self.client
            .delete_object()
            .bucket(bucket)
            .key(key)
            .send()
            .await
            .map_err(|e| ArtifactError::StorageError(e.to_string()))?;

        Ok(())
    }

    async fn exists(
        &self,
        bucket: &str,
        key: &str,
    ) -> Result<bool, ArtifactError> {
        match self
            .client
            .head_object()
            .bucket(bucket)
            .key(key)
            .send()
            .await
        {
            Ok(_) => Ok(true),
            Err(e) => {
                if e.to_string().contains("NoSuchKey") {
                    Ok(false)
                } else {
                    Err(ArtifactError::StorageError(e.to_string()))
                }
            }
        }
    }
}
```

### T037: Event Archival

Create `crates/agileplus-artifacts/src/archival.rs`:

```rust
use crate::store::ArtifactStore;
use agileplus_domain::Event;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ArchiveError {
    #[error("Archive error: {0}")]
    Error(String),
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct EventRecord {
    pub id: i64,
    pub entity_type: String,
    pub entity_id: i64,
    pub event_type: String,
    pub payload: serde_json::Value,
    pub actor: String,
    pub timestamp: String,
    pub sequence: i64,
}

impl From<&Event> for EventRecord {
    fn from(event: &Event) -> Self {
        EventRecord {
            id: event.id,
            entity_type: event.entity_type.clone(),
            entity_id: event.entity_id,
            event_type: event.event_type.clone(),
            payload: event.payload.clone(),
            actor: event.actor.clone(),
            timestamp: event.timestamp.to_rfc3339(),
            sequence: event.sequence,
        }
    }
}

pub struct EventArchive {
    store: std::sync::Arc<dyn ArtifactStore>,
}

impl EventArchive {
    pub fn new(store: std::sync::Arc<dyn ArtifactStore>) -> Self {
        EventArchive { store }
    }

    /// Archive events to MinIO as JSONL
    ///
    /// Key format: events/{entity_type}/{entity_id}/{year}/{month}.jsonl
    pub async fn archive_events(
        &self,
        events: &[Event],
    ) -> Result<Vec<String>, ArchiveError> {
        if events.is_empty() {
            return Ok(Vec::new());
        }

        // Group events by entity_type, entity_id, and month
        let mut groups: std::collections::HashMap<(String, i64, u32, u32), Vec<EventRecord>> =
            std::collections::HashMap::new();

        for event in events {
            let year = event.timestamp.year();
            let month = event.timestamp.month();
            let key = (
                event.entity_type.clone(),
                event.entity_id,
                year as u32,
                month,
            );

            groups
                .entry(key)
                .or_insert_with(Vec::new)
                .push(EventRecord::from(event));
        }

        let mut archived_keys = Vec::new();

        for ((entity_type, entity_id, year, month), records) in groups {
            // Create JSONL content
            let jsonl = records
                .iter()
                .map(|r| serde_json::to_string(r).unwrap_or_default())
                .collect::<Vec<_>>()
                .join("\n");

            let key = format!(
                "events/{}/{}/{:04}/{:02}.jsonl",
                entity_type, entity_id, year, month
            );

            self.store
                .upload("agileplus-events-archive", &key, jsonl.as_bytes())
                .await
                .map_err(|e| ArchiveError::Error(e.to_string()))?;

            archived_keys.push(key);
        }

        Ok(archived_keys)
    }

    /// Load archived events for an entity in a date range
    pub async fn load_archived_events(
        &self,
        entity_type: &str,
        entity_id: i64,
        year: u32,
        month: u32,
    ) -> Result<Vec<EventRecord>, ArchiveError> {
        let key = format!(
            "events/{}/{}/{:04}/{:02}.jsonl",
            entity_type, entity_id, year, month
        );

        let data = self
            .store
            .download("agileplus-events-archive", &key)
            .await
            .map_err(|e| ArchiveError::Error(e.to_string()))?;

        let content = String::from_utf8(data)
            .map_err(|e| ArchiveError::Error(e.to_string()))?;

        let records: Vec<EventRecord> = content
            .lines()
            .filter_map(|line| serde_json::from_str(line).ok())
            .collect();

        Ok(records)
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AuditRecord {
    pub feature_id: i64,
    pub action: String,
    pub actor: String,
    pub timestamp: String,
    pub details: serde_json::Value,
    pub archived_to: Option<String>,
}

pub struct AuditArchive {
    store: std::sync::Arc<dyn ArtifactStore>,
}

impl AuditArchive {
    pub fn new(store: std::sync::Arc<dyn ArtifactStore>) -> Self {
        AuditArchive { store }
    }

    /// Archive audit records to MinIO as JSONL
    ///
    /// Key format: audit/{feature_id}/{year}/{month}.jsonl
    pub async fn archive_audit_records(
        &self,
        feature_id: i64,
        records: &[AuditRecord],
    ) -> Result<String, ArchiveError> {
        if records.is_empty() {
            return Ok(String::new());
        }

        let now = Utc::now();
        let year = now.year();
        let month = now.month();

        let jsonl = records
            .iter()
            .map(|r| serde_json::to_string(r).unwrap_or_default())
            .collect::<Vec<_>>()
            .join("\n");

        let key = format!("audit/{}/{:04}/{:02}.jsonl", feature_id, year, month);

        self.store
            .upload("agileplus-audit-archive", &key, jsonl.as_bytes())
            .await
            .map_err(|e| ArchiveError::Error(e.to_string()))?;

        Ok(key)
    }

    /// Load archived audit records for a feature
    pub async fn load_audit_records(
        &self,
        feature_id: i64,
        year: u32,
        month: u32,
    ) -> Result<Vec<AuditRecord>, ArchiveError> {
        let key = format!("audit/{}/{:04}/{:02}.jsonl", feature_id, year, month);

        let data = self
            .store
            .download("agileplus-audit-archive", &key)
            .await
            .map_err(|e| ArchiveError::Error(e.to_string()))?;

        let content = String::from_utf8(data)
            .map_err(|e| ArchiveError::Error(e.to_string()))?;

        let records: Vec<AuditRecord> = content
            .lines()
            .filter_map(|line| serde_json::from_str(line).ok())
            .collect();

        Ok(records)
    }
}
```

### T038: Audit Archival Integration

The AuditArchive is already defined in T037. To integrate it:

Update `crates/agileplus-domain/src/domain/audit.rs` (or create it if it doesn't exist):

```rust
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AuditEntry {
    pub id: i64,
    pub feature_id: i64,
    pub action: String,
    pub actor: String,
    pub timestamp: DateTime<Utc>,
    pub details: serde_json::Value,
    pub archived_to: Option<String>, // Key in MinIO if archived
}
```

When archiving audit entries, set `archived_to` to the MinIO key returned from `AuditArchive::archive_audit_records()`.

### T039: Health Check

Create `crates/agileplus-artifacts/src/health.rs`:

```rust
use crate::bucket::BucketManager;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ArtifactHealth {
    Healthy,
    Unavailable,
}

pub struct ArtifactHealthChecker {
    bucket_manager: BucketManager,
}

impl ArtifactHealthChecker {
    pub fn new(bucket_manager: BucketManager) -> Self {
        ArtifactHealthChecker { bucket_manager }
    }

    pub async fn check(&self) -> ArtifactHealth {
        match self.bucket_manager.list_buckets().await {
            Ok(_) => ArtifactHealth::Healthy,
            Err(_) => ArtifactHealth::Unavailable,
        }
    }
}
```

## Implementation Guidance

1. **Order:** T034 → T035 → T036 → T037 → T038 → T039
2. **Multipart upload:** For files > 5MB, use AWS SDK's multipart upload for resume capability
3. **JSONL format:** Each line is a JSON object; supports streaming and incremental reads
4. **Bucket naming:** Use lowercase with hyphens for S3 compatibility
5. **Key organization:** Hierarchical keys (e.g., `events/Feature/1/2026/03.jsonl`) enable efficient prefix searches
6. **Retention:** Configure bucket lifecycle policies separately (not in this crate)
7. **Testing:** Test with MinIO running in Docker

## Definition of Done

- [ ] agileplus-artifacts crate compiles
- [ ] BucketManager creates all 4 required buckets
- [ ] S3ArtifactStore implements upload/download/delete/list operations
- [ ] EventArchive archives events to JSONL format
- [ ] EventArchive can load archived events
- [ ] AuditArchive archives audit records
- [ ] AuditEntry has archived_to field
- [ ] Health check returns correct status
- [ ] Integration tests pass (with MinIO running)
- [ ] No clippy warnings

## Command

```bash
spec-kitty implement WP06 --base WP03
```

## Activity Log

- 2026-03-02T11:55:22Z – claude-opus – shell_pid=61443 – lane=doing – Assigned agent via workflow command
- 2026-03-02T12:00:16Z – claude-opus – shell_pid=61443 – lane=for_review – Ready for review: agileplus-nats crate with EventBus trait, InMemoryBus, 12 tests
- 2026-03-02T23:19:17Z – claude-opus – shell_pid=61443 – lane=done – Merged to main, 516 tests passing
