---
work_package_id: WP14
title: gRPC Server & MCP Integration (Multi-Repo)
lane: "done"
dependencies: [WP00, WP13]
base_branch: 001-spec-driven-development-engine-WP13
base_commit: 3fc4a17c8bbced1dcddd3780def30ba7e544b1ef
created_at: '2026-03-02T01:23:35.484701+00:00'
subtasks:
- T079
- T080
- T080b
- T081
- T082
- T083
- T084
- T084b
- T084c
- T084d
phase: Phase 4 - Integration
assignee: ''
agent: "s1-wp14"
shell_pid: "60270"
review_status: "approved"
reviewed_by: "Koosha Paridehpour"
history:
- timestamp: '2026-02-27T00:00:00Z'
  lane: planned
  agent: system
  shell_pid: ''
  action: Prompt generated via /spec-kitty.tasks
---

# WP14: gRPC Server & MCP Integration (Multi-Repo)

## Implementation Command

```bash
spec-kitty implement WP14 --base WP13
```

## Objectives

Implement the tonic gRPC server in the `agileplus-core` Rust binary and wire the Python
FastMCP 3.0 service in `agileplus-mcp` to call it. This bridges the Rust domain layer to
the MCP ecosystem, allowing Claude Code, Codex, and other MCP-aware agents to invoke
AgilePlus commands through standardized tool definitions. Proto definitions live in the
`agileplus-proto` repo (consumed as a git submodule) and are split across four files:
`common.proto`, `core.proto`, `agents.proto`, and `integrations.proto`.

### Success Criteria

1. The tonic gRPC server starts on `0.0.0.0:50051` within `agileplus-core` and implements
   all RPCs defined in `core.proto` via the `AgilePlusCoreService` (from WP00/WP01 contracts).
2. Each gRPC handler delegates to the appropriate domain service through port traits,
   following the hexagonal architecture.
3. The Python MCP gRPC client in `agileplus-mcp` connects to the Rust server and
   successfully completes round-trip calls for all defined tools.
4. Each MCP tool in `agileplus-mcp/src/agileplus_mcp/tools/` maps 1:1 to the tool
   definitions in `contracts/mcp-tools.json` and routes through the gRPC client.
5. Bidirectional gRPC streaming delivers real-time agent status events from Rust to Python
   MCP clients.
6. Pact contract tests verify the Rust `agileplus-core` (provider) and Python
   `agileplus-mcp` (consumer) agree on message formats and behavior.

## Context & Constraints

### Architecture Context

- The `agileplus-core` Rust binary runs both the CLI (foreground, clap) and the gRPC
  server (background, tonic). When invoked as `agileplus serve`, it starts the gRPC server
  and optionally the axum HTTP API (WP15). The core server also acts as a proxy/router,
  forwarding agent and integration requests to the `agileplus-agents` and
  `agileplus-integrations` services (or stubs when those services are unavailable).
- The Python MCP service (`agileplus-mcp/src/agileplus_mcp/`) is a separate process
  started via `uv run python -m agileplus_mcp`. It registers MCP tools with FastMCP 3.0
  and connects to the Rust gRPC server as a client.
- Communication is strictly via Protobuf-defined messages. No JSON, no REST between the
  two services.
- Proto source of truth lives in the `agileplus-proto` repo, consumed as a git submodule.
  Proto definitions are split across four files: `common.proto`, `core.proto`,
  `agents.proto`, and `integrations.proto`. Generated stubs are imported in Python as
  `agileplus_proto`.

### Proto Contract

The proto files in the `agileplus-proto` repo (scaffolded in WP00/WP01) define the
`AgilePlusCoreService` in `core.proto`. Key RPCs include:
- `GetFeature`, `ListFeatures`, `CreateFeature` — feature management
- `GetWorkPackage`, `ListWorkPackages` — WP queries
- `RunCommand` — dispatch a CLI command (specify, plan, implement, etc.)
- `GetAuditTrail`, `VerifyAuditChain` — audit queries
- `GetGovernanceContract`, `EvaluateGovernance` — governance queries
- `StreamAgentEvents` — server-streaming RPC for real-time agent status

### Prior Work Dependencies

