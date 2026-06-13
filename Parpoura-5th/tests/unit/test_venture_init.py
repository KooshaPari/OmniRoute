"""Tests for venture package initialization."""



class TestVersionChecks:
    """Test suite for Python version support."""

    def test_venture_version_defined(self):
        """Test that venture has __version__ defined."""
        import venture
        assert hasattr(venture, '__version__')
        assert venture.__version__ == "0.1.0"

    def test_venture_runs_on_current_python(self):
        """Test venture can run on current Python implementation."""
        # If we're here, import succeeded, so version check passed
        import venture
        assert venture.__version__


class TestVentureImports:
    """Test suite for venture module imports."""

    def test_import_venture(self):
        """Test importing venture package."""
        import venture
        assert venture is not None

    def test_venture_is_package(self):
        """Test venture is a valid package."""
        import venture
        assert hasattr(venture, '__file__')

    def test_version_string_format(self):
        """Test version string follows semantic versioning."""
        import venture
        version = venture.__version__
        parts = version.split('.')
        assert len(parts) >= 2
        for part in parts:
            assert part.isdigit()

    def test_venture_imports_do_not_fail(self):
        """Test that venture submodules can be imported."""
        from venture.eventbus import schema as eventbus_schema
        assert eventbus_schema is not None
        
        from venture.ledger import schema as ledger_schema
        assert ledger_schema is not None
        
        from venture.api import main as api_main
        assert api_main is not None
