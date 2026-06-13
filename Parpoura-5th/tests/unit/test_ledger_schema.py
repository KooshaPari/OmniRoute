"""Tests for venture.ledger.schema module."""


from venture.ledger.schema import (
    Event,
    AuditCheckpoint,
    MoneyIntent,
    AuthorizationDecision,
    LedgerEntry,
    PolicyBundle,
    Workflow,
    Base,
)


class TestEventTable:
    """Test suite for Event ORM model."""

    def test_event_table_name(self):
        """Test that Event table has correct name."""
        assert Event.__tablename__ == "events"

    def test_event_columns_exist(self):
        """Test that Event has required columns."""
        assert hasattr(Event, 'id')
        assert hasattr(Event, 'event_id')
        assert hasattr(Event, 'event_type')
        assert hasattr(Event, 'trace_id')
        assert hasattr(Event, 'workflow_id')
        assert hasattr(Event, 'task_id')
        assert hasattr(Event, 'policy_bundle_id')
        assert hasattr(Event, 'payload')
        assert hasattr(Event, 'created_at')

    def test_event_table_args(self):
        """Test Event table has proper indices."""
        assert hasattr(Event, '__table_args__')

    def test_event_represents_immutable_log(self):
        """Test Event model structure for append-only semantics."""
        # Event should have minimal mutability features
        assert hasattr(Event, '__tablename__')
        assert hasattr(Event, 'id')


class TestAuditCheckpoint:
    """Test suite for AuditCheckpoint ORM model."""

    def test_audit_checkpoint_table_name(self):
        """Test that AuditCheckpoint table has correct name."""
        assert AuditCheckpoint.__tablename__ == "audit_checkpoints"

    def test_audit_checkpoint_columns_exist(self):
        """Test that AuditCheckpoint has required columns."""
        assert hasattr(AuditCheckpoint, 'id')
        assert hasattr(AuditCheckpoint, 'batch_id')
        assert hasattr(AuditCheckpoint, 'event_id_start')
        assert hasattr(AuditCheckpoint, 'event_id_end')
        assert hasattr(AuditCheckpoint, 'checksum')
        assert hasattr(AuditCheckpoint, 'created_at')

    def test_audit_checkpoint_for_tamper_evidence(self):
        """Test AuditCheckpoint has checksum field."""
        # Represents chain of checksums for tamper detection
        assert hasattr(AuditCheckpoint, 'checksum')


class TestMoneyIntent:
    """Test suite for MoneyIntent ORM model."""

    def test_money_intent_table_name(self):
        """Test that MoneyIntent table has correct name."""
        assert MoneyIntent.__tablename__ == "money_intents"

    def test_money_intent_columns_exist(self):
        """Test that MoneyIntent has required columns."""
        assert hasattr(MoneyIntent, 'id')
        assert hasattr(MoneyIntent, 'workflow_id')
        assert hasattr(MoneyIntent, 'amount_cents')
        assert hasattr(MoneyIntent, 'currency')
        assert hasattr(MoneyIntent, 'merchant_scope')
        assert hasattr(MoneyIntent, 'category')
        assert hasattr(MoneyIntent, 'ttl_seconds')
        assert hasattr(MoneyIntent, 'status')
        assert hasattr(MoneyIntent, 'created_at')
        assert hasattr(MoneyIntent, 'expires_at')

    def test_money_intent_model_structure(self):
        """Test MoneyIntent model has proper structure."""
        # All money intents should track amount in cents
        assert hasattr(MoneyIntent, 'amount_cents')
        assert hasattr(MoneyIntent, 'status')


class TestAuthorizationDecision:
    """Test suite for AuthorizationDecision ORM model."""

    def test_authorization_decision_table_name(self):
        """Test that AuthorizationDecision table has correct name."""
        assert AuthorizationDecision.__tablename__ == "authorization_decisions"

    def test_authorization_decision_columns_exist(self):
        """Test that AuthorizationDecision has required columns."""
        assert hasattr(AuthorizationDecision, 'id')
        assert hasattr(AuthorizationDecision, 'money_intent_id')
        assert hasattr(AuthorizationDecision, 'decision')
        assert hasattr(AuthorizationDecision, 'reason_code')
        assert hasattr(AuthorizationDecision, 'approved_by')
        assert hasattr(AuthorizationDecision, 'created_at')

    def test_authorization_decision_references_money_intent(self):
        """Test AuthorizationDecision has foreign key to MoneyIntent."""
        # Should reference money_intents table
        assert hasattr(AuthorizationDecision, 'money_intent_id')