- WP00: `agileplus-proto` repo bootstrapped; `core.proto` (and `common.proto`,
  `agents.proto`, `integrations.proto`) defined; git submodule wired into `agileplus-core`
  and `agileplus-mcp`; tonic-build and grpcio codegen configured.
- WP01: Proto file, tonic-build setup, Rust/Python stubs generated (within multi-repo layout).
- WP02: Python MCP scaffold with stub gRPC client and tool files.
- WP13: All 7 CLI commands exist and can be invoked programmatically.
- WP03-WP05: Domain types, governance, audit, port traits.
- WP06-WP10: All adapter implementations.

### Constraints

- gRPC server shares the tokio runtime with the CLI binary. Use `tokio::select!` or a
  separate task for the server.
- Python gRPC client uses `grpcio` (not `grpclib`) for compatibility with FastMCP's
  async model.
- Pact contract tests require a Pact broker or local file exchange. Use local files for
  initial development.
- Performance target: gRPC round-trip <10ms for queries, <100ms for command dispatch.

---

## Subtask Guidance

### T079: Implement tonic gRPC Server in `agileplus-core/crates/agileplus-grpc/src/server.rs`

**File**: `agileplus-core/crates/agileplus-grpc/src/server.rs`

**Purpose**: Create the gRPC server in the `agileplus-core` repo that exposes the Rust
domain layer to external clients (primarily the Python MCP service). The server implements
`AgilePlusCoreService` as defined in `core.proto` from the `agileplus-proto` submodule.

**Implementation Steps**:

1. Define the server struct that holds references to all port implementations:
   ```rust
   pub struct AgilePlusCoreServer<S, V, A, R, O>
   where
       S: StoragePort,
       V: VcsPort,
       A: AgentPort,
       R: ReviewPort,
       O: ObservabilityPort,
   {
       storage: Arc<S>,
       vcs: Arc<V>,
       agents: Arc<A>,
       review: Arc<R>,
       telemetry: Arc<O>,
   }
   ```

2. Implement the generated tonic service trait (`agileplus_proto::agile_plus_core_server::
   AgilePlusCoreService`) for this struct. The trait is generated by `tonic-build` from
   `core.proto` in the `agileplus-proto` submodule.

3. For each unary RPC, implement the handler method:
   ```rust
   async fn get_feature(
       &self,
       request: Request<GetFeatureRequest>,
   ) -> Result<Response<GetFeatureResponse>, Status> {
       let slug = request.into_inner().slug;
       match self.storage.get_feature_by_slug(&slug).await {
           Ok(feature) => Ok(Response::new(feature.into())),
           Err(DomainError::NotFound(_)) => Err(Status::not_found("Feature not found")),
           Err(e) => Err(Status::internal(e.to_string())),
       }
   }
   ```

4. Implement the `RunCommand` RPC which dispatches to the appropriate CLI command logic:
   ```rust
   async fn run_command(
       &self,
       request: Request<RunCommandRequest>,
   ) -> Result<Response<RunCommandResponse>, Status> {
       let req = request.into_inner();
       let result = match req.command.as_str() {
           "specify" => commands::specify::execute_from_args(req.args, &self.storage, &self.vcs, &self.telemetry).await,
           "plan" => commands::plan::execute_from_args(req.args, &self.storage, &self.vcs, &self.telemetry).await,
           // ... all 7 commands
           _ => Err(DomainError::UnknownCommand(req.command)),
       };
       // Convert result to RunCommandResponse
   }
   ```

5. Set up the server startup function:
   ```rust
   pub async fn start_server(
       addr: SocketAddr,
       storage: Arc<impl StoragePort>,
       vcs: Arc<impl VcsPort>,
       // ... other ports
   ) -> Result<()> {
       let service = AgilePlusCoreServer::new(storage, vcs, agents, review, telemetry);
       Server::builder()
           .add_service(AgilePlusCoreServiceServer::new(service))
           .serve(addr)
           .await?;
       Ok(())
   }
   ```

6. Add graceful shutdown handling: listen for SIGTERM/SIGINT, drain active RPCs.

---

### T080b: Implement gRPC Proxy/Routing in `agileplus-core/crates/agileplus-grpc/src/proxy.rs`

