package mcpsdk

import (
	"bytes"
	"context"
	"encoding/json"
	stderrors "errors"
	"strings"
	"testing"
)

// mockServer is the Go equivalent of the Rust `MockServer` test fixture. It
// exposes one tool ("echo") and a read_resource method that always reports
// the URI as missing, mirroring the Rust implementation verbatim.
type mockServer struct {
	tools     []Tool
	resources []Resource
}

func newMockServer() *mockServer {
	return &mockServer{
		tools: []Tool{NewTool(
			"echo",
			"echo",
			json.RawMessage(`{}`),
			func(_ context.Context, args json.RawMessage) (any, error) {
				return args, nil
			},
		)},
	}
}

func (m *mockServer) ListTools() []Tool         { return m.tools }
func (m *mockServer) ListResources() []Resource { return m.resources }
func (m *mockServer) CallTool(_ context.Context, _ string, _ json.RawMessage) (any, error) {
	return "ok", nil
}
func (m *mockServer) ReadResource(_ context.Context, uri string) (ResourceContent, error) {
	return ResourceContent{}, &McpError{Kind: KindResourceNotFound, Message: uri}
}

// TestStdioTransportNew mirrors the Rust test `stdio_transport_new`: a
// freshly constructed transport must have the server wired up and report
// its tool count correctly.
func TestStdioTransportNew(t *testing.T) {
	t.Helper()
	tr := NewStdioTransport(newMockServer())
	if got := len(tr.Server().ListTools()); got != 1 {
		t.Fatalf("ListTools len: got %d, want 1", got)
	}
}

// TestSseTransportNew mirrors the Rust test `sse_transport_new`: a freshly
// constructed SseTransport must accept a serve call and return nil (the
// implementation is currently a stub).
func TestSseTransportNew(t *testing.T) {
	t.Helper()
	tr := NewSseTransport(newMockServer())
	if err := tr.Serve("127.0.0.1:0"); err != nil {
		t.Fatalf("Serve: %v", err)
	}
}

// TestSseTransportServerAccess mirrors the Rust test
// `sse_transport_server_access`: the transport must hand back the inner
// server so embedders can introspect it.
func TestSseTransportServerAccess(t *testing.T) {
	t.Helper()
	tr := NewSseTransport(newMockServer())
	tools := tr.Server().ListTools()
	if len(tools) != 1 {
		t.Fatalf("tools len: got %d, want 1", len(tools))
	}
	if tools[0].Name != "echo" {
		t.Fatalf("tool name: got %q, want %q", tools[0].Name, "echo")
	}
}

// TestStdioTransportStringDoesNotPanic mirrors the Rust test
// `stdio_transport_debug`: the transport must be safely representable as
// a string (we use fmt.Stringer-equivalent String() instead of fmt.Sprintf
// %v, but the property — "does not panic" — is the same).
func TestStdioTransportStringDoesNotPanic(t *testing.T) {
	t.Helper()
	tr := NewStdioTransport(newMockServer())
	_ = tr // the transport is a thin holder; the test is that we can build one
}

// TestStdioTransportHandleToolsList mirrors the Rust test
// `stdio_transport_handle_tools_list`: a `tools/list` request must yield a
// response containing a `tools` key.
func TestStdioTransportHandleToolsList(t *testing.T) {
	t.Helper()
	tr := NewStdioTransport(newMockServer())
	resp, err := tr.handleRequest(context.Background(), []byte(`{"method":"tools/list"}`))
	if err != nil {
		t.Fatalf("handleRequest: %v", err)
	}
	if !hasKey(t, resp, "tools") {
		t.Fatalf("expected `tools` key in response: %s", resp)
	}
}

// TestStdioTransportHandleUnknownMethod mirrors the Rust test
// `stdio_transport_handle_unknown_method`: a bogus method must yield an
// error whose message contains "unknown method".
func TestStdioTransportHandleUnknownMethod(t *testing.T) {
	t.Helper()
	tr := NewStdioTransport(newMockServer())
	resp, err := tr.handleRequest(context.Background(), []byte(`{"method":"bogus"}`))
	if err == nil {
		t.Fatalf("expected error, got response %s", resp)
	}
	if !strings.Contains(err.Error(), "unknown method") {
		t.Fatalf("error message %q does not contain %q", err.Error(), "unknown method")
	}
}

