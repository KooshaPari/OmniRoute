"""Acceptance-test stubs for the Video Exporter (FR-6–FR-19).

Each test maps to one Functional Requirement from docs/specs/SPEC.md.
All tests are marked @pytest.mark.skip as pending — they encode the
asymptote / acceptance oracle that implementation must satisfy.

Run with:  pytest -v docs/specs/acceptance/test_video_exporter_acceptance.py
"""

from __future__ import annotations

from pathlib import Path
from typing import Any
from unittest.mock import patch

import pytest

from melosviz.analysis.models import RenderSpec
from melosviz.render.video_exporter import (
    FFMpegNotFoundError,
    RenderExportError,
    export_video,
    is_ffmpeg_available,
)


# ---------------------------------------------------------------------------
# Shared mock helpers (mirroring backend/tests/test_video_exporter.py)
# ---------------------------------------------------------------------------

SENTINEL_FFMPEG = "/fake/path/to/ffmpeg"
SENTINEL_OUTPUT_BYTES = b"\x00" * 4096


def _fake_ffmpeg_success(cmd: list[str], **kwargs: Any) -> Any:
    output_path = Path(cmd[-1])
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_bytes(SENTINEL_OUTPUT_BYTES)


def _patch_success() -> Any:
    return patch(
        "melosviz.render.video_exporter.subprocess.run",
        side_effect=_fake_ffmpeg_success,
    )


def _patch_resolve() -> Any:
    return patch(
        "melosviz.render.video_exporter._resolve_ffmpeg_binary",
        return_value=SENTINEL_FFMPEG,
    )


# ---------------------------------------------------------------------------
# FR-6: Export MP4 with libx264
# ---------------------------------------------------------------------------


@pytest.mark.skip(reason="FR-6 acceptance oracle — not yet implemented")
class TestFR6ExportMP4:
    """FR-6: export_video(spec, format='mp4') produces MP4 with libx264."""

    def test_returns_path_with_mp4_suffix(self, tmp_path: Path) -> None:
        with _patch_resolve(), _patch_success():
            result = export_video(RenderSpec(), format="mp4", output_dir=tmp_path)
        assert isinstance(result, Path)
        assert result.suffix == ".mp4"

    def test_creates_nonempty_file(self, tmp_path: Path) -> None:
        with _patch_resolve(), _patch_success():
            result = export_video(RenderSpec(), format="mp4", output_dir=tmp_path)
        assert result.exists()
        assert result.stat().st_size > 0

    def test_uses_libx264_and_yuv420p(self, tmp_path: Path) -> None:
        with _patch_resolve(), _patch_success() as mock_run:
            export_video(RenderSpec(), format="mp4", output_dir=tmp_path)
        cmd = mock_run.call_args[0][0]
        assert "libx264" in cmd
        assert "yuv420p" in cmd


# ---------------------------------------------------------------------------
# FR-7: Export WebM with libvpx-vp9
# ---------------------------------------------------------------------------


@pytest.mark.skip(reason="FR-7 acceptance oracle — not yet implemented")
class TestFR7ExportWebM:
    """FR-7: export_video(spec, format='webm') produces WebM with libvpx-vp9."""

    def test_returns_path_with_webm_suffix(self, tmp_path: Path) -> None:
        with _patch_resolve(), _patch_success():
            result = export_video(RenderSpec(), format="webm", output_dir=tmp_path)
        assert isinstance(result, Path)
        assert result.suffix == ".webm"

    def test_creates_nonempty_file(self, tmp_path: Path) -> None:
        with _patch_resolve(), _patch_success():
            result = export_video(RenderSpec(), format="webm", output_dir=tmp_path)
        assert result.exists()
        assert result.stat().st_size > 0

    def test_uses_libvpx_vp9(self, tmp_path: Path) -> None:
        with _patch_resolve(), _patch_success() as mock_run:
            export_video(RenderSpec(), format="webm", output_dir=tmp_path)
        cmd = mock_run.call_args[0][0]
        assert "libvpx-vp9" in cmd
        assert "-b:v" in cmd


# ---------------------------------------------------------------------------
# FR-8: Default format is MP4
# ---------------------------------------------------------------------------


@pytest.mark.skip(reason="FR-8 acceptance oracle — not yet implemented")
class TestFR8DefaultFormat:
    """FR-8: Omitting format defaults to MP4."""

    def test_default_format_is_mp4(self, tmp_path: Path) -> None:
        with _patch_resolve(), _patch_success():
            result = export_video(RenderSpec(), output_dir=tmp_path)
        assert result.suffix == ".mp4"


