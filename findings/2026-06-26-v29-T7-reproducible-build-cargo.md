# v29-T7 — L30.1 Reproducible Build (cargo) Adoption (P1→3.0)

## What
Verify the nix devshell produces bit-identical builds for `pheno-port-adapter`.

## Action
- Run `tools/reproducible-build/audit.py --repo pheno-port-adapter` twice.
- Confirm sha256 of target/release/pheno_port_adapter is identical across 2 builds.
- Add CI step: `nix develop .#rust -c cargo build --release && sha256sum target/release/pheno_port_adapter > /tmp/sha256.txt`

Ref: `tools/reproducible-build/audit.py` (exists from v28 T2)
