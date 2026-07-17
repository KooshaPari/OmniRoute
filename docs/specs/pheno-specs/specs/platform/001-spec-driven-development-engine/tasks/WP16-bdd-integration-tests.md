---
work_package_id: WP16
title: BDD Acceptance Tests & Integration Suite
lane: "done"
dependencies:
- WP15
base_branch: 001-spec-driven-development-engine-WP15
base_commit: 924613f1dc906265c96c21aa1bf7300271ce983c
created_at: '2026-03-02T02:17:36.682184+00:00'
subtasks:
- T091
- T092
- T093
- T094
- T095
- T096
- T097
phase: Phase 4 - Integration
assignee: ''
agent: "s1-wp16"
shell_pid: "65013"
review_status: "approved"
reviewed_by: "Koosha Paridehpour"
history:
- timestamp: '2026-02-27T00:00:00Z'
  lane: planned
  agent: system
  shell_pid: ''
  action: Prompt generated via /spec-kitty.tasks
---

# WP16: BDD Acceptance Tests & Integration Suite

## Implementation Command

```bash
spec-kitty implement WP16 --base WP15
```

## Objectives

Create a comprehensive test suite covering BDD acceptance tests (mapped to spec FRs),
Pact contract tests for the Rust-Python gRPC boundary, and Docker-based full-stack
integration tests that exercise the entire specify-to-ship workflow.

### Success Criteria

1. `.feature` files exist for all core user stories: specify, implement, governance, and
   audit, with scenario names referencing FR IDs.
2. Rust BDD step definitions (cucumber-rs) execute all `.feature` files against the Rust
   domain layer and CLI.
3. Python BDD step definitions (behave) execute shared `.feature` files against the MCP
   tools and gRPC client.
4. Pact contract test fixtures verify Rust provider and Python consumer message
   compatibility.
5. `docker-compose.test.yml` spins up the full stack (Rust binary + Python MCP + SQLite)
   for integration testing.
6. A full workflow integration test runs the complete specify -> research -> plan ->
   implement -> validate -> ship cycle on a test repository.
7. `make test` runs all unit, BDD, contract, and integration tests.
8. Test coverage exceeds 80% for core domain logic.

## Context & Constraints

### Testing Architecture

```
tests/
├── bdd/
│   └── features/              # Shared .feature files (Cucumber/Behave)
│       ├── specify.feature
│       ├── implement.feature
│       ├── governance.feature
│       └── audit.feature
├── contract/
│   └── pacts/                 # Pact contract files (JSON)
├── integration/
│   └── docker-compose.test.yml
└── fixtures/
    ├── sample-spec.md
    ├── sample-plan.md
    ├── sample-governance.json
    └── sample-audit-chain.jsonl
```