**File**: `agileplus-core/crates/agileplus-grpc/src/proxy.rs`

**Purpose**: The core gRPC server must forward agent and integration requests to the
`agileplus-agents` and `agileplus-integrations` services when they are available, and fall
back to in-process stubs when they are not. This allows `agileplus-core` to be the single
gRPC entry point for MCP clients without requiring all downstream services to be running.

**Implementation Steps**:

1. Create a `ProxyRouter` struct holding optional channels to downstream services:
   ```rust
   pub struct ProxyRouter {
       agents_client: Option<AgentsServiceClient<Channel>>,
       integrations_client: Option<IntegrationsServiceClient<Channel>>,
   }
   ```

2. Implement connection logic: attempt to connect to `agileplus-agents` and
   `agileplus-integrations` at startup; log a warning and use stubs if unavailable.

3. Implement forwarding methods: for each agent/integration RPC, delegate to the real
   downstream client if connected, otherwise invoke a stub that returns a `UNIMPLEMENTED`
   or a canned response suitable for development.

4. Wire `ProxyRouter` into the `AgilePlusCoreServer` struct and invoke it from the
   relevant handler methods (e.g., `RunCommand` with `command == "implement"`).

5. Expose a health-check endpoint that reports which downstream services are reachable.

**Testing**: Unit test with mock downstream clients. Test fallback-to-stub path when
downstream is unavailable. Integration test with a real downstream server running.

**Error Mapping**: Define a consistent mapping from `DomainError` variants to gRPC `Status`
codes: `NotFound -> NOT_FOUND`, `InvalidState -> FAILED_PRECONDITION`,
`Unauthorized -> UNAUTHENTICATED`, `Internal -> INTERNAL`.

**Testing**: Unit test each handler with mock port implementations. Verify correct Status
codes for error cases. Integration test with a real tonic client.

---

### T080: Wire gRPC Handlers to Domain Services

**File**: `agileplus-core/crates/agileplus-grpc/src/server.rs` (continued) and `agileplus-core/crates/agileplus-grpc/src/conversions.rs`

**Purpose**: Implement Protobuf-to-domain and domain-to-Protobuf conversion functions, and
ensure every gRPC handler correctly delegates to the domain layer.

**Implementation Steps**:

1. Create a `conversions.rs` module with `From`/`Into` implementations:
   ```rust
   impl From<domain::Feature> for proto::Feature {
       fn from(f: domain::Feature) -> Self {
           proto::Feature {
               id: f.id as i64,
               slug: f.slug,
               friendly_name: f.friendly_name,
               state: f.state.to_string(),
               spec_hash: f.spec_hash.to_vec(),
               target_branch: f.target_branch,
               created_at: f.created_at.to_rfc3339(),
               updated_at: f.updated_at.to_rfc3339(),
           }
       }
   }
   ```

2. Implement conversions for all domain types: Feature, WorkPackage, GovernanceContract,
   AuditEntry, Evidence, PolicyRule, Metric.

3. Implement request-to-args conversions for `RunCommand`: parse the gRPC request's `args`
   map into the corresponding clap Args struct for each command.

4. Wire the remaining handlers not covered in T079:
   - `ListFeatures`: query StoragePort with optional state filter.
   - `CreateFeature`: create via StoragePort, return created feature.
   - `ListWorkPackages`: query by feature_id, optional state filter.
   - `GetAuditTrail`: load full audit chain for a feature.
   - `VerifyAuditChain`: delegate to domain `verify_chain()` from WP04.
   - `EvaluateGovernance`: delegate to GovernanceEvaluator from WP13/T074.

5. Add request validation: check required fields, validate slugs match expected patterns,
   verify IDs are positive.

6. Add OpenTelemetry trace context propagation: extract trace context from gRPC metadata
   headers, create child spans for each handler.

**Testing**: Round-trip test: create a domain object, convert to proto, convert back, verify
equality. Test all handlers end-to-end with mock storage returning known data.

---

### T081: Implement Python gRPC Client in `agileplus-mcp/src/agileplus_mcp/grpc_client.py`

**File**: `agileplus-mcp/src/agileplus_mcp/grpc_client.py`

