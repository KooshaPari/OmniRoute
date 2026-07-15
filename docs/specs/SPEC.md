# Melosviz — Functional Requirements Specification

> **Oracle version:** 1.0  
> **Source derivation:** `origin/main` at `6c20fea`  
> **Status:** Spec-first oracle — acceptance skeletons exist at `docs/specs/acceptance/`  

---

## Functional Requirements

### FR-1: Preset Library – List Available Presets

**Description:** The `melosviz.presets` package exposes a `list_presets()` function that returns the sorted list of all built-in preset names.

**Acceptance criterion:** `list_presets()` returns a `List[str]` containing at least the names `"ambient"`, `"cinematic"`, `"classical"`, `"edm"`, `"jazz"`, and `"world"`, sorted alphabetically.

**Traceability:**
- Source: `backend/src/melosviz/presets/__init__.py:45-47` — `list_presets()` implementation
- Source: `backend/src/melosviz/presets/__init__.py:35-42` — `BUILTIN_PRESETS` constant

---

### FR-2: Preset Library – Load a Named Preset Module

**Description:** The `melosviz.presets` package exposes a `load_preset(name: str)` function that imports and returns the preset module registered under `name`.

**Acceptance criterion:** Calling `load_preset("cinematic")` returns the `melosviz.presets.cinematic` module. Calling `load_preset("unknown")` raises `KeyError` with a message listing available presets.

**Traceability:**
- Source: `backend/src/melosviz/presets/__init__.py:50-63` — `load_preset()` implementation
- Source: `backend/src/melosviz/presets/__init__.py:59` — `KeyError` raised for unknown names

---

### FR-3: Preset Library – Apply Preset to RenderSpec

**Description:** Each preset module exports an `apply(spec: RenderSpec) -> RenderSpec` function that mutates the spec in place with the preset's visual style (palette, layers, keyframes, timeline, metadata) and returns it.

**Acceptance criterion:** Calling `cinematic.apply(RenderSpec())` returns a `RenderSpec` whose `.metadata["preset"]` equals `"cinematic"`, `.palette` contains exactly 6 color strings (the `CINEMATIC_PALETTE`), `.layers` is a non-empty list of layer dicts, `.keyframes` is a non-empty list of keyframe dicts, and `.timeline` is extended with at least 3 section entries.

**Traceability:**
- Source: `backend/src/melosviz/presets/cinematic.py:68-91` — `apply()` function
- Source: `backend/src/melosviz/presets/cinematic.py:17-24` — `CINEMATIC_PALETTE` constant
- Source: `backend/src/melosviz/presets/cinematic.py:27-56` — `_layers()` helper
- Source: `backend/src/melosviz/presets/cinematic.py:59-65` — `_keyframes()` helper
- Import: `backend/src/melosviz/presets/cinematic.py:14` — `from ..analysis.models import RenderSpec`

---

### FR-4: Preset Library – Legacy ThemePresetRegistry Re-export

**Description:** The `melosviz.presets` package re-exports `ThemePresetRegistry` from its sub-module `.registry` so that existing callers (e.g., `melosviz.main`) continue to work without changing their import paths.

**Acceptance criterion:** `from melosviz.presets import ThemePresetRegistry` succeeds and `ThemePresetRegistry` is a callable class.

**Traceability:**
- Source: `backend/src/melosviz/presets/__init__.py:32` — re-export `from .registry import ThemePresetRegistry`

---

### FR-5: Preset Library – Public API Surface in `__all__`

**Description:** The `melosviz.presets` package defines `__all__` that exports `BUILTIN_PRESETS`, `ThemePresetRegistry`, `list_presets`, and `load_preset`.

**Acceptance criterion:** `melosviz.presets.__all__` is a list containing exactly `"BUILTIN_PRESETS"`, `"ThemePresetRegistry"`, `"list_presets"`, and `"load_preset"`.

**Traceability:**
- Source: `backend/src/melosviz/presets/__init__.py:66-71` — `__all__` list

---

### FR-6: Video Exporter – Export RenderSpec to MP4

**Description:** `melosviz.render.video_exporter.export_video(spec: RenderSpec, format: str = "mp4", output_dir: PathLike) -> Path` renders a `RenderSpec` into an MP4 video file using FFmpeg with the libx264 codec and yuv420p pixel format.

**Acceptance criterion:** Calling `export_video(RenderSpec(), format="mp4", output_dir=tmpdir)` returns a `Path` with `.suffix == ".mp4"`, the file exists on disk, is non-empty, and the ffmpeg command contains `"libx264"` and `"yuv420p"`.

**Traceability:**
- Test: `backend/tests/test_video_exporter.py:114-157` — MP4 tests exercising the contract

---

### FR-7: Video Exporter – Export RenderSpec to WebM

**Description:** The same `export_video` function supports WebM output using the libvpx-vp9 codec.

**Acceptance criterion:** Calling `export_video(RenderSpec(), format="webm", output_dir=tmpdir)` returns a `Path` with `.suffix == ".webm"`, the file exists, is non-empty, and the ffmpeg command contains `"libvpx-vp9"`.

