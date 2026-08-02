# Implementation Strategy

- Commit the already-tested runtime diff as one WIP unit to preserve behavior and provenance.
- Do not refactor the 538-line CLI in this preservation pass; split only after a focused design/test lane exists.
- Keep `.trunk/*` generated artifacts untracked and excluded.
- Require a fresh origin rebase, focused tests, security review, and hosted checks before any production dispatch.
