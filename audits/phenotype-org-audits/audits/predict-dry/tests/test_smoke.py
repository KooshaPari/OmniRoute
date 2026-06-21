"""Smoke tests for pheno-predict.

Covers:
- 12 in-process tests (algorithm + heuristic + criterion coverage)
- 5 subprocess E2E tests (CLI surface contract)

Per ADR-023 Rule 3.1 substrate quality bar.
"""
from __future__ import annotations

import importlib.util
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import pytest

# ---------------------------------------------------------------------------
# Import the script as a module
# ---------------------------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parent.parent
SCRIPT_PATH = REPO_ROOT / "pheno_predict.py"


def _load_module():
    """Load pheno_predict.py as a module (it's a single-file script, not a package)."""
    spec = importlib.util.spec_from_file_location("pheno_predict", SCRIPT_PATH)
    assert spec is not None and spec.loader is not None, f"cannot load spec for {SCRIPT_PATH}"
    mod = importlib.util.module_from_spec(spec)
    sys.modules.setdefault("pheno_predict", mod)
    spec.loader.exec_module(mod)
    return mod


# Pre-load once at import time so all tests share the module
_mod = _load_module()
FileSig = _mod.FileSig
Candidate = _mod.Candidate
tokenize = _mod.tokenize
shingles = _mod.shingles
jaccard = _mod.jaccard
detect_language = _mod.detect_language
should_skip = _mod.should_skip
check_4_criteria = _mod.check_4_criteria
render_json = _mod.render_json
render_csv = _mod.render_csv
render_md = _mod.render_md
render = _mod.render
find_candidates = _mod.find_candidates
main = _mod.main
SHINGLE_LEN = _mod.SHINGLE_LEN
DEFAULT_THRESHOLD = _mod.DEFAULT_THRESHOLD
SKIP_DIRS = _mod.SKIP_DIRS
CODE_EXTS = _mod.CODE_EXTS


# ---------------------------------------------------------------------------
# 12 in-process tests
# ---------------------------------------------------------------------------


class TestTokenize(unittest.TestCase):
    def test_basic_identifiers(self):
        toks = tokenize("def foo(bar, baz123):")
        # TOKEN_RE = [A-Za-z_][A-Za-z0-9_]{1,} | \d+
        # "def", "foo", "bar", "baz123" match; parens/colon dropped
        self.assertIn("def", toks)
        self.assertIn("foo", toks)
        self.assertIn("bar", toks)
        self.assertIn("baz123", toks)

    def test_numbers_extracted(self):
        toks = tokenize("x = 42; y = 3.14")
        self.assertIn("42", toks)
        self.assertIn("3", toks)
        self.assertIn("14", toks)

    def test_drops_whitespace_and_punctuation(self):
        toks = tokenize("  a  b\n c  ")
        # Pure whitespace + single-char tokens: identifier regex requires
        # >= 1 char after the first, so "a", "b", "c" all match
        self.assertEqual(toks, ["a", "b", "c"])


class TestShingles(unittest.TestCase):
    def test_short_input_returns_empty(self):
        toks = ["a", "b", "c"]  # < SHINGLE_LEN=5
        self.assertEqual(shingles(toks), set())

    def test_exact_length_input(self):
        toks = ["a", "b", "c", "d", "e"]
        sh = shingles(toks)
        self.assertEqual(len(sh), 1)

    def test_longer_input_has_overlap(self):
        toks = ["a", "b", "c", "d", "e", "f", "g"]
        sh = shingles(toks)
        # 7 - 5 + 1 = 3 shingles
        self.assertEqual(len(sh), 3)

    def test_shingles_are_bytes(self):
        toks = ["a", "b", "c", "d", "e"]
        sh = shingles(toks)
        for s in sh:
            self.assertIsInstance(s, bytes)


