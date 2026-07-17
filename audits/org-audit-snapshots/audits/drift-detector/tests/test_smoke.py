"""Smoke tests for pheno-drift-detector.

Covers 4 subprocess E2E tests (CLI surface contract):

1. Module imports cleanly (import test)
2. --help exits 0 with usage string
3. --format invalid exits non-zero
4. --root invalid exits non-zero

Per ADR-023 Rule 3.1 substrate quality bar.
"""
from __future__ import annotations

import subprocess
import sys
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SCRIPT_PATH = REPO_ROOT / "pheno_drift_detector.py"


class TestSubprocessCLI(unittest.TestCase):
    """Subprocess-level CLI surface tests."""

    @classmethod
    def setUpClass(cls):
        cls.python = sys.executable
        cls.script = str(SCRIPT_PATH)

    def _run(self, *args, expect_exit: int | None = None) -> subprocess.CompletedProcess:
        return subprocess.run(
            [self.python, self.script, *args],
            capture_output=True,
            text=True,
            timeout=30,
        )

    def test_module_imports_cleanly(self):
        """Verify the module can be imported without errors."""
        result = subprocess.run(
            [self.python, "-c",
             "import sys; sys.path.insert(0, '.'); "
             "from pheno_drift_detector import main; print('test_import: OK')"],
            capture_output=True,
            text=True,
            timeout=30,
            cwd=REPO_ROOT,
        )
        self.assertEqual(result.returncode, 0, msg=f"stderr: {result.stderr}")
        self.assertIn("test_import: OK", result.stdout)

    def test_cli_help_exits_zero(self):
        """--help exits 0 with usage string."""
        result = self._run("--help")
        self.assertEqual(result.returncode, 0)
        self.assertIn("usage", result.stdout.lower())

    def test_cli_invalid_format_exits_nonzero(self):
        """An invalid --format value exits non-zero."""
        result = self._run("scan", "--root", ".", "--format", "invalid")
        self.assertNotEqual(result.returncode, 0)

    def test_scan_root_invalid_exits_nonzero(self):
        """An invalid --root path exits non-zero."""
        result = self._run("scan", "--root", "/nonexistent/path")
        self.assertNotEqual(result.returncode, 0)


if __name__ == "__main__":
    unittest.main()
