---
title: v4 release readiness validator
---

# v4 release readiness validator

This validator reports whether the existing v4 release path has the minimum reproducibility controls required for a release candidate. It does not publish, sign, attest, upload, or merge anything.

Run:

```sh
node scripts/release/validate-v4-release-readiness.mjs
```

Use `--strict` only when the release workflow is expected to satisfy every control.

The v4 app manifests form one version group. The legacy root npm/CLI package is explicitly treated as an independent existing release surface so this work does not silently align versions or break npm compatibility. Native platform support is neither expanded nor reduced.

The generated report records:

- agreement among existing v4 web, BFF, desktop, Tauri, and Cargo versions;
- action SHA pinning;
- frozen installs;
- checksum, SBOM, and provenance controls;
- absence of secret-backed repository cloning;
- tag/version validation;
- a digest of independent release-surface manifests.

Related readiness epic: #322.