**Traceability:**
- Test: `backend/tests/test_video_exporter.py:199-224` — WebM tests

---

### FR-8: Video Exporter – Default Format Is MP4

**Description:** When `format` is omitted, `export_video` defaults to MP4.

**Acceptance criterion:** Calling `export_video(RenderSpec(), output_dir=tmpdir)` returns a file with `.suffix == ".mp4"`.

**Traceability:**
- Test: `backend/tests/test_video_exporter.py:231-235` — default format test

---

### FR-9: Video Exporter – Case-Insensitive Format Strings

**Description:** Format strings are accepted case-insensitively (e.g., `"MP4"`, `"Mp4"`, `"webm"`, `"WEBM"`).

**Acceptance criterion:** `export_video(RenderSpec(), format="MP4")` and `export_video(RenderSpec(), format="Mp4")` and `export_video(RenderSpec(), format="WEBM")` all succeed and produce files with correct lowercase extensions.

**Traceability:**
- Test: `backend/tests/test_video_exporter.py:238-261` — uppercase and mixed-case tests

---

### FR-10: Video Exporter – Reject Unknown Formats

**Description:** Unsupported format strings raise `RenderExportError` and do not invoke ffmpeg.

**Acceptance criterion:** Calling `export_video(RenderSpec(), format="avi")` raises `RenderExportError` and `subprocess.run` is never called.

**Traceability:**
- Test: `backend/tests/test_video_exporter.py:254-261` — unknown format rejection

---

### FR-11: Video Exporter – Create Output Directory

**Description:** If `output_dir` does not exist, `export_video` creates it (including parent directories).

**Acceptance criterion:** Calling `export_video(RenderSpec(), output_dir=tmpdir/"nested"/"out")` succeeds and the nested directory is created and contains the output file.

**Traceability:**
- Test: `backend/tests/test_video_exporter.py:279-306` — output directory handling tests

---

### FR-12: Video Exporter – String output_dir Accepted

**Description:** The `output_dir` parameter accepts both `Path` objects and plain strings.

**Acceptance criterion:** `export_video(RenderSpec(), output_dir=str(tmpdir/"from-str"))` succeeds.

**Traceability:**
- Test: `backend/tests/test_video_exporter.py:290-297` — string output_dir test

---

### FR-13: Video Exporter – FFmpeg Binary Resolution

**Description:** `export_video` resolves the ffmpeg binary path through `_resolve_ffmpeg_binary`, supporting the `MELOSVIZ_FFMPEG_BIN` environment variable and `$PATH` lookup.

**Acceptance criterion:** When `_resolve_ffmpeg_binary` raises `FFMpegNotFoundError`, the error propagates and `subprocess.run` is never called.

**Traceability:**
- Test: `backend/tests/test_video_exporter.py:431-441` — binary resolution failure propagation

---

### FR-14: Video Exporter – FFmpeg Non-Zero Exit Code

**Description:** When ffmpeg exits with a non-zero return code, `export_video` raises `RenderExportError` including the stderr tail.

**Acceptance criterion:** A mock ffmpeg with `returncode=1` causes `RenderExportError`; the error message contains the stderr text.

**Traceability:**
- Test: `backend/tests/test_video_exporter.py:367-389` — non-zero exit and stderr message tests

---

### FR-15: Video Exporter – Missing or Empty Output File

**Description:** When ffmpeg returns 0 but produces no file, or an empty file, `export_video` raises `RenderExportError`.

**Acceptance criterion:** A mock that returns `returncode=0` without writing a file raises `RenderExportError`. A mock that writes an empty file (0 bytes) also raises `RenderExportError`.

**Traceability:**
- Test: `backend/tests/test_video_exporter.py:392-415` — missing and empty output file tests

---

### FR-16: Video Exporter – `is_ffmpeg_available()` Query

**Description:** `melosviz.render.video_exporter.is_ffmpeg_available()` returns a boolean indicating whether a working ffmpeg binary is reachable.

**Acceptance criterion:** `is_ffmpeg_available()` returns `True` or `False` (always a `bool`, never raises).

**Traceability:**
- Test: `backend/tests/test_video_exporter.py:476-479` — boolean return type test

---

### FR-17: Video Exporter – PNG Frame Pipeline

**Description:** The exporter generates one PNG image per frame into a temporary directory, then muxes them into the final video via ffmpeg's image2 demuxer.

**Acceptance criterion:** The ffmpeg command includes `-framerate`, an `-i` argument ending in `frame_%05d.png`, and the pattern points to an absolute path.

**Traceability:**
- Test: `backend/tests/test_video_exporter.py:142-180` — PNG input pattern and tempdir tests

---

### FR-18: Video Exporter – Public API Exports

**Description:** The `video_exporter` module exposes `export_video`, `RenderExportError`, and `FFMpegNotFoundError` in its `__all__`.

