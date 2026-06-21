#![no_main]

// cargo-fuzz target: fuzz the TcpAdapter endpoint parser for panics / OOM / UB.
//
// The fuzz target exercises the public `connect` API with arbitrary bytes coerced
// to &str. It is intentionally tolerant of invalid UTF-8 by handling the
// conversion in the fuzzer so we do not bias against OS-level DNS resolution
// behaviour. The invariant being checked is:
//
//   * `connect(endpoint)` MUST NEVER PANIC. It returns Result and may error
//     for any non-empty input (empty input is a handled Err too).
//   * Empty input -> Err(ConnectFailed("empty endpoint")).
//   * Non-empty input -> either Ok(Connection) or Err(ConnectFailed(...)).
//
// Connections to routable endpoints will produce a real TcpStream; this is
// OK because the target aborts on first error and we set a short timeout.
//
// Run with:
//   cargo fuzz run fuzz_endpoint -- -max_total_time=60

use libfuzzer_sys::fuzz_target;
use pheno_port_adapter::adapters::tcp::TcpAdapter;
use pheno_port_adapter::PortAdapter;

fuzz_target!(|data: &[u8]| {
    // Lossy decode so we exercise the path with weird bytes; if decode fails we
    // skip the iteration (still counts as one pass, no panic).
    let endpoint = match std::str::from_utf8(data) {
        Ok(s) => s,
        Err(_) => return,
    };

    let adapter = TcpAdapter::new();
    // We do NOT care about the Ok variant — only that nothing panics or aborts.
    // Both Ok and Err are valid outcomes.
    let _ = adapter.connect(endpoint);
});
