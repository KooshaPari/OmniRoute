package main

import "testing"

// TestSmoke is a minimum floor test to ensure the Go toolchain
// builds and the test harness runs in CI. Traces to: FR-CI-FLOOR.
func TestSmoke(t *testing.T) {
	if 2+2 != 4 {
		t.Fatal("arithmetic broken")
	}
}