class TestJaccard(unittest.TestCase):
    def test_identical_sets(self):
        s = {b"a", b"b", b"c"}
        j, shared = jaccard(s, s)
        self.assertAlmostEqual(j, 1.0)
        self.assertEqual(shared, 3)

    def test_disjoint_sets(self):
        j, shared = jaccard({b"a"}, {b"b"})
        self.assertEqual(j, 0.0)
        self.assertEqual(shared, 0)

    def test_empty_inputs(self):
        j, shared = jaccard(set(), {b"a"})
        self.assertEqual((j, shared), (0.0, 0))

    def test_partial_overlap(self):
        a = {1, 2, 3, 4}
        b = {3, 4, 5, 6}
        j, shared = jaccard(a, b)
        # |A ∩ B| = 2, |A ∪ B| = 6 → 1/3
        self.assertAlmostEqual(j, 1 / 3)
        self.assertEqual(shared, 2)


class TestCheck4Criteria(unittest.TestCase):
    def test_clear_pass(self):
        c = Candidate(
            repo_a="x", file_a="a.py", repo_b="y", file_b="b.py",
            jaccard=0.6, shared_shingles=100,
            total_shingles_a=200, total_shingles_b=200, language="python",
        )
        c = check_4_criteria(c)
        # Both files > 50 shingles + jaccard < 0.85 → meets_4_criteria=True
        self.assertTrue(c.meets_4_criteria)
        self.assertEqual(len(c.criteria_notes), 4)
        # criteria 2 and 3 always flagged as HUMAN
        self.assertTrue(any("criterion-2" in n for n in c.criteria_notes))
        self.assertTrue(any("criterion-3" in n for n in c.criteria_notes))

    def test_clear_fail_high_jaccard(self):
        c = Candidate(
            repo_a="x", file_a="a.py", repo_b="y", file_b="b.py",
            jaccard=0.95, shared_shingles=200,
            total_shingles_a=200, total_shingles_b=200, language="python",
        )
        c = check_4_criteria(c)
        # jaccard >= 0.85 → criterion-4 fails
        self.assertFalse(c.meets_4_criteria)


class TestRenderers(unittest.TestCase):
    def _sample(self):
        return [
            Candidate(
                repo_a="repo-a", file_a="src/a.py", repo_b="repo-b",
                file_b="src/b.py", jaccard=0.6123, shared_shingles=42,
                total_shingles_a=100, total_shingles_b=110, language="python",
                meets_4_criteria=True,
                criteria_notes=["criterion-1: ✓", "criterion-4: ✓"],
            )
        ]

    def test_render_json(self):
        out = render_json(self._sample())
        data = json.loads(out)
        self.assertIsInstance(data, list)
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["repo_a"], "repo-a")

    def test_render_csv(self):
        out = render_csv(self._sample())
        self.assertIn("repo_a,file_a,repo_b,file_b", out)
        self.assertIn("repo-a,src/a.py,repo-b,src/b.py", out)

    def test_render_md(self):
        out = render_md(self._sample())
        self.assertIn("## Predictive DRY candidates", out)
        self.assertIn("`repo-a`", out)
        self.assertIn("`src/a.py`", out)
        self.assertIn("0.6123", out)

    def test_render_empty(self):
        self.assertIn("None found", render_md([]))
        # CSV with no rows still has header
        self.assertIn("repo_a,file_a", render_csv([]))

    def test_render_dispatch(self):
        cands = self._sample()
        self.assertEqual(render(cands, "json"), render_json(cands))
        self.assertEqual(render(cands, "csv"), render_csv(cands))
        self.assertEqual(render(cands, "md"), render_md(cands))


class TestShouldSkip(unittest.TestCase):
    def test_skips_target(self):
        self.assertTrue(should_skip(Path("target/foo.py")))

    def test_skips_node_modules(self):
        self.assertTrue(should_skip(Path("a/node_modules/b.js")))

    def test_keeps_normal(self):
        self.assertFalse(should_skip(Path("src/main.py")))


# ---------------------------------------------------------------------------
# 5 subprocess E2E tests
# ---------------------------------------------------------------------------


def _make_repo(tmp: Path, name: str, files: dict[str, str]) -> Path:
    """Create a temp repo at tmp/name with the given {relpath: content} files."""
    repo = tmp / name
    repo.mkdir(parents=True, exist_ok=True)
    for rel, content in files.items():
        fp = repo / rel
        fp.parent.mkdir(parents=True, exist_ok=True)
        fp.write_text(content)
    return repo


