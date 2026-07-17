# Phenotype-org standard justfile (docs variant)

# PhenoSpecs is a documentation/specification registry; primary build is
# handled by the existing Taskfile.yml. This justfile provides a thin,
# uniform interface that delegates to Task for the actual work.

default:
	@just --list

build:
	task build

test:
	task test

# Coverage report (SSOT for how to measure coverage).
coverage:
    echo 'No coverage tool configured'

lint:
	task lint

fmt:
	task fmt

audit:
	task audit

ci: lint test audit

docs:
	task docs
