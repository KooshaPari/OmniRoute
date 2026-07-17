"""Tests for validate_governance.py"""

import os
import subprocess
from pathlib import Path
from unittest import mock

import pytest

from validate_governance import (
    check_dir,
    check_file,
    discover_repo_name,
    main,
    parse_args,
    run_ptrace_check,
    validate_repo,
)

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def temp_repo(tmp_path: Path) -> Path:
    """Create a temporary directory that looks like a PhenoSpecs repo."""
    # Create required files
    (tmp_path / "CLAUDE.md").write_text("# Claude")
    (tmp_path / "AGENTS.md").write_text("# Agents")
    (tmp_path / "README.md").write_text("# Readme")
    # Create optional directories
    (tmp_path / "specs").mkdir()
    (tmp_path / "specs" / ".gitkeep").write_text("")
    (tmp_path / "docs").mkdir()
    (tmp_path / ".github" / "workflows").mkdir(parents=True)
    (tmp_path / ".github" / "workflows" / "traceability.yml").write_text("name: trace")
    (tmp_path / ".phenotype").mkdir()
    (tmp_path / ".phenotype" / "ai-traceability.yaml").write_text("enabled: true")
    return tmp_path


# ---------------------------------------------------------------------------
# check_file
# ---------------------------------------------------------------------------

class TestCheckFile:
    @pytest.mark.parametrize(
        ("file_exists", "expected"),
        [
            (True, True),
            (False, False),
        ],
    )
    def test_returns_correct_bool(
        self, tmp_path: Path, file_exists: bool, expected: bool
    ) -> None:
        path = tmp_path / "test.txt"
        if file_exists:
            path.write_text("content")
        assert check_file(str(path), "test file") is expected


# ---------------------------------------------------------------------------
# check_dir
# ---------------------------------------------------------------------------

class TestCheckDir:
    @pytest.mark.parametrize(
        ("setup_fn", "expected"),
        [
            ("create_dir_with_file", True),
            ("create_empty_dir", False),
            ("noop", False),
        ],
    )
    def test_returns_correct_bool(self, tmp_path: Path, setup_fn: str, expected: bool) -> None:
        path = tmp_path / "mydir"
        if setup_fn == "create_dir_with_file":
            path.mkdir()
            (path / "file.txt").write_text("content")
        elif setup_fn == "create_empty_dir":
            path.mkdir()
        # else: dir doesn't exist
        assert check_dir(str(path), "test dir") is expected


# ---------------------------------------------------------------------------
# discover_repo_name
# ---------------------------------------------------------------------------

class TestDiscoverRepoName:
    def test_reads_version_file(self, tmp_path: Path) -> None:
        (tmp_path / "VERSION").write_text("1.2.3\n")
        assert discover_repo_name(str(tmp_path)) == "1.2.3"

    def test_strips_whitespace(self, tmp_path: Path) -> None:
        (tmp_path / "VERSION").write_text("  0.1.0  \n")
        assert discover_repo_name(str(tmp_path)) == "0.1.0"

    def test_falls_back_to_dirname(self, tmp_path: Path) -> None:
        name = discover_repo_name(str(tmp_path))
        assert name == tmp_path.resolve().name

    def test_empty_version_falls_back(self, tmp_path: Path) -> None:
        (tmp_path / "VERSION").write_text("")
        assert discover_repo_name(str(tmp_path)) == tmp_path.resolve().name


# ---------------------------------------------------------------------------
# run_ptrace_check
# ---------------------------------------------------------------------------