class TestSubprocessCLI(unittest.TestCase):
    """The 5 user-spec'd subprocess smoke tests."""

    @classmethod
    def setUpClass(cls):
        # Ensure the entry-point script is on PATH (or use python -m).
        # Use `python -m` invocation to avoid relying on `pip install -e .`.
        cls.python = sys.executable
        cls.script = str(SCRIPT_PATH)

    def _run(self, *args, expect_exit: int = 0) -> subprocess.CompletedProcess:
        return subprocess.run(
            [self.python, self.script, *args],
            capture_output=True,
            text=True,
            timeout=30,
        )

    def test_01_help_exits_zero_with_usage_string(self):
        # Spec: --help exits 0 with usage string
        result = self._run("--help", expect_exit=0)
        self.assertEqual(result.returncode, 0)
        self.assertIn("usage", result.stdout.lower())

    def test_02_version_or_runtime_smoke(self):
        # Spec: --version OR any subcommand produces a valid runtime response.
        # The CLI uses subcommands, not a --version flag, so we call
        # `scan --help` (a clean subcommand entry) and check it returns 0
        # with the subcommand usage.
        result = self._run("scan", "--help")
        self.assertEqual(result.returncode, 0)
        # Subcommand usage should mention --target and --baseline
        self.assertIn("--target", result.stdout)
        self.assertIn("--baseline", result.stdout)

    def test_03_known_good_sample_exits_zero(self):
        # Spec: predict on a known-good sample → exit 0 (no candidates)
        with tempfile.TemporaryDirectory() as tmp:
            tmp_p = Path(tmp)
            # A tiny repo with completely unique content vs the baseline
            target = _make_repo(tmp_p, "target", {
                "src/uniq.py": "def unique_function_alpha():\n    return 99\n",
            })
            baseline = _make_repo(tmp_p, "baseline", {
                "src/diff.py": "def completely_different_beta():\n    return 7\n",
            })
            result = self._run(
                "scan",
                "--target", str(target),
                "--baseline", str(baseline),
                "--threshold", "0.55",
                "--format", "json",
            )
            self.assertEqual(result.returncode, 0, msg=f"stderr: {result.stderr}")
            # Output should be a valid JSON array
            data = json.loads(result.stdout)
            self.assertIsInstance(data, list)
            self.assertEqual(data, [])

    def test_04_known_bad_sample_exits_two(self):
        # Spec: predict on a known-bad (high-similarity) sample → exit 2
        with tempfile.TemporaryDirectory() as tmp:
            tmp_p = Path(tmp)
            # Two repos with substantial copy-paste between them
            shared = "def common_function():\n    x = 1\n    y = 2\n    z = 3\n    return x + y + z\n"
            target = _make_repo(tmp_p, "target", {"src/a.py": shared})
            baseline = _make_repo(tmp_p, "baseline", {"src/b.py": shared})
            result = self._run(
                "scan",
                "--target", str(target),
                "--baseline", str(baseline),
                "--threshold", "0.55",
                "--format", "json",
            )
            self.assertEqual(result.returncode, 2, msg=f"stderr: {result.stderr}")
            data = json.loads(result.stdout)
            self.assertGreater(len(data), 0)
            # jaccard should be 1.0 (identical content)
            self.assertGreaterEqual(data[0]["jaccard"], 0.99)

    def test_05_json_output_format_check(self):
        # Spec: JSON output format check
        with tempfile.TemporaryDirectory() as tmp:
            tmp_p = Path(tmp)
            target = _make_repo(tmp_p, "t", {"src/x.py": "def x():\n    return 1\n"})
            baseline = _make_repo(tmp_p, "b", {"src/y.py": "def y():\n    return 2\n"})
            result = self._run(
                "scan",
                "--target", str(target),
                "--baseline", str(baseline),
                "--format", "json",
            )
            # JSON should parse cleanly
            data = json.loads(result.stdout)
            self.assertIsInstance(data, list)
            # If there are candidates, each must have the expected keys
            for c in data:
                self.assertIn("repo_a", c)
                self.assertIn("repo_b", c)
                self.assertIn("jaccard", c)
                self.assertIn("shared_shingles", c)


if __name__ == "__main__":
    unittest.main()
