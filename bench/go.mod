module github.com/KooshaPari/phenotype-router/bench

go 1.22

// Self-contained bench module. The decision-flow types are ported here from
// the reference skeleton at findings/2026-06-20-phenotype-router-decision-flow.go
// so benchmarks have a real target without pulling in Bifrost (per ADR-051,
// Bifrost is a transport-only library; the bench targets the Phenotype-owned
// decision layer in isolation).
//
// Zero external deps. Stdlib only.