**Purpose**: Replace the stub gRPC client (from WP02) with a full implementation that
connects to the `agileplus-core` Rust gRPC server and provides a Pythonic async interface.
Uses generated stubs from the `agileplus-proto` submodule (imported as `agileplus_proto`).

**Implementation Steps**:

1. Create the client class with connection management:
   ```python
   import grpc
   from agileplus_proto import core_pb2, core_pb2_grpc

   class AgilePlusCoreClient:
       def __init__(self, address: str = "localhost:50051"):
           self._address = address
           self._channel: grpc.aio.Channel | None = None
           self._stub: core_pb2_grpc.AgilePlusCoreServiceStub | None = None

       async def connect(self) -> None:
           self._channel = grpc.aio.insecure_channel(self._address)
           await self._channel.channel_ready()
           self._stub = core_pb2_grpc.AgilePlusCoreServiceStub(self._channel)

       async def close(self) -> None:
           if self._channel:
               await self._channel.close()
   ```

2. Implement typed wrapper methods for each RPC:
   ```python
   async def get_feature(self, slug: str) -> dict:
       request = core_pb2.GetFeatureRequest(slug=slug)
       response = await self._stub.GetFeature(request)
       return self._feature_to_dict(response.feature)

   async def list_features(self, state: str | None = None) -> list[dict]:
       request = core_pb2.ListFeaturesRequest(state=state or "")
       response = await self._stub.ListFeatures(request)
       return [self._feature_to_dict(f) for f in response.features]

   async def run_command(self, command: str, **kwargs) -> dict:
       request = core_pb2.RunCommandRequest(
           command=command,
           args={k: str(v) for k, v in kwargs.items()},
       )
       response = await self._stub.RunCommand(request)
       return {"success": response.success, "output": response.output}
   ```

3. Implement the agent event stream consumer:
   ```python
   async def stream_agent_events(self, feature_slug: str):
       request = core_pb2.StreamAgentEventsRequest(feature_slug=feature_slug)
       async for event in self._stub.StreamAgentEvents(request):
           yield {
               "type": event.event_type,
               "wp_id": event.wp_id,
               "agent_id": event.agent_id,
               "message": event.message,
               "timestamp": event.timestamp,
           }
   ```

4. Add error handling with retry logic:
   - Catch `grpc.aio.AioRpcError` and map status codes to Python exceptions.
   - Implement exponential backoff retry for transient errors (UNAVAILABLE, DEADLINE_EXCEEDED).
   - Connection health check with automatic reconnect.

5. Add OpenTelemetry context propagation: inject trace context into gRPC metadata so Rust
   server can continue the trace.

6. Use `contextlib.asynccontextmanager` for connection lifecycle:
   ```python
   @asynccontextmanager
   async def connect_client(address: str = "localhost:50051"):
       client = AgilePlusCoreClient(address)
       await client.connect()
       try:
           yield client
       finally:
           await client.close()
   ```

**Testing**: Unit test with a mock gRPC channel. Test connection failure handling, retry
behavior, and correct proto message construction.

---

### T082: Implement MCP Tool Handlers in `agileplus-mcp/src/agileplus_mcp/tools/`

**Files**:
- `agileplus-mcp/src/agileplus_mcp/tools/features.py`
- `agileplus-mcp/src/agileplus_mcp/tools/governance.py`
- `agileplus-mcp/src/agileplus_mcp/tools/status.py`

**Purpose**: Replace the stub tool files (from WP02) with full implementations that receive
MCP tool calls from agents, route them through the gRPC client, and return structured
results.

**Implementation Steps**:

1. Each tool file registers tools with FastMCP using decorators. The tool definitions must
   match `contracts/mcp-tools.json` exactly (tool names, parameter schemas, descriptions).

