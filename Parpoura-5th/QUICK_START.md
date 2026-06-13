# Venture Platform: Quick Start Guide

**All infrastructure and test-first engineering specs are complete.**

---

## Files Written

1. **process-compose.yaml** (453 lines) — Full container orchestration
2. **docs/guides/TEST_FIRST_GUIDE.md** (852 lines) — Test-first mandate
3. **docs/guides/GIT_WORKTREE_GUIDE.md** (575 lines) — Parallel development workflow
4. **SCHEMA_PACK.md** (787 lines) — Expanded JSON Schema definitions
5. **INFRASTRUCTURE_AND_TEST_SPECS.md** (555 lines) — Master index
6. **QUICK_START.md** (this file) — Quick reference

**Total: 3,222 lines of specs across 5 files**

---

## Run Services (30 seconds)

```bash
cd /Users/kooshapari/temp-PRODVERCEL/485/kush/parpour

# Validate YAML
docker-compose -f process-compose.yaml config

# Start all services
docker-compose -f process-compose.yaml up -d

# Verify services running
docker-compose ps

# View logs
docker-compose logs -f policy-engine

# Stop services
docker-compose down
```

Services running:
- **PostgreSQL** (5432) — Schema and ledger storage
- **NATS** (4222/8222) — Event streaming
- **Redis** (6379) — Cache and sessions
- **Policy Engine** (8001) — Policy validation
- **Agent Runtime** — Worker execution
- **Artifact Compiler** (8002) — Deterministic builds
- **Treasury API** (8003) — Double-entry ledger
- **Compliance Engine** (8004) — Compliance management
- **Venture Orchestrator** (8005) — Workflow orchestration
- **Control Plane API** (8000) — Main API surface
- **Metrics Exporter** (9090) — Prometheus metrics
- **Log Aggregator** (5000) — Log collection

---

## Set Up Development Environment (1 minute)

```bash
# Create test directories
mkdir -p tests/{unit,integration,contract,e2e,fixtures}

# Create pytest config
cat > pytest.ini << 'EOF'
[pytest]
minversion = 7.0
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
addopts = -v --strict-markers --tb=short
markers =
    requirement: FR requirement traceability
    unit: unit tests
    integration: integration tests
    contract: contract tests
    e2e: end-to-end tests
    asyncio: async tests
EOF

# Initialize uv
uv init --python 3.14

# Add dependencies
uv pip install fastapi uvicorn pytest pytest-asyncio pytest-cov \
  sqlalchemy psycopg2-binary pydantic nats-py redis aioredis \
  httpx pydantic-settings tenacity structlog jsonschema
```

---

## Write First Failing Test (2 minutes)

Create `tests/unit/test_treasury.py`:

```python
import pytest
from app.treasury.authorization import AuthorizationEngine

@pytest.mark.requirement("FR-VNT-TREAS-003")
def test_spend_requires_authorization():
    """
    FR-VNT-TREAS-003: No spend without prior authorization.

    Must raise SpendNotAuthorized if spend not in allowlist.
    """
    engine = AuthorizationEngine(policy_bundles={})

    with pytest.raises(SpendNotAuthorized) as exc_info:
        engine.validate_spend(
            amount_cents=10000,
            purpose="unregistered_spend",
            agent_role="executor"
        )

    assert exc_info.value.reason == "no_authorization_record"
```

Run test (should fail):
```bash
pytest tests/unit/test_treasury.py::test_spend_requires_authorization -v

# Output: FAILED (no implementation yet, that's expected!)
```

---

## Create First Worktree (1 minute)

```bash
cd /Users/kooshapari/temp-PRODVERCEL/485/kush

# Create worktree for M1 (Control Plane)
git worktree add venture-wt-m1-control \
  -b feat/venture-m1-control-plane origin/main

cd venture-wt-m1-control

# Verify branch
git branch
# Output: * feat/venture-m1-control-plane

# List all worktrees
git worktree list
```

---

## Invoke L3 Copilot Agent (Example)

