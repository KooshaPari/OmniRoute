"""Venture Platform - Database Schema

PostgreSQL schema for the event-sourced ledger.
"""

from sqlalchemy import (
    BigInteger,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID
from sqlalchemy.orm import declarative_base
from sqlalchemy.sql import func

Base = declarative_base()


class Event(Base):
    """Immutable event log - append only."""
    __tablename__ = "events"

    id = Column(BigInteger, primary_key=True)
    event_id = Column(PGUUID(as_uuid=True), unique=True, nullable=False, index=True)
    event_type = Column(String(100), nullable=False, index=True)
    trace_id = Column(PGUUID(as_uuid=True), nullable=False, index=True)
    workflow_id = Column(PGUUID(as_uuid=True), nullable=True, index=True)
    task_id = Column(PGUUID(as_uuid=True), nullable=True, index=True)
    policy_bundle_id = Column(PGUUID(as_uuid=True), nullable=True)
    payload = Column(JSONB, nullable=False, default={})
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        Index('ix_events_workflow_created', 'workflow_id', 'created_at'),
    )


class AuditCheckpoint(Base):
    """Checksum chain for tamper evidence."""
    __tablename__ = "audit_checkpoints"

    id = Column(BigInteger, primary_key=True)
    batch_id = Column(String(50), nullable=False)
    event_id_start = Column(PGUUID(as_uuid=True), nullable=False)
    event_id_end = Column(PGUUID(as_uuid=True), nullable=False)
    checksum = Column(String(64), nullable=False)  # SHA-256
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class MoneyIntent(Base):
    """Money authorization requests."""
    __tablename__ = "money_intents"

    id = Column(PGUUID(as_uuid=True), primary_key=True)
    workflow_id = Column(PGUUID(as_uuid=True), nullable=False, index=True)
    amount_cents = Column(BigInteger, nullable=False)
    currency = Column(String(3), default="USD")
    merchant_scope = Column(String(200), nullable=True)
    category = Column(String(50), nullable=True)
    ttl_seconds = Column(Integer, default=3600)
    status = Column(String(20), nullable=False, default="CREATED")  # CREATED, AUTHORIZED, DENIED, EXPIRED, SETTLED
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=True)


class AuthorizationDecision(Base):
    """Authorization decisions from treasury."""
    __tablename__ = "authorization_decisions"

    id = Column(PGUUID(as_uuid=True), primary_key=True)
    money_intent_id = Column(PGUUID(as_uuid=True), ForeignKey("money_intents.id"), nullable=False)
    decision = Column(String(10), nullable=False)  # APPROVED, DENIED
    reason_code = Column(String(50), nullable=True)
    approved_by = Column(String(50), nullable=True)  # 'auto' or agent_role
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class LedgerEntry(Base):
    """Double-entry ledger entries."""
    __tablename__ = "ledger_entries"

    id = Column(PGUUID(as_uuid=True), primary_key=True)
    workflow_id = Column(PGUUID(as_uuid=True), nullable=True, index=True)
    entry_type = Column(String(20), nullable=False)  # REVENUE, COST, TRANSFER, REFUND
    amount_cents = Column(BigInteger, nullable=False)
    currency = Column(String(3), default="USD")
    account_from = Column(String(100), nullable=True)
    account_to = Column(String(100), nullable=True)
    external_ref = Column(String(200), nullable=True)
    policy_bundle_id = Column(PGUUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        Index('ix_ledger_workflow', 'workflow_id', 'created_at'),
    )


class PolicyBundle(Base):
    """Versioned policy bundles."""
    __tablename__ = "policy_bundles"

    id = Column(PGUUID(as_uuid=True), primary_key=True)
    version = Column(String(20), nullable=False)
    rules = Column(JSONB, nullable=False, default=[])
    tool_allowlists = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        UniqueConstraint('version', name='uq_policy_version'),
    )


class Workflow(Base):
    """Workflow tracking."""
    __tablename__ = "workflows"

    id = Column(PGUUID(as_uuid=True), primary_key=True)
    objective = Column(Text, nullable=False)
    status = Column(String(20), nullable=False, default="PENDING")  # PENDING, RUNNING, COMPLETED, FAILED, CANCELLED
    budget_allocated = Column(BigInteger, default=0)
    budget_spent = Column(BigInteger, default=0)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
