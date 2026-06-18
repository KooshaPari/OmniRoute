// Package mcpsdk provides a small, pluggable Model Context Protocol (MCP) server
// surface for Go. It is a 1:1 Go port of the Rust phenotype-mcp-sdk-rs crate and
// exposes:
//
//   - [McpServer] — the core server interface (list tools, call tool, list resources, read resource).
//   - [Tool]      — a named operation with a JSON schema and a handler.
//   - [Resource]  / [ResourceContent] — resource descriptors and read results.
//   - [StdioTransport] / [SseTransport] — transports for delivering MCP messages.
//   - [MCPTool] / [MCPResource] — convenience factory functions (Go has no macros, so
//     these are regular functions that mirror the Rust declarative macros).
//
// The package depends only on the Go standard library.
package mcpsdk

import (
	"encoding/json"
	"fmt"
)

// ErrorKind classifies an [McpError] into one of the five canonical MCP failure modes.
type ErrorKind int

const (
	// KindToolNotFound is returned when a requested tool name is not registered.
	KindToolNotFound ErrorKind = iota
	// KindResourceNotFound is returned when a requested resource URI is not registered.
	KindResourceNotFound
	// KindInvalidArguments is returned when a request payload is malformed or missing
	// required parameters.
	KindInvalidArguments
	// KindTransport wraps I/O and protocol-level transport errors.
	KindTransport
	// KindInternal is the catch-all for unexpected server-side failures.
	KindInternal
)

// String returns a short, lower-case label for the kind, suitable for logs.
func (k ErrorKind) String() string {
	switch k {
	case KindToolNotFound:
		return "tool not found"
	case KindResourceNotFound:
		return "resource not found"
	case KindInvalidArguments:
		return "invalid arguments"
	case KindTransport:
		return "transport error"
	case KindInternal:
		return "internal error"
	default:
		return fmt.Sprintf("unknown kind(%d)", int(k))
	}
}

// McpError is the canonical error type returned by MCP server and transport operations.
//
// It mirrors the Rust enum:
//
//	pub enum McpError {
//	    ToolNotFound(String),
//	    ResourceNotFound(String),
//	    InvalidArguments(String),
//	    Transport(String),
//	    Internal(String),
//	}
//
// In Go the variant is carried in [McpError.Kind] and the contextual detail in
// [McpError.Message]. Use [errors.As] to extract it from an error chain:
//
//	if me := new(McpError); errors.As(err, &me) && me.Kind == mcpsdk.KindToolNotFound {
//	    // ...
//	}
type McpError struct {
	// Kind identifies which MCP failure variant this error represents.
	Kind ErrorKind
	// Message is the human-readable detail (the payload of the Rust variant).
	Message string
}

// Error implements the standard [error] interface. The format matches the Rust
// thiserror Display strings, e.g. "tool not found: foo", so log scrapers that
// match against the Rust SDK's messages keep working.
func (e *McpError) Error() string {
	if e == nil {
		return "<nil mcp error>"
	}
	return e.Kind.String() + ": " + e.Message
}

// Is enables [errors.Is] comparisons between two McpError values that share a
// Kind and an identical Message.
func (e *McpError) Is(target error) bool {
	other, ok := target.(*McpError)
	if !ok || other == nil || e == nil {
		return false
	}
	return e.Kind == other.Kind && e.Message == other.Message
}

// Resource is a discoverable item exposed by an MCP server.
//
// Optional fields are pointers so they can be omitted from JSON output via
// `omitempty`. This matches the Rust Option<String> representation.
type Resource struct {
	URI         string  `json:"uri"`
	Name        string  `json:"name"`
	MimeType    *string `json:"mime_type,omitempty"`
	Description *string `json:"description,omitempty"`
}

// ResourceContent is the body returned by a successful [McpServer.ReadResource] call.
//
// Exactly one of Text or Blob is normally populated. Blob is typed as
// [json.RawMessage] so the field can carry either a base64-encoded string or
// any other JSON-shaped payload (e.g. nested objects for structured resources).
type ResourceContent struct {
	URI      string          `json:"uri"`
	MimeType *string         `json:"mime_type,omitempty"`
	Text     *string         `json:"text,omitempty"`
	Blob     json.RawMessage `json:"blob,omitempty"`
}

// ServerCapabilities advertises which MCP surfaces a server implements.
//
// The booleans use `omitempty` so a server that does not implement, say,
// prompts does not emit `"prompts": false` in its initialize handshake.
type ServerCapabilities struct {
	Tools     bool `json:"tools,omitempty"`
	Resources bool `json:"resources,omitempty"`
	Prompts   bool `json:"prompts,omitempty"`
}

// ServerInfo is the identity and capability bundle returned during the MCP
// initialize handshake.
type ServerInfo struct {
	Name         string             `json:"name"`
	Version      string             `json:"version"`
	Capabilities ServerCapabilities `json:"capabilities"`
}
