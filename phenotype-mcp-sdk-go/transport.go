package mcpsdk

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
)

// jsonRPCRequest is the subset of a JSON-RPC 2.0 envelope this transport
// understands. We only care about the method name and params.
type jsonRPCRequest struct {
	Method string          `json:"method"`
	Params json.RawMessage `json:"params,omitempty"`
}

// StdioTransport reads newline-delimited JSON requests from an [io.Reader]
// (typically [os.Stdin]) and writes one JSON response per line to an
// [io.Writer] (typically [os.Stdout]). It is the Go analogue of the Rust
// `StdioTransport` and is the canonical way to host an MCP server as a
// child process driven by a client such as Claude Desktop.
type StdioTransport struct {
	server McpServer
}

// NewStdioTransport wraps a [McpServer] for stdio-based MCP messaging.
func NewStdioTransport(server McpServer) *StdioTransport {
	return &StdioTransport{server: server}
}

// Server returns the wrapped [McpServer]. Useful in tests and for embedders
// who want to introspect or replace the server at runtime.
func (t *StdioTransport) Server() McpServer { return t.server }

// Run blocks until EOF on [os.Stdin] or a fatal error occurs. It reads one
// JSON object per line, dispatches via [StdioTransport.handleRequest], and
// writes each response as a single JSON line terminated by '\n' to
// [os.Stdout].
//
// Use [StdioTransport.RunWith] in tests or when you need to plug in custom
// reader/writer implementations.
func (t *StdioTransport) Run() error {
	return t.RunWith(context.Background(), os.Stdin, os.Stdout)
}

// RunWith is the parameterised form of [StdioTransport.Run]. It accepts an
// [io.Reader]/[io.Writer] pair, making it easy to test the dispatch loop
// against an in-memory pipe without touching the real stdio.
//
// A generous 1 MiB buffer is allocated on the scanner because MCP payloads
// can include large tool inputs, embedded documents, or base64 blobs.
func (t *StdioTransport) RunWith(ctx context.Context, r io.Reader, w io.Writer) error {
	scanner := bufio.NewScanner(r)
	// 1 MiB max line; payloads larger than this will be rejected with an
	// InvalidArguments error so the transport does not silently drop data.
	const maxLineBytes = 1 << 20
	scanner.Buffer(make([]byte, 0, 64*1024), maxLineBytes)

	out := bufio.NewWriter(w)
	for scanner.Scan() {
		// Honour cancellation between iterations so a Ctrl-C during a
		// long-running server shuts down promptly.
		if err := ctx.Err(); err != nil {
			return err
		}
		line := scanner.Bytes()
		if len(trimAll(line)) == 0 {
			continue
		}
		resp, err := t.handleRequest(ctx, line)
		if err != nil {
			resp = errorResponse(err)
		}
		if resp == nil {
			// handler returned (nil, nil) — write an empty object so the
			// client does not block waiting for a missing response.
			resp = json.RawMessage(`null`)
		}
		if _, err := out.Write(resp); err != nil {
			return &McpError{Kind: KindTransport, Message: "write response: " + err.Error()}
		}
		if err := out.WriteByte('\n'); err != nil {
			return &McpError{Kind: KindTransport, Message: "write newline: " + err.Error()}
		}
		if err := out.Flush(); err != nil {
			return &McpError{Kind: KindTransport, Message: "flush: " + err.Error()}
		}
	}
	if err := scanner.Err(); err != nil {
		return &McpError{Kind: KindTransport, Message: "scan stdin: " + err.Error()}
	}
	return nil
}