# ---------------------------------------------------------------------------
# FR-9: Case-insensitive format strings
# ---------------------------------------------------------------------------


@pytest.mark.skip(reason="FR-9 acceptance oracle — not yet implemented")
class TestFR9CaseInsensitiveFormats:
    """FR-9: Format strings are accepted case-insensitively."""

    def test_uppercase_mp4(self, tmp_path: Path) -> None:
        with _patch_resolve(), _patch_success():
            result = export_video(RenderSpec(), format="MP4", output_dir=tmp_path)
        assert result.suffix == ".mp4"

    def test_mixed_case_mp4(self, tmp_path: Path) -> None:
        with _patch_resolve(), _patch_success():
            result = export_video(RenderSpec(), format="Mp4", output_dir=tmp_path)
        assert result.suffix == ".mp4"

    def test_uppercase_webm(self, tmp_path: Path) -> None:
        with _patch_resolve(), _patch_success():
            result = export_video(RenderSpec(), format="WEBM", output_dir=tmp_path)
        assert result.suffix == ".webm"


# ---------------------------------------------------------------------------
# FR-10: Reject unknown formats
# ---------------------------------------------------------------------------


@pytest.mark.skip(reason="FR-10 acceptance oracle — not yet implemented")
class TestFR10RejectUnknownFormat:
    """FR-10: Unsupported formats raise RenderExportError."""

    def test_rejects_avi(self, tmp_path: Path) -> None:
        with _patch_resolve(), patch(
            "melosviz.render.video_exporter.subprocess.run"
        ) as mock_run:
            with pytest.raises(RenderExportError):
                export_video(RenderSpec(), format="avi", output_dir=tmp_path)
            mock_run.assert_not_called()

    def test_rejects_empty_format(self, tmp_path: Path) -> None:
        with _patch_resolve(), patch(
            "melosviz.render.video_exporter.subprocess.run"
        ) as mock_run:
            with pytest.raises(RenderExportError):
                export_video(RenderSpec(), format="", output_dir=tmp_path)
            mock_run.assert_not_called()


# ---------------------------------------------------------------------------
# FR-11: Create output directory
# ---------------------------------------------------------------------------


@pytest.mark.skip(reason="FR-11 acceptance oracle — not yet implemented")
class TestFR11CreateOutputDir:
    """FR-11: Non-existent output_dir is created."""

    def test_creates_nested_output_dir(self, tmp_path: Path) -> None:
        nested = tmp_path / "nested" / "out"
        assert not nested.exists()
        with _patch_resolve(), _patch_success():
            result = export_video(RenderSpec(), format="mp4", output_dir=nested)
        assert nested.exists()
        assert nested.is_dir()
        assert result.parent == nested


# ---------------------------------------------------------------------------
# FR-12: String output_dir accepted
# ---------------------------------------------------------------------------


@pytest.mark.skip(reason="FR-12 acceptance oracle — not yet implemented")
class TestFR12StringOutputDir:
    """FR-12: output_dir accepts a plain string."""

    def test_accepts_string_output_dir(self, tmp_path: Path) -> None:
        target = tmp_path / "from-str"
        with _patch_resolve(), _patch_success():
            result = export_video(
                RenderSpec(), format="mp4", output_dir=str(target)
            )
        assert result.parent == target


# ---------------------------------------------------------------------------
# FR-13: FFmpeg binary resolution failure
# ---------------------------------------------------------------------------


@pytest.mark.skip(reason="FR-13 acceptance oracle — not yet implemented")
class TestFR13BinaryResolutionFailure:
    """FR-13: _resolve_ffmpeg_binary failure propagates."""

    def test_propagates_ffmpeg_not_found(self, tmp_path: Path) -> None:
        sentinel_exc = FFMpegNotFoundError("ffmpeg is missing")
        with patch(
            "melosviz.render.video_exporter._resolve_ffmpeg_binary",
            side_effect=sentinel_exc,
        ), patch("melosviz.render.video_exporter.subprocess.run") as mock_run:
            with pytest.raises(FFMpegNotFoundError):
                export_video(RenderSpec(), format="mp4", output_dir=tmp_path)
            mock_run.assert_not_called()


# ---------------------------------------------------------------------------
# FR-14: Non-zero ffmpeg exit
# ---------------------------------------------------------------------------