2. Implement `features.py`:
   ```python
   from fastmcp import tool
   from agileplus_mcp.grpc_client import AgilePlusCoreClient

   @tool(name="agileplus_specify")
   async def specify(feature_slug: str, client: AgilePlusCoreClient) -> dict:
       """Run the specify command for a feature, creating or updating the spec."""
       result = await client.run_command("specify", feature=feature_slug)
       return {"status": "success" if result["success"] else "error", "output": result["output"]}

   @tool(name="agileplus_plan")
   async def plan(feature_slug: str, client: AgilePlusCoreClient) -> dict:
       """Generate work packages from the feature specification."""
       result = await client.run_command("plan", feature=feature_slug)
       return {"status": "success" if result["success"] else "error", "output": result["output"]}

   @tool(name="agileplus_implement")
   async def implement(feature_slug: str, wp_id: str | None = None, client: AgilePlusCoreClient = None) -> dict:
       """Dispatch agents to implement work packages."""
       kwargs = {"feature": feature_slug}
       if wp_id:
           kwargs["wp"] = wp_id
       result = await client.run_command("implement", **kwargs)
       return {"status": "success" if result["success"] else "error", "output": result["output"]}
   ```

3. Implement `governance.py`:
   ```python
   @tool(name="agileplus_validate")
   async def validate(feature_slug: str, client: AgilePlusCoreClient) -> dict:
       """Validate governance compliance for a feature."""
       result = await client.run_command("validate", feature=feature_slug)
       return result

   @tool(name="agileplus_get_governance")
   async def get_governance(feature_slug: str, client: AgilePlusCoreClient) -> dict:
       """Retrieve the governance contract for a feature."""
       return await client.get_governance_contract(feature_slug)

   @tool(name="agileplus_get_audit_trail")
   async def get_audit_trail(feature_slug: str, verify: bool = False, client: AgilePlusCoreClient = None) -> dict:
       """Retrieve and optionally verify the audit trail for a feature."""
       trail = await client.get_audit_trail(feature_slug)
       if verify:
           verification = await client.verify_audit_chain(feature_slug)
           trail["verification"] = verification
       return trail
   ```

4. Implement `status.py`:
   ```python
   @tool(name="agileplus_status")
   async def status(feature_slug: str | None = None, client: AgilePlusCoreClient = None) -> dict:
       """Get status of features and work packages."""
       if feature_slug:
           feature = await client.get_feature(feature_slug)
           wps = await client.list_work_packages(feature_slug)
           return {"feature": feature, "work_packages": wps}
       else:
           features = await client.list_features()
           return {"features": features}

   @tool(name="agileplus_ship")
   async def ship(feature_slug: str, target_branch: str = "main", client: AgilePlusCoreClient = None) -> dict:
       """Ship a validated feature to the target branch."""
       result = await client.run_command("ship", feature=feature_slug, target=target_branch)
       return result
   ```

5. Register all tools with the FastMCP server in `server.py`:
   ```python
   from fastmcp import FastMCP
   from agileplus_mcp.tools import features, governance, status

   app = FastMCP("AgilePlus")
   # Tools are auto-registered via @tool decorators when modules are imported
   ```

6. Ensure the gRPC client is injected into tool handlers via FastMCP's dependency injection
   or a module-level singleton initialized at startup.

**Testing**: Unit test each tool handler with a mock gRPC client. Verify correct parameter
passing and response formatting. Test error propagation from gRPC errors to MCP error
responses.

---

### T083: Implement Agent Event Streaming

**Files**:
- `agileplus-core/crates/agileplus-grpc/src/streaming.rs`
- `agileplus-mcp/src/agileplus_mcp/tools/status.py` (add streaming tool)

**Purpose**: Implement bidirectional gRPC streaming so the Python MCP service can receive
real-time agent status events (agent started, PR created, review received, agent finished)
from the Rust core.

**Implementation Steps**:

1. Define the event types in the domain layer:
   ```rust
   #[derive(Clone, Debug, Serialize)]
   pub enum AgentEvent {
       AgentStarted { wp_id: String, agent_id: String },
       PrCreated { wp_id: String, pr_url: String },
       ReviewReceived { wp_id: String, review_status: String, comments: usize },
       AgentFixing { wp_id: String, cycle: u32 },
       AgentCompleted { wp_id: String, success: bool },
       WpStateChanged { wp_id: String, old_state: String, new_state: String },
   }
   ```

