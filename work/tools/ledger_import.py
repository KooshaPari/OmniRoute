"""Import machine-readable work ledger artifacts into the AgilePlus WorkDB."""

from __future__ import annotations

import argparse
import hashlib
import json
import sqlite3
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

WORK_PACKAGE_STATES = {
    "todo": "planned",
    "wip": "doing",
    "ok": "done",
    "blocked": "blocked",
    "defer": "review",
    "hold": "review",
}
FEATURE_STATES = {
    "todo": "planned",
    "wip": "implementing",
    "ok": "validated",
    "blocked": "planned",
    "defer": "planned",
    "hold": "planned",
}
SOURCE_KEY = "phenotype-forward-work-v1"
SOURCE_METADATA = json.dumps({"source": "ledger_import"}, separators=(",", ":"))


def utc_now() -> str:
    """Return a SQLite-safe UTC timestamp."""
    return datetime.now(UTC).isoformat()


def ensure_schema(connection: sqlite3.Connection) -> None:
    """Create the WorkDB subset required by ledger imports when absent."""
    connection.executescript(
        """
        create table if not exists projects (
            id integer primary key autoincrement,
            slug text not null unique,
            name text not null,
            description text not null default '',
            created_at text not null,
            updated_at text not null
        );
        create table if not exists modules (
            id integer primary key autoincrement,
            slug text not null,
            friendly_name text not null,
            description text,
            parent_module_id integer references modules(id) on delete restrict,
            created_at text not null,
            updated_at text not null,
            unique(parent_module_id, slug)
        );
        create table if not exists features (
            id integer primary key autoincrement,
            slug text unique not null,
            friendly_name text not null,
            state text not null check(state in ('created','specified','researched','planned','implementing','validated','shipped','retrospected')),
            spec_hash blob not null,
            target_branch text not null default 'main',
            created_at text not null,
            updated_at text not null,
            module_id integer references modules(id) on delete set null
        );
        create table if not exists work_packages (
            id integer primary key autoincrement,
            feature_id integer not null references features(id) on delete cascade,
            title text not null,
            state text not null check(state in ('planned','doing','review','done','blocked')),
            sequence integer not null default 0,
            file_scope text not null default '[]',
            acceptance_criteria text not null default '',
            agent_id text,
            pr_url text,
            pr_state text,
            worktree_path text,
            created_at text not null,
            updated_at text not null
        );
        create table if not exists wp_dependencies (
            wp_id integer not null references work_packages(id) on delete cascade,
            depends_on integer not null references work_packages(id) on delete cascade,
            dep_type text not null check(dep_type in ('explicit','file_overlap','data')),
            primary key(wp_id, depends_on)
        );
        create table if not exists evidence (
            id integer primary key autoincrement,
            wp_id integer not null references work_packages(id) on delete cascade,
            fr_id text not null,
            evidence_type text not null check(evidence_type in ('test_result','ci_output','review_approval','security_scan','lint_result','manual_attestation')),
            artifact_path text not null,
            metadata text,
            created_at text not null
        );
        create table if not exists ledger_import_features (
            source_key text not null,
            external_id text not null,
            feature_id integer not null unique references features(id) on delete cascade,
            last_seen_at text not null,
            primary key(source_key, external_id)
        );
        create table if not exists ledger_import_modules (
            source_key text not null,
            external_id text not null,
            module_id integer not null unique references modules(id) on delete cascade,
            last_seen_at text not null,
            primary key(source_key, external_id)
        );
        create table if not exists ledger_import_work_packages (
            source_key text not null,
            external_id text not null,
            wp_id integer not null unique references work_packages(id) on delete cascade,
            last_seen_at text not null,
            primary key(source_key, external_id)
        );
        """
    )


def slugify(value: str) -> str:
    """Convert stable external identifiers into SQLite slugs."""
    return value.lower().replace("_", "-").replace(" ", "-")


def get_id(connection: sqlite3.Connection, table: str, slug: str) -> int:
    """Return the primary key for a uniquely slugged control-plane row."""
    row = connection.execute(
        f"select id from {table} where slug = ?", (slug,)
    ).fetchone()
    if row is None:
        raise RuntimeError(f"missing {table} row for {slug}")
    return int(row[0])


def upsert_project(connection: sqlite3.Connection, timestamp: str) -> None:
    """Create the project container for imported shared work."""
    connection.execute(
        """
        insert into projects(slug, name, description, created_at, updated_at)
        values('phenotype-work', 'Phenotype Shared Work', 'Imported from work ledger artifacts.', ?, ?)
        on conflict(slug) do update set updated_at = excluded.updated_at
        """,
        (timestamp, timestamp),
    )


