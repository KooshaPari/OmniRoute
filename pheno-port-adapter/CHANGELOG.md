# Changelog

All notable changes to `pheno-port-adapter` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- AGENTS.md, llms.txt, WORKLOG.md, CHANGELOG.md, LICENSE-MIT (T1.3 of v7 DAG, 2026-06-18)

## [0.1.0] - 2026-06-11

### Added
- Initial release of `pheno-port-adapter`.
- `PortAdapter` trait (`name`, `health`, `connect`, `disconnect`) — hexagonal L4 contract per ADR-014
- `AdapterError` enum (ConnectFailed, DisconnectFailed, HealthCheckFailed, Timeout)
- `Connection` opaque handle
- TCP transport adapter (`src/adapters/tcp.rs`)
- Unix-domain socket transport adapter (`src/adapters/unix.rs`)
- 5 unit tests covering trait contract (connect, disconnect, health, invalid endpoint, name)
