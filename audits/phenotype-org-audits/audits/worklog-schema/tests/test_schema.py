"""Tests for pheno-worklog-schema parser/emitter/migrator."""

from __future__ import annotations

import json

import pytest

from pheno_worklog_schema import (
    Row,
    __version__,
    migrate_v20_to_v21,
    parse,
    to_jsonl,
    to_markdown,
)


# ---------- version / metadata ----------


def test_version():
    assert __version__ == "0.4.0"


def test_row_dataclass_has_11_fields():
    r = Row(
        date="2026-06-20", task_id="L1", layer="L1-lib",
        action="feat", files="x.py", notes="n",
    )
    # v2.1 defaults: device/scope/risk = unknown, deps = none, links = ""
    assert r.device == "unknown"
    assert r.scope == "unknown"
    assert r.risk == "unknown"
    assert r.deps == "none"
    assert r.links == ""


# ---------- v2.1 parse + emit roundtrip ----------


def test_parse_v21_basic():
    text = """\
# WORKLOG

Schema: ADR-015 v2.1.

| Date | Task ID | Layer | Action | Files | Notes | device | scope | risk | deps | links |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-06-20 | L1-a | L1-lib | feat: x | x.py | n | macbook | repo | low | none | ADR-015 |
| 2026-06-20 | L1-b | L2-svc | fix: y | y.py | m | ci | fleet | med | L1-a | ADR-025 |
"""
    rows = parse(text)
    assert len(rows) == 2
    assert rows[0].task_id == "L1-a"
    assert rows[0].device == "macbook"
    assert rows[1].risk == "med"
    assert rows[1].links == "ADR-025"


def test_parse_v21_ignores_non_table_lines():
    text = """\
# Header

Some prose here.

| Date | Task ID | Layer | Action | Files | Notes | device | scope | risk | deps | links |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-06-20 | L1 | L1-lib | feat | x.py | n | macbook | repo | low | none |  |

## More prose

| 2026-06-20 | L2 | L2 | fix | y.py | m | ci | fleet | med | L1 |  |
"""
    rows = parse(text)
    assert len(rows) == 2


def test_to_markdown_v21_canonical():
    rows = [
        Row("2026-06-20", "L1", "L1-lib", "feat", "x.py", "n",
            "macbook", "repo", "low", "none", "ADR-015"),
    ]
    out = to_markdown(rows)
    lines = out.strip().splitlines()
    assert lines[0] == (
        "| Date | Task ID | Layer | Action | Files | Notes | device | "
        "scope | risk | deps | links |"
    )
    assert lines[2] == (
        "| 2026-06-20 | L1 | L1-lib | feat | x.py | n | macbook | repo "
        "| low | none | ADR-015 |"
    )


def test_roundtrip_v21():
    rows = [
        Row("2026-06-20", "L1", "L1-lib", "feat", "x.py", "n",
            "macbook", "repo", "low", "none", "ADR-015"),
    ]
    md = to_markdown(rows)
    parsed = parse(md)
    assert parsed == rows


# ---------- v2.0 parse ----------


def test_parse_v20_basic():
    text = """\
# WORKLOG

| Date | Task ID | Layer | Action | Files | Notes |
| --- | --- | --- | --- | --- | --- |
| 2026-06-20 | L1 | L1-lib | feat | x.py | n |
"""
    rows = parse(text)
    assert len(rows) == 1
    r = rows[0]
    assert r.task_id == "L1"
    # v2.0 row has all the v2.1 defaults since it's a single Row dataclass.
    assert r.device == "unknown"


# ---------- migrate v2.0 → v2.1 ----------


def test_migrate_v20_to_v21_preserves_fields():
    v20 = Row("2026-06-20", "L1", "L1-lib", "feat", "x.py", "n")
    v21 = migrate_v20_to_v21(v20)
    assert v21.date == v20.date
    assert v21.task_id == v20.task_id
    assert v21.layer == v20.layer
    assert v21.action == v20.action
    assert v21.files == v20.files
    assert v21.notes == v20.notes
    assert v21.device == "unknown"
    assert v21.scope == "unknown"
    assert v21.risk == "unknown"
    assert v21.deps == "none"
    assert v21.links == ""


def test_migrate_then_emit_roundtrip():
    v20 = Row("2026-06-20", "L1", "L1-lib", "feat", "x.py", "n")
    v21 = migrate_v20_to_v21(v20)
    md = to_markdown([v21])
    parsed = parse(md)
    assert parsed == [v21]


# ---------- JSONL emit ----------


def test_to_jsonl_basic():
    rows = [
        Row("2026-06-20", "L1", "L1-lib", "feat", "x.py", "n",
            "macbook", "repo", "low", "none", "ADR-015"),
    ]
    out = to_jsonl(rows)
    obj = json.loads(out.strip())
    assert obj["task_id"] == "L1"
    assert obj["device"] == "macbook"


def test_to_jsonl_multiple_rows():
    rows = [
        Row("2026-06-20", "L1", "L1", "feat", "x.py", "n",
            "macbook", "repo", "low", "none", ""),
        Row("2026-06-20", "L2", "L2", "fix", "y.py", "m",
            "ci", "fleet", "med", "L1", "ADR-015"),
    ]
    out = to_jsonl(rows)
    lines = [l for l in out.strip().splitlines() if l]
    assert len(lines) == 2
    assert json.loads(lines[0])["task_id"] == "L1"
    assert json.loads(lines[1])["task_id"] == "L2"


# ---------- error cases ----------


def test_parse_unknown_header_raises():
    text = "| a | b |\n| --- | --- |\n| 1 | 2 |\n"
    with pytest.raises(ValueError):
        parse(text)


def test_parse_empty_text_returns_empty():
    assert parse("") == []
    assert parse("# WORKLOG\n\nNo table here.\n") == []


def test_parse_lenient_short_row_pads():
    """If a row has fewer cells than the header, it is padded with ''."""
    text = """| Date | Task ID | Layer | Action | Files | Notes | device | scope | risk | deps | links |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-06-20 | L1 |
"""
    rows = parse(text)
    assert len(rows) == 1
    assert rows[0].task_id == "L1"
    assert rows[0].layer == ""


def test_parse_lenient_long_row_truncates():
    """If a row has more cells than the header, it is truncated."""
    text = """| Date | Task ID | Layer | Action | Files | Notes | device | scope | risk | deps | links |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-06-20 | L1 | L1 | feat | x.py | n | macbook | repo | low | none | A | EXTRA |
"""
    rows = parse(text)
    assert len(rows) == 1
    assert rows[0].links == "A"


def test_to_markdown_empty_list():
    out = to_markdown([])
    lines = out.strip().splitlines()
    # header + separator only
    assert len(lines) == 2
    assert "Date" in lines[0]
