# Makefile — Grafonnet/Jsonnet dashboard pipeline
#
# Targets:
#   make dashboards.build    — render every dashboards/<service>/*.jsonnet
#                              to dashboards/<service>/build/*.json
#   make dashboards.lint     — run jsonnet-lint + jsonnetfmt --check on every
#                              .jsonnet / .libsonnet file
#   make dashboards.diff     — compare checked-in JSON against re-rendered
#                              output; exit 1 on drift (CI gate)
#   make dashboards.clean    — remove all build/ directories
#   make dashboards.help     — print this header
#
# Install (one-time):
#   brew install go-jsonnet  # provides `jsonnet` + `jsonnetfmt`
#   go install github.com/google/go-jsonnet/cmd/jsonnet-lint@latest
#   jb init                  # only if you need to vendor grafonnet-lib locally
#
# Why a Makefile: the canonical Phenotype fleet build entry-point is
# `just` (Justfile), but `make` is the lingua franca for Grafana ecosystem
# tooling (jsonnet docs, grafonnet examples, Grafana Labs internal scripts).
# Pick one per repo; this scaffold uses `make` for portability.

JSONNET ?= jsonnet
JSONNETFMT ?= jsonnetfmt
JSONNETLINT ?= jsonnet-lint

DASHBOARDS_DIR := dashboards
JB_DIR := $(DASHBOARDS_DIR)/vendor
JSONNET_PATH := $(JB_DIR):$(DASHBOARDS_DIR)/lib

# Discover every *.jsonnet file under dashboards/<service>/ (excluding
# the library/ directory which contains .libsonnet factory files).
DASHBOARD_SOURCES := $(shell find $(DASHBOARDS_DIR) -type d -name build -prune -o -type f -name '*.jsonnet' -print | grep -v '/lib/' | sort)
DASHBOARD_TARGETS := $(patsubst %.jsonnet,%.json,$(addprefix $(DASHBOARDS_DIR)/,$(patsubst $(DASHBOARDS_DIR)/%,%,$(DASHBOARD_SOURCES))))

# Per-service build/ dirs hold rendered JSON. They are .gitignored so
# the only checked-in JSON is the golden copy (or, in this scaffold's
# case, the equivalent output of the .libsonnet sources).
BUILDS := $(shell find $(DASHBOARDS_DIR) -type d -name build 2>/dev/null)

.PHONY: all
all: dashboards.help

.PHONY: dashboards.help
dashboards.help:
	@echo "Grafonnet/Jsonnet dashboard pipeline"
	@echo ""
	@echo "Targets:"
	@echo "  make dashboards.build    render all .jsonnet -> .json"
	@echo "  make dashboards.lint     lint + format-check all sources"
	@echo "  make dashboards.diff     compare rendered output vs golden JSON"
	@echo "  make dashboards.clean    remove all build/ directories"
	@echo ""
	@echo "Sources:"
	@echo "  $(DASHBOARD_SOURCES)"
	@echo ""
	@echo "Render to:"
	@echo "  $(DASHBOARD_TARGETS)"

# Render: <service>/foo.jsonnet -> <service>/build/foo.json
# We put rendered JSON under <service>/build/ (not alongside the source)
# so the .libsonnet → .json pipeline is explicit and the golden JSON can
# be reviewed separately if desired.
.PHONY: dashboards.build
dashboards.build: $(BUILDS)

$(DASHBOARDS_DIR)/%/build:
	@mkdir -p $@

%.json: $(JSONNET_PATH) $(DASHBOARDS_DIR)/%/build
	@echo "  jsonnet $< -> $@"
	@cd $(DASHBOARDS_DIR)/$* && $(JSONNET) -J $(JB_DIR) -J $(DASHBOARDS_DIR)/lib $(notdir $<) > build/$(notdir $@)

# Lint: run jsonnet-lint on every .jsonnet + .libsonnet; jsonnetfmt --check
# on every .jsonnet. Exit 1 on any failure. CI runs this on every PR.
.PHONY: dashboards.lint
dashboards.lint:
	@echo "==> jsonnet-lint (lib/)"
	@find $(DASHBOARDS_DIR)/lib -type f \( -name '*.libsonnet' -o -name '*.jsonnet' \) \
		-exec $(JSONNETLINT) {} +
	@echo "==> jsonnet-lint (dashboards/<service>/)"
	@find $(DASHBOARDS_DIR) -type d -name build -prune -o -type f -name '*.jsonnet' -print \
		| grep -v '/lib/' \
		| xargs -I{} $(JSONNETLINT) {}
	@echo "==> jsonnetfmt --check (dashboards/<service>/)"
	@find $(DASHBOARDS_DIR) -type d -name build -prune -o -type f -name '*.jsonnet' -print \
		| grep -v '/lib/' \
		| xargs -I{} sh -c '$(JSONNETFMT) --check {} || (echo "  unformatted: {}" && exit 1)'

# Diff: re-render and compare against any checked-in golden JSON. If a
# golden JSON is checked in next to a .jsonnet, drift = exit 1. If only
# the .jsonnet is checked in (this scaffold's current state), diff is a
# no-op (it just re-renders).
.PHONY: dashboards.diff
dashboards.diff: dashboards.build
	@echo "==> jsonnet drift check (rendered vs golden JSON)"
	@status=0; \
	for src in $(DASHBOARD_SOURCES); do \
		svc=$$(echo $$src | sed -E 's|^$(DASHBOARDS_DIR)/([^/]+)/.*|\1|'); \
		base=$$(basename $$src .jsonnet); \
		rendered=$(DASHBOARDS_DIR)/$$svc/build/$$base.json; \
		golden=$(DASHBOARDS_DIR)/$$svc/$$base.json; \
		if [ -f $$golden ]; then \
			if ! diff -q $$rendered $$golden > /dev/null; then \
				echo "  DRIFT: $$rendered vs $$golden"; \
				diff $$rendered $$golden | head -40; \
				status=1; \
			else \
				echo "  ok:    $$base"; \
			fi; \
		else \
			echo "  no golden: $$base (rendered to $$rendered)"; \
		fi; \
	done; \
	exit $$status

.PHONY: dashboards.clean
dashboards.clean:
	@echo "==> removing build/ directories"
	@rm -rf $(BUILDS)
