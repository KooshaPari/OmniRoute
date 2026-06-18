package mcpsdk

import (
	"context"
	"encoding/json"
)

// McpServer is the core interface every MCP server implementation must satisfy.
//
// It mirrors the Rust trait verbatim:
//
//	pub trait McpServer: Send + Sync {
//	    async fn list_tools(&self) -> Vec<Tool>;
//	    async fn call_tool(&self, name: &str, arguments: Value) -> Result<Value, McpError>;
//	    async fn list_resources(&self) -> Vec<Resource>;
//	    async fn read_resource(&self, uri: &str) -> Result<ResourceContent, McpError>;
//	}
//
// In Go, "async" is expressed by accepting a [context.Context] as the first
// argument to the methods that conceptually suspend (call tool, read resource).
// The context may be honoured for cancellation and tracing, or simply ignored
// for purely synchronous handlers.
type McpServer interface {
	// ListTools returns the full catalog of tools exposed by this server.
	ListTools() []Tool

	// CallTool invokes the named tool with the given JSON arguments and
	// returns the handler's result. Implementations should return a
	// *McpError with Kind == KindToolNotFound when no such tool exists.
	CallTool(ctx context.Context, name string, args json.RawMessage) (any, error)

	// ListResources returns the full catalog of resources exposed by this server.
	ListResources() []Resource

	// ReadResource resolves the given URI to a [ResourceContent]. Implementations
	// should return a *McpError with Kind == KindResourceNotFound when the URI
	// is not known.
	ReadResource(ctx context.Context, uri string) (ResourceContent, error)
}

// McpServerBase is a small, embeddable helper that implements [McpServer] for
// servers whose tools and resources are static and known up-front. Embed it in
// a concrete server type and override the methods only when custom logic is
// needed:
//
//	type MyServer struct {
//	    McpServerBase
//	}
//
//	func (s *MyServer) ListResources() []Resource {
//	    return append(s.McpServerBase.ListResources(), extraResources()...)
//	}
//
// The zero value is a valid, empty server.
type McpServerBase struct {
	Tools     []Tool
	Resources []Resource
}

// ListTools returns the configured tools. Satisfies [McpServer].
func (b *McpServerBase) ListTools() []Tool { return b.Tools }

// ListResources returns the configured resources. Satisfies [McpServer].
func (b *McpServerBase) ListResources() []Resource { return b.Resources }

// CallTool looks up the named tool in [McpServerBase.Tools] and, if found,
// delegates to its handler. Returns a *McpError with Kind == KindToolNotFound
// when the tool is not registered. Satisfies [McpServer].
func (b *McpServerBase) CallTool(ctx context.Context, name string, args json.RawMessage) (any, error) {
	for _, t := range b.Tools {
		if t.Name == name {
			return t.Call(ctx, args)
		}
	}
	return nil, &McpError{Kind: KindToolNotFound, Message: name}
}

// ReadResource is a stub that always reports the URI as not found. Embedders
// are expected to override this once they start exposing resources. Satisfies
// [McpServer].
func (b *McpServerBase) ReadResource(ctx context.Context, uri string) (ResourceContent, error) {
	return ResourceContent{}, &McpError{Kind: KindResourceNotFound, Message: uri}
}
