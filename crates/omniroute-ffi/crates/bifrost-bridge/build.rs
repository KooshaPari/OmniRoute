fn main() {
    // Placeholder build script for CGO Bifrost bridge
    // When Bifrost v1.0 GA ships, this will invoke `go build -buildmode=c-shared`
    println!("cargo:rerun-if-changed=bridge.go");
    println!("cargo:rerun-if-changed=bifrost.go");
}
