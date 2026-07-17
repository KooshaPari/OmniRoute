---
work_package_id: WP16
title: P2P Sync via Tailscale
lane: "done"
dependencies: []
base_branch: main
base_commit: 8a8390c6e3d118f4898dfd1fba2fb0b67224c555
created_at: '2026-03-02T12:17:18.845837+00:00'
subtasks: [T095, T096, T097, T098, T099]
shell_pid: "54708"
agent: "claude-opus"
reviewed_by: "Koosha Paridehpour"
review_status: "approved"
history:
- date: '2026-03-02'
  action: created
  by: spec-kitty
---

# WP16: P2P Sync via Tailscale

Implementation command: `spec-kitty implement WP16 --base WP09`

## Objective

Create `crates/agileplus-p2p` for peer discovery via Tailscale and event replication between devices using vector clocks.

## Subtasks

### T095: Scaffold P2P Crate

Create a new crate at `crates/agileplus-p2p`.

Add the following dependencies to `Cargo.toml`:

```toml
tailscale-localapi = "0.1"
async-nats = "0.34"
agileplus-domain = { path = "../agileplus-domain" }
agileplus-events = { path = "../agileplus-events" }
agileplus-sync = { path = "../agileplus-sync" }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
tokio = { version = "1", features = ["full"] }
thiserror = "1.0"
tracing = "0.1"
uuid = { version = "1.0", features = ["v4", "serde"] }
```

Define error types for P2P operations:
- `PeerDiscoveryError`
- `SyncError`
- `ConnectionError`

### T096: Peer Discovery

Implement peer discovery by connecting to the Tailscale local API socket:

**Paths by platform:**
- Linux: `/var/run/tailscale/tailscaled.sock`
- macOS: Use `tailscale` CLI to find socket path or read from environment
- Windows: Not supported in initial release

Create `src/discovery.rs` with:

```rust
pub async fn discover_peers() -> Result<Vec<PeerInfo>, PeerDiscoveryError> {
    // Connect to Tailscale local API socket
    // Query GET /status for list of peers
    // Filter for peers with AgilePlus running (custom Tailscale tag or port probe)
    // Return PeerInfo { device_id, hostname, tailscale_ip, status }
}

pub struct PeerInfo {
    pub device_id: String,
    pub hostname: String,
    pub tailscale_ip: String,
    pub status: PeerStatus,
}

#[derive(Debug, Clone, PartialEq)]
pub enum PeerStatus {
    Online,
    Offline,
    Unknown,
}
```

Peer detection strategy:
1. Query Tailscale local API for peer list
2. For each peer, attempt to connect to AgilePlus port (default 3000) with short timeout (2 seconds)
3. If connection succeeds, mark peer as `Online` with AgilePlus detected
4. If connection fails, mark as `Offline` or `Unknown`

### T097: Device Registration

Implement device registration in `src/device.rs`:

On first run of the AgilePlus instance:
1. Generate a unique `device_id` as UUID v4
2. Query Tailscale local API for:
   - Local hostname
   - Assigned Tailscale IP address
3. Create a `DeviceNode` entity in SQLite:
   ```rust
   pub struct DeviceNode {
       pub device_id: String,
       pub hostname: String,
       pub tailscale_ip: String,
       pub created_at: DateTime<Utc>,
   }
   ```
4. Initialize sync vector as empty JSON map: `SyncVector: HashMap<(entity_type, entity_id), u64>`
5. Store device info persistently in SQLite for recovery

Provide:
- `register_device(db) -> Result<DeviceNode>` — creates or retrieves existing device
- `get_local_device(db) -> Result<Option<DeviceNode>>` — fetch local device info

### T098: Event Replication over NATS

Implement event replication in `src/replication.rs`:

When peers are discovered:
1. Establish connection to peer's NATS instance: `nats://{peer_tailscale_ip}:4222`
2. Subscribe to subject: `agileplus.sync.device.{local_device_id}`
3. Publish local events to: `agileplus.sync.device.{peer_device_id}` on the peer's NATS
4. Use NATS JetStream for reliable delivery with message persistence

Provide:
```rust
pub async fn replicate_events(
    local_device_id: &str,
    peer: &PeerInfo,
    events: Vec<DomainEvent>,
) -> Result<ReplicationResult, SyncError> {
    // Connect to peer NATS
    // Publish events to peer's device subject
    // Subscribe for peer's events to local device subject
    // Return count of events sent/received
}
```

Handle connection failures gracefully:
- Retry with exponential backoff (max 3 retries, 1s, 2s, 4s)
- Log failures with peer device_id
- Continue processing other peers

### T099: Vector Clock Sync

Implement vector clock synchronization in `src/vector_clock.rs`:

Each device maintains a `SyncVector: Map<(entity_type, entity_id), last_sequence>`.

Sync algorithm:
1. **Exchange vectors**: Device A sends its sync vector to Device B
2. **Identify missing**: For each entity, calculate:
   - Events A has that B is missing: `A[entity] > B[entity]`
   - Events B has that A is missing: `B[entity] > A[entity]`
3. **Transfer missing**: Exchange missing events based on sequence number range
4. **Apply via sync orchestrator**: Use `SyncOrchestrator::apply_events()` with conflict resolution
5. **Update vectors**: Advance local sync vector for each entity to max(local, peer)

Provide:
```rust
pub struct SyncVector {
    pub device_id: String,
    pub entries: HashMap<(String, String), u64>, // (entity_type, entity_id) -> sequence
}

pub async fn sync_with_peer(
    local_device_id: &str,
    peer: &PeerInfo,
    local_vector: &SyncVector,
    event_store: &dyn EventStore,
    orchestrator: &SyncOrchestrator,
) -> Result<SyncResult, SyncError> {
    // Exchange vectors with peer
    // Identify missing events
    // Transfer missing events
    // Apply events via orchestrator
    // Return updated vector
}

pub struct SyncResult {
    pub events_sent: usize,
    pub events_received: usize,
    pub conflicts_detected: usize,
    pub updated_vector: SyncVector,
}
```

## Definition of Done

- [ ] Crate `agileplus-p2p` compiles with all dependencies
- [ ] Peer discovery returns online peers via Tailscale local API
- [ ] Device registration creates persistent `DeviceNode` in SQLite
- [ ] Event replication transfers events to peer via NATS with JetStream
- [ ] Vector clock synchronization tracks per-entity sync state
- [ ] Integration test: two local instances discover each other and replicate events
- [ ] Connection failures are handled with retries and logging
- [ ] Documentation: Tailscale setup, NATS configuration, sync vector semantics

## Activity Log

- 2026-03-02T12:17:19Z – claude-opus – shell_pid=54708 – lane=doing – Assigned agent via workflow command
- 2026-03-02T12:25:18Z – claude-opus – shell_pid=54708 – lane=for_review – Ready for review: P2P sync via Tailscale with peer discovery, device registration, NATS replication, vector clocks (17 tests)
- 2026-03-02T23:19:40Z – claude-opus – shell_pid=54708 – lane=done – Merged to main, 516 tests passing
