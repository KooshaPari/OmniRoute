# Melosviz v0.1.0 (greenfield release)

## Summary

First production release of the Melosviz ecosystem (WP-102, sequence 100).

This release ships the foundational SDKs (Python, Rust, TypeScript), CI/CD
pipelines, documentation set, acceptance tests, and hardening gates.

## Highlights

- 5 frontend surfaces (web, desktop, CLI, mobile via Capacitor, Tauri)
- 3 SDKs (Python, Rust, TypeScript)
- 5 CI workflows (backend pytest, web build, desktop Tauri, SDK Python publish, SDK Rust publish)
- 7 docs deliverables (README, ARCHITECTURE, API reference, contribution guide, CHANGELOG)
- 3 acceptance tests (E2E MIDI->render, load test 100 concurrent jobs)
- 7 hardening gates (rate limit, input validation, graceful shutdown, secret mgmt, Sentry, structured logs, dep audit)
- 1 final release: this v0.1.0

## Migration

N/A (greenfield).

## Contributors

- @KooshaPari (orchestrator + direct execution)
- @phenotype-fleet (parallel agents)

## Acknowledgments

- 67 WPs from v11 wave 1-3
- 33 WPs from v11 wave 4-5
- 100 WPs total in melosviz-100task

