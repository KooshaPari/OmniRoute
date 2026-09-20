//! Build script for the OmniRoute desktop shell.
//!
//! Besides the usual Tauri codegen this hands the optional-pack *contract* to
//! the runtime: `scripts/packs/optionalPackManifest.mjs` is the build-side
//! source of truth for which optional runtime packs exist, and the shell needs
//! the same names at run time to build the supervised server's `NODE_PATH`.
//! `src/paths.rs` must not import build tooling (mirroring the deliberate
//! decoupling documented in `open-sse/utils/optionalPacks.ts`), so the names are
//! parsed here and injected as `OMNIROUTE_OPTIONAL_PACK_NAMES`.

use std::{env, fs, path::PathBuf};

/// Compile-time env var read back by `src/paths.rs` via `option_env!`.
const PACK_NAMES_ENV: &str = "OMNIROUTE_OPTIONAL_PACK_NAMES";

#[path = "src/pack_manifest.rs"]
mod pack_manifest;

fn main() {
    println!("cargo:rerun-if-changed=build.rs");
    emit_optional_pack_names();
    tauri_build::build();
}

/// `apps/desktop/src-tauri` -> repository root -> the pack manifest.
fn manifest_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../../scripts/packs/optionalPackManifest.mjs")
}

fn emit_optional_pack_names() {
    let path = manifest_path();
    println!("cargo:rerun-if-changed={}", path.display());
    match fs::read_to_string(&path) {
        Ok(source) => {
            let names = pack_manifest::pack_names(&source);
            if names.is_empty() {
                println!(
                    "cargo:warning=no OPTIONAL_PACKS names found in {}; \
                     the crate will fall back to its embedded pack list",
                    path.display()
                );
            } else {
                println!("cargo:rustc-env={PACK_NAMES_ENV}={}", names.join(","));
            }
        }
        Err(error) => println!(
            "cargo:warning=could not read {} ({error}); \
             the crate will fall back to its embedded pack list",
            path.display()
        ),
    }
}
