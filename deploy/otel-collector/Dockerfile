# =============================================================================
#  OmniRoute — OpenTelemetry Collector (sidecar) image — PR-010
# =============================================================================
#  Multi-stage build: the contrib image is already self-contained, so stage 1
#  is a tiny "repack" that copies the collector.yaml + a non-root entrypoint
#  wrapper. The result is a ~3 MiB delta over the base image and runs as UID
#  10001 (matches the systemd unit).
#
#  Build:
#    docker build -t omniroute/otel-collector:0.110.0 \
#      -f deploy/otel-collector/Dockerfile deploy/otel-collector/
# =============================================================================

FROM otel/opentelemetry-collector-contrib:0.110.0 AS base

# --- Stage 1: layer the config + a non-root entrypoint ----------------------
FROM base AS runtime

# Re-declare the upstream USER (UID 10001) so the runtime stage stays rootless
# even when the base image updates its default user.
USER root

# Bring in the collector config + a tiny entrypoint shim that exports
# $OTEL_AUTH_TOKEN before exec'ing the upstream binary.
COPY --chown=10001:10001 collector.yaml /etc/otelcol-contrib/config.yaml
COPY --chown=10001:10001 entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod 0755 /usr/local/bin/entrypoint.sh

USER 10001:10001

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["--config=/etc/otelcol-contrib/config.yaml"]