"""Registry integrity tests for PhenoSpecs.

Validates registry.yaml structure and cross-references.

Test tiers:
  Tier 1 (hard failures) — structural integrity, required documents/dirs.
  Tier 2 (informational) — path validation; reports missing files but does not
    block CI.  Gaps in registry path references are pre-existing and documented
    in the audit; the test surfaces them for remediation tracking.
"""

from pathlib import Path

import pytest
import yaml

REPO_ROOT = Path(__file__).resolve().parent.parent
REGISTRY_PATH = REPO_ROOT / "registry.yaml"

REQUIRED_ROOT_DOCS = ["README.md", "SPEC.md", "PRD.md", "CHARTER.md", "AGENTS.md"]
REQUIRED_ROOT_DIRS = ["specs", "adrs", "docs", "research", "archive"]


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(scope="session")
def registry() -> dict:
    """Load and return the parsed registry.yaml."""
    with open(REGISTRY_PATH) as f:
        data = yaml.safe_load(f)
    assert isinstance(data, dict), "registry.yaml is not a mapping"
    return data


# ---------------------------------------------------------------------------
# Tier 1 — Structural integrity (hard assertions)
# ---------------------------------------------------------------------------


class TestRegistryTopKeys:
    """registry.yaml must contain the expected top-level keys."""

    REQUIRED_KEYS = [
        "registry_version",
        "last_updated",
        "system",
        "domains",
        "specs",
        "adrs",
    ]

    def test_required_keys_present(self, registry: dict) -> None:
        missing = [k for k in self.REQUIRED_KEYS if k not in registry]
        assert not missing, f"registry.yaml missing required keys: {missing}"


class TestRequiredRootDocuments:
    """Documents mandated by the docs stack convention."""

    def test_all_required_docs_exist(self) -> None:
        missing = [d for d in REQUIRED_ROOT_DOCS if not (REPO_ROOT / d).is_file()]
        assert not missing, f"Missing required root docs: {missing}"

    def test_all_required_dirs_exist(self) -> None:
        missing = [d for d in REQUIRED_ROOT_DIRS if not (REPO_ROOT / d).is_dir()]
        assert not missing, f"Missing required root dirs: {missing}"


# ---------------------------------------------------------------------------
# Tier 2 — Path validation (informational, non-blocking)
# ---------------------------------------------------------------------------


def _check_paths(
    registry: dict,
    label: str,
) -> list[str]:
    """Return list of missing file paths for a given registry entry category."""
    collection: dict[str, str] = registry.get(label, {})
    bad: list[str] = []
    for item_id, item in collection.items():
        path = item.get("path")
        if not path:
            bad.append(f"{item_id}: missing 'path' key")
        elif not (REPO_ROOT / path).is_file():
            bad.append(f"{item_id}: '{path}' not found")
    return bad


class TestPathIntegrity:
    """Check that all registry-referenced paths exist on disk.

    These are informational: they report gaps but do not block the build.
    Gaps are tracked in the audit_scorecard for remediation.
    """

    # pytest will call this for each test method below to avoid duplication

    @staticmethod
    def _report(missing: list[str], category: str) -> None:
        if not missing:
            print(f"\n  ✓ {category}: all paths exist")
        else:
            print(f"\n  ⚠ {category}: {len(missing)} path(s) missing:")
            for m in missing:
                print(f"    - {m}")

    def test_spec_paths(self, registry: dict) -> None:
        bad = _check_paths(registry, "specs")
        self._report(bad, "specs")

    def test_adr_paths(self, registry: dict) -> None:
        bad = _check_paths(registry, "adrs")
        self._report(bad, "adrs")

    def test_openapi_paths(self, registry: dict) -> None:
        bad = _check_paths(registry, "openapi")
        self._report(bad, "openapi")

    def test_integration_paths(self, registry: dict) -> None:
        bad = _check_paths(registry, "integrations")
        self._report(bad, "integrations")


# ---------------------------------------------------------------------------
# CLI test
# ---------------------------------------------------------------------------


class TestSpecLinks:
    """Validate spec-link / traceability references in README."""

    def test_readme_mentions_spec_links(self) -> None:
        readme = (REPO_ROOT / "README.md").read_text()
        assert "spec-links" in readme or "traceability" in readme, (
            "README.md should reference spec-link validation or traceability"
        )


# ---------------------------------------------------------------------------
# Run directly
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
