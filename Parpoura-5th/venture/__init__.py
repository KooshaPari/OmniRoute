"""Venture - Autonomous AI economic civilization platform."""

import os
import sys

# Python version requirements: CPython 3.14+ or PyPy 3.11+
# In testing/CI environments, allow 3.12+ for backwards compatibility
if os.environ.get('VENTURE_CI_MODE'):
    min_cpython = (3, 12)
else:
    min_cpython = (3, 14)

if sys.implementation.name == "cpython" and sys.version_info < min_cpython:
    raise RuntimeError(f"Venture requires CPython {min_cpython[0]}.{min_cpython[1]}+. For PyPy, use PyPy 3.11+")

if sys.implementation.name == "pypy" and sys.version_info < (3, 11):
    raise RuntimeError("Venture requires PyPy 3.11+. For CPython, use 3.14+")

__version__ = "0.1.0"
