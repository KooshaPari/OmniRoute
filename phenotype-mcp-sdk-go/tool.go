package mcpsdk

import (
	"context"
	"encoding/json"
	"fmt"
)

// ToolHandler is the function signature every MCP tool must implement.
//
// It receives the caller's [context.Context] (so handlers can honour deadlines
// and cancellation) and the raw JSON arguments. The handler returns an
// arbitrary value, which the transport will JSON-encode, or an error to abort
// the call. To surface a structured MCP error, return a *McpError.
type ToolHandler func(ctx context.Context, args json.RawMessage) (any, error)

// Tool is a named operation with a JSON schema and a handler.
//
// This mirrors the Rust struct verbatim, with two Go-flavoured changes:
//
//  1. The handler is a function value rather than a Box<dyn Fn>, so Tool is
//     a value type and can be copied by value (Go slice/string headers are
//     shallow copies). Callers who need to attach a new handler should use
//     [Tool.CloneWithHandler].
//  2. The input schema is [json.RawMessage] so handlers can attach any JSON
//     Schema document without this package pulling in a schema-validation
//     dependency.
type Tool struct {
	Name        string
	Description string
	InputSchema json.RawMessage
	Handler     ToolHandler
}

// NewTool constructs a [Tool]. It is the Go equivalent of Rust's
// `Tool::new(name, description, input_schema, handler)`.
func NewTool(name, description string, inputSchema json.RawMessage, handler ToolHandler) Tool {
	return Tool{
		Name:        name,
		Description: description,
		InputSchema: inputSchema,
		Handler:     handler,
	}
}

// Call invokes the tool's handler with the given arguments. It is a thin
// passthrough that exists so embedders can do `tool.Call(ctx, args)` without
// reaching into the Handler field directly.
func (t Tool) Call(ctx context.Context, args json.RawMessage) (any, error) {
	if t.Handler == nil {
		return nil, &McpError{Kind: KindInternal, Message: fmt.Sprintf("tool %q has no handler", t.Name)}
	}
	return t.Handler(ctx, args)
}

// CloneWithHandler returns a copy of the tool with the metadata (name,
// description, input schema) preserved but the handler replaced. This is the
// Go analogue of Rust's `clone_with_handler`, used when the same tool
// definition needs to be retargeted at a different handler — for example when
// swapping a production handler for a test double.
func (t Tool) CloneWithHandler(handler ToolHandler) Tool {
	return Tool{
		Name:        t.Name,
		Description: t.Description,
		InputSchema: t.InputSchema,
		Handler:     handler,
	}
}

// String returns a one-line, human-readable representation of the tool.
// The handler is omitted (it is a function value and rarely serializes well).
func (t Tool) String() string {
	return fmt.Sprintf("Tool{Name: %q, Description: %q, Schema: %s}", t.Name, t.Description, string(t.InputSchema))
}

// MarshalJSON renders a tool as the JSON object MCP clients expect on the
// wire, e.g.:
//
//	{"name": "echo", "description": "...", "inputSchema": {...}}
//
// The handler is intentionally not serialized; it is server-side state.
func (t Tool) MarshalJSON() ([]byte, error) {
	payload := struct {
		Name        string          `json:"name"`
		Description string          `json:"description"`
		InputSchema json.RawMessage `json:"inputSchema"`
	}{
		Name:        t.Name,
		Description: t.Description,
		InputSchema: t.InputSchema,
	}
	return json.Marshal(payload)
}
