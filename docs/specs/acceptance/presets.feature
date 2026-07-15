Feature: Preset Library
  As a developer integrating Melosviz visualisations
  I want to list, load, and apply presets
  So that I can style rendered content with pre-defined themes

  Background:
    Given the `melosviz.presets` package is importable

  # FR-1
  Scenario: List all available preset names
    When I call `list_presets()`
    Then the result is a sorted list of strings
    And it contains "ambient", "cinematic", "classical", "edm", "jazz", and "world"

  # FR-2
  Scenario: Load a known preset by name
    When I call `load_preset("cinematic")`
    Then the result is a module with an `apply` function

  Scenario: Load an unknown preset raises KeyError
    When I call `load_preset("unknown")`
    Then a KeyError is raised with a message listing available presets

  # FR-3
  Scenario: Apply a preset to a RenderSpec
    Given I have a default `RenderSpec()`
    When I call `cinematic.apply(spec)`
    Then the returned spec has `metadata["preset"] == "cinematic"`
    And the spec's palette contains exactly 6 colour strings
    And the spec's layers list is non-empty
    And the spec's keyframes list is non-empty
    And the spec's timeline has at least 3 section entries

  # FR-4
  Scenario: Legacy ThemePresetRegistry is re-exported
    When I import `ThemePresetRegistry` from `melosviz.presets`
    Then the import succeeds
    And `ThemePresetRegistry` is a callable class

  # FR-5
  Scenario: Public API surface matches `__all__`
    When I inspect `melosviz.presets.__all__`
    Then it contains "BUILTIN_PRESETS", "ThemePresetRegistry", "list_presets", and "load_preset"
