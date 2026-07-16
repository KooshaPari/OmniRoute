# v4 release artifact dry run

This workflow produces an ephemeral release-candidate artifact without creating a GitHub Release, publishing npm packages, signing files, deploying services, or changing native targets.

It uses the existing v4 web and BFF build commands, then emits:

- deterministic web and BFF `.tar.gz` archives;
- `SHA256SUMS`, verified in the same job;
- a CycloneDX 1.6 component SBOM for the existing v4 application surfaces;
- `v4-preflight.json` recording version/tag agreement and explicit compatibility/publication boundaries.

On a tag, the tag must exactly equal `v<existing v4 version>`. On pull requests and manual runs, the same version-group check runs without inventing a tag.

The legacy root npm/CLI surface and native platform workflows remain untouched. This is a hardening slice for #330 and #322, not a release.
