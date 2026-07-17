"""Pytest configuration for gateway tests."""

import sys
from pathlib import Path

# Add the gateway directory to sys.path so tests can import validate_governance
_gateway_dir = Path(__file__).resolve().parent.parent
if str(_gateway_dir) not in sys.path:
    sys.path.insert(0, str(_gateway_dir))
