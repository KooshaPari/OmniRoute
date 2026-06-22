//! Secret-holding newtypes with `ZeroizeOnDrop` (ADR-078 / L52).
//!
//! Three newtypes live in this module:
//!
//! - [`ApiKey`] — opaque API key (`sk-live-...`, `AKIA...`, `ghp_...`).
//! - [`BearerToken`] — opaque bearer token (OAuth / OIDC).
//! - [`DbPassword`] — database connection password.
//!
//! Each is a heap-allocated `String` wrapper that derives both
//! [`Zeroize`] and [`ZeroizeOnDrop`]. When the newtype goes out of
//! scope (or is explicitly dropped via `mem::drop`), the inner
//! bytes are overwritten with zero before the allocator releases
//! them. This is the ADR-078 §2.1 mechanism that prevents secret
//! material from lingering on the heap after a request finishes.
//!
//! ## Construction
//!
//! Every newtype is constructed via `new(impl Into<String>)`. Empty
//! input is **rejected** with a panic — secret material of length 0
//! is almost always a bug (a missing env var, a truncated
//! `String::from_utf8`), and panicking surfaces the bug at the call
//! site rather than silently propagating an "empty credential".
//!
//! ## Read access
//!
//! The only way to read the inner bytes is [`ApiKey::expose`] (and
//! the analogous `BearerToken::expose` / `DbPassword::expose`).
//! Each returns a `&str` borrow — no allocation, no `clone()`, no
//! `String::from_utf8(secret_bytes)` escape hatch.
//!
//! ## Display / Debug
//!
//! Both `Display` and `Debug` render as `***REDACTED***`. The
//! redaction is implemented with `f.write_str` against a `&'static
//! str` so the `format!` machinery never allocates a buffer that
//! could accidentally retain the original secret bytes.
//!
//! [`Zeroize`]: zeroize::Zeroize
//! [`ZeroizeOnDrop`]: zeroize::ZeroizeOnDrop

use std::fmt;

use proptest::strategy::Strategy;
use zeroize::{Zeroize, ZeroizeOnDrop};

/// Redacted representation for `Display` and `Debug`.
///
/// A `&'static str` (rather than a freshly-formatted `String`) so the
/// redaction path is allocation-free.
const REDACTED: &str = "***REDACTED***";

/// Macro: implement `Display` + `Debug` for one secret newtype.
///
/// Centralised so the three structs below cannot accidentally diverge
/// in their redaction policy. If you find yourself needing a richer
/// display, open an ADR-078 follow-up instead of editing this macro.
macro_rules! impl_secret_fmt {
    ($ty:ident) => {
        impl fmt::Display for $ty {
            #[inline]
            fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
                f.write_str(REDACTED)
            }
        }

        impl fmt::Debug for $ty {
            #[inline]
            fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
                // `ApiKey(***REDACTED***)` — preserves the type tag
                // for log triage without leaking the inner value.
                write!(f, concat!(stringify!($ty), "("),)?;
                f.write_str(REDACTED)?;
                write!(f, ")")
            }
        }
    };
}

/// Macro: implement `new` + `expose` for one secret newtype.
macro_rules! impl_secret_new_expose {
    ($ty:ident) => {
        impl $ty {
            /// Construct a new secret from anything `Into<String>`.
            ///
            /// # Panics
            ///
            /// Panics if the input string is empty. Empty secret
            /// material is rejected at construction time so the
            /// caller surfaces a missing-credential bug immediately
            /// rather than propagating an empty `&str` to a downstream
            /// HTTP request that would happily send `Authorization: `.
            #[inline]
            #[must_use]
            pub fn new(s: impl Into<String>) -> Self {
                let inner = s.into();
                assert!(
                    !inner.is_empty(),
                    concat!(stringify!($ty), "::new: empty secret rejected (ADR-078)")
                );
                Self(inner)
            }

            /// Borrow the raw secret bytes. Use sparingly — every
            /// call site is grep-able for security review.
            #[inline]
            #[must_use]
            pub fn expose(&self) -> &str {
                &self.0
            }
        }
    };
}

// ---------------------------------------------------------------------------
// ApiKey
// ---------------------------------------------------------------------------

/// An opaque API key. See module docs.
#[derive(Zeroize, ZeroizeOnDrop, Clone)]
pub struct ApiKey(String);

impl_secret_new_expose!(ApiKey);
impl_secret_fmt!(ApiKey);

// ---------------------------------------------------------------------------
// BearerToken
// ---------------------------------------------------------------------------

/// An opaque bearer token (OAuth / OIDC). See module docs.
#[derive(Zeroize, ZeroizeOnDrop, Clone)]
pub struct BearerToken(String);

impl_secret_new_expose!(BearerToken);
impl_secret_fmt!(BearerToken);

// ---------------------------------------------------------------------------
// DbPassword
// ---------------------------------------------------------------------------

