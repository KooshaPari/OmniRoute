// SPDX-License-Identifier: MIT OR Apache-2.0

fn main() {
    uniffi_build::generate_scaffolding("src/focus_ffi.udl").unwrap();
}
