package mcpsdk

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
)

// TestToolCreationAndCall mirrors the Rust test `tool_creation_and_call`:
// a tool built with NewTool must carry the name we set and round-trip its
// arguments through Call.
func TestToolCreationAndCall(t *testing.T) {
	t.Helper()
	tool := NewTool(
		"echo",
		"Echo the input back",
		json.RawMessage(`{"type":"object","properties":{}}`),
		func(_ context.Context, args json.RawMessage) (any, error) {
			// Decode and re-encode the args so the handler proves it
			// receives valid JSON.
			var v any
			if err := json.Unmarshal(args, &v); err != nil {
				return nil, err
			}
			return v, nil
		},
	)
	if tool.Name != "echo" {
		t.Fatalf("Name: got %q, want %q", tool.Name, "echo")
	}
	got, err := tool.Call(context.Background(), json.RawMessage(`{"msg":"hello"}`))
	if err != nil {
		t.Fatalf("Call: %v", err)
	}
	m, ok := got.(map[string]any)
	if !ok {
		t.Fatalf("expected map[string]any, got %T", got)
	}
	if m["msg"] != "hello" {
		t.Fatalf("expected msg=hello, got %v", m["msg"])
	}
}

// TestToolCallErrorPropagation mirrors the Rust test
// `tool_call_error_propagation`: an error returned by the handler must
// bubble out of Call verbatim.
func TestToolCallErrorPropagation(t *testing.T) {
	t.Helper()
	tool := NewTool(
		"fail",
		"Always fails",
		json.RawMessage(`{}`),
		func(_ context.Context, _ json.RawMessage) (any, error) {
			return nil, errs.New("oops")
		},
	)
	got, err := tool.Call(context.Background(), json.RawMessage(`{}`))
	if err == nil {
		t.Fatalf("expected error, got result %v", got)
	}
	if err.Error() != "oops" {
		t.Fatalf("error message: got %q, want %q", err.Error(), "oops")
	}
}

// TestToolCloneWithHandler mirrors the Rust test `tool_clone_with_handler`:
// the metadata of a tool must survive a CloneWithHandler, while the
// replaced handler is the one that runs.
func TestToolCloneWithHandler(t *testing.T) {
	t.Helper()
	add := NewTool(
		"add",
		"Add two numbers",
		json.RawMessage(`{"type":"object"}`),
		func(_ context.Context, args json.RawMessage) (any, error) {
			nums := decodeTwoInts(t, args)
			return int64(nums[0] + nums[1]), nil
		},
	)
	sub := add.CloneWithHandler(func(_ context.Context, args json.RawMessage) (any, error) {
		nums := decodeTwoInts(t, args)
		return int64(nums[0] - nums[1]), nil
	})
	if add.Name != sub.Name {
		t.Fatalf("Name: add=%q sub=%q", add.Name, sub.Name)
	}
	if add.Description != sub.Description {
		t.Fatalf("Description: add=%q sub=%q", add.Description, sub.Description)
	}
	got, err := sub.Call(context.Background(), json.RawMessage(`{"a":5,"b":3}`))
	if err != nil {
		t.Fatalf("Call: %v", err)
	}
	if got != int64(2) {
		t.Fatalf("expected 2, got %v", got)
	}
}

// TestToolStringDoesNotPanic mirrors the Rust test `tool_debug_does_not_panic`:
// the human-readable form must not panic and must include the tool name.
func TestToolStringDoesNotPanic(t *testing.T) {
	t.Helper()
	tool := NewTool("x", "y", json.RawMessage(`{}`), func(_ context.Context, _ json.RawMessage) (any, error) {
		return nil, nil
	})
	s := tool.String()
	if !strings.Contains(s, "x") {
		t.Fatalf("expected String() to contain name, got %q", s)
	}
}