class TestRunPtraceCheck:
    @pytest.fixture
    def repo_path(self, tmp_path: Path) -> str:
        return str(tmp_path)

    @pytest.fixture
    def ptrace_bin(self, tmp_path: Path) -> str:
        bin_dir = tmp_path / "bin"
        bin_dir.mkdir()
        exe = bin_dir / "ptrace"
        exe.write_text("#!/bin/sh\nexit 0")
        exe.chmod(0o755)
        return str(exe)

    def test_skipped_when_no_ptrace_path(self, repo_path: str) -> None:
        assert run_ptrace_check(repo_path, ptrace_path=None) is True

    def test_skipped_when_binary_not_found(self, repo_path: str) -> None:
        assert run_ptrace_check(repo_path, ptrace_path="/nonexistent/ptrace") is True

    @mock.patch("validate_governance.subprocess.run")
    def test_returns_true_on_success(
        self, mock_run: mock.MagicMock, repo_path: str, ptrace_bin: str
    ) -> None:
        mock_run.return_value = mock.MagicMock(returncode=0)
        assert run_ptrace_check(repo_path, ptrace_path=ptrace_bin) is True
        mock_run.assert_called_once()

    @mock.patch("validate_governance.subprocess.run")
    def test_returns_false_on_drift(
        self, mock_run: mock.MagicMock, repo_path: str, ptrace_bin: str
    ) -> None:
        mock_run.return_value = mock.MagicMock(returncode=1)
        assert run_ptrace_check(repo_path, ptrace_path=ptrace_bin) is False

    @mock.patch("validate_governance.subprocess.run")
    def test_handles_timeout(
        self, mock_run: mock.MagicMock, repo_path: str, ptrace_bin: str
    ) -> None:
        mock_run.side_effect = subprocess.TimeoutExpired(cmd=["ptrace"], timeout=30)
        assert run_ptrace_check(repo_path, ptrace_path=ptrace_bin) is False

    @mock.patch("validate_governance.subprocess.run")
    def test_handles_called_process_error(
        self, mock_run: mock.MagicMock, repo_path: str, ptrace_bin: str
    ) -> None:
        mock_run.side_effect = subprocess.CalledProcessError(returncode=1, cmd=["ptrace"])
        assert run_ptrace_check(repo_path, ptrace_path=ptrace_bin) is False


# ---------------------------------------------------------------------------
# validate_repo
# ---------------------------------------------------------------------------

class TestValidateRepo:
    def test_passes_with_full_repo(self, temp_repo: Path) -> None:
        assert validate_repo(str(temp_repo)) == 0

    def test_fails_with_missing_artifacts(self, tmp_path: Path) -> None:
        # No CLAUDE.md, no AGENTS.md, no README.md
        (tmp_path / "specs").mkdir()
        result = validate_repo(str(tmp_path))
        # 6 checks: 3 artifacts fail, 2 governance fail, 1 specs pass, 1 ptrace skip
        # 2/6 = 33% < 80% -> fail
        assert result == 1

    def test_rejects_nonexistent_path(self) -> None:
        result = validate_repo("/nonexistent/path/that/does/not/exist")
        assert result == 1

    @mock.patch("validate_governance.Path.is_file", return_value=True)
    @mock.patch("validate_governance.subprocess.run")
    def test_accepts_custom_ptrace_path(
        self, mock_run: mock.MagicMock, mock_isfile: mock.MagicMock, temp_repo: Path
    ) -> None:
        mock_run.return_value = mock.MagicMock(returncode=0)
        result = validate_repo(str(temp_repo), ptrace_path="/usr/local/bin/ptrace")
        assert result == 0
        mock_run.assert_called_once()

    def test_partial_pass_with_some_artifacts(self, tmp_path: Path) -> None:
        # Only CLAUDE.md and specs/
        (tmp_path / "CLAUDE.md").write_text("# Claude")
        (tmp_path / "specs").mkdir()
        (tmp_path / "specs" / "a.md").write_text("a")
        result = validate_repo(str(tmp_path))
        # 6 checks: 1 artifact passes, 2 fail, 1 pass (specs dir), 1 skip (ptrace)
        # 3/6 = 50% < 80% -> fail
        assert result == 1


# ---------------------------------------------------------------------------
# parse_args
# ---------------------------------------------------------------------------

class TestParseArgs:
    def test_defaults(self) -> None:
        args = parse_args([])
        assert args.repo_path is None
        assert args.ptrace_path is None

    def test_repo_path(self) -> None:
        args = parse_args(["--repo-path", "/some/repo"])
        assert args.repo_path == "/some/repo"
        assert args.ptrace_path is None

    def test_ptrace_path(self) -> None:
        args = parse_args(["--ptrace-path", "/opt/bin/ptrace"])
        assert args.repo_path is None
        assert args.ptrace_path == "/opt/bin/ptrace"

    def test_both_args(self) -> None:
        args = parse_args(["--repo-path", "/repo", "--ptrace-path", "/bin/ptrace"])
        assert args.repo_path == "/repo"
        assert args.ptrace_path == "/bin/ptrace"


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------

class TestMain:
    def test_invokes_validate_repo(self) -> None:
        exit_code = main(["--repo-path", os.path.dirname(__file__)])
        assert exit_code in (0, 1)

    def test_nonexistent_path_returns_1(self) -> None:
        exit_code = main(["--repo-path", "/dev/null/nope"])
        assert exit_code == 1