def upsert_module(
    connection: sqlite3.Connection, lane: dict[str, Any], timestamp: str
) -> int:
    """Create or refresh a ledger lane module."""
    slug = slugify(str(lane["id"]))
    row = connection.execute(
        "select id from modules where parent_module_id is null and slug = ?", (slug,)
    ).fetchone()
    name = str(lane.get("name", lane["id"]))
    description = str(lane.get("owner", ""))
    if row is None:
        cursor = connection.execute(
            """
            insert into modules(slug, friendly_name, description, parent_module_id, created_at, updated_at)
            values(?, ?, ?, null, ?, ?)
            """,
            (slug, name, description, timestamp, timestamp),
        )
        return int(cursor.lastrowid)
    module_id = int(row[0])
    connection.execute(
        "update modules set friendly_name = ?, description = ?, updated_at = ? where id = ?",
        (name, description, timestamp, module_id),
    )
    return module_id


def validate_source(
    lanes: dict[str, dict[str, Any]], items: list[dict[str, Any]]
) -> None:
    """Reject invalid references before any mutable database operation begins."""
    item_ids = {str(item["id"]) for item in items}
    if len(item_ids) != len(items):
        raise ValueError("duplicate work item IDs")
    for item in items:
        item_id = str(item["id"])
        lane_id = str(item["lane"])
        state = str(item.get("state", "todo"))
        if lane_id not in lanes:
            raise ValueError(f"{item_id} references unknown lane {lane_id}")
        if state not in WORK_PACKAGE_STATES:
            raise ValueError(f"{item_id} has unsupported state {state}")
        for dependency in item.get("depends_on", []):
            if dependency not in item_ids:
                raise ValueError(
                    f"{item_id} references unknown dependency {dependency}"
                )


def collapse_duplicate_root_modules(connection: sqlite3.Connection) -> None:
    """Repair legacy duplicate root lanes caused by SQLite NULL uniqueness semantics."""
    duplicates = connection.execute(
        """
        select slug from modules
        where parent_module_id is null
        group by slug
        having count(*) > 1
        """
    ).fetchall()
    for (slug,) in duplicates:
        rows = connection.execute(
            "select id from modules where parent_module_id is null and slug = ? order by id",
            (slug,),
        ).fetchall()
        survivor = int(rows[0][0])
        duplicate_ids = [int(row[0]) for row in rows[1:]]
        for duplicate_id in duplicate_ids:
            connection.execute(
                "update features set module_id = ? where module_id = ?",
                (survivor, duplicate_id),
            )
            connection.execute("delete from modules where id = ?", (duplicate_id,))