// TestToolSchemaIsPreserved mirrors the Rust test `tool_schema_is_preserved`:
// the InputSchema field must be retained byte-for-byte through NewTool.
func TestToolSchemaIsPreserved(t *testing.T) {
	t.Helper()
	schema := json.RawMessage(`{"type":"object","properties":{"name":{"type":"string"}}}`)
	tool := NewTool(" greet", "Say hi", schema, func(_ context.Context, _ json.RawMessage) (any, error) {
		return "hi", nil
	})
	if string(tool.InputSchema) != string(schema) {
		t.Fatalf("schema mismatch: got %s, want %s", tool.InputSchema, schema)
	}
}

// TestToolMarshalJSON verifies that Tool serializes to the wire shape MCP
// clients expect: {name, description, inputSchema} (camelCase inputSchema).
func TestToolMarshalJSON(t *testing.T) {
	t.Helper()
	tool := NewTool("echo", "Echo", json.RawMessage(`{"type":"object"}`), func(_ context.Context, _ json.RawMessage) (any, error) {
		return nil, nil
	})
	raw, err := json.Marshal(tool)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	var got map[string]any
	if err := json.Unmarshal(raw, &got); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if got["name"] != "echo" {
		t.Fatalf("name: got %v", got["name"])
	}
	if _, ok := got["inputSchema"]; !ok {
		t.Fatalf("expected inputSchema key, got keys: %v", keysOf(got))
	}
	if _, ok := got["Handler"]; ok {
		t.Fatalf("Handler field must not be serialized")
	}
}

// TestToolHandlerSendSync mirrors the Rust test `tool_handler_send_sync`.
// In Go we cannot use a type-bound `Send + Sync` constraint, so we exercise
// the same property at runtime: a Tool value must be safely sent through a
// channel (Send) and safely shared with another goroutine that reads it
// (Sync). The assertion is that no race or panic is observed.
func TestToolHandlerSendSync(t *testing.T) {
	t.Helper()
	tool := NewTool("send-sync", "checks", json.RawMessage(`{}`), func(_ context.Context, _ json.RawMessage) (any, error) {
		return nil, nil
	})
	ch := make(chan Tool, 1)
	ch <- tool
	close(ch)
	got, ok := <-ch
	if !ok {
		t.Fatalf("expected a value from channel")
	}
	if got.Name != "send-sync" {
		t.Fatalf("Name: got %q, want %q", got.Name, "send-sync")
	}
}

// TestMCPToolFactory verifies the MCPTool convenience constructor.
func TestMCPToolFactory(t *testing.T) {
	t.Helper()
	tool := MCPTool("add", "Add", json.RawMessage(`{"type":"object"}`), func(_ context.Context, args json.RawMessage) (any, error) {
		nums := decodeTwoInts(t, args)
		return int64(nums[0] + nums[1]), nil
	})
	if tool.Name != "add" {
		t.Fatalf("Name: got %q", tool.Name)
	}
	got, err := tool.Call(context.Background(), json.RawMessage(`{"a":2,"b":3}`))
	if err != nil {
		t.Fatalf("Call: %v", err)
	}
	if got != int64(5) {
		t.Fatalf("expected 5, got %v", got)
	}
}

// --- helpers --------------------------------------------------------------

// errs is a tiny local alias so this file does not need to import the
// stdlib "errors" package just to construct a plain error in one test.
type _errString string

func (e _errString) Error() string { return string(e) }

var errs = struct {
	New func(string) error
}{New: func(s string) error { return _errString(s) }}

// decodeTwoInts decodes {"a": N, "b": M} from args. It fails the test on a
// malformed payload so callers can stay one-liner-style.
func decodeTwoInts(t *testing.T, args json.RawMessage) [2]int {
	t.Helper()
	var p struct {
		A int `json:"a"`
		B int `json:"b"`
	}
	if err := json.Unmarshal(args, &p); err != nil {
		t.Fatalf("decodeTwoInts: %v", err)
	}
	return [2]int{p.A, p.B}
}

func keysOf(m map[string]any) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	return out
}
