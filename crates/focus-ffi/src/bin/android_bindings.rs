// SPDX-License-Identifier: MIT OR Apache-2.0
// Generates UniFFI Kotlin bindings for Android.
//
// This binary orchestrates:
//   1. Validation of Android NDK installation (ANDROID_NDK_HOME env var)
//   2. Cross-compilation of focus-ffi for all Android ABIs
//   3. UniFFI Kotlin code generation
//   4. Packaging .so libraries into jniLibs structure
//
// Rationale for Rust over shell: Per Phenotype scripting policy, we prefer Rust for
// multi-step orchestration over bash. This binary is simpler than equivalent shell
// (no subprocess coordination complexity, strong error handling, cleaner control flow).

use anyhow::{anyhow, Result};
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

const ANDROID_ABIS: &[(&str, &str)] = &[
    ("aarch64-linux-android", "arm64-v8a"),       // Primary (most devices)
    ("armv7-linux-androideabi", "armeabi-v7a"),   // Older devices
    ("x86_64-linux-android", "x86_64"),           // Emulator
    ("i686-linux-android", "x86"),                // Legacy
];

fn main() -> Result<()> {
    eprintln!("🔨 FocalPoint Android Bindings Generator");
    eprintln!();

    // 1. Validate NDK
    let ndk_home = env::var("ANDROID_NDK_HOME").map_err(|_| {
        anyhow!(
            "ANDROID_NDK_HOME not set.\n\
             Install Android NDK:\n\
             1. Open Android Studio → SDK Manager → SDK Tools\n\
             2. Check 'NDK (Side by side)' → install latest\n\
             3. Set: export ANDROID_NDK_HOME=/Users/you/Library/Android/sdk/ndk/<version>"
        )
    })?;

    if !Path::new(&ndk_home).exists() {
        return Err(anyhow!(
            "ANDROID_NDK_HOME points to non-existent path: {}",
            ndk_home
        ));
    }

    eprintln!("✓ Android NDK found at: {}", ndk_home);
    eprintln!();

    // 2. Find workspace root
    let workspace_root = find_cargo_root()?;
    eprintln!("✓ Workspace root: {}", workspace_root.display());

    let ffi_crate = workspace_root.join("crates/focus-ffi");
    let android_app = workspace_root.join("apps/android/app");
    let udl_file = ffi_crate.join("src/focus_ffi.udl");

    if !udl_file.exists() {
        return Err(anyhow!(
            "UDL file not found: {}",
            udl_file.display()
        ));
    }

    eprintln!();
    eprintln!("🔨 Building focus-ffi for Android targets...");
    eprintln!();

    // 3. Build for all ABIs
    for (target, _abi) in ANDROID_ABIS {
        eprint!("  → {} ... ", target);

        let status = Command::new("cargo")
            .arg("build")
            .arg("--release")
            .arg("-p")
            .arg("focus-ffi")
            .arg("--target")
            .arg(target)
            .current_dir(&workspace_root)
            .status()?;

        if !status.success() {
            eprintln!("FAILED");
            return Err(anyhow!("cargo build failed for target: {}", target));
        }

        eprintln!("✓");
    }

    eprintln!();
    eprintln!("🔨 Generating Kotlin bindings...");
    eprintln!();

    // 4. Generate Kotlin bindings
    let kotlin_out = android_app.join("src/main/kotlin/com/focalpoint/ffi");
    fs::create_dir_all(&kotlin_out)?;

    let status = Command::new("cargo")
        .arg("run")
        .arg("--release")
        .arg("-p")
        .arg("focus-ffi")
        .arg("--bin")
        .arg("uniffi-bindgen")
        .arg("--")
        .arg("generate")
        .arg(&udl_file)
        .arg("--language")
        .arg("kotlin")
        .arg("--out-dir")
        .arg(&kotlin_out)
        .current_dir(&workspace_root)
        .status()?;

    if !status.success() {
        return Err(anyhow!(
            "uniffi-bindgen failed. Check that {} exists and is valid.",
            udl_file.display()
        ));
    }

    eprintln!("✓ Bindings generated at: {}", kotlin_out.display());
    eprintln!();
    eprintln!("🔨 Packing .so libraries into jniLibs...");
    eprintln!();

    // 5. Copy .so libraries to jniLibs
    for (target, abi) in ANDROID_ABIS {
        eprint!("  → {} ({}) ... ", target, abi);

        let so_src = workspace_root
            .join("target/release")
            .join(target)
            .join("libfocus_ffi.so");

        if !so_src.exists() {
            eprintln!("NOT FOUND");
            return Err(anyhow!(
                "libfocus_ffi.so not found at {}. Did cargo build succeed?",
                so_src.display()
            ));
        }

        let jni_libs = android_app.join("src/main/jniLibs").join(abi);
        fs::create_dir_all(&jni_libs)?;

        let so_dst = jni_libs.join("libfocus_ffi.so");
        fs::copy(&so_src, &so_dst)?;

        eprintln!("✓");
    }

    eprintln!();
    eprintln!("✅ Android bindings generated successfully!");
    eprintln!();
    eprintln!("Next steps:");
    eprintln!("  1. cd apps/android");
    eprintln!("  2. ./gradlew build");
    eprintln!("  3. Connect device/emulator or open Android Studio");
    eprintln!("  4. ./gradlew installDebug");
    eprintln!();

    Ok(())
}

fn find_cargo_root() -> Result<PathBuf> {
    let mut current = env::current_dir()?;
    loop {
        if current.join("Cargo.toml").exists() {
            return Ok(current);
        }
        if !current.pop() {
            return Err(anyhow!(
                "Could not find Cargo workspace root. Run from within the FocalPoint repo."
            ));
        }
    }
}
