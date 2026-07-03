//! FR-CAST-002 — Pane Registry (name → address map)
//! FR: FR-CAST-002
//!
//! Covers `cast register` / `cast unregister` / `cast list`.
//! The registry is persisted to `~/.config/sharecli/pane-map.toml` by
//! default, but tests use `PaneRegistry::new_in(path)` for hermeticity.

use std::collections::BTreeMap;

use sharecli::cast::address::PaneAddress;
use sharecli::cast::registry::PaneRegistry;

/// Register a new pane; second registration with same name replaces.
#[test]
fn fr_cast_002_register_adds_pane() {
    let tmp = tempdir();
    let reg = PaneRegistry::new_in(tmp.path()).expect("registry init");
    let addr = PaneAddress::parse("mbp:local:0:2").expect("parse ok");

    reg.register("civis-1", &addr).expect("register ok");
    let entries = reg.list().expect("list ok");

    assert_eq!(entries.len(), 1);
    assert_eq!(entries[0].0, "civis-1");
    assert_eq!(entries[0].1, addr);
}

/// Register replaces an existing entry with the same name.
#[test]
fn fr_cast_002_register_replaces_existing() {
    let tmp = tempdir();
    let reg = PaneRegistry::new_in(tmp.path()).expect("registry init");
    let addr_a = PaneAddress::parse("mbp:local:0:2").expect("parse ok");
    let addr_b = PaneAddress::parse("mbp:local:1:0").expect("parse ok");

    reg.register("civis-1", &addr_a).expect("register ok");
    reg.register("civis-1", &addr_b).expect("register ok");

    let entries = reg.list().expect("list ok");
    assert_eq!(entries.len(), 1, "replacement must not duplicate");
    assert_eq!(entries[0].1, addr_b);
}

/// Unregister removes an existing entry; unregister of missing name is a no-op.
#[test]
fn fr_cast_002_unregister_removes_entry() {
    let tmp = tempdir();
    let reg = PaneRegistry::new_in(tmp.path()).expect("registry init");
    let addr = PaneAddress::parse("mbp:local:0:2").expect("parse ok");

    reg.register("civis-1", &addr).expect("register ok");
    reg.unregister("civis-1").expect("unregister ok");
    assert!(reg.list().expect("list ok").is_empty());

    // Unregister of a non-existent name is a successful no-op.
    reg.unregister("never-existed").expect("unregister ok");
}

/// Resolve returns the address for a registered name, None otherwise.
#[test]
fn fr_cast_002_resolve_returns_address_or_none() {
    let tmp = tempdir();
    let reg = PaneRegistry::new_in(tmp.path()).expect("registry init");
    let addr = PaneAddress::parse("mbp:local:0:2").expect("parse ok");
    reg.register("civis-1", &addr).expect("register ok");

    assert_eq!(reg.resolve("civis-1").expect("resolve ok"), Some(addr.clone()));
    assert_eq!(reg.resolve("missing").expect("resolve ok"), None);
}

/// Persistence: write to disk, read back via a fresh registry.
#[test]
fn fr_cast_002_persists_across_instances() {
    let tmp = tempdir();
    let addr = PaneAddress::parse("mbp:tailscale:0:1").expect("parse ok");

    {
        let reg = PaneRegistry::new_in(tmp.path()).expect("registry init");
        reg.register("civis-1", &addr).expect("register ok");
        reg.register("civis-2", &addr).expect("register ok");
    }

    let reg2 = PaneRegistry::new_in(tmp.path()).expect("registry init");
    let entries = reg2.list().expect("list ok");
    assert_eq!(entries.len(), 2, "two entries must round-trip");
    let map: BTreeMap<_, _> = entries.into_iter().collect();
    assert_eq!(map.get("civis-1"), Some(&addr));
    assert_eq!(map.get("civis-2"), Some(&addr));
}

/// Register rejects empty names.
#[test]
fn fr_cast_002_register_rejects_empty_name() {
    let tmp = tempdir();
    let reg = PaneRegistry::new_in(tmp.path()).expect("registry init");
    let addr = PaneAddress::parse("mbp:local:0:0").expect("parse ok");
    let err = reg.register("", &addr).expect_err("empty name rejected");
    assert!(err.to_string().contains("name"), "error mentions name: {}", err);
}

/// Register rejects names containing control characters or whitespace.
#[test]
fn fr_cast_002_register_rejects_invalid_name() {
    let tmp = tempdir();
    let reg = PaneRegistry::new_in(tmp.path()).expect("registry init");
    let addr = PaneAddress::parse("mbp:local:0:0").expect("parse ok");

    for bad in ["civis 1", "civis\t1", "civis\n1", "civis\x001"] {
        let err = reg.register(bad, &addr).expect_err("invalid name rejected");
        assert!(
            err.to_string().contains("name"),
            "error mentions name for {:?}: {}",
            bad,
            err
        );
    }
}

// --- helpers ---

fn tempdir() -> tempfile::TempDir {
    tempfile::tempdir().expect("tempdir")
}
