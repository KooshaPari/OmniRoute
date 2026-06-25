# =============================================================================
#  OmniRoute — OpenTelemetry Collector sidecar Makefile — PR-010
# =============================================================================
#  Convenience targets for local dev / CI. The full stack is the docker-compose
#  in this directory; the systemd unit lives in deploy/systemd/.
#
#  Usage:
#    make up           # start the collector + Jaeger + Prometheus + Grafana
#    make down         # stop the stack
#    make logs         # tail collector stdout
#    make tail-sampling-debug  # set OTEL_DEBUG=1 + reload
#    make lint         # validate collector.yaml against the OTel schema
#    make validate     # alias for lint
# =============================================================================

SHELL := /bin/bash
IMAGE ?= omniroute/otel-collector:0.110.0
COLLECTOR_YAML := collector.yaml
VALIDATOR := ../../scripts/validate-otel-collector.mjs

.PHONY: help up down logs tail-sampling-debug lint validate build rebuild clean

help: ## show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}'

up: ## start the observability stack via docker-compose
	docker compose -f ../docker-compose.observability.yml up -d

down: ## stop the observability stack
	docker compose -f ../docker-compose.observability.yml down

logs: ## tail collector stdout
	docker logs -f omniroute-otel-collector

tail-sampling-debug: ## enable OTEL_DEBUG=1 and reload
	@OTEL_DEBUG=1 docker compose -f ../docker-compose.observability.yml up -d --force-recreate otel-collector

lint validate: ## validate collector.yaml against the OTel schema + our rules
	node $(VALIDATOR) --config $(COLLECTOR_YAML)

build: ## build the local collector image (re-tag the contrib image)
	docker build -t $(IMAGE) -f Dockerfile .

rebuild: clean build ## clean + rebuild

clean: ## remove the local collector image
	docker rmi -f $(IMAGE) 2>/dev/null || true