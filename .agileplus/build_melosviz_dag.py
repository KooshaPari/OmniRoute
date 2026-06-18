#!/usr/bin/env python3
"""Populate AgilePlus DB with melosviz work packages (re-seeded after external reset)."""
import sqlite3
from pathlib import Path

DB = Path("/Users/kooshapari/CodeProjects/Phenotype/repos/.agileplus/agileplus.db")
DB.parent.mkdir(parents=True, exist_ok=True)
con = sqlite3.connect(DB)
cur = con.cursor()

now = "2026-06-14T00:00:00Z"

# 1. project
cur.execute("SELECT id FROM projects WHERE slug='melosviz'")
row = cur.fetchone()
if row:
    project_id = row[0]
else:
    cur.execute(
        "INSERT INTO projects(slug, name, description, created_at, updated_at) VALUES(?,?,?,?,?)",
        ("melosviz", "Melosviz", "Music visualization platform", now, now),
    )
    project_id = cur.lastrowid

# 2. module
cur.execute("SELECT id FROM modules WHERE slug='melosviz' AND parent_module_id IS NULL")
row = cur.fetchone()
if row:
    module_id = row[0]
else:
    cur.execute(
        "INSERT INTO modules(slug, friendly_name, description, parent_module_id, created_at, updated_at) VALUES(?,?,?,?,?,?)",
        ("melosviz", "Melosviz", "Top-level module", None, now, now),
    )
    module_id = cur.lastrowid

# 3. feature
cur.execute("SELECT id FROM features WHERE slug='melosviz-100task'")
row = cur.fetchone()
if row:
    feature_id = row[0]
else:
    cur.execute(
        "INSERT INTO features(slug, friendly_name, state, spec_hash, target_branch, created_at, updated_at, module_id) VALUES(?,?,?,?,?,?,?,?)",
        ("melosviz-100task", "Melosviz 100-task DAG", "implementing", b"\x00" * 32, "main", now, now, module_id),
    )
    feature_id = cur.lastrowid

print(f"feature_id = {feature_id}")
con.commit()
con.close()
