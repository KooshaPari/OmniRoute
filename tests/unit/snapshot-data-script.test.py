import os
from pathlib import Path
import sqlite3
import subprocess
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[2] / "bin" / "snapshot-data.sh"

class SnapshotRefusalTest(unittest.TestCase):
    def test_active_wal_is_preserved(self):
        with tempfile.TemporaryDirectory() as root:
            data = Path(root) / "data"
            data.mkdir()
            db = sqlite3.connect(data / "storage.sqlite")
            db.execute("PRAGMA journal_mode=WAL")
            db.execute("PRAGMA wal_autocheckpoint=0")
            db.execute("CREATE TABLE entries (v TEXT)")
            db.commit()
            db.execute("INSERT INTO entries VALUES ('wal sentinel')")
            db.commit()
            main = data / "storage.sqlite"
            wal = data / "storage.sqlite-wal"
            before = (main.read_bytes(), wal.read_bytes())
            result = subprocess.run(["bash", str(SCRIPT), "--data-dir", str(data)], text=True, capture_output=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("Snapshot creation is unavailable", result.stderr)
            self.assertEqual((main.read_bytes(), wal.read_bytes()), before)
            self.assertFalse((data / "db_backups").exists())
            db.close()
    def test_traversal_and_symlink_never_write(self):
        with tempfile.TemporaryDirectory() as root:
            root = Path(root)
            data = root / "data"
            data.mkdir()
            target = root / "target"
            target.mkdir()
            (root / "link").symlink_to(target, target_is_directory=True)
            for backup in [root / "link" / ".." / "unexpected", root / "link" / "snapshots"]:
                env = dict(os.environ, DB_BACKUPS_DIR=str(backup))
                result = subprocess.run(["bash", str(SCRIPT), "--data-dir", str(data)], env=env, text=True, capture_output=True)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("Snapshot creation is unavailable", result.stderr)
            self.assertEqual(list(target.iterdir()), [])
            self.assertFalse((root / "unexpected").exists())
            self.assertFalse((data / "db_backups").exists())
    def test_missing_snapshot_advice_does_not_offer_disabled_command(self):
        with tempfile.TemporaryDirectory() as root:
            env = dict(os.environ, DATA_DIR=root)
            common = SCRIPT.parent / "_ops-common.sh"
            result = subprocess.run(["bash", "-c", "source \"$1\"; ops_find_snapshot missing", "test", str(common)], env=env, text=True, capture_output=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("snapshot creation is currently unavailable", result.stderr)
            self.assertNotIn("run bin/snapshot-data.sh first", result.stderr)
    def test_help_reports_unavailable(self):
        result = subprocess.run(["bash", str(SCRIPT), "--help"], text=True, capture_output=True)
        self.assertEqual(result.returncode, 0)
        self.assertIn("Snapshot creation is unavailable", result.stdout)

if __name__ == "__main__":
    unittest.main()
