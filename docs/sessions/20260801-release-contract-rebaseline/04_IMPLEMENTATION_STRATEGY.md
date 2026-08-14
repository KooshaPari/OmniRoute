# Implementation Strategy

## Boundaries

The checker uses the repository cwd as its trust root and reads only paths
declared by the manifest. Every declared path is checked lexically and, when it
exists, by realpath containment. No directory-wide package scan is performed.

## Gates

- `release`: package/OpenAPI/changelog identity and ordering.
- `mirrors`: configured locale catalog presence and JSON validity.
- `all`: both gates (default).

CLI parsing rejects unknown, duplicate, missing, uppercase product, and invalid
scope values before any source is read. The implementation stays below the
repository's 500-line hard limit and is designed for direct Node invocation.

## Integration

The parent agent must review the diff, run the focused test and direct checker,
then decide whether this isolated worktree is suitable for a later PR. This
lane does not push a normal feature branch or merge into `main`.
