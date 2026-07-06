# NOTICE

This product includes software developed by third parties.

## Upstream

```
OmniRoute — Unified AI Provider Router
Copyright (c) Diego Souza and contributors

This product is a fork of OmniRoute (https://github.com/diegosouzapw/OmniRoute),
distributed under the MIT License. The full MIT license text is reproduced
in the LICENSE file at the root of this repository.

The fork (ArgisMonitor) is maintained by KooshaPari / Phenotype.
Copyright (c) 2026 KooshaPari / Phenotype.
```

## Redirect chain

ArgisMonitor is the renamed continuation of this fork. The chain is:

```
diegosouzapw/OmniRoute  (upstream, MIT)
        ↓  fork (2025)
KooshaPari/OmniRoute    (preserved identifiers, additive rename policy)
        ↓  in-place rename (2026)
KooshaPari/ArgisMonitor (this repo, all publish surface flipped)
```

Internal source identifiers (`omniroute`, `OmniRoute`, `@omniroute/*`,
`OMNIROUTE_*`, `~/.omniroute`) are preserved as legacy aliases to keep
upstream rebases tractable. The new canonical surface is `argismonitor`,
`ArgisMonitor`, `@argismonitor/*`, `ARGIS_*`, `~/.argismonitor`. See
[`docs/FORK.md`](./FORK.md) § 3 for the additive-rename policy and
[`docs/RENAMES-STRATEGY.md`](./RENAMES-STRATEGY.md) for the migration
guide.

## Trademarks

- **ArgisMonitor** is a trademark of KooshaPari / Phenotype.
- **Phenotype.** is a trademark of KooshaPari / Phenotype. The period is
  used for stylistic consistency; the legal entity name omits it.
- **OmniRoute** is a trademark of its respective owner; this fork uses
  the mark only to identify upstream provenance.
- **KooshaPari** is the personal moniker of the maintainer.

## Third-party dependencies

All third-party dependencies are listed in `package.json` and audited
via `npm audit` and the SBOMs generated at build time
(`sbom-npm.cdx.json`, `sbom-cargo.cdx.json`). Each dependency retains
its own license — see `THIRD-PARTY-NOTICES.md` (generated) for the full
attribution text.

## AI-DD / HITL-less disclosure

ArgisMonitor is developed with AI-Driven Development (AI-DD) and runs
without a Human-in-the-Loop (HITL) review gate on a routine basis. See
[`docs/FORK.md`](./FORK.md) § 2 for the full disclosure.

## License compatibility

This fork is distributed under the MIT License, compatible with upstream
and with the dependency set as recorded in
[`docs/security/`](./security).