@pytest.mark.skip(reason="FR-14 acceptance oracle — not yet implemented")
class TestFR14NonZeroExit:
    """FR-14: Non-zero ffmpeg exit raises RenderExportError with stderr."""

    def test_nonzero_exit_raises(self, tmp_path: Path) -> None:
        with _patch_resolve(), patch(
            "melosviz.render.video_exporter.subprocess.run",
            return_value=type("CP", (), {"returncode": 1, "stderr": "error msg", "stdout": ""})(),
        ):
            with pytest.raises(RenderExportError):
                export_video(RenderSpec(), format="mp4", output_dir=tmp_path)


# ---------------------------------------------------------------------------
# FR-15: Missing or empty output file
# ---------------------------------------------------------------------------


@pytest.mark.skip(reason="FR-15 acceptance oracle — not yet implemented")
class TestFR15MissingOrEmptyOutput:
    """FR-15: Missing/empty output after returncode=0 raises RenderExportError."""

    def test_missing_output_file_raises(self, tmp_path: Path) -> None:
        def _noop(cmd: list[str], **kwargs: Any) -> Any:
            return type("CP", (), {"returncode": 0, "stderr": "", "stdout": ""})()

        with _patch_resolve(), patch(
            "melosviz.render.video_exporter.subprocess.run", side_effect=_noop
        ):
            with pytest.raises(RenderExportError):
                export_video(RenderSpec(), format="mp4", output_dir=tmp_path)


# ---------------------------------------------------------------------------
# FR-16: is_ffmpeg_available()
# ---------------------------------------------------------------------------


@pytest.mark.skip(reason="FR-16 acceptance oracle — not yet implemented")
class TestFR16IsFfmpegAvailable:
    """FR-16: is_ffmpeg_available() returns a bool."""

    def test_returns_bool(self) -> None:
        result = is_ffmpeg_available()
        assert isinstance(result, bool)


# ---------------------------------------------------------------------------
# FR-17: PNG frame pipeline
# ---------------------------------------------------------------------------


@pytest.mark.skip(reason="FR-17 acceptance oracle — not yet implemented")
class TestFR17PngFramePipeline:
    """FR-17: Exporter uses PNG frame pipeline with image2 demuxer."""

    def test_uses_framerate_and_png_pattern(self, tmp_path: Path) -> None:
        with _patch_resolve(), _patch_success() as mock_run:
            export_video(RenderSpec(), format="mp4", output_dir=tmp_path)
        cmd = mock_run.call_args[0][0]
        assert "-framerate" in cmd
        assert "-i" in cmd
        input_idx = cmd.index("-i")
        input_pattern = cmd[input_idx + 1]
        assert input_pattern.endswith("frame_%05d.png")
        assert "lavfi" not in cmd

    def test_pattern_path_is_absolute(self, tmp_path: Path) -> None:
        with _patch_resolve(), _patch_success() as mock_run:
            export_video(RenderSpec(), format="mp4", output_dir=tmp_path)
        cmd = mock_run.call_args[0][0]
        input_idx = cmd.index("-i")
        pattern_dir = Path(cmd[input_idx + 1]).parent
        assert pattern_dir.is_absolute()


# ---------------------------------------------------------------------------
# FR-18: Public API exports
# ---------------------------------------------------------------------------


@pytest.mark.skip(reason="FR-18 acceptance oracle — not yet implemented")
class TestFR18PublicApiExports:
    """FR-18: Public API surface includes expected names."""

    def test_export_video_in_all(self) -> None:
        from melosviz.render import video_exporter

        assert "export_video" in video_exporter.__all__

    def test_error_classes_in_all(self) -> None:
        from melosviz.render import video_exporter

        for name in ("RenderExportError", "FFMpegNotFoundError"):
            assert name in video_exporter.__all__


# ---------------------------------------------------------------------------
# FR-19: INFO logging on success
# ---------------------------------------------------------------------------


@pytest.mark.skip(reason="FR-19 acceptance oracle — not yet implemented")
class TestFR19InfoLogging:
    """FR-19: Successful export emits an INFO log."""

    def test_logs_info_on_success(
        self, tmp_path: Path, caplog: pytest.LogCaptureFixture
    ) -> None:
        import logging

        with _patch_resolve(), _patch_success(), caplog.at_level(
            logging.INFO, logger="melosviz.render.video_exporter"
        ):
            export_video(RenderSpec(), format="mp4", output_dir=tmp_path)
        matching = [
            rec
            for rec in caplog.records
            if "export_video" in rec.getMessage()
        ]
        assert matching, f"expected 'export_video' log, got: {caplog.records}"