2. Create an event bus in the Rust core using `tokio::sync::broadcast`:
   ```rust
   pub struct EventBus {
       sender: broadcast::Sender<AgentEvent>,
   }

   impl EventBus {
       pub fn new(capacity: usize) -> Self {
           let (sender, _) = broadcast::channel(capacity);
           Self { sender }
       }
       pub fn publish(&self, event: AgentEvent) { let _ = self.sender.send(event); }
       pub fn subscribe(&self) -> broadcast::Receiver<AgentEvent> { self.sender.subscribe() }
   }
   ```

3. Implement the server-streaming RPC in the gRPC server:
   ```rust
   async fn stream_agent_events(
       &self,
       request: Request<StreamAgentEventsRequest>,
   ) -> Result<Response<Self::StreamAgentEventsStream>, Status> {
       let feature_slug = request.into_inner().feature_slug;
       let mut rx = self.event_bus.subscribe();
       let stream = async_stream::stream! {
           while let Ok(event) = rx.recv().await {
               if event.matches_feature(&feature_slug) {
                   yield Ok(event.into());
               }
           }
       };
       Ok(Response::new(Box::pin(stream)))
   }
   ```

4. Wire the event bus into the agent dispatch adapter (WP08): publish events at each stage
   of agent execution.

5. On the Python side, add a streaming status tool:
   ```python
   @tool(name="agileplus_stream_status")
   async def stream_status(feature_slug: str, client: AgilePlusCoreClient) -> AsyncIterator[dict]:
       async for event in client.stream_agent_events(feature_slug):
           yield event
   ```

6. Handle stream disconnection gracefully: auto-reconnect on UNAVAILABLE, log dropped
   events.

**Testing**: Integration test: start gRPC server, publish events from a test task, consume
via Python client, verify all events received in order. Test disconnection and reconnection.

---

### T084: Write Pact Contract Tests for Rust-Python gRPC Boundary

**Files**:
- `agileplus-core/tests/contract/rust_provider_test.rs`
- `agileplus-mcp/tests/contract/python_consumer_test.py`
- `agileplus-core/tests/contract/pacts/` (generated pact files)

**Purpose**: Establish contract tests that verify the Rust gRPC provider and Python gRPC
consumer agree on message formats and behavior, preventing integration regressions.

**Implementation Steps**:

1. Set up the Python consumer side with `pact-python`:
   ```python
   # agileplus-mcp/tests/contract/test_agileplus_consumer.py
   from pact import Consumer, Provider

   pact = Consumer("AgilePlusMCP").has_pact_with(
       Provider("AgilePlusCoreService"),
       pact_dir="../../agileplus-core/tests/contract/pacts",
   )

   def test_get_feature():
       expected = {"slug": "test-feature", "state": "planned", "friendly_name": "Test Feature"}
       pact.given("a feature exists").upon_receiving("a get feature request") \
           .with_request("get_feature", slug="test-feature") \
           .will_respond_with(expected)
       with pact:
           result = client.get_feature("test-feature")
           assert result["slug"] == "test-feature"
   ```

2. Set up the Rust provider side with `pact-rust`:
   ```rust
   #[tokio::test]
   async fn verify_pact_contract() {
       let provider = ProviderBuilder::new("AgilePlusCoreService")
           .with_pact_source(PactSource::Dir("tests/contract/pacts"))
           .with_provider_state_url("http://localhost:50051/pact-state")
           .build();
       provider.verify().await.expect("Pact verification failed");
   }
   ```

3. Create pact interactions for each critical RPC:
   - GetFeature: feature exists -> returns feature; feature missing -> NOT_FOUND.
   - ListFeatures: with state filter -> returns filtered list.
   - RunCommand: valid command -> success response; invalid command -> error.
   - GetAuditTrail: feature with audit entries -> returns chain.
   - VerifyAuditChain: valid chain -> passes; tampered chain -> fails.

4. Note: Pact for gRPC is less mature than for HTTP. If `pact-python` gRPC support is
   insufficient, use a Pact HTTP proxy approach:
   - Stand up a thin HTTP-to-gRPC bridge for testing.
   - Or use proto-level contract testing with `buf breaking` for schema compatibility.

5. Add pact verification to the Makefile: `make test-contracts`.

6. Store generated pact files in `agileplus-core/tests/contract/pacts/` and commit them.
   The provider (`agileplus-core`, Rust) verification runs against these files produced by
   the consumer (`agileplus-mcp`, Python).

