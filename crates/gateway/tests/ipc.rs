// Smoke test: ensure the gateway crate compiles + exposes the expected symbols.
#[test]
fn symbols() {
    // These are the public re-exports from omniroute_gateway::lib.
    use omniroute_gateway::{KbridgeClient, KbridgeRequest};
    fn _accept(_c: KbridgeClient, _r: KbridgeRequest) {}
    let _: fn(KbridgeClient, KbridgeRequest) = _accept;
}
