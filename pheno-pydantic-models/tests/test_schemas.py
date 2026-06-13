"""Tests for pheno-pydantic-models — mirrors the vitest suite in
pheno-zod-schemas/tests/schemas.test.ts. Five canonical tests, one per
the task brief, plus a baseline that the well-formed fixtures do
validate (so the "rejects" tests are meaningful)."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

import pytest
from pydantic import ValidationError

from pheno_pydantic_models import (
    PROJECT_NAME_MAX,
    Project,
    User,
    WorklogEntry,
    WorklogStatus,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

VALID_USER = {
    "id": UUID("550e8400-e29b-41d4-a716-446655440000"),
    "email": "ada@example.com",
    "display_name": "Ada Lovelace",
    "created_at": datetime(2026, 6, 11, 10, 0, 0, tzinfo=timezone.utc),
}

VALID_WORKLOG_ENTRY = {
    "task_id": "L3-53",
    "status": WorklogStatus.RUNNING,
    "agent_id": "forge-l3-subagent-53",
    "commit_sha": "7b78b5d0511655a0c535ade2cbd0b22131851a19",
    "started_at": datetime(2026, 6, 11, 10, 0, 0, tzinfo=timezone.utc),
    "completed_at": None,
    "files_changed": ["pheno-pydantic-models/pheno_pydantic_models/__init__.py"],
}

VALID_PROJECT = {
    "id": "pheno-pydantic-models",
    "name": "Canonical Pydantic models for the pheno-* fleet",
    "owner_email": "ada@example.com",
    "members": ["ada@example.com", "babbage@example.com"],
}


# ---------------------------------------------------------------------------
# Tests (5, per task brief)
# ---------------------------------------------------------------------------


def test_user_schema_rejects_invalid_email() -> None:
    bad = {**VALID_USER, "email": "not-an-email"}
    with pytest.raises(ValidationError) as exc_info:
        User(**bad)
    # Pydantic should flag the email field.
    error_locations = {tuple(e["loc"]) for e in exc_info.value.errors()}
    assert ("email",) in error_locations


def test_worklog_entry_schema_accepts_all_six_statuses() -> None:
    # All six canonical status enum members must validate.
    for status in WorklogStatus:
        entry = {**VALID_WORKLOG_ENTRY, "status": status}
        w = WorklogEntry(**entry)
        assert w.status is status


def test_worklog_entry_schema_rejects_unknown_status() -> None:
    bad = {**VALID_WORKLOG_ENTRY, "status": "queued"}
    with pytest.raises(ValidationError) as exc_info:
        WorklogEntry(**bad)
    error_locations = {tuple(e["loc"]) for e in exc_info.value.errors()}
    assert ("status",) in error_locations


def test_project_schema_requires_at_least_one_owner_member() -> None:
    # Empty members list is rejected (must have >=1 member).
    with pytest.raises(ValidationError):
        Project(**{**VALID_PROJECT, "members": []})

    # Owner must appear in members.
    missing_owner = {**VALID_PROJECT, "members": ["babbage@example.com"]}
    with pytest.raises(ValidationError) as exc_info:
        Project(**missing_owner)
    # The model_validator puts the error on the model itself, so the loc
    # is empty; we just confirm the message references the invariant.
    msgs = " ".join(
        e["msg"]
        for e in exc_info.value.errors()
        if "owner" in e["msg"] or "member" in e["msg"]
    )
    assert "owner" in msgs and "members" in msgs

    # Baseline: the well-formed fixture does validate.
    p = Project(**VALID_PROJECT)
    assert p.owner_email in p.members


def test_schema_types_infer_correctly() -> None:
    # Round-trip construction proves the types are usable end-to-end.
    u = User(**VALID_USER)
    w = WorklogEntry(**VALID_WORKLOG_ENTRY)
    p = Project(**VALID_PROJECT)

    assert isinstance(u, User)
    assert u.id == VALID_USER["id"]
    assert u.display_name == "Ada Lovelace"

    assert isinstance(w, WorklogEntry)
    assert w.task_id == "L3-53"
    assert w.status is WorklogStatus.RUNNING

    assert isinstance(p, Project)
    assert len(p.members) > 0

    # Tripwire: the WorklogStatus enum must have exactly 6 members, and
    # their string values must match the canonical set. Adding a 7th
    # would break this test (mirrors the l3-46 Rust 6-variant tripwire
    # pattern).
    assert len(WorklogStatus) == 6
    assert {s.value for s in WorklogStatus} == {
        "pending",
        "running",
        "blocked",
        "completed",
        "failed",
        "cancelled",
    }

    # And the project-name length bound used by the Field metadata is
    # the same one exported in the public API surface, so consumers
    # who import ``PROJECT_NAME_MAX`` are reading the live value.
    assert PROJECT_NAME_MAX == 120
