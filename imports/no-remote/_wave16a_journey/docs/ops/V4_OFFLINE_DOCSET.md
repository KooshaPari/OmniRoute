# v4 offline docset contract

The GitHub wiki is not treated as a source: its public URL does not currently expose a wiki, and enabling the existing legacy sync would import unreviewed/stale material.

This contract produces a deterministic, versioned static archive without deploying or publishing it. Current `main` has no approved public input, so the contract deliberately declares:

- `reviewedInputs: []`
- `deployable: false`
- `releaseAttachable: false`

The archive contains an accessible explanatory index, empty search index, and provenance record. Sidecars define the future release attachment filename/media type and SHA-256 checksum while retaining the non-attachable flag.

PR #329 proposes the separate docs-app scaffold. PR #334 proposes reviewed Quickstart content. After those inputs merge and their provenance gates pass, a later PR may add exact reviewed paths and change release attachment readiness. This PR does not make that decision.

Related: #322, #329, #330.