- Rust BDD tests live in `tests/bdd/` at the workspace root (or in each crate's `tests/`).
- Python BDD tests live in `mcp/tests/bdd/`.
- Both Rust and Python share the same `.feature` files. For Rust, they are referenced
  directly. For Python, they are symlinked or copied during test setup.

### Prior Work Dependencies

- WP01-WP15: The entire system must be built. This WP is the final verification layer.
- WP04: Audit chain and governance evaluation (tested directly).
- WP13: All 7 CLI commands (exercised in integration tests).
- WP14: gRPC server and Python MCP client (tested via contract and integration tests).
- WP15: API layer (tested via integration tests).

### Constraints

- BDD tests must be deterministic: no network calls, no real git remotes, no real agents.
- Integration tests use Docker Compose and require Docker to be available.
- Test fixtures must be self-contained and not depend on any external state.
- Python BDD tests require `behave` and `pact-python` in the Python environment.
- Target: all tests complete in <5 minutes on CI (parallel execution where possible).

---

## Subtask Guidance

### T091: Create `.feature` Files for Core User Stories

**Directory**: `tests/bdd/features/`

**Purpose**: Write Gherkin feature files that map directly to functional requirements from
the spec. Each scenario name includes the FR ID for traceability.

**Implementation Steps**:

1. Create `specify.feature`:
   ```gherkin
   Feature: Specification workflow
     As a developer using AgilePlus
     I want to create and refine feature specifications
     So that my development work is well-defined and traceable

     @FR-001
     Scenario: FR-001 - Specify creates spec in git and SQLite
       Given a fresh AgilePlus project with no features
       When I run "agileplus specify" with feature slug "test-feature"
       And I provide specification details via stdin
       Then a spec.md file exists at "kitty-specs/test-feature/spec.md"
       And the feature "test-feature" exists in SQLite with state "specified"
       And an audit entry records the "created -> specified" transition

     @FR-008
     Scenario: FR-008 - Re-running specify triggers refinement
       Given a feature "test-feature" in state "specified"
       When I run "agileplus specify" with feature slug "test-feature"
       And I provide updated specification details
       Then the spec.md file is updated with a new spec_hash
       And an audit entry records a "refinement" event with diff reference

     @FR-033
     Scenario: FR-033 - Specify rejects feature in wrong state
       Given a feature "test-feature" in state "implementing"
       When I run "agileplus specify" with feature slug "test-feature"
       Then the command fails with an invalid state error
       And the feature state remains "implementing"
   ```

2. Create `implement.feature`:
   ```gherkin
   Feature: Implementation workflow
     As a developer using AgilePlus
     I want to dispatch agents to implement work packages
     So that code is written according to the plan

     @FR-004
     Scenario: FR-004 - Implement dispatches agent to worktree
       Given a feature "test-feature" in state "planned" with 2 work packages
       When I run "agileplus implement" for feature "test-feature"
       Then a worktree is created for WP01
       And an agent is dispatched with the WP01 prompt
       And an audit entry records the "planned -> implementing" transition

     @FR-010
     Scenario: FR-010 - Implement creates PR with WP context
       Given a feature "test-feature" with WP01 in state "doing"
       And the agent has committed code in the WP01 worktree
       When the agent completes WP01 implementation
       Then a PR is created with title "WP01: [title]"
       And the PR body contains the WP goal and FR references

     @FR-038
     Scenario: FR-038 - Non-overlapping WPs run in parallel
       Given a feature with WP01 (file_scope: ["src/a.rs"]) and WP02 (file_scope: ["src/b.rs"])
       When I run "agileplus implement" for the feature
       Then WP01 and WP02 are dispatched concurrently

     @FR-039
     Scenario: FR-039 - Overlapping WPs are serialized
       Given a feature with WP01 (file_scope: ["src/a.rs"]) and WP02 (file_scope: ["src/a.rs"])
       When I run "agileplus implement" for the feature
       Then WP02 waits until WP01 completes before starting
   ```

3. Create `governance.feature`:
   ```gherkin
   Feature: Governance enforcement
     As a project with quality standards
     I want governance contracts to enforce evidence requirements
     So that no feature ships without proper verification

     @FR-018
     Scenario: FR-018 - Governance contract binds to feature
       Given a feature "test-feature" in state "researched"
       When I run "agileplus plan" for feature "test-feature"
       Then a governance contract is created for the feature
       And the contract contains rules for each state transition

     @FR-019
     Scenario: FR-019 - Validate checks governance compliance
       Given a feature "test-feature" in state "implementing"
       And the governance contract requires test_result evidence for FR-001
       And evidence exists for FR-001 with type "test_result"
       When I run "agileplus validate" for feature "test-feature"
       Then validation passes
       And the feature transitions to "validated"

     @FR-019 @negative
     Scenario: FR-019 - Validate blocks on missing evidence
       Given a feature "test-feature" in state "implementing"
       And the governance contract requires test_result evidence for FR-001
       And no evidence exists for FR-001
       When I run "agileplus validate" for feature "test-feature"
       Then validation fails
       And the report shows FR-001 evidence is missing
       And the feature state remains "implementing"
   ```

4. Create `audit.feature`:
   ```gherkin
   Feature: Audit trail integrity
     As an auditor
     I want a tamper-evident hash-chained audit log
     So that I can verify the complete history of a feature

     @FR-016
     Scenario: FR-016 - Audit entries form a hash chain
       Given a feature "test-feature" with 5 audit entries
       When I verify the audit chain for "test-feature"
       Then all entries have valid hash linkage
       And the verification returns success with count 5

     @FR-016 @negative
     Scenario: FR-016 - Tampered audit entry detected
       Given a feature "test-feature" with 5 audit entries
       And audit entry 3 has been tampered with
       When I verify the audit chain for "test-feature"
       Then verification fails at entry 3
       And the error identifies the hash mismatch
   ```

5. Tag all scenarios with FR IDs for selective execution: `@FR-001`, `@FR-016`, etc.
   Add `@smoke` tags for the most critical scenarios (subset for fast CI feedback).

**Testing**: Verify all `.feature` files parse correctly with both cucumber-rs and behave
parsers.

---

### T092: Implement cucumber-rs Step Definitions for Rust BDD Tests

**Directory**: `tests/bdd/` (workspace root)

**Purpose**: Write Rust step definitions that execute the `.feature` file scenarios against
the actual domain layer and CLI commands using mock adapters.

**Implementation Steps**:

1. Set up the cucumber-rs test runner:
   ```rust
   // tests/bdd/main.rs
   use cucumber::World;

   #[derive(Debug, Default, World)]
   pub struct AgilePlusWorld {
       storage: MockStoragePort,
       vcs: MockVcsPort,
       agents: MockAgentPort,
       review: MockReviewPort,
       telemetry: MockObservabilityPort,
       last_result: Option<Result<String, String>>,
       temp_dir: Option<tempfile::TempDir>,
   }

   fn main() {
       futures::executor::block_on(
           AgilePlusWorld::cucumber()
               .with_default_cli()
               .run("tests/bdd/features/")
       );
   }
   ```

2. Implement Given steps for setting up test state:
   ```rust
   #[given(regex = r#"a fresh AgilePlus project with no features"#)]
   async fn fresh_project(world: &mut AgilePlusWorld) {
       world.temp_dir = Some(tempfile::tempdir().unwrap());
       world.storage = MockStoragePort::empty();
       world.vcs = MockVcsPort::with_repo(world.temp_dir.as_ref().unwrap().path());
   }

   #[given(regex = r#"a feature "([^"]*)" in state "([^"]*)""#)]
   async fn feature_in_state(world: &mut AgilePlusWorld, slug: String, state: String) {
       let feature = Feature {
           slug: slug.clone(),
           state: FeatureState::from_str(&state).unwrap(),
           // ... defaults
       };
       world.storage.insert_feature(feature);
   }

   #[given(regex = r#"a feature "([^"]*)" with (\d+) audit entries"#)]
   async fn feature_with_audit(world: &mut AgilePlusWorld, slug: String, count: usize) {
       // Create feature and N audit entries with valid hash chain
       let feature = world.storage.get_feature_by_slug(&slug).await.unwrap();
       let entries = create_valid_audit_chain(feature.id, count);
       for entry in entries {
           world.storage.append_audit_entry(entry).await.unwrap();
       }
   }
   ```

3. Implement When steps for executing commands:
   ```rust
   #[when(regex = r#"I run "agileplus specify" with feature slug "([^"]*)""#)]
   async fn run_specify(world: &mut AgilePlusWorld, slug: String) {
       let args = SpecifyArgs { feature: slug, ..Default::default() };
       world.last_result = Some(
           commands::specify::execute(args, &world.storage, &world.vcs, &world.telemetry)
               .await
               .map(|_| "ok".to_string())
               .map_err(|e| e.to_string())
       );
   }

   #[when(regex = r#"I verify the audit chain for "([^"]*)""#)]
   async fn verify_chain(world: &mut AgilePlusWorld, slug: String) {
       let feature = world.storage.get_feature_by_slug(&slug).await.unwrap();
       let trail = world.storage.get_audit_trail(feature.id).await.unwrap();
       world.last_result = Some(
           domain::audit::verify_chain(&trail)
               .map(|count| format!("valid:{count}"))
               .map_err(|e| e.to_string())
       );
   }
   ```

4. Implement Then steps for assertions:
   ```rust
   #[then(regex = r#"the feature "([^"]*)" exists in SQLite with state "([^"]*)""#)]
   async fn feature_exists_with_state(world: &mut AgilePlusWorld, slug: String, state: String) {
       let feature = world.storage.get_feature_by_slug(&slug).await.unwrap();
       assert_eq!(feature.state.to_string(), state);
   }

   #[then(regex = r#"the command fails with an invalid state error"#)]
   async fn command_fails_invalid_state(world: &mut AgilePlusWorld) {
       let result = world.last_result.as_ref().unwrap();
       assert!(result.is_err());
       assert!(result.as_ref().unwrap_err().contains("InvalidState"));
   }

   #[then(regex = r#"all entries have valid hash linkage"#)]
   async fn valid_hash_linkage(world: &mut AgilePlusWorld) {
       let result = world.last_result.as_ref().unwrap();
       assert!(result.is_ok());
   }
   ```

5. Add the BDD test target to `Cargo.toml`:
   ```toml
   [[test]]
   name = "bdd"
   harness = false
   path = "tests/bdd/main.rs"
   ```

6. Run with `cargo test --test bdd` or `make test-bdd`.

**Testing**: Run all feature files. Verify all scenarios pass. Check that negative scenarios
correctly fail and produce expected error messages.

---

### T093: Implement behave Step Definitions for Python BDD Tests

**Directory**: `mcp/tests/bdd/`

**Purpose**: Write Python step definitions for behave that execute the same `.feature` files
against the MCP tools and gRPC client.

**Implementation Steps**:

1. Set up the behave environment:
   ```python
   # mcp/tests/bdd/environment.py
   import asyncio
   from unittest.mock import AsyncMock
   from agileplus_mcp.grpc_client import AgilePlusCoreClient

   def before_scenario(context, scenario):
       context.loop = asyncio.new_event_loop()
       context.client = AsyncMock(spec=AgilePlusCoreClient)
       context.last_result = None
       context.features = {}
       context.audit_entries = []

   def after_scenario(context, scenario):
       context.loop.close()
   ```

2. Implement Given steps:
   ```python
   # mcp/tests/bdd/steps/given_steps.py
   from behave import given

   @given('a fresh AgilePlus project with no features')
   def fresh_project(context):
       context.client.list_features.return_value = []

   @given('a feature "{slug}" in state "{state}"')
   def feature_in_state(context, slug, state):
       feature = {"slug": slug, "state": state, "friendly_name": slug.replace("-", " ").title()}
       context.features[slug] = feature
       context.client.get_feature.return_value = feature
   ```

3. Implement When steps that call MCP tools through the mock gRPC client:
   ```python
   # mcp/tests/bdd/steps/when_steps.py
   from behave import when
   from agileplus_mcp.tools.features import specify, plan, implement
   from agileplus_mcp.tools.governance import validate, get_audit_trail

   @when('I run "agileplus specify" with feature slug "{slug}"')
   def run_specify(context, slug):
       context.client.run_command.return_value = {"success": True, "output": "Spec created"}
       context.last_result = context.loop.run_until_complete(
           specify(feature_slug=slug, client=context.client)
       )

   @when('I run "agileplus validate" for feature "{slug}"')
   def run_validate(context, slug):
       context.last_result = context.loop.run_until_complete(
           validate(feature_slug=slug, client=context.client)
       )
   ```

4. Implement Then steps:
   ```python
   # mcp/tests/bdd/steps/then_steps.py
   from behave import then

   @then('the feature "{slug}" exists in SQLite with state "{state}"')
   def feature_exists(context, slug, state):
       feature = context.loop.run_until_complete(context.client.get_feature(slug))
       assert feature["state"] == state

   @then('validation passes')
   def validation_passes(context):
       assert context.last_result["status"] == "success"
   ```

5. Symlink the shared `.feature` files:
   ```bash
   ln -s ../../../../tests/bdd/features mcp/tests/bdd/features
   ```

6. Run with `cd mcp && uv run behave tests/bdd/` or `make test-bdd-python`.

**Note**: Python BDD tests focus on the MCP tool layer and gRPC client. They verify that
tool handlers correctly translate MCP calls to gRPC requests and format responses. The
Rust BDD tests cover the domain logic depth.

**Testing**: Run all feature files with behave. Verify scenarios pass with mock gRPC client.

---

### T094: Create Pact Contract Test Fixtures for gRPC Boundary

**Directory**: `tests/contract/`

**Purpose**: Define Pact contract interactions that formally verify the Rust gRPC provider
and Python gRPC consumer agree on message formats.

**Implementation Steps**:

1. Create the Python consumer pact definitions:
   ```python
   # mcp/tests/contract/test_agileplus_pact.py
   import pytest
   from pact import MessageConsumer, Provider

   pact = MessageConsumer("AgilePlusMCP").has_pact_with(
       Provider("AgilePlusCore"),
       pact_dir="../../tests/contract/pacts",
   )

   def test_get_feature_interaction():
       pact.given("feature test-feature exists in planned state") \
           .expects_to_receive("a GetFeature response") \
           .with_content({
               "feature": {
                   "slug": "test-feature",
                   "friendly_name": "Test Feature",
                   "state": "planned",
                   "spec_hash": "abc123",
                   "target_branch": "main",
                   "created_at": "2026-01-01T00:00:00Z",
                   "updated_at": "2026-01-01T00:00:00Z",
               }
           }) \
           .with_metadata({"content-type": "application/protobuf"})

       with pact:
           # Consumer processes the message
           pass

   def test_run_command_interaction():
       pact.given("feature test-feature exists in planned state") \
           .expects_to_receive("a RunCommand response for plan") \
           .with_content({
               "success": True,
               "output": "Generated 5 work packages",
               "feature_state": "planned",
           })

       with pact:
           pass

   def test_audit_trail_interaction():
       pact.given("feature test-feature has 3 audit entries") \
           .expects_to_receive("a GetAuditTrail response") \
           .with_content({
               "entries": [
                   {"id": 1, "transition": "created -> specified", "actor": "user"},
                   {"id": 2, "transition": "specified -> researched", "actor": "user"},
                   {"id": 3, "transition": "researched -> planned", "actor": "system"},
               ]
           })

       with pact:
           pass
   ```

2. Create the Rust provider verification:
   ```rust
   // tests/contract/pact_provider_test.rs
   use pact_verifier::*;

   #[tokio::test]
   async fn verify_agileplus_core_pact() {
       // Start the gRPC server with mock data matching provider states
       let server = start_test_server_with_states().await;

       let verifier = PactVerifier::new("AgilePlusCore")
           .with_pact_source(PactSource::Dir("tests/contract/pacts/"))
           .with_provider_transport("grpc", server.port(), "/", None)
           .with_state_change_url(&format!("http://localhost:{}/pact-state", server.port()))
           .build();

       let result = verifier.verify().await;
       assert!(result.is_ok(), "Pact verification failed: {:?}", result.err());
   }
   ```

3. Implement provider state handlers that set up the correct mock data for each "given"
   clause in the pact interactions.

4. Generate pact JSON files by running the Python consumer tests first, then verify with
   the Rust provider.

5. Add to Makefile:
   ```makefile
   test-contracts:
       cd mcp && uv run pytest tests/contract/ -v
       cargo test --test pact_provider_test
   ```

**Testing**: Run consumer tests to generate pacts. Run provider verification against
generated pacts. Intentionally break a message format and verify the pact test catches it.

---

### T095: Create `docker-compose.test.yml` for Full-Stack Integration Tests

**File**: `tests/integration/docker-compose.test.yml`

**Purpose**: Define a Docker Compose configuration that spins up the complete AgilePlus
stack for integration testing.

**Implementation Steps**:

1. Define the compose file:
   ```yaml
   version: "3.9"
   services:
     agileplus-core:
       build:
         context: ../..
         dockerfile: Dockerfile
         target: test
       command: ["agileplus", "serve"]
       ports:
         - "50051:50051"  # gRPC
         - "8080:8080"    # HTTP API
       volumes:
         - test-data:/data
         - test-repo:/repo
       environment:
         - AGILEPLUS_CORE_DATABASE_PATH=/data/agileplus.db
         - AGILEPLUS_API_PORT=8080
         - AGILEPLUS_API_GRPC_PORT=50051
         - AGILEPLUS_TELEMETRY_ENABLED=false
       healthcheck:
         test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
         interval: 5s
         timeout: 3s
         retries: 10

     agileplus-mcp:
       build:
         context: ../../mcp
         dockerfile: Dockerfile
       depends_on:
         agileplus-core:
           condition: service_healthy
       environment:
         - AGILEPLUS_GRPC_ADDRESS=agileplus-core:50051
       ports:
         - "8081:8081"

     test-runner:
       build:
         context: ../..
         dockerfile: Dockerfile.test
       depends_on:
         agileplus-core:
           condition: service_healthy
         agileplus-mcp:
           condition: service_started
       environment:
         - AGILEPLUS_API_URL=http://agileplus-core:8080
         - AGILEPLUS_GRPC_URL=agileplus-core:50051
       volumes:
         - test-repo:/repo
       command: ["make", "test-integration-inner"]

   volumes:
     test-data:
     test-repo:
   ```

2. Create `Dockerfile.test` that includes both Rust and Python test tooling.

3. Create a test initialization script that sets up the test git repository:
   ```bash
   #!/bin/bash
   # tests/integration/setup-test-repo.sh
   cd /repo
   git init
   mkdir -p kitty-specs
   echo '{}' > kitty-specs/.gitkeep
   git add . && git commit -m "Initial test repo"
   ```

4. Add Makefile targets:
   ```makefile
   test-integration:
       docker compose -f tests/integration/docker-compose.test.yml up --build --abort-on-container-exit
       docker compose -f tests/integration/docker-compose.test.yml down -v

   test-integration-inner:
       # Runs inside the test-runner container
       cargo test --test integration -- --test-threads=1
       cd mcp && uv run pytest tests/integration/ -v
   ```

5. Add Docker Compose profiles for partial testing:
   ```yaml
   services:
     agileplus-mcp:
       profiles: ["full", "mcp"]
     test-runner:
       profiles: ["full", "test"]
   ```
   This allows `docker compose --profile mcp up` to test just the MCP service.

**Testing**: Verify `docker compose config` validates the compose file. Run `docker compose
up` and verify all services start and health checks pass.

---

### T096: Implement Integration Test Scenarios — Full Workflow

**Files**:
- `tests/integration/test_full_workflow.rs`
- `mcp/tests/integration/test_full_workflow.py`

**Purpose**: End-to-end test that exercises the complete specify -> ship lifecycle on a
test repository, verifying all commands work together.

**Implementation Steps**:

1. Implement the Rust integration test:
   ```rust
   // tests/integration/test_full_workflow.rs
   #[tokio::test]
   #[ignore] // Only run in Docker integration environment
   async fn test_full_specify_to_ship_workflow() {
       let api_url = env::var("AGILEPLUS_API_URL").unwrap_or("http://localhost:8080".into());
       let client = reqwest::Client::new();

       // Step 1: Specify
       let resp = client.post(&format!("{api_url}/api/v1/commands/specify"))
           .json(&json!({"feature": "integration-test-feature"}))
           .header("X-API-Key", "test-key")
           .send().await.unwrap();
       assert_eq!(resp.status(), 200);

       // Step 2: Verify feature created
       let resp = client.get(&format!("{api_url}/api/v1/features/integration-test-feature"))
           .header("X-API-Key", "test-key")
           .send().await.unwrap();
       let feature: serde_json::Value = resp.json().await.unwrap();
       assert_eq!(feature["state"], "specified");

       // Step 3: Research
       let resp = client.post(&format!("{api_url}/api/v1/commands/research"))
           .json(&json!({"feature": "integration-test-feature"}))
           .header("X-API-Key", "test-key")
           .send().await.unwrap();
       assert_eq!(resp.status(), 200);

       // Step 4: Plan
       let resp = client.post(&format!("{api_url}/api/v1/commands/plan"))
           .json(&json!({"feature": "integration-test-feature"}))
           .header("X-API-Key", "test-key")
           .send().await.unwrap();
       assert_eq!(resp.status(), 200);

       // Verify work packages created
       let resp = client.get(&format!("{api_url}/api/v1/features/integration-test-feature"))
           .header("X-API-Key", "test-key")
           .send().await.unwrap();
       let feature: serde_json::Value = resp.json().await.unwrap();
       assert_eq!(feature["state"], "planned");

       // Step 5: Implement (with mock agent)
       // ... dispatch mock agent, create mock evidence

       // Step 6: Validate
       let resp = client.post(&format!("{api_url}/api/v1/commands/validate"))
           .json(&json!({"feature": "integration-test-feature"}))
           .header("X-API-Key", "test-key")
           .send().await.unwrap();
       assert_eq!(resp.status(), 200);

       // Step 7: Ship
       let resp = client.post(&format!("{api_url}/api/v1/commands/ship"))
           .json(&json!({"feature": "integration-test-feature"}))
           .header("X-API-Key", "test-key")
           .send().await.unwrap();
       assert_eq!(resp.status(), 200);

       // Verify final state
       let resp = client.get(&format!("{api_url}/api/v1/features/integration-test-feature"))
           .header("X-API-Key", "test-key")
           .send().await.unwrap();
       let feature: serde_json::Value = resp.json().await.unwrap();
       assert_eq!(feature["state"], "shipped");

       // Step 8: Verify audit trail integrity
       let resp = client.post(&format!("{api_url}/api/v1/features/integration-test-feature/audit/verify"))
           .header("X-API-Key", "test-key")
           .send().await.unwrap();
       let verification: serde_json::Value = resp.json().await.unwrap();
       assert_eq!(verification["valid"], true);
   }
   ```

2. Implement a Python integration test that exercises the MCP tools:
   ```python
   # mcp/tests/integration/test_mcp_workflow.py
   import pytest
   from agileplus_mcp.grpc_client import AgilePlusCoreClient

   @pytest.fixture
   async def client():
       address = os.environ.get("AGILEPLUS_GRPC_URL", "localhost:50051")
       async with connect_client(address) as c:
           yield c

   @pytest.mark.asyncio
   async def test_mcp_feature_lifecycle(client):
       # Create feature via gRPC
       result = await client.run_command("specify", feature="mcp-test-feature")
       assert result["success"]

       # Query via gRPC
       feature = await client.get_feature("mcp-test-feature")
       assert feature["state"] == "specified"

       # Verify audit
       trail = await client.get_audit_trail("mcp-test-feature")
       assert len(trail) >= 1
   ```

3. The integration tests must handle timing: use retry loops with timeouts for operations
   that may take time (agent dispatch, review polling).

4. Clean up test data after each test: delete test features, remove test worktrees.

**Testing**: Run in Docker Compose environment. Verify full lifecycle completes. Verify
audit chain is valid at the end.

---

### T097: Create Test Fixtures

**Directory**: `tests/fixtures/`

**Purpose**: Provide self-contained sample data files that BDD and integration tests can
use as input.

**Implementation Steps**:

1. Create `tests/fixtures/sample-spec.md`:
   A minimal but valid specification file with a few functional requirements, suitable for
   testing the plan command's WP generation.

2. Create `tests/fixtures/sample-plan.md`:
   A minimal plan with 2-3 work packages, file scopes, and dependency declarations.

3. Create `tests/fixtures/sample-governance.json`:
   ```json
   {
     "version": 1,
     "rules": [
       {
         "transition": "implementing -> validated",
         "required_evidence": [
           {"fr_id": "FR-001", "type": "test_result", "min_coverage": 80}
         ],
         "policy_refs": ["POL-001"]
       }
     ]
   }
   ```

4. Create `tests/fixtures/sample-audit-chain.jsonl`:
   ```jsonl
   {"id":1,"feature_id":1,"timestamp":"2026-01-01T00:00:00Z","actor":"user","transition":"created -> specified","evidence_refs":[],"prev_hash":"0000000000000000000000000000000000000000000000000000000000000000","hash":"a1b2c3..."}
   {"id":2,"feature_id":1,"timestamp":"2026-01-01T01:00:00Z","actor":"user","transition":"specified -> researched","evidence_refs":[],"prev_hash":"a1b2c3...","hash":"d4e5f6..."}
   ```
   Compute real SHA-256 hashes so the chain is actually valid and can be verified.

5. Create `tests/fixtures/sample-evidence/`:
   ```
   tests/fixtures/sample-evidence/
   ├── WP01/
   │   ├── test-results.json    # {"passed": 42, "failed": 0, "coverage": 85.2}
   │   └── review-approval.json # {"reviewer": "coderabbit", "approved": true}
   └── WP02/
       └── test-results.json
   ```

6. Create `tests/fixtures/sample-meta.json`:
   ```json
   {
     "slug": "test-feature",
     "friendly_name": "Test Feature",
     "state": "implementing",
     "target_branch": "main",
     "created_at": "2026-01-01T00:00:00Z",
     "updated_at": "2026-01-15T00:00:00Z"
   }
   ```

7. Create a Rust helper module `tests/fixtures/mod.rs` (or `tests/test_helpers.rs`) that
   loads fixtures:
   ```rust
   pub fn load_fixture(name: &str) -> String {
       let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
           .join("tests/fixtures")
           .join(name);
       std::fs::read_to_string(path).unwrap()
   }

   pub fn sample_governance_contract() -> GovernanceContract {
       let json = load_fixture("sample-governance.json");
       serde_json::from_str(&json).unwrap()
   }

   pub fn sample_audit_chain() -> Vec<AuditEntry> {
       let jsonl = load_fixture("sample-audit-chain.jsonl");
       jsonl.lines()
           .map(|line| serde_json::from_str(line).unwrap())
           .collect()
   }
   ```

**Testing**: Verify all fixtures parse correctly. Verify the audit chain fixture passes
`verify_chain()`. Verify evidence fixtures match the governance contract requirements.

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Docker not available in CI | Integration tests cannot run | Use Docker Compose profiles; mark integration tests with `#[ignore]`; run in dedicated CI job |
| cucumber-rs and behave feature file dialect differences | Scenarios fail in one runner | Use only standard Gherkin syntax; test with both parsers during development |
| Pact gRPC support limitations | Contract tests unreliable for streaming RPCs | Test unary RPCs with Pact; test streaming with manual integration tests |
| Test flakiness from timing | CI failures | Use retry loops with configurable timeouts; mock time-dependent operations |
| Fixture staleness | Tests pass but fixtures don't match current schema | Include fixture validation in `make test`; regenerate fixtures from code |
| Coverage measurement complexity | Reported coverage inaccurate for polyglot project | Use `cargo-llvm-cov` for Rust, `coverage.py` for Python; aggregate in CI |

## Review Guidance

### What to Check

1. **FR traceability**: Every `.feature` scenario has an `@FR-xxx` tag. Every FR from the
   spec has at least one scenario covering it.

2. **Fixture validity**: Audit chain fixtures have real SHA-256 hashes that pass
   `verify_chain()`. Governance fixtures match the contract schema from data-model.md.

3. **Test isolation**: No test depends on state from a previous test. Each scenario sets up
   its own state in Given steps and cleans up after.

4. **Mock fidelity**: Mock adapters behave consistently with real adapters. Mock StoragePort
   uses an in-memory HashMap that supports all the same query patterns as SQLite.

5. **Docker Compose correctness**: Health checks work. Service startup order is correct.
   Volumes are cleaned between runs.

6. **Coverage completeness**: Run `cargo llvm-cov` and verify >80% on `agileplus-core`.
   Identify any untested domain logic paths.

### Acceptance Criteria Traceability

- All FRs: T091 (feature files reference every FR)
- FR-016 (Audit integrity): T091 audit.feature, T097 audit chain fixture
- FR-018/019 (Governance): T091 governance.feature
- FR-033/034 (State machine): T091 specify.feature negative scenarios
- Contract boundary: T094
- Full workflow: T096
- Test infrastructure: T095, T097

---

## Activity Log

| Timestamp | Event |
|-----------|-------|
| 2026-02-27T00:00:00Z | WP16 prompt generated via /spec-kitty.tasks |
- 2026-03-02T02:17:36Z – s1-wp16 – shell_pid=65013 – lane=doing – Assigned agent via workflow command
- 2026-03-02T02:40:46Z – s1-wp16 – shell_pid=65013 – lane=for_review – Ready: BDD tests and integration suite
- 2026-03-02T02:41:16Z – s1-wp16 – shell_pid=65013 – lane=done – BDD acceptance tests and integration suite complete
