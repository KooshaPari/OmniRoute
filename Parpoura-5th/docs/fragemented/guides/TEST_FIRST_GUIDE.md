# Test-First Engineering for Venture Platform

This document defines the test-first mandate for all Venture development. Every functional requirement (FR) must have a failing test written BEFORE any implementation code.

## Core Philosophy

**Test-first is non-negotiable.** The sequence is:
1. Write failing test (RED)
2. Implement minimal code to pass (GREEN)
3. Refactor to remove duplication (REFACTOR)
4. Commit test before implementation

This ensures:
- All code has a documented requirement (the test)
- Coverage is guaranteed (100% by design)
- Invariants are enforced before code ships
- Regression is caught immediately

## Test Organization

Tests are organized by type and layer:

```
tests/
  unit/                    # Pure functions, no I/O
    test_policy_engine.py
    test_treasury.py
    test_artifact_schema.py
    test_compliance_rules.py

  integration/             # Service boundaries, mocked external systems
    test_policy_api.py
    test_treasury_api.py
    test_agent_runtime.py

  contract/                # Event schema validation
    test_event_schemas.py
    test_task_envelope.py
    test_policy_bundle.py

  e2e/                     # Full flows via process-compose
    test_workflow_complete.py
    test_treasury_payout_flow.py
    test_compliance_case_flow.py

  fixtures/                # Shared pytest fixtures
    conftest.py            # Global fixtures
    db_fixtures.py         # Database session, migrations
    nats_fixtures.py       # NATS mock/real
    redis_fixtures.py      # Redis mock/real
    policy_fixtures.py     # Policy engine fixtures
```

## Test Types and Requirements

### Unit Tests

**Purpose:** Test pure business logic without I/O.

**Requirements:**
- No database calls (use fixtures for any needed state)
- No network calls (mock external services)
- No file system access
- Fast (< 100ms per test)
- Test single responsibility

**Example: Treasury authorization logic**

```python
import pytest
from app.treasury.authorization import AuthorizationEngine
from app.treasury.models import SpendAuthorization, AuthorizationResult

@pytest.mark.requirement("FR-VNT-TREAS-003")
def test_spend_requires_authorization():
    """
    FR-VNT-TREAS-003: No spend without prior authorization.

    All spend must pass through authorization gate.
    Default-deny policy: if not explicitly authorized, reject.
    """
    engine = AuthorizationEngine(policy_bundles={})

    with pytest.raises(SpendNotAuthorized) as exc_info:
        engine.validate_spend(
            amount_cents=10000,
            purpose="unregistered_spend",
            agent_role="executor"
        )

    assert exc_info.value.reason == "no_authorization_record"


@pytest.mark.requirement("FR-VNT-TREAS-004")
def test_authorization_checks_amount_ceiling():
    """
    FR-VNT-TREAS-004: Spend authorized up to declared ceiling.

    Authorization decision includes upper bound.
    Spend exceeding ceiling must be rejected.
    """
    engine = AuthorizationEngine(policy_bundles={})

    auth = SpendAuthorization(
        amount_cents=5000,
        purpose="marketing_campaign",
        agent_role="business_strategist"
    )

    # Within ceiling: OK
    result = engine.validate_spend(
        amount_cents=3000,
        authorization=auth
    )
    assert result.approved

    # Above ceiling: REJECT
    with pytest.raises(SpendExceedsCeiling):
        engine.validate_spend(
            amount_cents=6000,
            authorization=auth
        )
```

### Integration Tests

**Purpose:** Test service APIs and external integrations with mocked dependencies.

**Requirements:**
- Use FastAPI TestClient for HTTP endpoints
- Mock NATS, Redis, external APIs
- Test request/response schemas
- Test error handling and edge cases
- Medium speed (< 500ms per test)

**Example: Treasury API endpoint**

