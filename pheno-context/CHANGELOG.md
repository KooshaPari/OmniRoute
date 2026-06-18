# Changelog

All notable changes to `pheno-context` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- AGENTS.md, llms.txt, WORKLOG.md, LICENSE-MIT (T1.3 of v7 DAG, 2026-06-18)

## [0.1.0] - 2026-06-11

### Added
- Initial release of `pheno-context`.
- `Context` struct: request_id, span_id, trace_id, user_id, org_id, metadata
- `ContextBuilder` for programmatic construction with required-field validation
- `Context::from_headers(HeaderMap)` extractor for X-Request-ID, X-Trace-ID, X-Span-ID, X-User-ID, X-Org-ID
- `ContextError::MissingHeader(String)` typed error
- 5 unit tests (builder, headers, missing-required, clone, display)
