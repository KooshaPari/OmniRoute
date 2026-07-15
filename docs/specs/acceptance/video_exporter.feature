Feature: Video Exporter
  As a developer rendering music visualisations
  I want to export RenderSpec objects to video files
  So that visual content can be played back or shared

  Background:
    Given the `melosviz.render.video_exporter` module is importable
    And subprocess.run is mocked to simulate ffmpeg

  # FR-6
  Scenario: Export to MP4 with libx264
    When I export a RenderSpec with format "mp4"
    Then the result path has suffix ".mp4"
    And the output file exists and is non-empty
    And the ffmpeg command contains "libx264" and "yuv420p"

  # FR-7
  Scenario: Export to WebM with libvpx-vp9
    When I export a RenderSpec with format "webm"
    Then the result path has suffix ".webm"
    And the output file exists and is non-empty
    And the ffmpeg command contains "libvpx-vp9"

  # FR-8
  Scenario: Default format is MP4
    When I export a RenderSpec without specifying a format
    Then the result path has suffix ".mp4"

  # FR-9
  Scenario: Case-insensitive format strings are accepted
    When I export a RenderSpec with format "MP4"
    And I export a RenderSpec with format "Mp4"
    And I export a RenderSpec with format "WEBM"
    Then all exports succeed with correct lowercase extensions

  # FR-10
  Scenario: Unknown format is rejected
    When I export a RenderSpec with format "avi"
    Then a RenderExportError is raised
    And subprocess.run is never called

  # FR-11
  Scenario: Output directory is created if missing
    When I export a RenderSpec to a non-existent nested directory
    Then the nested directory is created
    And the output file resides inside it

  # FR-12
  Scenario: output_dir accepts a plain string
    When I export a RenderSpec with output_dir passed as a str
    Then the export succeeds

  # FR-13
  Scenario: Missing ffmpeg binary propagates error
    Given _resolve_ffmpeg_binary raises FFMpegNotFoundError
    When I export a RenderSpec
    Then FFMpegNotFoundError propagates
    And subprocess.run is never called

  # FR-14
  Scenario: Non-zero ffmpeg exit raises RenderExportError
    Given mocked ffmpeg returns returncode=1 with stderr "fake stack trace"
    When I export a RenderSpec
    Then a RenderExportError is raised
    And the error message contains "fake stack trace"

  # FR-15
  Scenario: Missing output file raises RenderExportError
    Given mocked ffmpeg returns 0 but does not write a file
    When I export a RenderSpec
    Then a RenderExportError is raised

  Scenario: Empty output file raises RenderExportError
    Given mocked ffmpeg returns 0 but writes an empty file
    When I export a RenderSpec
    Then a RenderExportError is raised

  # FR-16
  Scenario: is_ffmpeg_available returns a boolean
    When I call `is_ffmpeg_available()`
    Then the result is a bool (does not raise)

  # FR-17
  Scenario: PNG frame pipeline is used
    When I export a RenderSpec
    Then the ffmpeg command includes "-framerate"
    And the "-i" argument ends with "frame_%05d.png"
    And the pattern path is absolute

  # FR-18
  Scenario: Public API exports are correct
    Then "export_video" is in video_exporter.__all__
    And "RenderExportError" is in video_exporter.__all__
    And "FFMpegNotFoundError" is in video_exporter.__all__

  # FR-19
  Scenario: INFO log is emitted on success
    When I export a RenderSpec successfully
    Then an INFO log record mentioning "export_video" is emitted

  # FR-20
  Scenario: SVG brand assets exist
    Then assets/brand/favicon.svg exists and is a valid SVG
    And assets/brand/icon.svg exists and is a valid SVG
