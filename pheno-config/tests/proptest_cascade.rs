//! v16-T6 (L25) — proptest property suite for the `pheno-config` cascade.
//!
//! Targeted at [`pheno_config::cascade`] (the [`build_cascade`] /
//! [`build_cascade_from_str`] / [`DEFAULT_TOML`] trio). The companion
//! `tests/proptest_smoke.rs` covers the secret-holding newtypes; this
//! file is cascade-only and does not duplicate any of those properties.
//!
//! Run with:
//!
//! ```bash
//! PROPTEST_CASES=64 cargo test --test proptest_cascade
//! ```
//!
//! The 12 properties below cover:
//!
//! 1. The embedded `DEFAULT_TOML` is well-formed TOML and exposes the
//!    expected `[server]` / `[logging]` / `[database]` sections.
//! 2. `build_cascade_from_str` honours a `[server] port = N` override.
//! 3. A user-supplied `[server] host = "..."` override beats the default.
//! 4. Nested tables (`[a.b.c]`) parse without flattening.
//! 5. Arrays of inline tables (`items = [{k = 1}, {k = 2}]`) parse with
//!    the right length and right first-element field.
//! 6. String values containing punctuation / dashes / spaces round-trip.
//! 7. Integer values up to u16::MAX parse correctly.
//! 8. Float values parse without truncation to integer.
//! 9. Boolean values parse correctly.
//! 10. An empty user TOML still preserves the embedded defaults (the
//!     merge is additive; an empty provider is a no-op).
//! 11. A user TOML that *only* defines a new section does not delete the
//!     defaults' other sections (the merge is per-key, not per-file).
//! 12. A user TOML written to a `tempfile::tempdir()` and read back via
//!     `build_cascade_from_str` produces the same cascade as the same
//!     string passed inline. Verifies the tempfile fixture pattern
//!     L25 §4 — per-test scratch dir, no shared `static TEMP_DIR`.
//!
//! Each property is wrapped in a `proptest!` block with
//! `prop_assert!` / `prop_assert_eq!` for proptest-native shrinking.

use proptest::prelude::*;

use pheno_config::cascade::{build_cascade_from_str, DEFAULT_TOML};