**Testing**: The pact tests themselves are the tests. Verify they run in CI and catch
intentional breaking changes (modify a proto field, verify pact fails).

### Subtask T084b: MCP Sampling Primitive

**Purpose**: Implement server-initiated analysis via MCP Sampling (FR-049).

**Steps**:
1. Implement sampling handlers in `agileplus-mcp/src/agileplus_mcp/sampling/`
2. Auto-triage: server analyzes agent output and classifies bugs/issues
3. Governance pre-check: server proactively validates before state transitions
4. Retrospective generation: server-initiated analysis of feature history

**Files**: `agileplus-mcp/src/agileplus_mcp/sampling/`
**Validation**: Sampling triggers produce valid triage/governance results

### Subtask T084c: MCP Roots Primitive

**Purpose**: Implement workspace boundary declarations via MCP Roots (FR-049).

**Steps**:
1. Implement roots provider in MCP server
2. Declare per-feature roots: feature dir, worktree paths, config dirs
3. Roots update dynamically as features/WPs are created

**Files**: `agileplus-mcp/src/agileplus_mcp/server.py`
**Validation**: MCP client receives correct workspace boundaries

### Subtask T084d: MCP Elicitation Primitive

**Purpose**: Implement discovery interviews via MCP Elicitation (FR-049).

**Steps**:
1. Implement elicitation handlers for specify/clarify flows
2. Server sends structured questions, receives answers
3. Wire to specify and clarify command workflows via gRPC

**Files**: `agileplus-mcp/src/agileplus_mcp/server.py`
**Validation**: Elicitation flow completes a discovery interview

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| tonic/grpcio version incompatibility | Connection failures between Rust and Python | Pin proto version, test with exact dependency versions in CI |
| gRPC streaming backpressure | Memory growth if Python consumer is slow | Bounded broadcast channel (1024 events), drop oldest on overflow |
| Pact gRPC support immaturity | Contract tests unreliable | Fall back to `buf breaking` for schema checks + manual integration tests |
| FastMCP 3.0 API changes | Tool registration breaks | Pin FastMCP version, wrap registration in adapter layer |
| Proto schema evolution | Breaking changes between services | Use `buf breaking` in CI, follow proto3 backward-compatibility rules |

## Review Guidance

### What to Check

1. **Proto fidelity**: Every RPC in `core.proto` (and relevant RPCs from `agents.proto`,
   `integrations.proto`) has a corresponding server handler in `agileplus-core` and a
   Python client method in `agileplus-mcp`. No RPCs are unimplemented.

2. **Error mapping consistency**: DomainError -> gRPC Status mapping is consistent across
   all handlers. Python client maps Status codes back to meaningful exceptions.

3. **Streaming correctness**: Event bus does not leak subscribers. Stream ends cleanly when
   client disconnects. Events are filtered by feature slug.

4. **MCP tool compliance**: Every tool in `contracts/mcp-tools.json` has a corresponding
   handler in `agileplus-mcp/src/agileplus_mcp/tools/`. Parameter names and types match
   exactly.

5. **Trace propagation**: OpenTelemetry context flows from Python MCP -> gRPC metadata ->
   Rust handler spans. Verify with a test that creates a parent span in Python and checks
   for child span in Rust logs.

### Acceptance Criteria Traceability

- FR-010 (MCP integration): T082
- FR-011 (Agent dispatch via gRPC): T079, T080
- FR-012 (Review loop events): T083
- FR-013 (Agent event streaming): T083
- Proto contract compliance: T084

---

## Activity Log

| Timestamp | Event |
|-----------|-------|
| 2026-02-27T00:00:00Z | WP14 prompt generated via /spec-kitty.tasks |
- 2026-03-02T01:23:35Z – s1-wp14 – shell_pid=60270 – lane=doing – Assigned agent via workflow command
- 2026-03-02T01:37:36Z – s1-wp14 – shell_pid=60270 – lane=for_review – Ready: gRPC server and MCP integration
- 2026-03-02T01:38:04Z – s1-wp14 – shell_pid=60270 – lane=done – gRPC server and MCP integration complete
