# Changelog

## 0.1.0 (2026-06-20)
- Initial Tauri 2.x scaffold (orch-w15-direct recovery wave)
- Cargo.toml (lib + bin, crate-type = staticlib + cdylib + rlib)
- tauri.conf.json (windows, bundle, identifier=ai.phenotype.melosviz)
- build.rs invoking tauri_build
- capabilities/default.json with fs + dialog perms
- src/main.rs + src/lib.rs (run() with plugin init)
