#!/bin/sh
# =============================================================================
#  OmniRoute — OpenTelemetry Collector entrypoint shim
# =============================================================================
#  Exports OTEL_AUTH_TOKEN (if set in the env) and forwards every CLI argument
#  to the upstream `otelcol-contrib` binary. Kept tiny on purpose — anything
#  more elaborate belongs in the collector.yaml, not here.
# =============================================================================
set -eu

if [ -n "${OTEL_AUTH_TOKEN:-}" ]; then
  export OTEL_AUTH_TOKEN
fi

exec /otelcol-contrib "$@"