```python
import pytest
from fastapi.testclient import TestClient
from app.main import app
from unittest.mock import AsyncMock, patch

@pytest.mark.requirement("FR-VNT-TREAS-005")
def test_post_authorization_validates_request(client: TestClient):
    """
    FR-VNT-TREAS-005: Authorization endpoint validates request schema.

    POST /api/treasury/authorize requires:
    - amount_cents (positive integer)
    - purpose (non-empty string)
    - workflow_id (UUID)
    - policy_version (string)
    """
    # Missing amount_cents
    response = client.post(
        "/api/treasury/authorize",
        json={
            "purpose": "test",
            "workflow_id": "550e8400-e29b-41d4-a716-446655440000",
            "policy_version": "1.0"
        }
    )
    assert response.status_code == 422
    assert "amount_cents" in response.json()["detail"][0]["loc"]


@pytest.mark.requirement("FR-VNT-TREAS-006")
@pytest.mark.asyncio
async def test_post_authorization_calls_policy_engine(
    client: TestClient,
    mock_policy_engine: AsyncMock
):
    """
    FR-VNT-TREAS-006: Authorization delegates to policy engine.

    Treasury must consult policy engine before approving spend.
    Response includes policy decision rationale.
    """
    mock_policy_engine.check_authorization = AsyncMock(
        return_value={
            "approved": True,
            "reason": "within_daily_budget",
            "amount_cents": 5000
        }
    )

    response = client.post(
        "/api/treasury/authorize",
        json={
            "amount_cents": 5000,
            "purpose": "api_call",
            "workflow_id": "550e8400-e29b-41d4-a716-446655440000",
            "policy_version": "1.0"
        }
    )

    assert response.status_code == 200
    assert response.json()["approved"]
    assert response.json()["reason"] == "within_daily_budget"

    mock_policy_engine.check_authorization.assert_called_once()
```

### Contract Tests

**Purpose:** Validate event and message schemas match the registry.

**Requirements:**
- All emitted events must match schema registry
- Schema validation must be strict (no extra fields)
- Version pinning enforced (unknown versions rejected)
- Test before event emission

**Example: Agent action event contract**

```python
import pytest
import jsonschema
from app.events.schema_registry import SchemaRegistry
from app.agent.models import AgentAction
from app.events.models import EventEnvelope

@pytest.mark.requirement("FR-VNT-AGENT-007")
def test_agent_action_emits_valid_event(
    schema_registry: SchemaRegistry,
    event_bus
):
    """
    FR-VNT-AGENT-007: All agent actions emit valid events.

    Event must conform to EventEnvelope schema.
    Payload must match action-specific schema.
    Unknown schema versions rejected at emit time.
    """
    action = AgentAction(
        agent_id="agent-001",
        tool="web_search",
        input={"query": "python asyncio"},
        workflow_id="550e8400-e29b-41d4-a716-446655440000"
    )

    event = action.to_event()

    # Validate envelope structure
    envelope_schema = schema_registry.get_schema(
        "event/envelope",
        version="v1"
    )
    jsonschema.validate(instance=event.model_dump(), schema=envelope_schema)

    # Validate action payload
    action_schema = schema_registry.get_schema(
        "action/web_search",
        version="v1"
    )
    jsonschema.validate(instance=event.payload, schema=action_schema)


@pytest.mark.requirement("FR-VNT-EVENT-008")
def test_event_envelope_rejects_unknown_version():
    """
    FR-VNT-EVENT-008: Unknown schema versions are rejected.

    EventEnvelope with schema_version=v999 must fail validation.
    """
    schema_registry = SchemaRegistry()

    invalid_event = {
        "event_id": "550e8400-e29b-41d4-a716-446655440000",
        "event_type": "agent.action",
        "workflow_id": "550e8400-e29b-41d4-a716-446655440001",
        "schema_version": "v999",  # Unknown
        "payload": {}
    }

    with pytest.raises(jsonschema.ValidationError):
        schema_registry.validate_event(invalid_event)
```

