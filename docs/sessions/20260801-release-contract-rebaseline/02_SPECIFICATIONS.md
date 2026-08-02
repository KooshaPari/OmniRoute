# Specifications

## Contract

`config/release/release-contract.json` is schema version 1 and declares:

- lowercase product id, display name, and package identity;
- one `package`, `openapi`, and `changelog` version source;
- i18n config and message paths;
- generated-doc policy and optional/required state behavior.

## Acceptance criteria

| ID    | Requirement                                                 | Gate                   |
| ----- | ----------------------------------------------------------- | ---------------------- |
| AC-01 | package identity and semver are valid                       | `--scope release`      |
| AC-02 | OpenAPI version equals declared package version             | `--scope release`      |
| AC-03 | changelog starts `Unreleased` and latest release matches    | `--scope release`      |
| AC-04 | every configured locale has valid JSON                      | `--scope mirrors`      |
| AC-05 | generated docs are not required                             | default/all fixture    |
| AC-06 | undeclared package versions do not fail                     | declared-only fixture  |
| AC-07 | parent-directory and symlink escapes fail                   | path-security fixtures |
| AC-08 | duplicate/unknown/invalid CLI values fail deterministically | CLI fixtures           |

## ARUs

- A state file may be absent under ADR-0005; `stateMode: required` is explicit.
- Scope names are intentionally limited to `release`, `mirrors`, and `all`.