/// A database connection password. See module docs.
#[derive(Zeroize, ZeroizeOnDrop, Clone)]
pub struct DbPassword(String);

impl_secret_new_expose!(DbPassword);
impl_secret_fmt!(DbPassword);

// ---------------------------------------------------------------------------
// proptest::Arbitrary impls (v20-T5 / L23)
// ---------------------------------------------------------------------------

/// Helper strategy: any non-empty ASCII string.
///
/// `ApiKey::new` panics on empty input (ADR-078 §2.1 tripwire), so the
/// `Arbitrary` impl cannot delegate to the built-in `string` strategy
/// (which can produce the empty string). The "alphanumeric 1..=64"
/// range keeps generated secrets realistic without being too narrow.
fn non_empty_ascii_string() -> proptest::strategy::BoxedStrategy<String> {
    use proptest::strategy::Strategy;
    proptest::string::string_regex("[A-Za-z0-9_\\-]{1,64}")
        .expect("non_empty_ascii_string: regex must be valid")
        .boxed()
}

impl proptest::arbitrary::Arbitrary for ApiKey {
    type Parameters = ();
    type Strategy = proptest::strategy::BoxedStrategy<Self>;

    fn arbitrary_with((): Self::Parameters) -> Self::Strategy {
        non_empty_ascii_string().prop_map(Self::new).boxed()
    }
}

impl proptest::arbitrary::Arbitrary for BearerToken {
    type Parameters = ();
    type Strategy = proptest::strategy::BoxedStrategy<Self>;

    fn arbitrary_with((): Self::Parameters) -> Self::Strategy {
        non_empty_ascii_string().prop_map(Self::new).boxed()
    }
}

impl proptest::arbitrary::Arbitrary for DbPassword {
    type Parameters = ();
    type Strategy = proptest::strategy::BoxedStrategy<Self>;

    fn arbitrary_with((): Self::Parameters) -> Self::Strategy {
        non_empty_ascii_string().prop_map(Self::new).boxed()
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    /// Helper: a panic-on-empty assertion. The `new()` constructor
    /// panics with a fixed message; we assert the message so a
    /// silent acceptance of empty input fails loudly.
    #[test]
    #[should_panic(expected = "empty secret rejected")]
    fn test_empty_api_key_rejected() {
        // Empty string is rejected at construction. This is the
        // ADR-078 §2.1 tripwire: a zero-length credential is almost
        // always a missing env var.
        let _ = ApiKey::new("");
    }

    #[test]
    fn test_expose_returns_inner_string() {
        let raw = "sk-live-abc123";
        let key = ApiKey::new(raw);
        assert_eq!(key.expose(), raw);

        let tok = BearerToken::new("eyJ.payload.sig");
        assert_eq!(tok.expose(), "eyJ.payload.sig");

        let pw = DbPassword::new("hunter2");
        assert_eq!(pw.expose(), "hunter2");
    }

    #[test]
    fn test_debug_redacts_secret() {
        let raw = "sk-live-abc123";
        let key = ApiKey::new(raw);
        let dbg = format!("{:?}", key);
        // Type tag is preserved (for log triage) but the value is gone.
        assert!(dbg.contains("ApiKey"), "Debug should preserve type tag: {dbg}");
        assert!(dbg.contains("REDACTED"), "Debug should show REDACTED: {dbg}");
        assert!(!dbg.contains(raw), "Debug must not leak the raw value: {dbg}");

        // Display path is also redacted.
        let disp = format!("{}", key);
        assert_eq!(disp, "***REDACTED***");
        assert!(!disp.contains(raw));

        // Same contract for the other two newtypes.
        let pw = DbPassword::new("hunter2");
        let dbg = format!("{:?}", pw);
        assert!(dbg.contains("DbPassword"));
        assert!(!dbg.contains("hunter2"));
    }

    /// `Drop` zeroization is verified by the type system: the
    /// `#[derive(ZeroizeOnDrop)]` on each newtype emits a `Drop`
    /// impl that calls `Zeroize::zeroize(&mut self.0)` before the
    /// inner `String` is released. Verifying this in a unit test
    /// would require `unsafe` (e.g. `ManuallyDrop` + `ptr::read`),
    /// which `#![forbid(unsafe_code)]` forbids at the crate root.
    ///
    /// Instead, we exercise the only safe, observable contract:
    /// explicit `zeroize()` zeroes the inner `String` in place, so
    /// subsequent `expose()` returns an empty `&str`. This proves
    /// the `Zeroize` impl is wired up; the `Drop` glue is the
    /// `zeroize_derive` macro's job.
    #[test]
    fn test_drop_zeros_memory() {
        let mut key = ApiKey::new("sk-live-abc123");
        assert_eq!(key.expose(), "sk-live-abc123");
        // Explicit `zeroize()` — same code path `Drop` will run.
        key.zeroize();
        assert_eq!(
            key.expose(),
            "",
            "explicit zeroize() should wipe the inner String"
        );
    }
}
