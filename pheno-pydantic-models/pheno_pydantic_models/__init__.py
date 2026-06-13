"""pheno-pydantic-models.

Canonical Pydantic v2 models for the pheno-* fleet. Mirrors the domain
model in the sibling ``pheno-zod-schemas`` TypeScript package so Python
and TypeScript services validate the same wire contract.

The three entities are:

- :class:`User` -- identity record (``id: UUID4``, ``email: EmailStr``,
  ``display_name: 1..80``, ``created_at: AwareDatetime``).
- :class:`WorklogEntry` -- per-task execution record (``task_id``,
  ``status`` enum of 6, ``agent_id``, nullable ``commit_sha``,
  ``started_at``/``completed_at`` aware datetimes, ``files_changed``
  list).
- :class:`Project` -- project aggregate (``id: slug``,
  ``name: 1..120``, ``owner_email: EmailStr``,
  ``members: list[EmailStr]`` with the "owner must be a member"
  invariant enforced by a model validator).

All three models are Pydantic v2 ``BaseModel`` subclasses with
``model_config = ConfigDict(extra="forbid", frozen=True)`` so:

- Unknown fields are rejected at validation time (catches
  client/server schema drift early).
- Instances are hashable and immutable after construction -- the
  fleet treats validated records as values, not mutable DTOs.

Wire-codes & invariants (must match ``pheno-zod-schemas``):

==================  =====================================================
Field               Constraint
==================  =====================================================
``User.id``             RFC 4122 UUID v4 (Pydantic ``UUID4``)
``User.email``          RFC 5322 email (``EmailStr``)
``User.display_name``   1..80 chars inclusive
``User.created_at``     Aware ``datetime`` (rejects naive datetimes)
``WorklogEntry.task_id``     non-empty string
``WorklogEntry.status``      exactly one of the 6 enum members
``WorklogEntry.commit_sha``  nullable; when set, 7-40 lowercase hex
``WorklogEntry.started_at``  aware ``datetime``
``WorklogEntry.completed_at``  nullable aware ``datetime``
``WorklogEntry.files_changed``  list of non-empty strings
``Project.id``          non-empty slug
``Project.name``        1..120 chars inclusive
``Project.owner_email``  RFC 5322 email
``Project.members``     list of emails; at least one member; the
                        owner MUST appear in the list
==================  =====================================================
"""

from __future__ import annotations

import re
from enum import Enum
from typing import Annotated, List, Optional

from pydantic import (
    AwareDatetime,
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    UUID4,
    field_validator,
    model_validator,
)

__all__ = [
    "User",
    "WorklogEntry",
    "WorklogStatus",
    "Project",
    "COMMIT_SHA_PATTERN",
    "SLUG_PATTERN",
    "DISPLAY_NAME_MAX",
    "DISPLAY_NAME_MIN",
    "PROJECT_NAME_MAX",
    "PROJECT_NAME_MIN",
]

# ---------------------------------------------------------------------------
# Shared constraints (mirror the Zod regex / length constants in the TS sibling
# so the two wire contracts cannot drift silently).
# ---------------------------------------------------------------------------

#: Lowercase-hex git short..full SHA pattern, 7-40 chars.
COMMIT_SHA_PATTERN: re.Pattern[str] = re.compile(r"^[0-9a-f]{7,40}$")

#: Slug pattern: lowercase alnum, optional single ``-`` or ``_`` separators,
#: no leading/trailing separators, 1..120 chars. Anchored.
SLUG_PATTERN: re.Pattern[str] = re.compile(r"^[a-z0-9]+(?:[-_][a-z0-9]+)*$")

#: ``User.display_name`` length bounds.
DISPLAY_NAME_MIN: int = 1
DISPLAY_NAME_MAX: int = 80

#: ``Project.name`` length bounds.
PROJECT_NAME_MIN: int = 1
PROJECT_NAME_MAX: int = 120


# ---------------------------------------------------------------------------
# WorklogStatus enum (the 6 canonical status values)
# ---------------------------------------------------------------------------


class WorklogStatus(str, Enum):
    """The 6 canonical worklog status values.

    Mirrors the ``WorklogStatus`` tuple in
    ``pheno-zod-schemas/src/index.ts``. Adding a 7th value is a breaking
    change to the wire contract and must be coordinated with the TS
    sibling.
    """

    PENDING = "pending"
    RUNNING = "running"
    BLOCKED = "blocked"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


# ---------------------------------------------------------------------------
# User
# ---------------------------------------------------------------------------


class User(BaseModel):
    """Identity record.

    See :data:`pheno_pydantic_models.DISPLAY_NAME_MAX` for the
    display_name upper bound and :class:`pheno_pydantic_models.User`'s
    field-level ``Field`` metadata for the lower/upper bound pair.
    """

    model_config = ConfigDict(extra="forbid", frozen=True)

    id: UUID4
    email: EmailStr
    display_name: Annotated[
        str,
        Field(
            min_length=DISPLAY_NAME_MIN,
            max_length=DISPLAY_NAME_MAX,
            description=f"1..{DISPLAY_NAME_MAX} char display name",
        ),
    ]
    created_at: AwareDatetime


# ---------------------------------------------------------------------------
# WorklogEntry
# ---------------------------------------------------------------------------


class WorklogEntry(BaseModel):
    """Per-task execution record.

    The status field uses :class:`WorklogStatus` (the canonical 6-value
    enum). ``commit_sha`` is null while a task is in flight; it gets
    set to the eventual git SHA when the task transitions to
    ``completed`` (or remains null on cancellation / failure).
    """

    model_config = ConfigDict(extra="forbid", frozen=True)

    task_id: Annotated[str, Field(min_length=1)]
    status: WorklogStatus
    agent_id: Annotated[str, Field(min_length=1)]
    commit_sha: Optional[str] = None
    started_at: AwareDatetime
    completed_at: Optional[AwareDatetime] = None
    files_changed: List[Annotated[str, Field(min_length=1)]]

    @field_validator("commit_sha")
    @classmethod
    def _validate_commit_sha(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        if not COMMIT_SHA_PATTERN.match(v):
            raise ValueError(
                "commit_sha must be 7-40 lowercase hex characters (or null)"
            )
        return v


# ---------------------------------------------------------------------------
# Project
# ---------------------------------------------------------------------------


class Project(BaseModel):
    """Project aggregate.

    The "owner must be a member" invariant is enforced by
    :py:meth:`model_validator` (mode="after") because it spans two
    fields. ``members`` is also required to be non-empty (a project
    with zero members is meaningless).
    """

    model_config = ConfigDict(extra="forbid", frozen=True)

    id: Annotated[
        str,
        Field(
            min_length=1,
            max_length=120,
            description="1..120 char slug (lowercase alnum + '-' or '_')",
        ),
    ]
    name: Annotated[
        str,
        Field(
            min_length=PROJECT_NAME_MIN,
            max_length=PROJECT_NAME_MAX,
            description=f"1..{PROJECT_NAME_MAX} char project name",
        ),
    ]
    owner_email: EmailStr
    members: List[EmailStr]

    @field_validator("id")
    @classmethod
    def _validate_id_is_slug(cls, v: str) -> str:
        if not SLUG_PATTERN.match(v):
            raise ValueError(
                "id must be a slug (lowercase alnum, dashes/underscores, "
                "no leading/trailing separators)"
            )
        return v

    @model_validator(mode="after")
    def _owner_must_be_member(self) -> "Project":
        if len(self.members) < 1:
            raise ValueError("project must have at least one member")
        if self.owner_email not in self.members:
            raise ValueError("owner_email must appear in members")
        return self