### E2E Tests

**Purpose:** Test full workflows through actual services (or realistic mocks).

**Requirements:**
- Use real process-compose services OR realistic Docker setup
- Full flow from input to persisted state
- Test invariants (e.g., ledger balance, authorization chain)
- Slower but comprehensive (1-5 seconds per test)
- Only test happy path and critical error cases

**Example: Complete payout workflow**

```python
import pytest
import asyncio
from app.treasury.client import TreasuryClient
from app.compliance.client import ComplianceClient
from app.ledger.queries import LedgerQueries

@pytest.mark.requirement("FR-VNT-TREAS-FLOW-001")
@pytest.mark.asyncio
async def test_complete_payout_workflow(
    treasury_client: TreasuryClient,
    compliance_client: ComplianceClient,
    ledger: LedgerQueries,
    db_session,
    nats_client
):
    """
    FR-VNT-TREAS-FLOW-001: Complete payout workflow.

    Workflow: intent -> authorization -> execution -> reconciliation

    Invariants:
    - Double-entry ledger always balances
    - No spend without prior authorization
    - Compliance flag raises case if policy violated
    """
    workflow_id = "550e8400-e29b-41d4-a716-446655440000"

    # 1. Create spend intent
    intent = await treasury_client.create_intent(
        workflow_id=workflow_id,
        amount_cents=100000,
        purpose="payout_vendor",
        currency="USD"
    )
    assert intent.status == "intent_created"

    # 2. Get authorization
    auth = await treasury_client.request_authorization(
        intent_id=intent.id,
        policy_version="1.0"
    )
    assert auth.status == "authorized"

    # 3. Check compliance didn't flag
    compliance_cases = await compliance_client.list_cases(
        workflow_id=workflow_id
    )
    assert len(compliance_cases) == 0

    # 4. Execute payout
    payout = await treasury_client.execute_payout(
        intent_id=intent.id,
        recipient_account="vendor-account-123"
    )
    assert payout.status == "executed"

    # 5. Verify ledger invariant: balance == 0
    balance = await ledger.get_workflow_balance(workflow_id)
    assert balance == 0, "Double-entry must balance"

    # 6. Verify event trail
    events = await nats_client.fetch_events(
        workflow_id=workflow_id,
        subject="treasury.*"
    )
    assert len(events) >= 3  # intent, auth, execution
    assert events[0]["event_type"] == "treasury.intent_created"
    assert events[1]["event_type"] == "treasury.authorized"
    assert events[2]["event_type"] == "treasury.executed"
```

## Treasury Invariant Tests

Treasury is the most sensitive subsystem. Every test must enforce these invariants:

### Invariant 1: Double-Entry Ledger Balances

Every debit has a corresponding credit. Sum of all entries == 0.

```python
@pytest.mark.requirement("FR-VNT-TREAS-INV-001")
@pytest.mark.asyncio
async def test_ledger_always_balances(ledger: LedgerQueries, db_session):
    """
    FR-VNT-TREAS-INV-001: Double-entry ledger balance invariant.

    For any workflow:
    sum(debits) - sum(credits) == 0
    """
    # Create workflow with multiple entries
    from app.ledger.models import LedgerEntry, EntryType

    entries = [
        LedgerEntry(amount_cents=10000, entry_type=EntryType.DEBIT),
        LedgerEntry(amount_cents=6000, entry_type=EntryType.CREDIT),
        LedgerEntry(amount_cents=4000, entry_type=EntryType.CREDIT),
    ]

    for entry in entries:
        db_session.add(entry)
    db_session.commit()

    balance = await ledger.get_balance()
    assert balance == 0, "All entries must balance (debits == credits)"


@pytest.mark.requirement("FR-VNT-TREAS-INV-002")
@pytest.mark.asyncio
async def test_no_unmatched_entries(ledger: LedgerQueries, db_session):
    """
    FR-VNT-TREAS-INV-002: No orphaned ledger entries.

    Every entry must have a corresponding workflow_id and authorization record.
    """
    from app.ledger.models import LedgerEntry

    entry = LedgerEntry(
        workflow_id=None,  # Invalid
        amount_cents=5000,
        entry_type=EntryType.DEBIT
    )

    with pytest.raises(ValueError) as exc:
        db_session.add(entry)
        db_session.commit()

    assert "workflow_id" in str(exc.value)
```