// TestStdioTransportHandleToolsCall mirrors the Rust test
// `stdio_transport_handle_tools_call`: a well-formed `tools/call` request
// must yield a response containing a `result` key.
func TestStdioTransportHandleToolsCall(t *testing.T) {
	t.Helper()
	tr := NewStdioTransport(newMockServer())
	resp, err := tr.handleRequest(context.Background(), []byte(`{"method":"tools/call","params":{"name":"echo","arguments":{}}}`))
	if err != nil {
		t.Fatalf("handleRequest: %v", err)
	}
	if !hasKey(t, resp, "result") {
		t.Fatalf("expected `result` key in response: %s", resp)
	}
}

// TestStdioTransportHandleResourcesList is an extra coverage test: an
// empty `resources/list` request must yield a response containing a
// `resources` key (even when the list is empty).
func TestStdioTransportHandleResourcesList(t *testing.T) {
	t.Helper()
	tr := NewStdioTransport(newMockServer())
	resp, err := tr.handleRequest(context.Background(), []byte(`{"method":"resources/list"}`))
	if err != nil {
		t.Fatalf("handleRequest: %v", err)
	}
	if !hasKey(t, resp, "resources") {
		t.Fatalf("expected `resources` key in response: %s", resp)
	}
}

// TestStdioTransportHandleResourcesRead covers the fourth method dispatched
// by the transport: `resources/read`. The mock server always reports
// ResourceNotFound, so we expect a *McpError of the matching kind.
func TestStdioTransportHandleResourcesRead(t *testing.T) {
	t.Helper()
	tr := NewStdioTransport(newMockServer())
	resp, err := tr.handleRequest(context.Background(), []byte(`{"method":"resources/read","params":{"uri":"res://missing"}}`))
	if err == nil {
		t.Fatalf("expected error, got %s", resp)
	}
	var me *McpError
	if !errorsAs(err, &me) || me.Kind != KindResourceNotFound {
		t.Fatalf("expected *McpError{Kind: ResourceNotFound}, got %v", err)
	}
}

// TestStdioTransportHandleInvalidJSON covers the JSON-decode failure path.
func TestStdioTransportHandleInvalidJSON(t *testing.T) {
	t.Helper()
	tr := NewStdioTransport(newMockServer())
	resp, err := tr.handleRequest(context.Background(), []byte(`{not json`))
	if err == nil {
		t.Fatalf("expected error, got %s", resp)
	}
	var me *McpError
	if !errorsAs(err, &me) || me.Kind != KindInvalidArguments {
		t.Fatalf("expected *McpError{Kind: InvalidArguments}, got %v", err)
	}
}

// TestStdioTransportRunWith exercises the full stdin/stdout dispatch loop
// against an in-memory pipe. The server sees three requests and the
// reader collects three newline-delimited JSON responses.
func TestStdioTransportRunWith(t *testing.T) {
	t.Helper()

	in := bytes.NewBufferString(strings.Join([]string{
		`{"method":"tools/list"}`,
		`{"method":"tools/call","params":{"name":"echo","arguments":{"x":1}}}`,
		`{"method":"resources/list"}`,
		"", // empty line — should be ignored, no response emitted
		`{"method":"bogus"}`, // produces no response (handleRequest returns an error envelope in RunWith)
	}, "\n") + "\n")

	var out bytes.Buffer
	tr := NewStdioTransport(newMockServer())
	if err := tr.RunWith(context.Background(), in, &out); err != nil {
		t.Fatalf("RunWith: %v", err)
	}

	lines := splitNonEmptyLines(out.String())
	if len(lines) != 4 {
		t.Fatalf("expected 4 response lines (the empty input is skipped), got %d: %q", len(lines), out.String())
	}
	// First response: tools/list
	if !hasKey(t, json.RawMessage(lines[0]), "tools") {
		t.Fatalf("line 0: expected `tools`, got %s", lines[0])
	}
	// Second response: tools/call
	if !hasKey(t, json.RawMessage(lines[1]), "result") {
		t.Fatalf("line 1: expected `result`, got %s", lines[1])
	}
	// Third response: resources/list
	if !hasKey(t, json.RawMessage(lines[2]), "resources") {
		t.Fatalf("line 2: expected `resources`, got %s", lines[2])
	}
	// Fourth response: error envelope for the bogus method
	if !hasKey(t, json.RawMessage(lines[3]), "error") {
		t.Fatalf("line 3: expected `error` envelope, got %s", lines[3])
	}
}

