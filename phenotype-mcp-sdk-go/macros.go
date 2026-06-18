package mcpsdk

import (
	"encoding/json"
)

// MCPTool is a convenience factory that builds a [Tool]. It exists to give
// users porting from the Rust mcp_tool! macro a familiar call site:
//
//	// Rust
//	let t = mcp_tool!("add", "Add two numbers", {"type":"object"}, |args| ...);
//
//	// Go
//	t := mcpsdk.MCPTool("add", "Add two numbers",
//	    json.RawMessage(`{"type":"object"}`),
//	    func(ctx context.Context, args json.RawMessage) (any, error) { ... })
//
// The function is a thin alias for [NewTool]; it is provided for naming
// symmetry with the Rust crate's `mcp_tool!` macro.
func MCPTool(name, description string, schema json.RawMessage, handler ToolHandler) Tool {
	return NewTool(name, description, schema, handler)
}

// MCPResource builds a [Resource]. It mirrors the Rust mcp_resource! macro,
// which has two forms: a 4-argument form that sets MimeType and Description,
// and a 2-argument form that leaves them nil. In Go we use variadic
// parameters to express the optional trailing arguments:
//
//	r  := mcpsdk.MCPResource("res://docs", "Documentation")                      // short form
//	r2 := mcpsdk.MCPResource("res://docs", "Documentation", "text/markdown", ...) // full form
//
// Exactly 0, 1, or 2 trailing arguments are accepted. Any other count is a
// programmer error; the function panics in that case so the bug is caught
// at construction time rather than at the first request.
func MCPResource(uri, name string, opts ...string) Resource {
	switch len(opts) {
	case 0:
		return Resource{URI: uri, Name: name}
	case 1:
		mime := opts[0]
		return Resource{URI: uri, Name: name, MimeType: &mime}
	case 2:
		mime, desc := opts[0], opts[1]
		return Resource{URI: uri, Name: name, MimeType: &mime, Description: &desc}
	default:
		panic("MCPResource: expected 0, 1, or 2 optional arguments (mime, desc)")
	}
}