**Acceptance criterion:** `"export_video" in video_exporter.__all__`, `"RenderExportError" in video_exporter.__all__`, and `"FFMpegNotFoundError" in video_exporter.__all__` are all true.

**Traceability:**
- Test: `backend/tests/test_video_exporter.py:464-473` — module exports test

---

### FR-19: Video Exporter – INFO Logging on Success

**Description:** A successful export emits at least one INFO-level log record mentioning "export_video" in the `melosviz.render.video_exporter` logger.

**Acceptance criterion:** After a successful export, `caplog.records` contains at least one record at level `INFO` whose message contains `"export_video"`.

**Traceability:**
- Test: `backend/tests/test_video_exporter.py:449-461` — logging test

---

### FR-20: Brand Assets – SVG Icon Assets

**Description:** The repository ships two SVG brand assets: a favicon and a full icon.

**Acceptance criterion:** Files `assets/brand/favicon.svg` and `assets/brand/icon.svg` exist, are valid SVG documents, and contain `<svg` root elements.

**Traceability:**
- Files: `assets/brand/favicon.svg`, `assets/brand/icon.svg`

---

### FR-21: CI/CD – Gitleaks Secret Scan

**Description:** A GitHub Actions workflow runs gitleaks to detect secrets on every push and pull request.

**Acceptance criterion:** The workflow file `.github/workflows/gitleaks.yml` exists and contains a job that runs `gitleaks detect`.

**Traceability:**
- File: `.github/workflows/gitleaks.yml`

---

### FR-22: CI/CD – OpenSSF Scorecard

**Description:** A GitHub Actions workflow runs the OpenSSF Scorecard to evaluate the repository's security posture.

**Acceptance criterion:** The workflow file `.github/workflows/scorecard.yml` exists and contains a job using `openssf/scorecard-action`.

**Traceability:**
- File: `.github/workflows/scorecard.yml`

---

## Non-Functional Requirements

### NFR-1: No External Python Dependencies for Presets Package

**Description:** The `melosviz.presets` package must use only the Python standard library — it must not import from external packages.

**Acceptance criterion:** A static import analysis of `backend/src/melosviz/presets/` shows zero imports from packages outside the standard library (stdlib modules: `importlib`, `os`, `sys`, `types`, `typing` are all stdlib).

**Traceability:**
- Source: `backend/src/melosviz/presets/__init__.py:14-18` — all imports are stdlib
- Source: `backend/src/melosviz/presets/cinematic.py:12` — all imports are stdlib (aside from `..analysis.models` which is intra-package)

### NFR-2: Mocked Subprocess in Test Suite

**Description:** All video exporter tests must mock `subprocess.run` to avoid requiring a real ffmpeg binary on the test host.

**Acceptance criterion:** Every test in `test_video_exporter.py` that calls `export_video` patches either `melosviz.render.video_exporter.subprocess.run` or `_resolve_ffmpeg_binary`.

**Traceability:**
- Test: `backend/tests/test_video_exporter.py:85-107` — patch helpers `_patch_success()`, `_patch_resolve()`, `_patch_resolve_raises()`
- All test functions use these patch context managers.

### NFR-3: FFmpeg Command Timeout of 120 Seconds

**Description:** The `export_video` function must call `subprocess.run` with `timeout=120` to accommodate slower hardware during PNG-frame rendering.

**Acceptance criterion:** The `kwargs` passed to `subprocess.run` contain `timeout=120`.

**Traceability:**
- Test: `backend/tests/test_video_exporter.py:342-351` — timeout capture test

### NFR-4: Subprocess Invoked Exactly Once Per Export

**Description:** Each call to `export_video` must invoke `subprocess.run` exactly once (not multiple times).

**Acceptance criterion:** After one call to `export_video`, `mock_run.call_count == 1`.

**Traceability:**
- Test: `backend/tests/test_video_exporter.py:354-359` — single invocation test

### NFR-5: RenderSpec Accepts Empty and Populated States

**Description:** `export_video` must accept both a default (empty) `RenderSpec()` and a populated `RenderSpec` with metadata, palette, and layers. Both must produce a valid output file.

**Acceptance criterion:** `export_video(RenderSpec(), ...)` and `export_video(RenderSpec(metadata=..., palette=..., layers=...), ...)` both succeed and produce non-empty output files.

**Traceability:**
- Test: `backend/tests/test_video_exporter.py:487-514` — empty and populated RenderSpec tests

### NFR-6: Sys.path Manipulation for Cross-Package Imports

**Description:** The presets `__init__.py` must ensure `backend/src` is on `sys.path` so that absolute `from melosviz.X` imports resolve even when the package is loaded via the `backend.src.melosviz.presets` path.

**Acceptance criterion:** When `backend/src` is not already on `sys.path`, loading `melosviz.presets` inserts it at position 0, enabling `from melosviz.analysis.models import RenderSpec` to succeed.

**Traceability:**
- Source: `backend/src/melosviz/presets/__init__.py:25-28` — `sys.path.insert(0, _SRC_ROOT)`