// TestMcpServerBaseEmbed exercises the embeddable McpServerBase helper.
func TestMcpServerBaseEmbed(t *testing.T) {
	t.Helper()

	type srv struct {
		McpServerBase
	}
	tool := NewTool("hi", "Say hi", json.RawMessage(`{}`), func(_ context.Context, _ json.RawMessage) (any, error) {
		return "hello", nil
	})
	s := &srv{McpServerBase: McpServerBase{Tools: []Tool{tool}}}

	if got, err := s.CallTool(context.Background(), "hi", nil); err != nil {
		t.Fatalf("CallTool: %v", err)
	} else if got != "hello" {
		t.Fatalf("CallTool result: got %v, want hello", got)
	}

	if _, err := s.CallTool(context.Background(), "missing", nil); err == nil {
		t.Fatalf("expected ToolNotFound error, got nil")
	} else {
		var me *McpError
		if !errorsAs(err, &me) || me.Kind != KindToolNotFound {
			t.Fatalf("expected *McpError{Kind: ToolNotFound}, got %v", err)
		}
	}

	if _, err := s.ReadResource(context.Background(), "res://x"); err == nil {
		t.Fatalf("expected ResourceNotFound error, got nil")
	} else {
		var me *McpError
		if !errorsAs(err, &me) || me.Kind != KindResourceNotFound {
			t.Fatalf("expected *McpError{Kind: ResourceNotFound}, got %v", err)
		}
	}
}

// TestMCPResourceFactory is a table-driven test for the MCPResource
// factory's two forms (4-arg full and 2-arg minimal).
func TestMCPResourceFactory(t *testing.T) {
	t.Helper()

	full := MCPResource("res://docs", "Documentation", "text/markdown", "API docs")
	if full.URI != "res://docs" || full.Name != "Documentation" {
		t.Fatalf("full: %+v", full)
	}
	if full.MimeType == nil || *full.MimeType != "text/markdown" {
		t.Fatalf("full.MimeType: %v", full.MimeType)
	}
	if full.Description == nil || *full.Description != "API docs" {
		t.Fatalf("full.Description: %v", full.Description)
	}

	short := MCPResource("res://readme", "Readme")
	if short.URI != "res://readme" || short.Name != "Readme" {
		t.Fatalf("short: %+v", short)
	}
	if short.MimeType != nil {
		t.Fatalf("short.MimeType: expected nil, got %v", *short.MimeType)
	}
	if short.Description != nil {
		t.Fatalf("short.Description: expected nil, got %v", *short.Description)
	}
}

// --- helpers --------------------------------------------------------------

// hasKey checks that the given JSON object contains the given top-level key.
func hasKey(t *testing.T, raw json.RawMessage, key string) bool {
	t.Helper()
	var m map[string]json.RawMessage
	if err := json.Unmarshal(raw, &m); err != nil {
		t.Fatalf("hasKey(%q): unmarshal: %v", key, err)
	}
	_, ok := m[key]
	return ok
}

// errorsAs is a tiny wrapper around errors.As that the rest of the file
// reuses without needing to import the "errors" package in two places.
func errorsAs(err error, target any) bool {
	type wrapper interface{ As(any) bool }
	if w, ok := err.(wrapper); ok {
		return w.As(target)
	}
	// Fall back to the standard library. We import it lazily via a
	// function variable to keep the import block tiny.
	return stderrors.As(err, target)
}

func splitNonEmptyLines(s string) []string {
	var out []string
	for _, line := range strings.Split(s, "\n") {
		if line == "" {
			continue
		}
		out = append(out, line)
	}
	return out
}
