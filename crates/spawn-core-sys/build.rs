//! build.rs — compile the Zig spawn-core static library and link it.
//!
//! # Why Zig for the hot core
//!
//! The semaphore (POSIX mutex+condvar), `posix_spawn`, `setpriority`, and
//! `waitpid` are all single libc calls.  Zig reaches them with zero-overhead
//! `std.c` wrappers and zero-ceremony `extern "c"` linkage, no bindgen, no
//! proc-macro, no async runtime.  The `SpawnParams` struct is `extern struct`
//! in Zig which guarantees C ABI layout; Rust declares it as `#[repr(C)]` —
//! the boundary is a plain C struct + a handful of `i32`-returning functions.
//!
//! # Build protocol
//!
//! 1. `zig build` in `crates/spawn-core/` — produces `zig-out/lib/libspawn_core.a`
//! 2. Cargo links `libspawn_core.a` via `cargo:rustc-link-lib=static=spawn_core`
//! 3. On macOS, also link `-framework CoreFoundation` (pulled in by libc) +
//!    `libSystem` (the default macOS C runtime).
//!
//! The `links = "spawn_core"` key in Cargo.toml ensures at most one copy of the
//! lib is linked in a dependency graph and that build metadata is propagated
//! to downstream crates.

use std::path::PathBuf;
use std::process::Command;

fn main() -> anyhow::Result<()> {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let spawn_core_dir = manifest_dir.join("..").join("spawn-core");
    let spawn_core_dir = spawn_core_dir.canonicalize()?;
    let lib_out = spawn_core_dir.join("zig-out").join("lib");

    // --- Run `zig build` to compile the static library ---
    let status = Command::new("zig")
        .args(["build", "-Doptimize=ReleaseSafe"])
        .current_dir(&spawn_core_dir)
        .status()
        .map_err(|e| {
            anyhow::anyhow!("failed to run `zig build`: {e}\nIs zig installed and on PATH?")
        })?;

    if !status.success() {
        anyhow::bail!("`zig build` exited with status {status}");
    }

    // --- Tell Cargo where to find libspawn_core.a ---
    println!("cargo:rustc-link-search=native={}", lib_out.display());
    println!("cargo:rustc-link-lib=static=spawn_core");

    // macOS: link libc (libSystem contains all the POSIX symbols we need).
    #[cfg(target_os = "macos")]
    println!("cargo:rustc-link-lib=dylib=System");

    // Linux: link libc + libpthread.
    #[cfg(target_os = "linux")]
    {
        println!("cargo:rustc-link-lib=dylib=c");
        println!("cargo:rustc-link-lib=dylib=pthread");
    }

    // Re-run if any Zig source changes.
    println!("cargo:rerun-if-changed={}/src/spawn_core.zig", spawn_core_dir.display());
    println!("cargo:rerun-if-changed={}/build.zig", spawn_core_dir.display());

    Ok(())
}