### Invariant 2: No Spend Without Authorization

All spend must follow: intent → authorization → execution.

```python
@pytest.mark.requirement("FR-VNT-TREAS-INV-003")
@pytest.mark.asyncio
async def test_spend_requires_authorization(treasury_client):
    """
    FR-VNT-TREAS-INV-003: No spend without prior authorization.

    execute_payout() must fail if no AuthorizationDecision record.
    """
    intent = await treasury_client.create_intent(
        workflow_id="550e8400-e29b-41d4-a716-446655440000",
        amount_cents=50000,
        purpose="unregistered"
    )

    # Try to payout without authorization
    with pytest.raises(SpendNotAuthorized):
        await treasury_client.execute_payout(
            intent_id=intent.id,
            recipient_account="account-123"
        )


@pytest.mark.requirement("FR-VNT-TREAS-INV-004")
@pytest.mark.asyncio
async def test_authorization_chain_enforced(treasury_client):
    """
    FR-VNT-TREAS-INV-004: Authorization chain must be complete.

    States: pending -> approved|denied|expired
    Can only execute if approved.
    """
    intent = await treasury_client.create_intent(
        workflow_id="550e8400-e29b-41d4-a716-446655440000",
        amount_cents=50000
    )

    auth = await treasury_client.request_authorization(intent_id=intent.id)
    assert auth.status in ["pending", "approved", "denied"]

    if auth.status != "approved":
        with pytest.raises(CannotExecuteUnapprovedIntent):
            await treasury_client.execute_payout(intent_id=intent.id)
```

## Policy Invariant Tests

Policy engine gates all tool calls. These tests enforce the allowlist.

```python
@pytest.mark.requirement("FR-VNT-POLICY-INV-001")
def test_no_tool_call_without_allowlist(
    policy_engine: PolicyEngine,
    policy_bundle
):
    """
    FR-VNT-POLICY-INV-001: No tool call without allowlist entry.

    Default-deny: if tool not in agent's allowlist, reject.
    """
    engine = PolicyEngine(policy_bundle)

    with pytest.raises(ToolNotAllowed) as exc:
        engine.validate_tool_call(
            agent_role="executor",
            tool_name="delete_database",
            arguments={}
        )

    assert exc.value.tool_name == "delete_database"


@pytest.mark.requirement("FR-VNT-POLICY-INV-002")
def test_allowlist_is_role_specific(policy_engine, policy_bundle):
    """
    FR-VNT-POLICY-INV-002: Allowlist is role-specific.

    Different roles have different allowed tools.
    executive != executor != analyst
    """
    from app.policy.models import AgentRole

    engine = PolicyEngine(policy_bundle)

    # executive can approve spend
    assert engine.validate_tool_call(
        agent_role=AgentRole.EXECUTIVE,
        tool_name="approve_spend"
    ).allowed

    # executor cannot
    with pytest.raises(ToolNotAllowed):
        engine.validate_tool_call(
            agent_role=AgentRole.EXECUTOR,
            tool_name="approve_spend"
        )
```

## Pytest Fixtures

All tests use shared fixtures. Define in `tests/fixtures/conftest.py`:

```python
import pytest
import asyncio
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from unittest.mock import AsyncMock, MagicMock
from nats.aio.client import Client as NATS

# ============================================================================
# DATABASE FIXTURES
# ============================================================================

@pytest.fixture(scope="function")
def db_session() -> Session:
    """Isolated database session for each test."""
    engine = create_engine("sqlite:///:memory:")
    # Run migrations
    from app.db.base import Base
    Base.metadata.create_all(engine)

    Session = sessionmaker(bind=engine)
    session = Session()

    yield session

    session.close()
    engine.dispose()


@pytest.fixture(scope="function")
def db_with_sample_data(db_session):
    """Database session with sample data pre-loaded."""
    from app.models import PolicyBundle

    bundle = PolicyBundle(
        id="policy-001",
        version="1.0",
        content_hash="abc123",
        status="active"
    )
    db_session.add(bundle)
    db_session.commit()

    return db_session


# ============================================================================
# NATS FIXTURES
# ============================================================================

@pytest.fixture(scope="function")
async def nats_mock() -> AsyncMock:
    """Mock NATS client for unit/integration tests."""
    client = AsyncMock(spec=NATS)
    client.publish = AsyncMock()
    client.subscribe = AsyncMock(return_value=AsyncMock())
    client.jetstream = AsyncMock(return_value=AsyncMock())
    return client


@pytest.fixture(scope="function")
async def nats_real():
    """Real NATS connection for E2E tests."""
    client = NATS()
    await client.connect("nats://localhost:4222")
    yield client
    await client.close()


# ============================================================================
# REDIS FIXTURES
# ============================================================================

@pytest.fixture(scope="function")
def redis_mock():
    """Mock Redis client."""
    from unittest.mock import MagicMock
    client = MagicMock()
    client.get = MagicMock(return_value=None)
    client.set = MagicMock()
    client.delete = MagicMock()
    return client


@pytest.fixture(scope="function")
def redis_real():
    """Real Redis connection for E2E tests."""
    import redis
    r = redis.Redis(host='localhost', port=6379, db=0)
    r.flushdb()
    yield r
    r.flushdb()


# ============================================================================
# POLICY ENGINE FIXTURES
# ============================================================================

@pytest.fixture(scope="function")
def policy_bundle():
    """Sample policy bundle with role/tool allowlist."""
    return {
        "version": "1.0",
        "roles": {
            "executor": {
                "tools": ["web_search", "read_file", "call_api"],
                "daily_budget_cents": 100000
            },
            "executive": {
                "tools": ["approve_spend", "create_workflow"],
                "daily_budget_cents": 1000000
            }
        },
        "spend_rules": [
            {
                "name": "daily_limit",
                "condition": "amount_cents > 50000",
                "action": "require_executive_approval"
            }
        ]
    }


@pytest.fixture(scope="function")
def policy_engine(policy_bundle, db_session):
    """Policy engine instance with sample bundle."""
    from app.policy.engine import PolicyEngine
    return PolicyEngine(bundle=policy_bundle, db_session=db_session)


@pytest.fixture(scope="function")
def mock_policy_engine():
    """Mocked policy engine for API tests."""
    mock = AsyncMock()
    mock.check_authorization = AsyncMock(
        return_value={"approved": True, "reason": "ok"}
    )
    mock.validate_tool_call = AsyncMock(return_value={"allowed": True})
    return mock


# ============================================================================
# TREASURY FIXTURES
# ============================================================================

@pytest.fixture(scope="function")
def treasury_client(db_session, mock_policy_engine):
    """Treasury client instance for testing."""
    from app.treasury.client import TreasuryClient
    return TreasuryClient(
        db_session=db_session,
        policy_engine=mock_policy_engine
    )


# ============================================================================
# EVENT SCHEMA REGISTRY
# ============================================================================

@pytest.fixture(scope="session")
def schema_registry():
    """Global schema registry with all event schemas."""
    from app.events.schema_registry import SchemaRegistry
    registry = SchemaRegistry()
    registry.load_schemas("config/schemas/")
    return registry


# ============================================================================
# FASTAPI TEST CLIENT
# ============================================================================

@pytest.fixture(scope="function")
def client(db_session, mock_policy_engine):
    """FastAPI TestClient with mocked dependencies."""
    from fastapi.testclient import TestClient
    from app.main import app

    # Override dependencies
    app.dependency_overrides[get_db] = lambda: db_session
    app.dependency_overrides[get_policy_engine] = lambda: mock_policy_engine

    yield TestClient(app)

    app.dependency_overrides.clear()
```

