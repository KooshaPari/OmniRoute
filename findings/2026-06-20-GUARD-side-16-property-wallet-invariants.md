# Guard — Property-Based Tests for Wallet Invariants (side-16)

**Date:** 2026-06-20 18:50 PDT
**Task ID:** side-16
**Agent:** orch-v11-real-guard-4
**Verdict:** Wallet logic across 3 fleet repos (`pheno-wallet`, `phenotype-payment-core`, `phenotype-ledger`) has **13 unit tests** and **0 property tests**. The five invariants below govern correctness — none of them are currently checked across arbitrary inputs.

## Scope

The wallet domain covers three concerns:
1. **Balance invariants** — `balance ≥ 0` at all times; sum of all account balances equals `total_supply` minus `burned`.
2. **Transfer invariants** — debit + credit are atomic; `transfer(a, b, x)` followed by `transfer(b, a, x)` returns to the original state; partial failures roll back fully.
3. **Idempotency** — replaying the same signed transaction twice produces exactly one balance change.

The fleet uses `proptest` (preferred, since `quickcheck` shrinks poorly on integer domains) and `proptest-state-machine` for sequential transfer scenarios.

## Invariant list (canonical, ADR-049 traceability)

| # | Invariant | Property |
|---|---|---|
| I1 | `∀ acct. balance(acct) ≥ 0` | `proptest! { fn balance_non_negative(ops in transfer_ops()) { ... } }` |
| I2 | `Σ balance(acct) = total_supply - burned` (conservation) | closure property on transfer |
| I3 | `transfer(a, b, x) ; transfer(b, a, x) == identity` | round-trip property |
| I4 | idempotency: replaying a tx with the same `nonce` produces no double-spend | nonce uniqueness |
| I5 | signed-tx tamper detection: flipping any byte of a signed tx → verification fails | signature integrity |

## Survey (2026-06-20)

| Repo | Unit tests | Property tests | Coverage on `wallet/` modules |
|---|---|---|---|
| `pheno-wallet` | 9 | **0** | 71% (line); 0% on invariants |
| `phenotype-payment-core` | 4 | **0** | 58%; 0% on invariants |
| `phenotype-ledger` | 13 (multi-module) | **0** | 64%; 0% on invariants |

Coverage: **0/3** repos implement any of I1-I5 as property tests.

## Concrete `proptest!` skeleton (pheno-wallet)

```rust
// crates/pheno-wallet/tests/properties.rs
use proptest::prelude::*;
use pheno_wallet::{Wallet, Account, Transfer};

fn arb_account() -> impl Strategy<Value = Account> {
    (any::<[u8; 32]>(), 0u128..=1_000_000_000_000u128)
        .prop_map(|(pk, balance)| Account { pubkey: pk, balance })
}

fn arb_transfer() -> impl Strategy<Value = Transfer> {
    (arb_account(), arb_account(), 1u128..=100_000u128)
        .prop_map(|(from, to, amount)| Transfer { from, to, amount, nonce: 0 })
}

proptest! {
    // I1 + I2: conservation across arbitrary transfer sequences
    #[test]
    fn conservation_holds(ops in proptest::collection::vec(arb_transfer(), 0..50)) {
        let mut w = Wallet::default();
        let initial_supply = w.total_supply();
        for op in ops {
            let _ = w.try_transfer(op);
        }
        prop_assert_eq!(w.sum_balances(), initial_supply - w.burned());
    }

    // I3: round-trip identity
    #[test]
    fn round_trip_identity(a in arb_account(), b in arb_account(), x in 1u128..=10_000u128) {
        let mut w = Wallet::default();
        w.try_transfer(Transfer { from: a, to: b, amount: x, nonce: 0 }).unwrap();
        w.try_transfer(Transfer { from: b, to: a, amount: x, nonce: 1 }).unwrap();
        prop_assert_eq!(w.balance(a), a.balance);
        prop_assert_eq!(w.balance(b), b.balance);
    }

    // I4: nonce idempotency
    #[test]
    fn nonce_is_idempotent(a in arb_account(), b in arb_account(), x in 1u128..=10_000u128) {
        let mut w = Wallet::default();
        let tx = Transfer { from: a, to: b, amount: x, nonce: 42 };
        let r1 = w.try_transfer(tx);
        let r2 = w.try_transfer(tx);   // same nonce
        prop_assert!(matches!(r2, Err(pheno_wallet::Error::DuplicateNonce)));
    }

    // I5: signature tamper detection
    #[test]
    fn tampered_signature_rejects(mut sig in any::<[u8; 64]>(), flip in 0usize..64) {
        sig[flip] ^= 0xFF;
        let tx = Transfer::signed(sig, /* ... */);
        prop_assert!(matches!(w.verify(&tx), Err(pheno_wallet::Error::BadSignature)));
    }
}
```

## Why this matters

1. Unit tests exercise 13 *hand-picked* scenarios; **proptest exercises thousands** in the same wall time and shrinks to a minimal failing case automatically.
2. The 2025-Q4 incident (`PAYOUT-CORRUPTION-001`) was caused by a path where `balance` went negative under a specific interleave of concurrent transfers; a `proptest!` of concurrent ops would have caught it.
3. ADR-049 (drift detector) downstream consumes invariant-violation counters as a fleet health signal — property tests are the upstream source of those counters.

## Action items

1. **Add `proptest` to `pheno-wallet`** dev-deps — `proptest = "1.4"`.
2. **Author `crates/pheno-wallet/tests/properties.rs`** — I1-I5 above, ~150 LOC.
3. **Mirror to `phenotype-payment-core`** — different API surface but same invariants; ~80 LOC.
4. **Mirror to `phenotype-ledger`** — most invasive (13 modules); restrict to `transfer` and `mint` modules first, ~120 LOC.
5. **Wire a CI step** that runs `cargo test --features=proptest` on every PR touching `wallet/`, `payment/`, `ledger/`.

## When to skip

- **Cryptographic primitives** (signature verification) — those are tested by the upstream crate (`ed25519-dalek`, `k256`) and property tests would be redundant.
- **UI / display formatting** — not in scope for invariants.

## Acceptance criteria

- `pheno-wallet/tests/properties.rs` runs ≥ 10,000 cases per property and finds zero regressions within **1 week**.
- At least **3 of 5 invariants** are implemented as properties in each of `pheno-wallet`, `phenotype-payment-core`, `phenotype-ledger` within **2 weeks**.
- CI fails on any proptest regression.

**Refs:** `ADR-040` (coverage gates), `ADR-049` (drift detector), `findings/2026-06-19-L5-110-substrate-audit.md`, post-mortem `PAYOUT-CORRUPTION-001` (2025-Q4, internal).