def import_ledger(db_path: Path, forward_path: Path, qa_path: Path) -> dict[str, int]:
    """Import forward work and QA records into WorkDB without duplicate entities."""
    forward = json.loads(forward_path.read_text())
    qa = json.loads(qa_path.read_text())
    timestamp = utc_now()
    lanes = {str(lane["id"]): lane for lane in forward.get("lanes", [])}
    items = forward.get("work_items", [])
    validate_source(lanes, items)

    with sqlite3.connect(db_path) as connection:
        connection.execute("pragma foreign_keys = on")
        ensure_schema(connection)
        collapse_duplicate_root_modules(connection)
        upsert_project(connection, timestamp)
        module_ids = {
            lane_id: upsert_module(connection, lane, timestamp)
            for lane_id, lane in lanes.items()
        }
        package_ids: dict[str, int] = {}

        for sequence, item in enumerate(items):
            item_id = str(item["id"])
            lane_id = str(item["lane"])
            module_id = module_ids[lane_id]
            state = str(item.get("state", "todo"))
            spec_hash = hashlib.sha256(
                json.dumps(item, sort_keys=True).encode()
            ).digest()
            connection.execute(
                """
                insert into features(slug, friendly_name, state, spec_hash, target_branch, created_at, updated_at, module_id)
                values(?, ?, ?, ?, 'main', ?, ?, ?)
                on conflict(slug) do update set
                    friendly_name = excluded.friendly_name,
                    state = excluded.state,
                    spec_hash = excluded.spec_hash,
                    updated_at = excluded.updated_at,
                    module_id = excluded.module_id
                """,
                (
                    slugify(item_id),
                    str(item["deliverable"]),
                    FEATURE_STATES[state],
                    spec_hash,
                    timestamp,
                    timestamp,
                    module_id,
                ),
            )
            feature_id = get_id(connection, "features", slugify(item_id))
            connection.execute(
                """
                insert into ledger_import_features(source_key, external_id, feature_id, last_seen_at)
                values(?, ?, ?, ?)
                on conflict(source_key, external_id) do update set
                    feature_id = excluded.feature_id,
                    last_seen_at = excluded.last_seen_at
                """,
                (SOURCE_KEY, item_id, feature_id, timestamp),
            )
            existing = connection.execute(
                "select id from work_packages where feature_id = ? and title = ?",
                (feature_id, item_id),
            ).fetchone()
            if existing is None:
                cursor = connection.execute(
                    """
                    insert into work_packages(feature_id, title, state, sequence, file_scope, acceptance_criteria, agent_id, created_at, updated_at)
                    values(?, ?, ?, ?, '[]', ?, ?, ?, ?)
                    """,
                    (
                        feature_id,
                        item_id,
                        WORK_PACKAGE_STATES[state],
                        sequence,
                        str(item["deliverable"]),
                        str(item.get("owner", "")),
                        timestamp,
                        timestamp,
                    ),
                )
                package_ids[item_id] = int(cursor.lastrowid)
            else:
                package_ids[item_id] = int(existing[0])
                connection.execute(
                    "update work_packages set state = ?, sequence = ?, acceptance_criteria = ?, agent_id = ?, updated_at = ? where id = ?",
                    (
                        WORK_PACKAGE_STATES[state],
                        sequence,
                        str(item["deliverable"]),
                        str(item.get("owner", "")),
                        timestamp,
                        package_ids[item_id],
                    ),
                )
            connection.execute(
                """
                delete from evidence
                where wp_id = ?
                  and (
                    metadata = ?
                    or (metadata = '{}' and evidence_type in ('ci_output', 'test_result'))
                  )
                """,
                (package_ids[item_id], SOURCE_METADATA),
            )
            for artifact in item.get("evidence", []):
                add_evidence(
                    connection,
                    package_ids[item_id],
                    item_id,
                    str(artifact),
                    "ci_output",
                    timestamp,
                )

        for item in items:
            wp_id = package_ids[str(item["id"])]
            connection.execute("delete from wp_dependencies where wp_id = ?", (wp_id,))
            for dependency in item.get("depends_on", []):
                connection.execute(
                    "insert into wp_dependencies(wp_id, depends_on, dep_type) values(?, ?, 'explicit')",
                    (wp_id, package_ids[dependency]),
                )
        for requirement in qa.get("requirements", []):
            requirement_id = str(requirement["id"])
            for work_item in requirement.get("work_items", []):
                if work_item in package_ids:
                    for artifact in requirement.get("verification", []):
                        add_evidence(
                            connection,
                            package_ids[work_item],
                            requirement_id,
                            str(artifact),
                            "test_result",
                            timestamp,
                        )
        reconcile_removed_features(connection, set(package_ids), timestamp)
        connection.commit()
        return {
            "projects": count_rows(connection, "projects"),
            "modules": count_rows(connection, "modules"),
            "features": count_rows(connection, "features"),
            "work_packages": count_rows(connection, "work_packages"),
            "dependencies": count_rows(connection, "wp_dependencies"),
            "evidence": count_rows(connection, "evidence"),
        }


def add_evidence(
    connection: sqlite3.Connection,
    wp_id: int,
    fr_id: str,
    artifact_path: str,
    evidence_type: str,
    timestamp: str,
) -> None:
    """Insert a trace artifact only once for a work package and requirement."""
    existing = connection.execute(
        "select 1 from evidence where wp_id = ? and fr_id = ? and artifact_path = ?",
        (wp_id, fr_id, artifact_path),
    ).fetchone()
    if existing is None:
        connection.execute(
            "insert into evidence(wp_id, fr_id, evidence_type, artifact_path, metadata, created_at) values(?, ?, ?, ?, ?, ?)",
            (wp_id, fr_id, evidence_type, artifact_path, SOURCE_METADATA, timestamp),
        )


def reconcile_removed_features(
    connection: sqlite3.Connection, current_external_ids: set[str], timestamp: str
) -> None:
    """Delete only features previously owned by this source and now absent."""
    owned = connection.execute(
        "select external_id, feature_id from ledger_import_features where source_key = ?",
        (SOURCE_KEY,),
    ).fetchall()
    for external_id, feature_id in owned:
        if str(external_id) not in current_external_ids:
            connection.execute("delete from features where id = ?", (int(feature_id),))
        else:
            connection.execute(
                "update ledger_import_features set last_seen_at = ? where source_key = ? and external_id = ?",
                (timestamp, SOURCE_KEY, str(external_id)),
            )


def count_rows(connection: sqlite3.Connection, table: str) -> int:
    """Return a control-plane table count."""
    return int(connection.execute(f"select count(*) from {table}").fetchone()[0])


def main() -> None:
    """Provide a command-line entry point for the importer."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", type=Path, default=Path("work/agileplus-work.db"))
    parser.add_argument("--forward", type=Path, default=Path("work/forward-work.json"))
    parser.add_argument("--qa", type=Path, default=Path("work/qa-matrix.json"))
    arguments = parser.parse_args()
    print(
        json.dumps(
            import_ledger(arguments.db, arguments.forward, arguments.qa), sort_keys=True
        )
    )


if __name__ == "__main__":
    main()
