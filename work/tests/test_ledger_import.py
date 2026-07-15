"""Regression coverage for the WorkDB ledger importer."""

from __future__ import annotations

import json
import sqlite3
import tempfile
import unittest
from pathlib import Path

from work.tools.ledger_import import import_ledger


class LedgerImportTests(unittest.TestCase):
    """Verify the importer creates stable, idempotent control-plane records."""

    def test_import_populates_and_is_idempotent(self) -> None:
        """Importing the same ledger twice preserves one row per entity."""
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            db_path = root / "work.db"
            forward_path = root / "forward.json"
            qa_path = root / "qa.json"
            forward_path.write_text(
                json.dumps(
                    {
                        "lanes": [{"id": "LANE-CORE", "name": "Core", "owner": "root"}],
                        "work_items": [
                            {
                                "id": "WBS-001",
                                "lane": "LANE-CORE",
                                "phase": "control",
                                "owner": "root",
                                "state": "wip",
                                "depends_on": [],
                                "deliverable": "Seed the ledger",
                                "evidence": ["work/forward.json"],
                            },
                            {
                                "id": "WBS-002",
                                "lane": "LANE-CORE",
                                "phase": "control",
                                "owner": "root",
                                "state": "todo",
                                "depends_on": ["WBS-001"],
                                "deliverable": "Verify the ledger",
                                "evidence": [],
                            },
                        ],
                    }
                )
            )
            qa_path.write_text(
                json.dumps(
                    {
                        "requirements": [
                            {
                                "id": "GAP-001",
                                "work_items": ["WBS-001"],
                                "verification": ["python verify.py"],
                            }
                        ]
                    }
                )
            )

            first = import_ledger(db_path, forward_path, qa_path)
            second = import_ledger(db_path, forward_path, qa_path)

            self.assertEqual(first["work_packages"], 2)
            self.assertEqual(second, first)
            with sqlite3.connect(db_path) as connection:
                self.assertEqual(
                    connection.execute("select count(*) from projects").fetchone()[0], 1
                )
                self.assertEqual(
                    connection.execute("select count(*) from modules").fetchone()[0], 1
                )
                self.assertEqual(
                    connection.execute("select count(*) from features").fetchone()[0], 2
                )
                self.assertEqual(
                    connection.execute("select count(*) from work_packages").fetchone()[
                        0
                    ],
                    2,
                )
                self.assertEqual(
                    connection.execute(
                        "select count(*) from wp_dependencies"
                    ).fetchone()[0],
                    1,
                )
                self.assertEqual(
                    connection.execute("select count(*) from evidence").fetchone()[0], 2
                )

            with sqlite3.connect(db_path) as connection:
                connection.execute(
                    "insert into modules(slug, friendly_name, description, parent_module_id, created_at, updated_at) values('lane-core', 'Core', '', null, 'old', 'old')"
                )
                connection.commit()
            repaired = import_ledger(db_path, forward_path, qa_path)
            self.assertEqual(repaired["modules"], 1)

    def test_import_rejects_unknown_dependency_before_creating_rows(self) -> None:
        """An orphaned edge fails instead of silently producing a partial DAG."""
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            db_path = root / "work.db"
            forward_path = root / "forward.json"
            qa_path = root / "qa.json"
            forward_path.write_text(
                json.dumps(
                    {
                        "lanes": [{"id": "LANE-CORE", "name": "Core"}],
                        "work_items": [
                            {
                                "id": "WBS-001",
                                "lane": "LANE-CORE",
                                "state": "todo",
                                "depends_on": ["MISSING-001"],
                                "deliverable": "Broken dependency",
                                "evidence": [],
                            }
                        ],
                    }
                )
            )
            qa_path.write_text(json.dumps({"requirements": []}))

            with self.assertRaisesRegex(ValueError, "MISSING-001"):
                import_ledger(db_path, forward_path, qa_path)
            self.assertFalse(db_path.exists())

    def test_import_reconciles_removed_source_rows_and_evidence(self) -> None:
        """A later import removes only rows previously owned by this ledger source."""
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            db_path = root / "work.db"
            forward_path = root / "forward.json"
            qa_path = root / "qa.json"
            forward = {
                "lanes": [{"id": "LANE-CORE", "name": "Core"}],
                "work_items": [
                    {
                        "id": "WBS-001",
                        "lane": "LANE-CORE",
                        "state": "todo",
                        "depends_on": [],
                        "deliverable": "Keep",
                        "evidence": ["old-ci"],
                    },
                    {
                        "id": "WBS-002",
                        "lane": "LANE-CORE",
                        "state": "todo",
                        "depends_on": [],
                        "deliverable": "Remove",
                        "evidence": [],
                    },
                ],
            }
            forward_path.write_text(json.dumps(forward))
            qa_path.write_text(
                json.dumps(
                    {
                        "requirements": [
                            {
                                "id": "GAP-001",
                                "work_items": ["WBS-001"],
                                "verification": ["old-test"],
                            }
                        ]
                    }
                )
            )
            import_ledger(db_path, forward_path, qa_path)

            with sqlite3.connect(db_path) as connection:
                connection.execute("update evidence set metadata = '{}'")
                connection.execute(
                    """
                    insert into features(slug, friendly_name, state, spec_hash, target_branch, created_at, updated_at)
                    values('manual-feature', 'Manual feature', 'planned', ?, 'main', 'manual', 'manual')
                    """,
                    (b"manual",),
                )
                connection.commit()

            forward["work_items"] = [
                {
                    "id": "WBS-001",
                    "lane": "LANE-CORE",
                    "state": "todo",
                    "depends_on": [],
                    "deliverable": "Keep",
                    "evidence": ["new-ci"],
                }
            ]
            forward_path.write_text(json.dumps(forward))
            qa_path.write_text(
                json.dumps(
                    {
                        "requirements": [
                            {
                                "id": "GAP-001",
                                "work_items": ["WBS-001"],
                                "verification": ["new-test"],
                            }
                        ]
                    }
                )
            )
            imported = import_ledger(db_path, forward_path, qa_path)

            self.assertEqual(imported["features"], 2)
            self.assertEqual(imported["work_packages"], 1)
            with sqlite3.connect(db_path) as connection:
                self.assertEqual(
                    connection.execute(
                        "select count(*) from features where slug = 'manual-feature'"
                    ).fetchone()[0],
                    1,
                )
                self.assertEqual(
                    connection.execute(
                        "select group_concat(artifact_path, ',') from evidence order by artifact_path"
                    ).fetchone()[0],
                    "new-ci,new-test",
                )
                self.assertEqual(
                    connection.execute(
                        "select metadata from evidence limit 1"
                    ).fetchone()[0],
                    '{"source":"ledger_import"}',
                )


if __name__ == "__main__":
    unittest.main()