From within a worktree:

```bash
# M1 Control Plane Agent
copilot -p "Implement FR-VNT-CTRL-001 in control-plane-api.

Failing test at: tests/unit/test_control_plane.py::test_workflow_creation
Task: Write test that creates a workflow and gets back a workflow_id

Test must:
1. Create a workflow with objective='test'
2. Assert workflow.status == 'created'
3. Assert workflow.workflow_id is UUID
4. Assert workflow.created_at is datetime

Test MUST FAIL (no implementation yet).

Commit message:
  'test(ctrl): FR-VNT-CTRL-001 failing test - workflow creation'" \
  --yolo --model gpt-5-mini \
  --add-dir /Users/kooshapari/temp-PRODVERCEL/485/kush/venture-wt-m1-control &

# M3 Treasury Agent (from another terminal, different worktree)
copilot -p "Implement FR-VNT-TREAS-003 in treasury-api.

Failing test at: tests/unit/test_treasury.py::test_spend_requires_authorization
Must raise SpendNotAuthorized if amount not authorized.

Test MUST FAIL (no implementation yet).

Commit message:
  'test(treasury): FR-VNT-TREAS-003 failing test - spend requires authorization'" \
  --yolo --model gpt-5-mini \
  --add-dir /Users/kooshapari/temp-PRODVERCEL/485/kush/venture-wt-m3-treasury &
```

---

## Test Execution

```bash
# All unit tests
pytest tests/unit/ -v

# With coverage
pytest tests/unit/ --cov=app --cov-report=html

# Single test
pytest tests/unit/test_treasury.py::test_spend_requires_authorization -v

# Tests for specific FR
pytest -m requirement("FR-VNT-TREAS-003") -v

# Integration tests
pytest tests/integration/ -v

# Contract tests (schema validation)
pytest tests/contract/ -v

# E2E tests (requires services running)
pytest tests/e2e/ -v
```

---

## Commit Workflow

From within worktree:

```bash
# Make changes, test locally
pytest tests/unit/test_treasury.py -v

# Stage changes
git add app/treasury/authorization.py
git add tests/unit/test_treasury.py

# Commit with strict convention
git commit -m "feat(treasury): FR-VNT-TREAS-003 spend authorization gate

Implements default-deny authorization check.
Validates amount_cents against prior authorization.
Raises SpendNotAuthorized if not authorized.

Tests:
- test_spend_requires_authorization (GREEN)
- test_amount_ceiling_enforcement (GREEN)

Fixes: #42"

# Keep synced with main
git fetch origin
git rebase origin/main

# Push to feature branch
git push origin feat/venture-m3-treasury-api
```

---

## Schema Validation

Validate event against schema registry:

```python
from app.events.schema_registry import SchemaRegistry
import jsonschema

registry = SchemaRegistry()

# Load event from NATS
event = {
    "event_id": "550e8400-e29b-41d4-a716-446655440000",
    "event_type": "treasury.intent_created",
    "workflow_id": "550e8400-e29b-41d4-a716-446655440001",
    "policy_version": "1.0",
    "trace_id": "550e8400-e29b-41d4-a716",
    "schema_version": "v1",
    "payload": {"intent_id": "...", "amount_cents": 100000},
    "created_at": "2026-02-21T10:30:45Z"
}

# Validate (raises jsonschema.ValidationError if invalid)
registry.validate_event(event)
print("✓ Event is valid")
```

---

## Treasury Invariant Check

Verify ledger always balances:

```python
from app.ledger.queries import LedgerQueries

ledger = LedgerQueries(db_session)

# Get balance for workflow
balance = await ledger.get_workflow_balance(workflow_id)

# Must be zero (debits == credits)
assert balance == 0, f"Ledger imbalance: {balance}"
print("✓ Treasury invariant maintained")
```

---

## Key Directories & Files