## Coverage Targets

| Service | Unit | Integration | E2E | Target |
|---------|------|-------------|-----|--------|
| policy-engine | 100% | 100% | 100% | 100% |
| treasury-api | 100% | 100% | 95% | 100% |
| compliance-engine | 85% | 85% | 80% | 90% |
| artifact-compiler | 80% | 80% | 70% | 85% |
| agent-runtime | 85% | 80% | 75% | 85% |
| venture-orchestrator | 80% | 80% | 75% | 80% |

## Copilot L3 Test-First Pattern

Use `copilot` with `--yolo` flag to write failing tests:

```bash
copilot -p "Write failing test for FR-VNT-TREAS-003.
Test name: test_spend_requires_authorization
File: tests/unit/test_treasury.py
Test setup:
  - Create AuthorizationEngine
  - Call validate_spend() with unregistered purpose
  - Expect SpendNotAuthorized exception
  - Assert reason == 'no_authorization_record'

Test MUST FAIL (no implementation yet).
After writing test, run:
  pytest tests/unit/test_treasury.py::test_spend_requires_authorization -v

Commit message:
  test(treasury): FR-VNT-TREAS-003 failing test - spend requires authorization" \
    --yolo --model gpt-5-mini \
    --add-dir /Users/kooshapari/temp-PRODVERCEL/485/kush/parpour &
```

Then implement:

```bash
copilot -p "Implement FR-VNT-TREAS-003 in app/treasury/authorization.py.
Test file: tests/unit/test_treasury.py::test_spend_requires_authorization
Must pass the test.
Don't add fallbacks or legacy compatibility.

Implementation must:
  - Check if amount_cents has prior authorization
  - Raise SpendNotAuthorized if not
  - Include reason_code in exception

After implementing, run:
  pytest tests/unit/test_treasury.py::test_spend_requires_authorization -v

Commit message:
  feat(treasury): FR-VNT-TREAS-003 spend authorization gate" \
    --yolo --model gpt-5-mini \
    --add-dir /Users/kooshapari/temp-PRODVERCEL/485/kush/parpour &
```

## Test Execution

Run tests by type:

```bash
# Unit tests only (fast)
pytest tests/unit/ -v

# Integration tests
pytest tests/integration/ -v

# Contract tests
pytest tests/contract/ -v

# E2E tests (requires process-compose)
pytest tests/e2e/ -v

# All tests with coverage
pytest tests/ --cov=app --cov-report=html

# Single test
pytest tests/unit/test_treasury.py::test_spend_requires_authorization -v

# Tests for specific FR
pytest -m requirement("FR-VNT-TREAS-003") -v

# Watch mode (auto-rerun on file change)
ptw tests/unit/
```

## CI/CD Integration

All tests must pass before merge:

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: "3.14"

      - name: Install uv
        run: pip install uv

      - name: Install dependencies
        run: uv sync

      - name: Run unit tests
        run: pytest tests/unit/ --cov=app --cov-report=xml

      - name: Run integration tests
        run: pytest tests/integration/ --cov-append --cov-report=xml

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage.xml
```

## Summary

Test-first ensures:
- Every FR has documented intent (the test)
- Coverage is proven by design (100%)
- Invariants are enforced (double-entry, authorization chain, policy gates)
- Regressions are caught immediately
- Code is confident and maintainable

Start with the RED test. Make it FAIL. Then implement. Never ship code without a test.
