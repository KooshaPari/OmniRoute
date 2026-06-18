package mcpsdk

import (
	"encoding/json"
	"errors"
	"testing"
)

// TestMcpErrorDisplay mirrors the Rust test `mcp_error_display`: the error
// string must contain the original payload.
func TestMcpErrorDisplay(t *testing.T) {
	t.Helper()
	e := &McpError{Kind: KindToolNotFound, Message: "foo"}
	if got := e.Error(); !contains(got, "foo") {
		t.Fatalf("expected error string to contain %q, got %q", "foo", got)
	}
}

// TestServerInfoRoundTrip mirrors the Rust test `server_info_round_trip`:
// a ServerInfo value must survive JSON marshal/unmarshal and preserve its
// booleans (true stays true, false stays false even when omitted).
func TestServerInfoRoundTrip(t *testing.T) {
	t.Helper()
	info := ServerInfo{
		Name:    "test-server",
		Version: "0.1.0",
		Capabilities: ServerCapabilities{
			Tools:     true,
			Resources: false,
			Prompts:   true,
		},
	}
	raw, err := json.Marshal(info)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	var back ServerInfo
	if err := json.Unmarshal(raw, &back); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if back.Name != "test-server" {
		t.Fatalf("name: got %q, want %q", back.Name, "test-server")
	}
	if !back.Capabilities.Tools {
		t.Fatalf("expected Capabilities.Tools to be true")
	}
	if back.Capabilities.Resources {
		t.Fatalf("expected Capabilities.Resources to be false")
	}
}

// TestResourceContentHasTextOrBlob mirrors the Rust test
// `resource_content_has_text_or_blob`: a constructed ResourceContent must
// expose the text we put in.
func TestResourceContentHasTextOrBlob(t *testing.T) {
	t.Helper()
	rc := ResourceContent{
		URI:      "file:///tmp/test.txt",
		MimeType: ptrString("text/plain"),
		Text:     ptrString("hello"),
	}
	if rc.Text == nil || *rc.Text != "hello" {
		t.Fatalf("expected Text=hello, got %v", rc.Text)
	}
}

// TestResourceSerdeRoundTrip mirrors the Rust test `resource_serde_round_trip`:
// a Resource must round-trip through JSON.
func TestResourceSerdeRoundTrip(t *testing.T) {
	t.Helper()
	r := Resource{
		URI:         "res://docs",
		Name:        "Documentation",
		MimeType:    ptrString("text/markdown"),
		Description: ptrString("API docs"),
	}
	raw, err := json.Marshal(r)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	var back Resource
	if err := json.Unmarshal(raw, &back); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if back.URI != "res://docs" {
		t.Fatalf("uri: got %q, want %q", back.URI, "res://docs")
	}
}

// TestMcpErrorKinds is a table-driven version of the five Rust kind tests
// (`mcp_error_tool_not_found` ... `mcp_error_internal`). It uses t.Run
// subtests so each kind shows up as its own line in `go test -v`.
func TestMcpErrorKinds(t *testing.T) {
	t.Helper()
	cases := []struct {
		name    string
		kind    ErrorKind
		message string
	}{
		{"tool not found", KindToolNotFound, "missing"},
		{"resource not found", KindResourceNotFound, "missing"},
		{"invalid arguments", KindInvalidArguments, "bad json"},
		{"transport", KindTransport, "io broken"},
		{"internal", KindInternal, "panic"},
	}
	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			e := &McpError{Kind: tc.kind, Message: tc.message}
			if e.Kind != tc.kind {
				t.Fatalf("Kind: got %v, want %v", e.Kind, tc.kind)
			}
			if !contains(e.Error(), tc.message) {
				t.Fatalf("Error() = %q, want it to contain %q", e.Error(), tc.message)
			}
		})
	}
}

// TestMcpErrorErrorsAs verifies that *McpError can be extracted from an
// error chain with the standard errors.As helper — a Go-idiomatic analogue
// of the Rust `matches!` checks.
func TestMcpErrorErrorsAs(t *testing.T) {
	t.Helper()

	wrapped := errors.Join(errors.New("outer"), &McpError{Kind: KindToolNotFound, Message: "nope"})

	var target *McpError
	if !errors.As(wrapped, &target) {
		t.Fatalf("expected errors.As to extract *McpError, got false")
	}
	if target.Kind != KindToolNotFound {
		t.Fatalf("Kind: got %v, want %v", target.Kind, KindToolNotFound)
	}
	if target.Message != "nope" {
		t.Fatalf("Message: got %q, want %q", target.Message, "nope")
	}
}

// TestServerCapabilitiesDefault mirrors the Rust test
// `server_capabilities_default`: the zero value of ServerCapabilities must
// have all fields set to false.
func TestServerCapabilitiesDefault(t *testing.T) {
	t.Helper()
	c := ServerCapabilities{}
	if c.Tools || c.Resources || c.Prompts {
		t.Fatalf("expected zero-value ServerCapabilities to be all-false, got %+v", c)
	}
}

// TestErrorKindString sanity-checks the kind labels we use in Error().
func TestErrorKindString(t *testing.T) {
	t.Helper()
	cases := map[ErrorKind]string{
		KindToolNotFound:     "tool not found",
		KindResourceNotFound: "resource not found",
		KindInvalidArguments: "invalid arguments",
		KindTransport:        "transport error",
		KindInternal:         "internal error",
	}
	for k, want := range cases {
		if got := k.String(); got != want {
			t.Errorf("Kind %d: got %q, want %q", k, got, want)
		}
	}
}

// TestResourceOmitEmptyNil checks that optional fields with nil pointers
// are omitted from the JSON output. This matches the Rust serde default of
// skipping None values.
func TestResourceOmitEmptyNil(t *testing.T) {
	t.Helper()
	r := Resource{URI: "res://x", Name: "X"}
	raw, err := json.Marshal(r)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	got := string(raw)
	if contains(got, "mime_type") || contains(got, "description") {
		t.Fatalf("expected nil optionals to be omitted, got %s", got)
	}
}

// --- helpers --------------------------------------------------------------

// ptrString returns a pointer to its argument. Useful for populating the
// optional *string fields on Resource and ResourceContent.
func ptrString(s string) *string { return &s }

// contains is a tiny strings.Contains shim to keep the test file's import
// surface minimal.
func contains(haystack, needle string) bool {
	return len(haystack) >= len(needle) && indexOf(haystack, needle) >= 0
}

func indexOf(s, sub string) int {
	// Equivalent to strings.Index but inlined to avoid importing strings.
	if len(sub) == 0 {
		return 0
	}
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}