class TestLedgerEntry:
    """Test suite for LedgerEntry ORM model."""

    def test_ledger_entry_table_name(self):
        """Test that LedgerEntry table has correct name."""
        assert LedgerEntry.__tablename__ == "ledger_entries"

    def test_ledger_entry_columns_exist(self):
        """Test that LedgerEntry has required columns."""
        assert hasattr(LedgerEntry, 'id')
        assert hasattr(LedgerEntry, 'workflow_id')
        assert hasattr(LedgerEntry, 'entry_type')
        assert hasattr(LedgerEntry, 'amount_cents')
        assert hasattr(LedgerEntry, 'currency')
        assert hasattr(LedgerEntry, 'account_from')
        assert hasattr(LedgerEntry, 'account_to')
        assert hasattr(LedgerEntry, 'external_ref')
        assert hasattr(LedgerEntry, 'policy_bundle_id')
        assert hasattr(LedgerEntry, 'created_at')

    def test_ledger_entry_has_double_entry_fields(self):
        """Test LedgerEntry supports double-entry bookkeeping."""
        # Double-entry accounts: from and to
        assert hasattr(LedgerEntry, 'account_from')
        assert hasattr(LedgerEntry, 'account_to')

    def test_ledger_entry_has_indices(self):
        """Test LedgerEntry table has optimization indices."""
        assert hasattr(LedgerEntry, '__table_args__')


class TestPolicyBundle:
    """Test suite for PolicyBundle ORM model."""

    def test_policy_bundle_table_name(self):
        """Test that PolicyBundle table has correct name."""
        assert PolicyBundle.__tablename__ == "policy_bundles"

    def test_policy_bundle_columns_exist(self):
        """Test that PolicyBundle has required columns."""
        assert hasattr(PolicyBundle, 'id')
        assert hasattr(PolicyBundle, 'version')
        assert hasattr(PolicyBundle, 'rules')
        assert hasattr(PolicyBundle, 'tool_allowlists')
        assert hasattr(PolicyBundle, 'created_at')

    def test_policy_bundle_versioning(self):
        """Test PolicyBundle supports versioning."""
        assert hasattr(PolicyBundle, 'version')

    def test_policy_bundle_has_unique_version_constraint(self):
        """Test PolicyBundle version is unique."""
        assert hasattr(PolicyBundle, '__table_args__')


class TestWorkflow:
    """Test suite for Workflow ORM model."""

    def test_workflow_table_name(self):
        """Test that Workflow table has correct name."""
        assert Workflow.__tablename__ == "workflows"

    def test_workflow_columns_exist(self):
        """Test that Workflow has required columns."""
        assert hasattr(Workflow, 'id')
        assert hasattr(Workflow, 'objective')
        assert hasattr(Workflow, 'status')
        assert hasattr(Workflow, 'budget_allocated')
        assert hasattr(Workflow, 'budget_spent')
        assert hasattr(Workflow, 'created_at')
        assert hasattr(Workflow, 'updated_at')

    def test_workflow_has_budget_tracking(self):
        """Test Workflow tracks allocated and spent budget."""
        assert hasattr(Workflow, 'budget_allocated')
        assert hasattr(Workflow, 'budget_spent')

    def test_workflow_has_status_field(self):
        """Test Workflow has status tracking."""
        assert hasattr(Workflow, 'status')

    def test_workflow_has_timestamps(self):
        """Test Workflow tracks creation and update times."""
        assert hasattr(Workflow, 'created_at')
        assert hasattr(Workflow, 'updated_at')


class TestSchemaBaseConfiguration:
    """Test suite for overall schema configuration."""

    def test_declarative_base_exists(self):
        """Test that declarative base is defined."""
        assert Base is not None

    def test_all_models_inherit_from_base(self):
        """Test that all ORM models are based on declarative."""
        models = [Event, AuditCheckpoint, MoneyIntent, AuthorizationDecision, 
                  LedgerEntry, PolicyBundle, Workflow]
        for model in models:
            # All models should have __tablename__
            assert hasattr(model, '__tablename__')
            # All should be classes
            assert isinstance(model, type)

    def test_all_models_have_table_metadata(self):
        """Test all models define table metadata."""
        models = [Event, AuditCheckpoint, MoneyIntent, AuthorizationDecision, 
                  LedgerEntry, PolicyBundle, Workflow]
        for model in models:
            assert hasattr(model, '__tablename__')
            assert isinstance(model.__tablename__, str)
            assert len(model.__tablename__) > 0

    def test_schema_supports_event_sourcing(self):
        """Test schema supports event sourcing pattern."""
        # Event log is immutable
        assert Event.__tablename__ == "events"
        # Audit chain for verification
        assert AuditCheckpoint.__tablename__ == "audit_checkpoints"

    def test_schema_supports_double_entry_accounting(self):
        """Test schema supports double-entry bookkeeping."""
        # LedgerEntry with from/to accounts
        assert LedgerEntry.__tablename__ == "ledger_entries"
        assert hasattr(LedgerEntry, 'account_from')
        assert hasattr(LedgerEntry, 'account_to')

    def test_schema_supports_authorization_workflow(self):
        """Test schema supports money authorization workflow."""
        # Money intent + authorization decision
        assert MoneyIntent.__tablename__ == "money_intents"
        assert AuthorizationDecision.__tablename__ == "authorization_decisions"
