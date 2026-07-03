//! FR-CAST-001 — Pane Address Schema
//! FR: FR-CAST-001
//!
//! Covers the `PaneAddress` schema used by `cast register` and `cast send`.
//!
//! Schema: `machine:host?[:window][:pane]`
//!   - `machine`  : friendly name (e.g. `mbp`, `winTerm`)
//!   - `host`     : `local` | `tailscale` | `ssh:user@host`
//!   - `window`   : terminal window index (default 0)
//!   - `pane`     : pane index within window (default 0)

use sharecli::cast::address::{Host, PaneAddress};

/// PaneAddress::parse handles the canonical 4-segment form.
#[test]
fn fr_cast_001_parse_full_form() {
    let addr = PaneAddress::parse("mbp:local:0:2").expect("parse ok");
    assert_eq!(addr.machine, "mbp");
    assert_eq!(addr.host, Host::Local);
    assert_eq!(addr.window, 0);
    assert_eq!(addr.pane, 2);
}

/// PaneAddress::parse handles the 3-segment form (omits pane → 0).
#[test]
fn fr_cast_001_parse_three_segments_omits_pane() {
    let addr = PaneAddress::parse("winTerm:tailscale:0").expect("parse ok");
    assert_eq!(addr.machine, "winTerm");
    assert_eq!(addr.host, Host::Tailscale);
    assert_eq!(addr.window, 0);
    assert_eq!(addr.pane, 0);
}

/// PaneAddress::parse handles the 2-segment form (machine:host only).
#[test]
fn fr_cast_001_parse_two_segments_omits_window_and_pane() {
    let addr = PaneAddress::parse("mbp:local").expect("parse ok");
    assert_eq!(addr.machine, "mbp");
    assert_eq!(addr.host, Host::Local);
    assert_eq!(addr.window, 0);
    assert_eq!(addr.pane, 0);
}

/// PaneAddress::parse rejects empty machine names.
#[test]
fn fr_cast_001_parse_rejects_empty_machine() {
    let err = PaneAddress::parse(":local:0:0").expect_err("must reject empty machine");
    assert!(err.to_string().contains("machine"), "error mentions machine: {}", err);
}

/// PaneAddress::parse rejects unknown host schemes.
#[test]
fn fr_cast_001_parse_rejects_unknown_host() {
    let err = PaneAddress::parse("mbp:ftp:0:0").expect_err("must reject ftp scheme");
    assert!(err.to_string().contains("host"), "error mentions host: {}", err);
}

/// PaneAddress::parse rejects out-of-range window indices.
#[test]
fn fr_cast_001_parse_rejects_negative_window() {
    let err = PaneAddress::parse("mbp:local:-1:0").expect_err("negative window rejected");
    assert!(err.to_string().contains("window"), "error mentions window: {}", err);
}

/// PaneAddress::parse rejects out-of-range pane indices.
#[test]
fn fr_cast_001_parse_rejects_negative_pane() {
    let err = PaneAddress::parse("mbp:local:0:-1").expect_err("negative pane rejected");
    assert!(err.to_string().contains("pane"), "error mentions pane: {}", err);
}

/// PaneAddress::parse handles ssh user@host form.
#[test]
fn fr_cast_001_parse_ssh_user_at_host() {
    let addr = PaneAddress::parse("workstation:ssh:koosha@10.0.0.5:0:3").expect("parse ok");
    assert_eq!(addr.machine, "workstation");
    match &addr.host {
        Host::Ssh { user, host } => {
            assert_eq!(user, "koosha");
            assert_eq!(host, "10.0.0.5");
        }
        other => panic!("expected ssh host, got {:?}", other),
    }
    assert_eq!(addr.window, 0);
    assert_eq!(addr.pane, 3);
}

/// PaneAddress Display impl round-trips through parse.
#[test]
fn fr_cast_001_display_round_trip() {
    let original = "mbp:tailscale:2:5";
    let addr = PaneAddress::parse(original).expect("parse ok");
    let displayed = format!("{}", addr);
    assert_eq!(displayed, original, "display must match original");
}

/// PaneAddress Display handles ssh user@host.
#[test]
fn fr_cast_001_display_ssh_round_trip() {
    let original = "ws:ssh:user@host.example:1:2";
    let addr = PaneAddress::parse(original).expect("parse ok");
    let displayed = format!("{}", addr);
    assert_eq!(displayed, original, "display must match original");
}
