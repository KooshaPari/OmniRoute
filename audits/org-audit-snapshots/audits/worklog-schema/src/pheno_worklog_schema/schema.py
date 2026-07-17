"""WORKLOG.md schema for ADR-015 v2.0 (6 col) and v2.1 (11 col).

The v2.1 schema (ADR-025/ADR-030) adds five columns to v2.0:
    device, scope, risk, deps, links
"""

from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass, field
from typing import Optional

# v2.0 columns (original 6)
_V20_COLUMNS = ("Date", "Task ID", "Layer", "Action", "Files", "Notes")

# v2.1 columns (ADR-025 adds device/scope/risk/deps/links)
_V21_COLUMNS = (
    "Date",
    "Task ID",
    "Layer",
    "Action",
    "Files",
    "Notes",
    "device",
    "scope",
    "risk",
    "deps",
    "links",
)

# Canonical `device:` values for the v2.1 schema (ADR-015 + ADR-025 + ADR-026).
#
# The `device` field records where the work was executed, which ADR-023 and the
# Factory AI Agent Readiness Model use to gate heavy work off of developer
# laptops. Only the values below are canonical; anything else should be migrated
# to one of them via tooling or noted as ad-hoc (case-sensitive, no spaces).
CANONICAL_DEVICES: tuple[str, ...] = (
    "macbook",       # local developer MacBook — planning, ADR-writing, small focused PRs, code review, dogfooding
    "heavy-runner",  # self-hosted runner or CI agent capable of full multi-crate `cargo test --workspace`, iOS sim boot, Docker-in-Docker, or any single build/test cycle > 10 min wall on MacBook
    "subagent",      # dispatched subagent (forge/codex/codex/droid/etc.) doing scoped, isolated work off-device
    "ci",            # CI pipeline run (GitHub Actions, Buildkite, etc.) — non-interactive, fully automated
)

_TABLE_HEADING_RE = re.compile(r"^\|(.+)\|\s*$")
_SEPARATOR_RE = re.compile(r"^\|(\s*:?-+:?\s*\|)+\s*$")


@dataclass(frozen=True)
class Row:
    """One row of a v2.1 WORKLOG.md (11 columns).

    All fields are strings. Missing v2.0 fields default to `"unknown"` after
    migration via `migrate_v20_to_v21`.
    """

    date: str
    task_id: str
    layer: str
    action: str
    files: str
    notes: str
    device: str = "unknown"
    scope: str = "unknown"
    risk: str = "unknown"
    deps: str = "none"
    links: str = ""


def _split_row(line: str) -> list[str]:
    """Split a Markdown table row into its cells (stripped)."""
    line = line.strip()
    if not (line.startswith("|") and line.endswith("|")):
        raise ValueError(f"not a table row: {line!r}")
    inner = line[1:-1]
    return [c.strip() for c in inner.split("|")]


def _is_separator(cells: list[str]) -> bool:
    return all(re.fullmatch(r":?-+:?", c) for c in cells)


def parse(text: str) -> list[Row]:
    """Parse a WORKLOG.md document into `Row` objects.

    Auto-detects v2.0 (6 col) vs v2.1 (11 col) by counting header columns.
    Empty / non-table lines are ignored.

    Args:
        text: The full WORKLOG.md text.

    Returns:
        List of Row objects. v2.0 rows are NOT auto-migrated — use
        `migrate_v20_to_v21` if you need v2.1 fields.
    """
    rows: list[Row] = []
    header: tuple[str, ...] | None = None
    for raw in text.splitlines():
        line = raw.rstrip()
        if not line or not _TABLE_HEADING_RE.match(line):
            continue
        cells = _split_row(line)
        if _is_separator(cells):
            continue
        if header is None:
            n = len(cells)
            if n == len(_V20_COLUMNS) and tuple(cells) == _V20_COLUMNS:
                header = _V20_COLUMNS
            elif n == len(_V21_COLUMNS) and tuple(cells) == _V21_COLUMNS:
                header = _V21_COLUMNS
            else:
                raise ValueError(
                    f"unrecognized WORKLOG header (expected v2.0 6-col or "
                    f"v2.1 11-col): {cells!r}"
                )
            continue
        # data row
        if len(cells) != len(header):
            # Be lenient: pad or truncate.
            if len(cells) < len(header):
                cells = cells + [""] * (len(header) - len(cells))
            else:
                cells = cells[: len(header)]
        if header == _V20_COLUMNS:
            rows.append(
                Row(
                    date=cells[0],
                    task_id=cells[1],
                    layer=cells[2],
                    action=cells[3],
                    files=cells[4],
                    notes=cells[5],
                )
            )
        else:  # v2.1
            rows.append(
                Row(
                    date=cells[0],
                    task_id=cells[1],
                    layer=cells[2],
                    action=cells[3],
                    files=cells[4],
                    notes=cells[5],
                    device=cells[6],
                    scope=cells[7],
                    risk=cells[8],
                    deps=cells[9],
                    links=cells[10],
                )
            )
    return rows


def to_markdown(rows: list[Row]) -> str:
    """Emit canonical v2.1 Markdown for a list of rows.

    Includes a header row and a separator row.
    """
    lines = [
        "| " + " | ".join(_V21_COLUMNS) + " |",
        "|" + "|".join([" --- "] * len(_V21_COLUMNS)) + "|",
    ]
    for r in rows:
        lines.append(
            "| "
            + " | ".join(
                [
                    r.date,
                    r.task_id,
                    r.layer,
                    r.action,
                    r.files,
                    r.notes,
                    r.device,
                    r.scope,
                    r.risk,
                    r.deps,
                    r.links,
                ]
            )
            + " |"
        )
    return "\n".join(lines) + "\n"


def to_jsonl(rows: list[Row]) -> str:
    """Emit JSONL (one JSON object per line) for a list of rows."""
    return "\n".join(json.dumps(asdict(r), ensure_ascii=False) for r in rows) + "\n"


def migrate_v20_to_v21(row: Row) -> Row:
    """Migrate a v2.0 row (6 columns) to v2.1 (11 columns).

    Sets `device="unknown"`, `scope="unknown"`, `risk="unknown"`, `deps="none"`,
    and `links=""`. All other fields are preserved.
    """
    return Row(
        date=row.date,
        task_id=row.task_id,
        layer=row.layer,
        action=row.action,
        files=row.files,
        notes=row.notes,
        device="unknown",
        scope="unknown",
        risk="unknown",
        deps="none",
        links="",
    )