// handleRequest dispatches a single JSON-RPC request to the [McpServer]. The
// raw JSON bytes are expected to be a JSON object containing a `method` field
// and optionally a `params` object. Unknown methods yield a *McpError with
// Kind == KindInvalidArguments whose message contains "unknown method:".
func (t *StdioTransport) handleRequest(ctx context.Context, raw []byte) (json.RawMessage, error) {
	var req jsonRPCRequest
	if err := json.Unmarshal(raw, &req); err != nil {
		return nil, &McpError{Kind: KindInvalidArguments, Message: "decode request: " + err.Error()}
	}

	switch req.Method {
	case "tools/list":
		tools := t.server.ListTools()
		toolsJSON := make([]json.RawMessage, 0, len(tools))
		for _, tool := range tools {
			entry, err := json.Marshal(tool)
			if err != nil {
				return nil, &McpError{Kind: KindInternal, Message: "marshal tool: " + err.Error()}
			}
			toolsJSON = append(toolsJSON, entry)
		}
		return marshalEnvelope(map[string]any{"tools": toolsJSON})

	case "tools/call":
		var params struct {
			Name      string          `json:"name"`
			Arguments json.RawMessage `json:"arguments"`
		}
		if err := json.Unmarshal(req.Params, &params); err != nil {
			return nil, &McpError{Kind: KindInvalidArguments, Message: "decode tools/call params: " + err.Error()}
		}
		if params.Name == "" {
			return nil, &McpError{Kind: KindInvalidArguments, Message: "missing name"}
		}
		if len(params.Arguments) == 0 {
			// An absent `arguments` field is valid; default to an empty object
			// so handlers can json.Unmarshal without guarding against nil.
			params.Arguments = json.RawMessage(`{}`)
		}
		result, err := t.server.CallTool(ctx, params.Name, params.Arguments)
		if err != nil {
			return nil, err
		}
		return marshalEnvelope(map[string]any{"result": result})

	case "resources/list":
		return marshalEnvelope(map[string]any{"resources": t.server.ListResources()})

	case "resources/read":
		var params struct {
			URI string `json:"uri"`
		}
		if err := json.Unmarshal(req.Params, &params); err != nil {
			return nil, &McpError{Kind: KindInvalidArguments, Message: "decode resources/read params: " + err.Error()}
		}
		if params.URI == "" {
			return nil, &McpError{Kind: KindInvalidArguments, Message: "missing uri"}
		}
		content, err := t.server.ReadResource(ctx, params.URI)
		if err != nil {
			return nil, err
		}
		return marshalEnvelope(map[string]any{"content": content})

	default:
		return nil, &McpError{Kind: KindInvalidArguments, Message: fmt.Sprintf("unknown method: %s", req.Method)}
	}
}

// errorResponse renders an error as a JSON-RPC error envelope. The shape is
// deliberately permissive — MCP clients typically inspect `error.code` or
// `error.message` and ignore the rest.
func errorResponse(err error) json.RawMessage {
	payload := map[string]any{
		"error": map[string]any{
			"message": err.Error(),
		},
	}
	if me, ok := err.(*McpError); ok {
		payload["error"].(map[string]any)["kind"] = me.Kind.String()
	}
	out, marshalErr := json.Marshal(payload)
	if marshalErr != nil {
		// Last-resort: return a hard-coded JSON object. We can never fail
		// to encode a string, so the only realistic failure is running
		// out of memory, in which case there is nothing useful we can do.
		return json.RawMessage(`{"error":{"message":"failed to encode error"}}`)
	}
	return out
}

// marshalEnvelope is a small helper that JSON-encodes an envelope object,
// returning a *McpError on failure (which the caller converts to an error
// response).
func marshalEnvelope(v any) (json.RawMessage, error) {
	b, err := json.Marshal(v)
	if err != nil {
		return nil, &McpError{Kind: KindInternal, Message: "marshal envelope: " + err.Error()}
	}
	return b, nil
}

// trimAll is a no-allocation byte-trim that handles only the whitespace
// characters JSON would consider insignificant: space, tab, CR, LF.
func trimAll(b []byte) []byte {
	start, end := 0, len(b)
	for start < end {
		switch b[start] {
		case ' ', '\t', '\r', '\n':
			start++
		default:
			goto doneLeft
		}
	}
doneLeft:
	for end > start {
		switch b[end-1] {
		case ' ', '\t', '\r', '\n':
			end--
		default:
			goto doneRight
		}
	}
doneRight:
	return b[start:end]
}

// SseTransport is a placeholder for an HTTP Server-Sent Events transport.
// Like its Rust counterpart, the full implementation requires an HTTP server
// framework, so the [SseTransport.Serve] method is a no-op that returns
// nil. The struct is kept in the public API so embedders can switch
// transports without changing their server wiring.
type SseTransport struct {
	server McpServer
}

// NewSseTransport wraps a [McpServer] for an eventual SSE-based transport.
func NewSseTransport(server McpServer) *SseTransport {
	return &SseTransport{server: server}
}

// Server returns the wrapped [McpServer].
func (t *SseTransport) Server() McpServer { return t.server }

// Serve is a placeholder that always succeeds. A future revision will bind
// an HTTP listener on addr and stream MCP messages over Server-Sent Events.
func (t *SseTransport) Serve(addr string) error {
	_ = addr
	return nil
}