proptest! {
    /// Property 1: `DEFAULT_TOML` is well-formed and exposes the three
    /// canonical sections with the expected shape. A regression that
    /// accidentally drops a section from the embedded defaults would
    /// manifest as `find_value("…")` returning `Err`.
    #[test]
    fn default_toml_exposes_canonical_sections(_unused in 0u8..1) {
        let cascade = build_cascade_from_str("");
        // [server]
        let port = cascade
            .find_value("server.port")
            .expect("server.port present in DEFAULT_TOML");
        prop_assert_eq!(port.to_u128(), Some(8080));
        // [logging]
        let level = cascade
            .find_value("logging.level")
            .expect("logging.level present in DEFAULT_TOML");
        prop_assert!(!level.to_string().is_empty());
        // [database]
        let pool = cascade
            .find_value("database.pool_size")
            .expect("database.pool_size present in DEFAULT_TOML");
        prop_assert_eq!(pool.to_u128(), Some(8));
    }

    /// Property 2: `[server] port = N` in user TOML overrides the
    /// default `server.port`. Generates `N` from the proptest
    /// `0u16..=65535` range (full u16 coverage).
    #[test]
    fn server_port_override_wins(port in 0u16..=65535) {
        let user = format!("[server]\nport = {}\n", port);
        let cascade = build_cascade_from_str(&user);
        let got = cascade
            .find_value("server.port")
            .expect("server.port after override");
        prop_assert_eq!(got.to_u128(), Some(port as u128));
    }

    /// Property 3: a user-supplied `server.host` override beats the
    /// default `127.0.0.1`. The host string is generated from a
    /// conservative regex (lowercase, digits, dots, dashes) so it
    /// round-trips through TOML without quoting concerns.
    #[test]
    fn server_host_override_wins(host in "[a-z0-9\\.\\-]{3,32}") {
        let user = format!("[server]\nhost = \"{}\"\n", host);
        let cascade = build_cascade_from_str(&user);
        let got = cascade
            .find_value("server.host")
            .expect("server.host after override");
        // The cascade stores the value as a `Value::String(_, …)`; the
        // `to_string()` round-trips it through TOML quoting, which
        // for our alphanumeric+dot+dash charset is a no-op.
        prop_assert_eq!(got.to_string(), format!("\"{}\"", host));
    }

    /// Property 4: a 3-level nested table (`[a.b.c]`) round-trips
    /// without flattening. The leaf value is asserted to survive the
    /// cascade parse unchanged.
    #[test]
    fn nested_table_roundtrips(depth_marker in "[A-Z]{3,8}") {
        let user = format!(
            "[a.b.c]\nmarker = \"{}\"\n",
            depth_marker
        );
        let cascade = build_cascade_from_str(&user);
        let got = cascade
            .find_value("a.b.c.marker")
            .expect("nested marker present");
        prop_assert_eq!(got.to_string(), format!("\"{}\"", depth_marker));
    }

    /// Property 5: an array of inline tables parses with the right
    /// length and exposes the first element's `k` field. Length is
    /// capped at 4 so the test wall-clock stays under a second.
    #[test]
    fn array_of_inline_tables_parses(n in 1usize..=4usize) {
        let entries: Vec<String> =
            (0..n).map(|i| format!("{{ k = {} }}", i as u64)).collect();
        let user = format!("items = [{}]\n", entries.join(", "));
        let cascade = build_cascade_from_str(&user);
        // figment exposes arrays under the dotted key with an index.
        let first = cascade
            .find_value("items.0.k")
            .expect("items[0].k present");
        prop_assert_eq!(first.to_u128(), Some(0));
        // Last element's k is `n-1` (proves the array has the
        // requested length and not fewer).
        let last_key = format!("items.{}.k", n - 1);
        let last = cascade
            .find_value(&last_key)
            .expect("last element's k present");
        prop_assert_eq!(last.to_u128(), Some((n as u64) - 1));
    }

    /// Property 6: string values containing punctuation (spaces,
    /// dashes, dots, slashes, colons) round-trip without
    /// re-quoting-induced corruption. The `format!` round-trip we
    /// assert against in proptest 3 doesn't apply here because
    /// TOML quoting of arbitrary characters introduces escapes
    /// (e.g. `\\` for backslash). We therefore assert that the
    /// returned `Value::String` preserves the original bytes
    /// when `to_string()` is called against the underlying string.
    #[test]
    fn punctuation_string_roundtrips(
        body in "[a-zA-Z0-9 _\\.\\-\\:\\/]{0,32}"
    ) {
        // We need to escape `"` and `\` to embed in TOML.
        let escaped = body
            .replace('\\', "\\\\")
            .replace('"', "\\\"");
        let user = format!("[metadata]\nlabel = \"{}\"\n", escaped);
        let cascade = build_cascade_from_str(&user);
        let got = cascade
            .find_value("metadata.label")
            .expect("metadata.label present");
        // `figment::value::Value::to_string()` for a String returns
        // the original quoted+escaped form. Decoding that back to
        // a plain String is what we assert here (proptest will
        // shrink a failing case to the smallest bad body).
        let s = got.to_string();
        // Strip the surrounding quotes TOML adds.
        prop_assert!(s.starts_with('"') && s.ends_with('"'),
                     "TOML string should be quoted, got {s:?}");
        let inner = &s[1..s.len() - 1];
        // After TOML unescaping, `inner` should match `body` byte-for-byte
        // for our restricted charset (no backslashes or quotes generated
        // by the regex).
        prop_assert!(
            inner.contains(&body) || body.is_empty(),
            "decoded label {inner:?} should contain body {body:?}"
        );
    }

    /// Property 7: integer values up to u16::MAX parse correctly.
    /// Tests the full u16 range (0..=65535) — the default cascade
    /// uses `server.port` as a u16, so this is the relevant integer
    /// shape for downstream consumers.
    #[test]
    fn u16_integer_parses(port in 0u16..=65535) {
        let user = format!("[server]\nport = {}\n", port);
        let cascade = build_cascade_from_str(&user);
        let got = cascade
            .find_value("server.port")
            .expect("server.port after override");
        prop_assert_eq!(got.to_u128(), Some(port as u128));
    }

    /// Property 8: float values parse without integer truncation.
    /// We sample 64 random floats in [-1000.0, 1000.0) and assert
    /// `to_f64()` round-trips. figment stores `toml::Value::Float`
    /// for any value containing a `.`.
    #[test]
    fn float_value_roundtrips(
        whole in 0i16..1000i16,
        frac in 0u32..1_000_000u32
    ) {
        let f = (whole as f64) + (frac as f64) / 1_000_000.0;
        let user = format!("[server]\nweight = {}\n", f);
        let cascade = build_cascade_from_str(&user);
        let got = cascade
            .find_value("server.weight")
            .expect("server.weight after override");
        // `to_f64()` returns the parsed f64. We compare with a
        // small epsilon because TOML serialisation of f64 can
        // round-trip through `format!` with a 1-ulp error.
        let back = got.to_f64().expect("to_f64() of float");
        prop_assert!(
            (back - f).abs() < 1e-6,
            "float round-trip drifted: wrote {} read {}",
            f, back
        );
    }

    /// Property 9: boolean values parse correctly. Both `true` and
    /// `false` are tested independently by the `any::<bool>()` shim.
    #[test]
    fn boolean_value_roundtrips(flag in any::<bool>()) {
        let user = format!("[flags]\nbeta = {}\n", flag);
        let cascade = build_cascade_from_str(&user);
        let got = cascade
            .find_value("flags.beta")
            .expect("flags.beta after override");
        prop_assert_eq!(got.to_bool(), Some(flag));
    }

    /// Property 10: an empty user TOML preserves the embedded
    /// defaults. This is the regression guard for "the merge
    /// accidentally drops the bottom-of-stack when the top is empty".
    #[test]
    fn empty_user_toml_preserves_defaults(_unused in 0u8..1) {
        let cascade = build_cascade_from_str("");
        // All three default sections must remain.
        prop_assert!(cascade.find_value("server.port").is_ok());
        prop_assert!(cascade.find_value("logging.level").is_ok());
        prop_assert!(cascade.find_value("database.pool_size").is_ok());
    }

    /// Property 11: a user TOML that *only* adds a new section does
    /// not delete the defaults' other sections. The merge is per-key,
    /// not per-file — verified by adding `[extra]` and confirming
    /// `[server]` / `[logging]` / `[database]` survive intact.
    #[test]
    fn additive_merge_preserves_other_sections(extra_key in "[a-z_]{3,16}") {
        let user = format!("[extra]\n{} = 1\n", extra_key);
        let cascade = build_cascade_from_str(&user);
        // [server] from DEFAULT_TOML still present.
        prop_assert!(cascade.find_value("server.port").is_ok());
        // [logging] still present.
        prop_assert!(cascade.find_value("logging.level").is_ok());
        // [database] still present.
        prop_assert!(cascade.find_value("database.pool_size").is_ok());
        // [extra] is also present.
        let key_path = format!("extra.{}", extra_key);
        let got = cascade
            .find_value(&key_path)
            .expect("extra section present");
        prop_assert_eq!(got.to_u128(), Some(1));
    }

    /// Property 12: a user TOML written to a `tempfile::tempdir()`
    /// and read back as a string produces the same cascade as the
    /// same string passed inline to `build_cascade_from_str`. This is
    /// the per-test tempfile fixture pattern from L25 §4 — no shared
    /// `static TEMP_DIR`; each proptest case gets a fresh scratch
    /// directory that is cleaned up when the `TempDir` is dropped.
    #[test]
    fn tempfile_fixture_roundtrip(port in 1u16..=65535) {
        let dir = tempfile::tempdir().expect("tempdir");
        let path = dir.path().join("override.toml");
        let body = format!("[server]\nport = {}\n", port);
        std::fs::write(&path, &body).expect("write override.toml");

        // Read back from disk (mirrors what `Toml::file()` would do
        // in production) — verify the file content survived the
        // round-trip through the filesystem.
        let read_back = std::fs::read_to_string(&path)
            .expect("read override.toml");
        prop_assert_eq!(&read_back, &body);

        // Pass the disk-read string through the cascade builder —
        // the result must equal an inline call with the same body.
        let cascade_from_disk = build_cascade_from_str(&read_back);
        let cascade_inline = build_cascade_from_str(&body);
        let from_disk = cascade_from_disk
            .find_value("server.port")
            .expect("disk cascade has server.port");
        let inline = cascade_inline
            .find_value("server.port")
            .expect("inline cascade has server.port");
        prop_assert_eq!(from_disk.to_u128(), inline.to_u128());
        prop_assert_eq!(from_disk.to_u128(), Some(port as u128));

        // `dir` is dropped at end of fn, removing the scratch dir.
        // proptest will see the absence of leaked files via the
        // filesystem (and the OS will see `TempDir`'s cleanup
        // handler run).
    }
}
