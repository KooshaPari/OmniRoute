# Makefile — convenience targets for the phenotype-router bench module.
#
# The canonical task runner is `just` (Justfile at the repo root). This
# Makefile is provided for environments where `just` isn't installed and as
# a fast local-only entry point. Each target wraps a single Go command.

GO       ?= go
PKG      ?= ./...
BENCHBIN ?= -benchtime=1000x -benchmem -run=^$

.PHONY: all
all: vet test build

.PHONY: build
build:
	$(GO) build $(PKG)

.PHONY: test
test:
	$(GO) test -count=1 -timeout 60s $(PKG)

.PHONY: vet
vet:
	$(GO) vet $(PKG)

.PHONY: bench-e2e
bench-e2e:
	$(GO) test -bench=BenchmarkRoutingE2E -benchtime=1000x -benchmem -run=^$ .

.PHONY: bench-p95
bench-p95:
	$(GO) run ./cmd/p95_latency -rps=1000 -duration=30s -workers=512 -warmup=5s

.PHONY: bench-throughput
bench-throughput:
	$(GO) run ./cmd/throughput -min=100 -max=10000 -steps=8 -per-step=10s -profile=fast

.PHONY: bench-all
bench-all: bench-e2e bench-p95 bench-throughput

.PHONY: clean
clean:
	$(GO) clean -testcache
	rm -rf bench-results/*.txt