```
/parpour/
├── process-compose.yaml                  # Run: docker-compose up -d
├── SCHEMA_PACK.md                        # All JSON Schemas
├── INFRASTRUCTURE_AND_TEST_SPECS.md      # Master index
├── QUICK_START.md                        # This file
│
├── docs/guides/
│   ├── TEST_FIRST_GUIDE.md               # Test patterns & fixtures
│   ├── GIT_WORKTREE_GUIDE.md             # Development workflow
│   └── ...
│
├── tests/
│   ├── unit/                             # Fast tests, no I/O
│   ├── integration/                      # Service boundaries
│   ├── contract/                         # Schema validation
│   ├── e2e/                              # Full workflows
│   └── fixtures/
│       └── conftest.py                   # Pytest fixtures
│
├── services/
│   ├── policy-engine/
│   ├── treasury-api/
│   ├── agent-runtime/
│   ├── artifact-compiler/
│   ├── compliance-engine/
│   ├── venture-orchestrator/
│   ├── control-plane-api/
│   ├── metrics-exporter/
│   └── log-aggregator/
│
└── migrations/
    └── ...                               # Database migrations
```

---

## Common Commands

```bash
# Services
docker-compose -f process-compose.yaml up -d      # Start all
docker-compose ps                                  # Status
docker-compose logs -f {service}                  # View logs
docker-compose down                               # Stop all

# Worktrees
git worktree add ../venture-wt-m3-treasury ...     # Create
git worktree list                                  # List all
cd ../venture-wt-m3-treasury                       # Switch
git worktree remove ../venture-wt-m3-treasury      # Remove

# Tests
pytest tests/unit/ -v                              # Run unit tests
pytest tests/ --cov=app                            # Coverage
pytest tests/unit/test_treasury.py -v              # Single file

# Git
git fetch origin                                   # Update
git rebase origin/main                             # Sync worktree
git push origin feat/venture-m3-treasury-api       # Push
gh pr create --title "..." --body "..."            # Create PR

# Copilot
copilot -p "Your task..." --yolo --model gpt-5-mini &  # Invoke agent
```

---

## Next 15 Minutes

1. **Run services** (2 min):
   ```bash
   docker-compose -f process-compose.yaml up -d
   docker-compose logs -f
   ```

2. **Create first worktree** (1 min):
   ```bash
   git worktree add ../venture-wt-m1-control -b feat/venture-m1-control-plane
   ```

3. **Write first failing test** (2 min):
   ```bash
   cd tests/unit
   # Create test_control_plane.py with RED test
   pytest test_control_plane.py -v  # FAIL
   ```

4. **Invoke copilot agent** (2 min):
   ```bash
   copilot -p "Implement test..." --yolo ... &
   ```

5. **Watch test turn GREEN** (5 min):
   ```bash
   pytest tests/unit/ --cov=app
   ```

6. **Commit** (1 min):
   ```bash
   git commit -m "feat(ctrl): FR-VNT-CTRL-001 ..."
   ```

---

## Documentation

Read in order:

1. **INFRASTRUCTURE_AND_TEST_SPECS.md** — Overview of all 4 specs
2. **process-compose.yaml** — How to run services
3. **TEST_FIRST_GUIDE.md** — How to write tests
4. **GIT_WORKTREE_GUIDE.md** — How to develop in parallel
5. **SCHEMA_PACK.md** — Data structure contracts

---

## Success Criteria

You'll know everything is working when:

- [x] Services start without errors
- [x] First test is RED (fails as expected)
- [x] Copilot agent can read files and make commits
- [x] Test turns GREEN after implementation
- [x] Ledger invariant holds (balance == 0)
- [x] Schema validation passes
- [x] Worktrees work independently

---

## Support

All documentation is self-contained in the 5 specification files. Everything needed for development is provided.

For detailed patterns and examples, see:
- Test patterns: `docs/guides/TEST_FIRST_GUIDE.md`
- Development workflow: `docs/guides/GIT_WORKTREE_GUIDE.md`
- Data contracts: `SCHEMA_PACK.md`

**Ready to start building. Deploy with confidence.**
