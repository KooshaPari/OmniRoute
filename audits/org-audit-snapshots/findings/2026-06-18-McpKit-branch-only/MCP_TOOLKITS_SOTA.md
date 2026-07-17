# MCP Toolkits: State of the Art Research

**Document ID:** PHENOTYPE_MCPKIT_SOTA_001  
**Status:** Active Research  
**Last Updated:** 2026-04-03  
**Author:** Phenotype Architecture Team

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Model Context Protocol Landscape](#2-model-context-protocol-landscape)
3. [Protocol Specification Analysis](#3-protocol-specification-analysis)
4. [Transport Mechanisms Deep Dive](#4-transport-mechanisms-deep-dive)
5. [Official MCP SDK Implementations](#5-official-mcp-sdk-implementations)
6. [Third-Party MCP Toolkits](#6-third-party-mcp-toolkits)
7. [AI Agent Tool Frameworks Comparison](#7-ai-agent-tool-frameworks-comparison)
8. [Language-Specific Implementation Analysis](#8-language-specific-implementation-analysis)
9. [Architecture Patterns](#9-architecture-patterns)
10. [Security Considerations](#10-security-considerations)
11. [Performance Benchmarks](#11-performance-benchmarks)
12. [Tool Discovery and Registry Patterns](#12-tool-discovery-and-registry-patterns)
13. [Resource Management Systems](#13-resource-management-systems)
14. [Prompt and Sampling Integration](#14-prompt-and-sampling-integration)
15. [Streaming and Pagination](#15-streaming-and-pagination)
16. [Error Handling Strategies](#16-error-handling-strategies)
17. [Testing and Quality Assurance](#17-testing-and-quality-assurance)
18. [Deployment Patterns](#18-deployment-patterns)
19. [Ecosystem and Tooling](#19-ecosystem-and-tooling)
20. [Future Directions and Emerging Trends](#20-future-directions-and-emerging-trends)
21. [Comparison Matrices](#21-comparison-matrices)
22. [Code Examples by Language](#22-code-examples-by-language)
23. [References](#23-references)

---

## 1. Executive Summary

The Model Context Protocol (MCP) has emerged as the de facto standard for AI-to-tool communication, providing a unified interface for Large Language Models (LLMs) to interact with external tools, resources, and contextual data. Originally developed by Anthropic and released as an open specification in late 2024, MCP has rapidly gained adoption across the AI ecosystem.

This comprehensive State of the Art (SOTA) research analyzes the MCP toolkit landscape, evaluating protocol implementations, SDK ecosystems, architectural patterns, and emerging trends across multiple programming languages. The research covers:

- **Protocol Foundations**: JSON-RPC 2.0 based communication with SSE and stdio transports
- **Official SDKs**: TypeScript, Python, Kotlin, and Java implementations by Anthropic
- **Third-Party Toolkits**: Community-driven implementations in Rust, Go, Ruby, and more
- **Competitive Analysis**: Comparison with OpenAI Function Calling, LangChain Tools, Semantic Kernel
- **Architecture Patterns**: Server design, tool registries, resource providers, and transport layers
- **Security Models**: Authentication, authorization, sandboxing, and input validation
- **Performance Considerations**: Latency, throughput, and resource utilization
- **Ecosystem Maturity**: Tool availability, community adoption, and integration patterns

### Key Findings

1. **MCP is the leading open protocol** for AI tool integration, with adoption growing exponentially since its release
2. **Multi-language support is critical** - production systems require implementations across Python, TypeScript, Go, and Rust
3. **Transport flexibility** (SSE + stdio) enables both local and distributed deployment scenarios
4. **Tool registry design** significantly impacts developer experience and system maintainability
5. **Security remains a primary concern** - sandboxing, input validation, and permission models are essential
6. **SDK generation from protocol specs** reduces implementation drift and ensures compliance

### McpKit Positioning

McpKit is positioned as a multi-language MCP toolkit within the Phenotype ecosystem, providing:

- **Python SDK** (`pheno-mcp`): Full-featured implementation with decorators, resource schemes, and agent adapters
- **Go SDK**: Protocol-compliant server and client implementations
- **TypeScript SDK**: Node.js and browser-compatible implementations
- **Rust Implementation**: High-performance protocol types via `mcp-forge` generator
- **Registry System**: YAML-based tool and resource registry for discovery and configuration

---

## 2. Model Context Protocol Landscape

### 2.1 Protocol Genesis and Evolution

The Model Context Protocol emerged from a fundamental problem in the AI ecosystem: the lack of a standardized way for AI models to interact with external tools and data sources.

#### Pre-MCP Era (2020-2024)

Before MCP, the AI tool integration landscape was fragmented:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Pre-MCP Tool Integration                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │  OpenAI      │    │  LangChain   │    │  Custom      │       │
│  │  Functions   │    │  Tools       │    │  Adapters    │       │
│  │              │    │              │    │              │       │
│  │ • Proprietary│    │ • In-process │    │ • Per-model  │       │
│  │ • HTTP only  │    │ • Python     │    │ • Fragile    │       │
│  │ • Stateless  │    │ • Tightly    │    │ • No std     │       │
│  │              │    │   coupled    │    │              │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│                                                                 │
│  Problems:                                                      │
│  • No interoperability between platforms                        │
│  • Tool definitions duplicated across frameworks                │
│  • No standard discovery mechanism                              │
│  • Vendor lock-in for tool developers                           │
│  • Inconsistent error handling and response formats             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Key pain points:**
- **OpenAI Function Calling**: Proprietary, HTTP-only, tied to OpenAI models
- **LangChain Tools**: Python-only, in-process, tightly coupled to LangChain runtime
- **Semantic Kernel**: Microsoft-specific, mixed transport support
- **Custom Adapters**: Per-model implementations, no standardization

#### MCP Standardization (2024-Present)

Anthropic's release of MCP addressed these fragmentation issues:

```
┌─────────────────────────────────────────────────────────────────┐
│                    MCP Standardized Architecture                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐         MCP Protocol         ┌─────────────┐   │
│  │   MCP       │◄────────────────────────────►│   MCP       │   │
│  │   Client    │    JSON-RPC 2.0 over SSE     │   Server    │   │
│  │             │         or stdio             │             │   │
│  │ • Claude    │                              │ • Tools     │   │
│  │ • IDE       │    ┌──────────────────┐      │ • Resources │   │
│  │ • CLI       │    │  Discovery       │      │ • Prompts   │   │
│  │ • Custom    │    │  Initialization  │      │ • Sampling  │   │
│  │             │    │  Tool Execution  │      │ • Logging   │   │
│  │             │    │  Notifications   │      │             │   │
│  └─────────────┘    └──────────────────┘      └─────────────┘   │
│                                                                 │
│  Benefits:                                                      │
│  • Open specification - any language, any platform               │
│  • Standardized tool discovery and execution                    │
│  • Resource access with URI-based addressing                    │
│  • Bidirectional communication with notifications               │
│  • Capability negotiation during initialization                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Protocol Timeline

| Date | Milestone | Significance |
|------|-----------|-------------|
| Nov 2024 | MCP 1.0 Released | Initial protocol specification |
| Nov 2024 | TypeScript SDK | First official SDK release |
| Dec 2024 | Python SDK | Official Python implementation |
| Jan 2025 | Protocol Version 2024-11-05 | Standardized version string |
| Q1 2025 | Community Implementations | Rust, Go, Ruby SDKs emerge |
| Q2 2025 | Enterprise Adoption | Major platforms adopt MCP |
| 2026 | Multi-Modal Extensions | Image, audio, video content types |

### 2.3 Protocol Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                          MCP Protocol Stack                           │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                    Application Layer                             │  │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌─────────────┐  │  │
│  │  │   Tools   │  │Resources  │  │  Prompts  │  │  Sampling   │  │  │
│  │  │           │  │           │  │           │  │             │  │  │
│  │  │ • list    │  │ • list    │  │ • get     │  │ • create    │  │  │
│  │  │ • call    │  │ • read    │  │ • list    │  │             │  │  │
│  │  │           │  │ • sub     │  │           │  │             │  │  │
│  │  └───────────┘  └───────────┘  └───────────┘  └─────────────┘  │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                    Protocol Layer                                │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │  │
│  │  │ Initialize   │  │ Capabilities │  │  Notifications       │   │  │
│  │  │              │  │              │  │                      │   │  │
│  │  │ Version      │  │ Negotiation  │  │ • roots/listChanged  │   │  │
│  │  │ Handshake    │  │ Feature      │  │ • tools/listChanged  │   │  │
│  │  │              │  │ Detection    │  │ • resources/changed  │   │  │
│  │  └──────────────┘  └──────────────┘  └──────────────────────┘   │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                    Transport Layer                               │  │
│  │  ┌──────────────────────────┐  ┌──────────────────────────────┐  │  │
│  │  │    Server-Sent Events   │  │       Standard I/O           │  │  │
│  │  │    (SSE)                │  │       (stdio)                │  │  │
│  │  │                         │  │                              │  │  │
│  │  │ • HTTP-based            │  │ • Process-based              │  │  │
│  │  │ • Server-to-client      │  │ • Bidirectional              │  │  │
│  │  │   streaming             │  │ • Local deployment           │  │  │
│  │  │ • Remote deployment     │  │ • IDE integration            │  │  │
│  │  └──────────────────────────┘  └──────────────────────────────┘  │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                    Message Layer                                 │  │
│  │                                                                 │  │
│  │  JSON-RPC 2.0                                                   │  │
│  │  • Request/Response pattern                                     │  │
│  │  • Notification (fire-and-forget)                               │  │
│  │  • Error codes and messages                                     │  │
│  │  • Batch requests                                               │  │
│  │                                                                 │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

### 2.4 Core Protocol Concepts

#### 2.4.1 Client-Server Model

MCP follows a client-server architecture where:

- **MCP Host**: The application that initiates connections (Claude Desktop, IDE, CLI)
- **MCP Client**: Protocol client within the host that manages connections
- **MCP Server**: External process providing tools, resources, and prompts

```
┌─────────────────────────────────────────────────────────────────┐
│                        MCP Host Application                      │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │                    MCP Client                              │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌───────────────────┐  │   │
│  │  │ Connection  │  │  Message    │  │  Capability       │  │   │
│  │  │ Manager     │  │  Router     │  │  Negotiator       │  │   │
│  │  └─────────────┘  └─────────────┘  └───────────────────┘  │   │
│  └───────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┼─────────┐
                    │         │         │
              ┌─────▼────┐ ┌──▼────┐ ┌─▼────────┐
              │ Server 1 │ │Server2│ │ Server N │
              │ (Tools)  │ │(Resrc)│ │(Prompts) │
              └──────────┘ └───────┘ └──────────┘
```

#### 2.4.2 Capability Negotiation

During initialization, client and server exchange capabilities:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "roots": {
        "listChanged": true
      }
    },
    "clientInfo": {
      "name": "phenotype-host",
      "version": "1.0.0"
    }
  }
}
```

Server response:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "tools": { "listChanged": true },
      "resources": {
        "subscribe": true,
        "listChanged": true
      },
      "prompts": { "listChanged": false }
    },
    "serverInfo": {
      "name": "mcpkit-server",
      "version": "0.1.0"
    }
  }
}
```

---

## 3. Protocol Specification Analysis

### 3.1 JSON-RPC 2.0 Foundation

MCP is built on JSON-RPC 2.0, a lightweight remote procedure call protocol. The specification defines:

#### 3.1.1 Request Structure

```json
{
  "jsonrpc": "2.0",
  "id": <unique-identifier>,
  "method": "<method-name>",
  "params": { ... }
}
```

#### 3.1.2 Response Structure

Success:
```json
{
  "jsonrpc": "2.0",
  "id": <matching-request-id>,
  "result": { ... }
}
```

Error:
```json
{
  "jsonrpc": "2.0",
  "id": <matching-request-id>,
  "error": {
    "code": <error-code>,
    "message": "<error-description>",
    "data": <optional-details>
  }
}
```

#### 3.1.3 Notification Structure

```json
{
  "jsonrpc": "2.0",
  "method": "<notification-method>",
  "params": { ... }
}
```

### 3.2 Standard Error Codes

| Code | Name | Description |
|------|------|-------------|
| -32700 | Parse error | Invalid JSON was received |
| -32600 | Invalid request | The JSON sent is not a valid Request object |
| -32601 | Method not found | The method does not exist / is not available |
| -32602 | Invalid params | Invalid method parameter(s) |
| -32603 | Internal error | Internal JSON-RPC error |
| -32000 to -32099 | Server error | Reserved for implementation-defined server errors |

### 3.3 MCP-Specific Methods

#### 3.3.1 Lifecycle Methods

| Method | Direction | Description |
|--------|-----------|-------------|
| `initialize` | Client → Server | Initialize connection, negotiate capabilities |
| `notifications/initialized` | Client → Server | Signal initialization complete |
| `ping` | Either → Either | Health check / keepalive |

#### 3.3.2 Tool Methods

| Method | Direction | Description |
|--------|-----------|-------------|
| `tools/list` | Client → Server | List available tools |
| `tools/call` | Client → Server | Execute a tool |
| `notifications/tools/list_changed` | Server → Client | Notify tools have changed |

#### 3.3.3 Resource Methods

| Method | Direction | Description |
|--------|-----------|-------------|
| `resources/list` | Client → Server | List available resources |
| `resources/read` | Client → Server | Read a resource |
| `resources/subscribe` | Client → Server | Subscribe to resource changes |
| `resources/unsubscribe` | Client → Server | Unsubscribe from resource |
| `notifications/resources/list_changed` | Server → Client | Notify resources changed |
| `notifications/resources/updated` | Server → Client | Notify resource updated |

#### 3.3.4 Prompt Methods

| Method | Direction | Description |
|--------|-----------|-------------|
| `prompts/list` | Client → Server | List available prompts |
| `prompts/get` | Client → Server | Get a prompt with arguments |
| `notifications/prompts/list_changed` | Server → Client | Notify prompts changed |

#### 3.3.5 Root Methods

| Method | Direction | Description |
|--------|-----------|-------------|
| `roots/list` | Server → Client | List client roots |
| `notifications/roots/list_changed` | Client → Server | Notify roots changed |

#### 3.3.6 Sampling Methods

| Method | Direction | Description |
|--------|-----------|-------------|
| `sampling/createMessage` | Server → Client | Request LLM sampling |
| `sampling/createMessageBatch` | Server → Client | Batch sampling request |

### 3.4 Content Types

#### 3.4.1 Text Content

```json
{
  "type": "text",
  "text": "Hello, world!"
}
```

#### 3.4.2 Image Content

```json
{
  "type": "image",
  "data": "<base64-encoded-data>",
  "mimeType": "image/png"
}
```

#### 3.4.3 Embedded Resources

```json
{
  "type": "resource",
  "resource": {
    "uri": "file:///path/to/file.txt",
    "mimeType": "text/plain",
    "text": "File contents"
  }
}
```

---

## 4. Transport Mechanisms Deep Dive

### 4.1 Server-Sent Events (SSE)

SSE provides a unidirectional streaming channel from server to client, with a separate HTTP POST endpoint for client-to-server communication.

#### 4.1.1 SSE Architecture

```
┌──────────────┐                          ┌──────────────┐
│   MCP Host   │                          │  MCP Server  │
│   (Client)   │                          │              │
│              │  GET /sse                │              │
│              │─────────────────────────►│              │
│              │  text/event-stream       │              │
│              │◄─────────────────────────│              │
│              │                          │              │
│              │  POST /message           │              │
│              │─────────────────────────►│              │
│              │  application/json        │              │
│              │◄─────────────────────────│  202 Accepted│
└──────────────┘                          └──────────────┘
```

#### 4.1.2 SSE Implementation (TypeScript)

```typescript
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";

const app = express();

app.get("/sse", async (req, res) => {
  const transport = new SSEServerTransport("/message", res);
  await server.connect(transport);
});

app.post("/message", async (req, res) => {
  const sessionId = req.query.sessionId as string;
  const transport = transports.get(sessionId);
  if (transport) {
    await transport.handlePostMessage(req, res);
  }
});

app.listen(3000);
```

#### 4.1.3 SSE Implementation (Python)

```python
from mcp.server.fastmcp import FastMCP
from mcp.server.sse import SseServerTransport
from starlette.applications import Starlette
from starlette.routing import Route

mcp = FastMCP("my-server")
sse = SseServerTransport("/message")

async def handle_sse(scope, receive, send):
    async with sse.connect_sse(scope, receive, send) as streams:
        await mcp._mcp_server.run(
            streams[0],
            streams[1],
            mcp._mcp_server.create_initialization_options(),
        )

async def handle_message(scope, receive, send):
    await sse.handle_post_message(scope, receive, send)

app = Starlette(
    routes=[
        Route("/sse", endpoint=handle_sse),
        Route("/message", endpoint=handle_message, methods=["POST"]),
    ]
)
```

#### 4.1.4 SSE Implementation (Go)

```go
package main

import (
    "encoding/json"
    "net/http"
    "sync"
)

type SSETransport struct {
    sessions    map[string]*SSESession
    mu          sync.RWMutex
}

type SSESession struct {
    ID          string
    MessageChan chan json.RawMessage
    Done        chan struct{}
}

func (t *SSETransport) HandleSSE(w http.ResponseWriter, r *http.Request) {
    session := &SSESession{
        ID:          generateSessionID(),
        MessageChan: make(chan json.RawMessage, 100),
        Done:        make(chan struct{}),
    }

    t.mu.Lock()
    t.sessions[session.ID] = session
    t.mu.Unlock()

    // Set SSE headers
    w.Header().Set("Content-Type", "text/event-stream")
    w.Header().Set("Cache-Control", "no-cache")
    w.Header().Set("Connection", "keep-alive")
    w.Header().Set("Access-Control-Allow-Origin", "*")

    flusher := w.(http.Flusher)
    fmt.Fprintf(w, "event: endpoint\ndata: /message?sessionId=%s\n\n", session.ID)
    flusher.Flush()

    // Send messages to client
    for {
        select {
        case msg := <-session.MessageChan:
            fmt.Fprintf(w, "event: message\ndata: %s\n\n", string(msg))
            flusher.Flush()
        case <-r.Context().Done():
            t.mu.Lock()
            delete(t.sessions, session.ID)
            t.mu.Unlock()
            close(session.Done)
            return
        }
    }
}

func (t *SSETransport) HandleMessage(w http.ResponseWriter, r *http.Request) {
    sessionID := r.URL.Query().Get("sessionId")
    t.mu.RLock()
    session, ok := t.sessions[sessionID]
    t.mu.RUnlock()

    if !ok {
        http.Error(w, "Session not found", http.StatusNotFound)
        return
    }

    var msg json.RawMessage
    if err := json.NewDecoder(r.Body).Decode(&msg); err != nil {
        http.Error(w, err.Error(), http.StatusBadRequest)
        return
    }

    select {
    case session.MessageChan <- msg:
        w.WriteHeader(http.StatusAccepted)
    case <-session.Done:
        http.Error(w, "Session closed", http.StatusGone)
    }
}
```

### 4.2 Standard I/O (stdio)

stdio transport enables local process communication, ideal for IDE integrations and CLI tools.

#### 4.2.1 stdio Architecture

```
┌──────────────┐                          ┌──────────────┐
│   MCP Host   │                          │  MCP Server  │
│   (Parent)   │                          │  (Child)     │
│              │                          │              │
│  stdout      │◄──── JSON-RPC Lines ──── │  stdin       │
│              │                          │              │
│  stdin       │──── JSON-RPC Lines ────► │  stdout      │
│              │                          │              │
│              │──── Process Spawn ──────► │              │
└──────────────┘                          └──────────────┘
```

#### 4.2.2 stdio Implementation (TypeScript)

```typescript
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const transport = new StdioServerTransport();
await server.connect(transport);
```

#### 4.2.3 stdio Implementation (Python)

```python
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("my-server")

if __name__ == "__main__":
    mcp.run(transport="stdio")
```

#### 4.2.4 stdio Implementation (Go)

```go
package main

import (
    "bufio"
    "encoding/json"
    "fmt"
    "os"
)

type StdioTransport struct {
    scanner *bufio.Scanner
    writer  *json.Encoder
}

func NewStdioTransport() *StdioTransport {
    return &StdioTransport{
        scanner: bufio.NewScanner(os.Stdin),
        writer:  json.NewEncoder(os.Stdout),
    }
}

func (t *StdioTransport) ReadMessage() (json.RawMessage, error) {
    if !t.scanner.Scan() {
        return nil, t.scanner.Err()
    }
    return json.RawMessage(t.scanner.Text()), nil
}

func (t *StdioTransport) WriteMessage(msg json.RawMessage) error {
    return t.writer.Encode(msg)
}

func (t *StdioTransport) Run(handler MessageHandler) error {
    for {
        msg, err := t.ReadMessage()
        if err != nil {
            return err
        }
        response, err := handler(msg)
        if err != nil {
            return err
        }
        if err := t.WriteMessage(response); err != nil {
            return err
        }
    }
}
```

### 4.3 Transport Comparison

| Feature | SSE | stdio |
|---------|-----|-------|
| Direction | Bidirectional (SSE + POST) | Bidirectional |
| Deployment | Remote/Network | Local/Process |
| Scalability | Multi-session | Single session |
| Latency | Network-dependent | Minimal |
| Security | TLS, Auth tokens | Process isolation |
| Use Cases | Cloud services, APIs | IDE plugins, CLI tools |
| Complexity | Higher (HTTP server) | Lower (stdin/stdout) |
| Debugging | HTTP logs, network tools | Process stdout/stderr |

### 4.4 Emerging Transports

#### 4.4.1 WebSocket Transport (Proposed)

```typescript
// Conceptual WebSocket transport
import WebSocket from "ws";

class WebSocketTransport {
  private ws: WebSocket;

  async connect(url: string): Promise<void> {
    this.ws = new WebSocket(url);
    this.ws.on("message", (data) => {
      this.handleMessage(JSON.parse(data.toString()));
    });
  }

  async send(message: JsonRpcMessage): Promise<void> {
    this.ws.send(JSON.stringify(message));
  }
}
```

#### 4.4.2 HTTP Stream Transport (Proposed)

```python
# Conceptual HTTP/2 stream transport
import httpx

class HttpStreamTransport:
    async def connect(self, url: str):
        async with httpx.AsyncClient(http2=True) as client:
            async with client.stream("POST", url) as response:
                async for chunk in response.aiter_text():
                    yield self.parse_message(chunk)
```

---

## 5. Official MCP SDK Implementations

### 5.1 TypeScript SDK (@modelcontextprotocol/sdk)

The reference implementation, maintained by Anthropic.

#### 5.1.1 Package Structure

```
@modelcontextprotocol/sdk/
├── src/
│   ├── client/
│   │   ├── index.ts          # Client implementation
│   │   └── stdio.ts          # stdio transport
│   ├── server/
│   │   ├── index.ts          # Server implementation
│   │   ├── stdio.ts          # stdio transport
│   │   └── sse.ts            # SSE transport
│   ├── types.ts              # Protocol types
│   └── shared/
│       └── protocol.ts       # Shared protocol logic
└── package.json
```

#### 5.1.2 Server Creation

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const server = new McpServer({
  name: "example-server",
  version: "1.0.0",
});

server.tool(
  "calculate",
  "Perform mathematical calculations",
  {
    expression: z.string().describe("Math expression to evaluate"),
  },
  async ({ expression }) => {
    const result = eval(expression);
    return {
      content: [{ type: "text", text: String(result) }],
    };
  }
);

server.resource(
  "config",
  "config://app.json",
  async (uri) => ({
    contents: [{
      uri: uri.href,
      mimeType: "application/json",
      text: JSON.stringify({ key: "value" }),
    }],
  })
);
```

#### 5.1.3 Client Usage

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "node",
  args: ["server.js"],
});

const client = new Client({
  name: "example-client",
  version: "1.0.0",
}, {
  capabilities: {
    tools: {},
  },
});

await client.connect(transport);

// List tools
const tools = await client.listTools();

// Call tool
const result = await client.callTool({
  name: "calculate",
  arguments: { expression: "2 + 2" },
});
```

### 5.2 Python SDK (mcp)

Official Python implementation with FastMCP high-level API.

#### 5.2.1 Package Structure

```
mcp/
├── src/mcp/
│   ├── server/
│   │   ├── __init__.py
│   │   ├── fastmcp.py        # High-level FastMCP API
│   │   ├── lowlevel.py       # Low-level server API
│   │   └── sse.py            # SSE transport
│   ├── client/
│   │   ├── __init__.py
│   │   └── session.py        # Client session
│   ├── shared/
│   │   └── context.py        # Shared context
│   └── types.py              # Protocol types
└── pyproject.toml
```

#### 5.2.2 FastMCP Server

```python
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("My Server")

@mcp.tool()
def calculate(expression: str) -> str:
    """Perform mathematical calculations."""
    return str(eval(expression))

@mcp.resource("config://app")
def get_config() -> str:
    """Application configuration."""
    return '{"key": "value"}'

@mcp.prompt()
def analyze_code(code: str) -> str:
    """Prompt for code analysis."""
    return f"Analyze this code:\n\n{code}"

if __name__ == "__main__":
    mcp.run()
```

#### 5.2.3 Low-Level Server

```python
from mcp.server import Server
from mcp.server.models import InitializationOptions
from mcp.types import (
    Tool,
    TextContent,
    CallToolResult,
)
import mcp.server.stdio

server = Server("my-server")

@server.list_tools()
async def list_tools() -> list[Tool]:
    return [
        Tool(
            name="calculate",
            description="Perform calculations",
            inputSchema={
                "type": "object",
                "properties": {
                    "expression": {"type": "string"}
                },
                "required": ["expression"],
            },
        )
    ]

@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    if name == "calculate":
        result = eval(arguments["expression"])
        return [TextContent(type="text", text=str(result))]
    raise ValueError(f"Unknown tool: {name}")

if __name__ == "__main__":
    import asyncio
    asyncio.run(server.run(
        mcp.server.stdio.stdio_server(),
        InitializationOptions(
            server_name="my-server",
            server_version="1.0.0",
            capabilities=server.get_capabilities(
                notification_options={},
                experimental_capabilities={},
            ),
        ),
    ))
```

### 5.3 Kotlin SDK

#### 5.3.1 Server Creation

```kotlin
import io.modelcontextprotocol.server.McpServer
import io.modelcontextprotocol.server.McpSyncServer
import io.modelcontextprotocol.spec.McpSchema

val server = McpServer.sync(
    serverInfo = McpSchema.Implementation("kotlin-server", "1.0.0")
) {
    tool("calculate") { request ->
        val expression = request.arguments["expression"] as String
        val result = evaluate(expression)
        McpSyncServer.CallToolResult(
            content = listOf(
                McpSchema.TextContent(
                    type = "text",
                    text = result.toString()
                )
            )
        )
    }
}
```

### 5.4 Java SDK

#### 5.4.1 Spring Boot Integration

```java
@Configuration
public class McpConfiguration {

    @Bean
    public McpServer mcpServer() {
        return McpServer.builder()
            .serverInfo("java-server", "1.0.0")
            .tool(CalculatorTool.class)
            .resource(ConfigResource.class)
            .transport(TransportType.SSE)
            .build();
    }
}

@McpTool(name = "calculate", description = "Perform calculations")
public class CalculatorTool {

    @McpToolMethod
    public String calculate(@McpParam("expression") String expression) {
        return String.valueOf(evaluate(expression));
    }
}
```

---

## 6. Third-Party MCP Toolkits

### 6.1 Rust Implementations

#### 6.1.1 rmcp (Rust MCP)

```rust
use rmcp::{Server, ToolHandler};
use rmcp::model::{Tool, CallToolRequestParam, CallToolResult, Content};

struct MyTool;

impl ToolHandler for MyTool {
    fn tool_info(&self) -> Tool {
        Tool {
            name: "calculate".into(),
            description: Some("Perform calculations".into()),
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "expression": {"type": "string"}
                },
                "required": ["expression"]
            }),
        }
    }

    async fn call(
        &self,
        CallToolRequestParam { name, arguments: args }: CallToolRequestParam,
    ) -> Result<CallToolResult, rmcp::Error> {
        let expression = args["expression"].as_str().unwrap();
        let result = evaluate(expression);
        Ok(CallToolResult {
            content: vec![Content::text(result.to_string())],
            is_error: None,
        })
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let server = Server::new()
        .register_tool(MyTool)
        .serve(rmcp::transport::stdio::StdioServerTransport::new())
        .await?;
    Ok(())
}
```

#### 6.1.2 mcp-forge (McpKit Rust Generator)

The `mcp-forge` tool in McpKit generates Rust protocol types from the MCP TypeScript schema:

```go
// mcp-forge generates Rust types from MCP TypeScript definitions
func main() {
    // Parse TypeScript protocol definitions
    tsTypes := parseTsProtocol("path/to/typescript/schema.ts")

    // Generate Rust equivalents
    rustCode := generateRustTypes(tsTypes)

    // Write to crates
    writeRustCrates(rustCode)
}
```

### 6.2 Go Implementations

#### 6.2.1 mark3labs/mcp-go

```go
package main

import (
    "context"
    "fmt"

    "github.com/mark3labs/mcp-go/mcp"
    "github.com/mark3labs/mcp-go/server"
)

func main() {
    s := server.NewMCPServer(
        "Go MCP Server",
        "1.0.0",
    )

    tool := mcp.NewTool("calculate",
        mcp.WithDescription("Perform mathematical calculations"),
        mcp.WithString("expression",
            mcp.Required(),
            mcp.Description("Math expression to evaluate"),
        ),
    )

    s.AddTool(tool, func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
        expression := request.Params.Arguments["expression"].(string)
        result := evaluate(expression)
        return mcp.NewToolResultText(fmt.Sprintf("%v", result)), nil
    })

    server.ServeStdio(s)
}
```

#### 6.2.2 McpKit Go Implementation

```go
package mcpkit

import (
    "context"
    "encoding/json"
)

// Server represents an MCP server
type Server struct {
    name    string
    version string
    tools   *ToolRegistry
}

// NewServer creates a new MCP server
func NewServer(name, version string) *Server {
    return &Server{
        name:    name,
        version: version,
        tools:   NewToolRegistry(),
    }
}

// RegisterTool adds a tool to the server
func (s *Server) RegisterTool(tool Tool) {
    s.tools.Register(tool)
}

// HandleRequest processes an MCP request
func (s *Server) HandleRequest(ctx context.Context, req JsonRpcRequest) (*JsonRpcResponse, error) {
    switch req.Method {
    case "initialize":
        return s.handleInitialize(req)
    case "tools/list":
        return s.handleToolsList()
    case "tools/call":
        return s.handleToolsCall(req)
    default:
        return nil, &JsonRpcError{
            Code:    -32601,
            Message: "Method not found",
        }
    }
}
```

### 6.3 Ruby Implementation

```ruby
require 'mcp'

class CalculatorTool < Mcp::Tool
  name 'calculate'
  description 'Perform mathematical calculations'

  argument :expression, type: :string, required: true

  def call(expression:)
    result = eval(expression)
    Mcp::ToolResult.text(result.to_s)
  end
end

server = Mcp::Server.new(name: 'ruby-server', version: '1.0.0')
server.register_tool(CalculatorTool.new)
server.run(transport: :stdio)
```

### 6.4 Community Implementations

| Language | Package | Stars | Maturity | Notes |
|----------|---------|-------|----------|-------|
| TypeScript | @modelcontextprotocol/sdk | Official | Production | Reference implementation |
| Python | mcp | Official | Production | FastMCP high-level API |
| Kotlin | mcp-kotlin | Official | Beta | JVM ecosystem |
| Java | spring-ai-mcp | Spring | Beta | Spring Boot integration |
| Rust | rmcp | Community | Alpha | Async-first |
| Rust | mcp-rs | Community | Alpha | Minimal |
| Go | mcp-go | Community | Beta | Well-featured |
| Go | McpKit | Phenotype | Planning | Multi-language toolkit |
| Ruby | mcp-ruby | Community | Alpha | Simple API |
| PHP | mcp-php | Community | Alpha | PSR-compliant |
| C# | McpDotNet | Community | Alpha | .NET 8+ |
| Swift | swift-mcp | Community | Alpha | Swift Concurrency |

---

## 7. AI Agent Tool Frameworks Comparison

### 7.1 Framework Comparison Matrix

| Feature | MCP | OpenAI Functions | LangChain Tools | Semantic Kernel |
|---------|-----|------------------|-----------------|-----------------|
| **Protocol** | Open Standard | Proprietary | In-Process | Open (Microsoft) |
| **Transport** | SSE, stdio | HTTP | N/A | Various |
| **Languages** | Multi | Any (HTTP) | Python, TS | C#, Python |
| **Discovery** | Built-in | Manual | Code-based | Mixed |
| **State** | Per-connection | Stateless | Stateful | Mixed |
| **Resources** | First-class | Not supported | Not supported | Limited |
| **Prompts** | First-class | Not supported | Prompt Templates | Prompt Templates |
| **Streaming** | Yes | Yes | Yes | Yes |
| **Subscription** | Yes | No | No | Limited |
| **Multi-modal** | Text, Image | Text, Image | Text, Image | Text |
| **Error Codes** | Standard | Proprietary | Python exceptions | Mixed |
| **Versioning** | Protocol version | API version | Package version | Package version |
| **Auth** | Implementation-specific | API key | Implementation-specific | Azure AD |
| **Sandboxing** | Implementation-specific | N/A | Implementation-specific | Implementation-specific |

### 7.2 Detailed Comparison

#### 7.2.1 MCP vs OpenAI Function Calling

```
┌─────────────────────────────────────────────────────────────────┐
│                    MCP vs OpenAI Functions                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  MCP Advantages:                                                │
│  • Open specification - not tied to any vendor                  │
│  • Resource access - URI-based data retrieval                   │
│  • Bidirectional - server can request LLM sampling              │
│  • Subscription model - real-time updates                       │
│  • Multi-server - connect to multiple tool providers            │
│  • Local deployment - stdio transport for offline use           │
│                                                                 │
│  OpenAI Advantages:                                             │
│  • Native integration with GPT models                           │
│  • Parallel tool calls - built-in support                       │
│  • Strict schema validation - automatic                         │
│  • Mature ecosystem - widespread adoption                       │
│                                                                 │
│  Integration Pattern:                                           │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐        │
│  │   OpenAI    │     │    MCP      │     │    MCP      │        │
│  │   Client    │────►│  Gateway    │────►│   Server    │        │
│  │             │     │             │     │             │        │
│  │ • Functions │     │ • Translates│     │ • Tools     │        │
│  │ • Streaming │     │ • Routes    │     │ • Resources │        │
│  │             │     │ • Aggregates│     │ • Prompts   │        │
│  └─────────────┘     └─────────────┘     └─────────────┘        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 7.2.2 MCP vs LangChain Tools

```
┌─────────────────────────────────────────────────────────────────┐
│                    MCP vs LangChain Tools                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  LangChain Tools:                                               │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  class SearchTool(BaseTool):                             │   │
│  │      name = "search"                                     │   │
│  │      description = "Search the web"                      │   │
│  │                                                          │   │
│  │      def _run(self, query: str) -> str:                  │   │
│  │          return search_web(query)                        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  MCP Tools:                                                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  @mcp.tool()                                             │   │
│  │  def search(query: str) -> str:                          │   │
│  │      \"\"\"Search the web.\"\"\"                         │   │
│  │      return search_web(query)                            │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Key Differences:                                               │
│  • LangChain: In-process, Python/TS only, tightly coupled       │
│  • MCP: Out-of-process, any language, loosely coupled           │
│  • LangChain: Framework-specific tool definitions               │
│  • MCP: Standardized protocol, cross-framework compatible       │
│  • LangChain: No resource abstraction                           │
│  • MCP: Resources as first-class citizens                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 7.3 Integration Patterns

#### 7.3.1 MCP as Tool Backend

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   LLM App    │     │   MCP Host   │     │  MCP Server  │
│              │     │              │     │              │
│ • LangChain  │     │ • Protocol   │     │ • Tools      │
│ • Semantic   │────►│ • Routing    │────►│ • Resources  │
│ • Custom     │     │ • Auth       │     │ • Prompts    │
│              │     │              │     │              │
└──────────────┘     └──────────────┘     └──────────────┘
```

#### 7.3.2 MCP as Tool Frontend

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   MCP Host   │     │   MCP Server │     │   External   │
│              │     │   (Gateway)  │     │   Services   │
│ • Claude     │     │              │     │              │
│ • IDE        │────►│ • Translate  │────►│ • REST APIs  │
│ • CLI        │     │ • Aggregate  │     │ • Databases  │
│              │     │ • Cache      │     │ • Files      │
└──────────────┘     └──────────────┘     └──────────────┘
```

---

## 8. Language-Specific Implementation Analysis

### 8.1 Python Implementation Patterns

#### 8.1.1 McpKit Python Architecture

```
python/pheno-mcp/
├── src/pheno_mcp/
│   ├── __init__.py              # Package entry point
│   ├── types.py                 # Protocol types
│   ├── ports.py                 # Port interfaces
│   ├── adapter_base.py          # Base adapter class
│   ├── manager.py               # Server manager
│   ├── registry.py              # Tool registry
│   ├── adapters/
│   │   ├── __init__.py
│   │   ├── tool_registry.py     # Tool registry adapter
│   │   ├── session_manager.py   # Session management
│   │   ├── monitoring.py        # Monitoring adapter
│   │   ├── provider.py          # Provider adapter
│   │   └── resource_provider.py # Resource provider
│   ├── agents/
│   │   ├── __init__.py
│   │   ├── orchestration_base.py
│   │   ├── orchestration_state.py
│   │   ├── orchestration_tasks.py
│   │   ├── port_adapter.py
│   │   └── adapters/
│   │       ├── langgraph_adapter.py
│   │       ├── crewai_adapter.py
│   │       └── autogen_adapter.py
│   ├── resources/
│   │   ├── __init__.py
│   │   ├── registry.py          # Resource registry
│   │   ├── handlers.py          # Resource handlers
│   │   ├── namespaces.py        # Resource namespaces
│   │   ├── templates.py         # Resource templates
│   │   ├── schemes/
│   │   │   ├── base.py
│   │   │   ├── common.py
│   │   │   ├── config.py
│   │   │   ├── files.py
│   │   │   ├── logs.py
│   │   │   ├── metrics.py
│   │   │   ├── prompts.py
│   │   │   ├── static.py
│   │   │   ├── system.py
│   │   │   ├── tools.py
│   │   │   └── zen.py
│   │   └── template_engine/
│   │       ├── __init__.py
│   │       ├── engine.py
│   │       └── models.py
│   ├── tools/
│   │   └── decorators.py        # Tool decorators
│   ├── schemes/
│   │   ├── __init__.py
│   │   ├── env_scheme.py
│   │   ├── file_scheme.py
│   │   ├── http_scheme.py
│   │   ├── logs_scheme.py
│   │   └── metrics_scheme.py
│   ├── entry_points/
│   │   ├── __init__.py
│   │   ├── base.py
│   │   ├── atoms.py
│   │   ├── zen.py
│   │   └── enhanced_framework.py
│   ├── performance/
│   │   ├── __init__.py
│   │   ├── integration.py
│   │   └── mcp_monitor.py
│   ├── workflow/
│   │   ├── __init__.py
│   │   ├── integration.py
│   │   └── monitoring.py
│   └── qa/
│       ├── __init__.py
│       ├── core/
│       │   ├── base/
│       │   │   ├── client_adapter.py
│       │   │   └── test_runner.py
│       │   ├── cache.py
│       │   └── test_registry.py
│       ├── adapters/
│       ├── config/
│       │   ├── endpoints.py
│       ├── logging/
│       │   └── structured_events.py
│       ├── oauth/
│       │   └── credential_broker.py
│       ├── pytest_plugins/
│       │   └── auth.py
│       ├── reporters/
│       │   ├── console.py
│       │   ├── error_detail.py
│       │   ├── json_reporter.py
│       │   ├── markdown.py
│       │   └── matrix.py
│       ├── testing/
│       │   └── logging_config.py
│       └── tui/
│           └── widgets_compat.py
```

#### 8.1.2 Tool Decorator Pattern

```python
from functools import wraps
from typing import Any, Callable, Optional
import json

def mcp_tool(
    name: Optional[str] = None,
    description: Optional[str] = None,
    input_schema: Optional[dict] = None,
):
    """Decorator for registering MCP tools."""
    def decorator(func: Callable) -> Callable:
        tool_name = name or func.__name__
        tool_desc = description or (func.__doc__ or "").strip()

        @wraps(func)
        async def wrapper(*args: Any, **kwargs: Any) -> dict:
            try:
                result = func(*args, **kwargs)
                return {
                    "content": [{"type": "text", "text": str(result)}],
                    "isError": False,
                }
            except Exception as e:
                return {
                    "content": [{"type": "text", "text": f"Error: {str(e)}"}],
                    "isError": True,
                }

        wrapper._mcp_tool = {
            "name": tool_name,
            "description": tool_desc,
            "inputSchema": input_schema or extract_schema(func),
            "handler": wrapper,
        }

        return wrapper
    return decorator

def extract_schema(func: Callable) -> dict:
    """Extract JSON Schema from function signature."""
    import inspect
    sig = inspect.signature(func)
    properties = {}
    required = []

    for name, param in sig.parameters.items():
        param_type = "string"
        if param.annotation is int:
            param_type = "integer"
        elif param.annotation is float:
            param_type = "number"
        elif param.annotation is bool:
            param_type = "boolean"

        properties[name] = {
            "type": param_type,
            "description": param.name,
        }

        if param.default is inspect.Parameter.empty:
            required.append(name)

    return {
        "type": "object",
        "properties": properties,
        "required": required,
    }
```

### 8.2 Go Implementation Patterns

#### 8.2.1 Protocol Types

```go
package mcp

// JsonRpcRequest represents a JSON-RPC 2.0 request
type JsonRpcRequest struct {
    JsonRpc string          `json:"jsonrpc"`
    ID      interface{}     `json:"id"`
    Method  string          `json:"method"`
    Params  json.RawMessage `json:"params,omitempty"`
}

// JsonRpcResponse represents a JSON-RPC 2.0 response
type JsonRpcResponse struct {
    JsonRpc string          `json:"jsonrpc"`
    ID      interface{}     `json:"id"`
    Result  json.RawMessage `json:"result,omitempty"`
    Error   *JsonRpcError   `json:"error,omitempty"`
}

// JsonRpcError represents a JSON-RPC 2.0 error
type JsonRpcError struct {
    Code    int             `json:"code"`
    Message string          `json:"message"`
    Data    json.RawMessage `json:"data,omitempty"`
}

// Tool represents an MCP tool definition
type Tool struct {
    Name        string          `json:"name"`
    Description string          `json:"description,omitempty"`
    InputSchema json.RawMessage `json:"inputSchema"`
}

// ToolCall represents a tool invocation request
type ToolCall struct {
    Name      string                 `json:"name"`
    Arguments map[string]interface{} `json:"arguments,omitempty"`
}

// ToolResult represents a tool execution result
type ToolResult struct {
    Content []Content `json:"content"`
    IsError *bool     `json:"isError,omitempty"`
}

// Content represents tool response content
type Content struct {
    Type     string `json:"type"`
    Text     string `json:"text,omitempty"`
    Data     string `json:"data,omitempty"`
    MimeType string `json:"mimeType,omitempty"`
}
```

#### 8.2.2 Server Implementation

```go
package mcp

import (
    "context"
    "fmt"
    "sync"
)

// ToolHandler defines the interface for MCP tools
type ToolHandler interface {
    Definition() Tool
    Execute(ctx context.Context, args map[string]interface{}) (*ToolResult, error)
}

// ToolRegistry manages tool registration and execution
type ToolRegistry struct {
    tools map[string]ToolHandler
    mu    sync.RWMutex
}

func NewToolRegistry() *ToolRegistry {
    return &ToolRegistry{
        tools: make(map[string]ToolHandler),
    }
}

func (r *ToolRegistry) Register(handler ToolHandler) {
    r.mu.Lock()
    defer r.mu.Unlock()
    def := handler.Definition()
    r.tools[def.Name] = handler
}

func (r *ToolRegistry) List() []Tool {
    r.mu.RLock()
    defer r.mu.RUnlock()

    tools := make([]Tool, 0, len(r.tools))
    for _, handler := range r.tools {
        tools = append(tools, handler.Definition())
    }
    return tools
}

func (r *ToolRegistry) Execute(ctx context.Context, name string, args map[string]interface{}) (*ToolResult, error) {
    r.mu.RLock()
    handler, ok := r.tools[name]
    r.mu.RUnlock()

    if !ok {
        return nil, fmt.Errorf("tool not found: %s", name)
    }

    return handler.Execute(ctx, args)
}
```

### 8.3 TypeScript Implementation Patterns

#### 8.3.1 Type-Safe Tool Definitions

```typescript
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Type-safe tool definition with Zod validation
const calculateTool = {
  name: "calculate",
  description: "Perform mathematical calculations",
  inputSchema: z.object({
    expression: z.string().describe("Math expression to evaluate"),
    precision: z.number().optional().default(2),
  }),
  handler: async ({ expression, precision }) => {
    const result = evaluate(expression);
    return {
      content: [
        {
          type: "text",
          text: result.toFixed(precision),
        },
      ],
    };
  },
};

// Server setup
const server = new McpServer({
  name: "typescript-server",
  version: "1.0.0",
});

server.tool(
  calculateTool.name,
  calculateTool.description,
  calculateTool.inputSchema.shape,
  calculateTool.handler
);
```

### 8.4 Rust Implementation Patterns

#### 8.4.1 mcp-forge Generated Types

```rust
// Generated by mcp-forge from MCP TypeScript schema

use serde::{Deserialize, Serialize};

/// MCP Protocol Version
pub const MCP_PROTOCOL_VERSION: &str = "2024-11-05";

/// JSON-RPC Version
pub const JSONRPC_VERSION: &str = "2.0";

/// JSON-RPC Message ID
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum JsonRpcId {
    String(String),
    Number(i64),
    Null,
}

/// JSON-RPC Request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonRpcRequest {
    pub jsonrpc: String,
    pub id: JsonRpcId,
    pub method: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub params: Option<serde_json::Value>,
}

/// JSON-RPC Response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonRpcResponse {
    pub jsonrpc: String,
    pub id: JsonRpcId,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<JsonRpcError>,
}

/// JSON-RPC Error
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonRpcError {
    pub code: i32,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
}

/// Tool Definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tool {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub input_schema: serde_json::Value,
}

/// Tool Call Request
#[derive(Debug, Clone, Deserialize)]
pub struct ToolCall {
    pub name: String,
    #[serde(default)]
    pub arguments: serde_json::Value,
}

/// Tool Call Result
#[derive(Debug, Clone, Serialize)]
pub struct ToolResult {
    pub content: Vec<Content>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_error: Option<bool>,
}

/// Content Types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum Content {
    #[serde(rename = "text")]
    Text { text: String },
    #[serde(rename = "image")]
    Image { data: String, mime_type: String },
    #[serde(rename = "resource")]
    Resource { resource: ResourceContents },
}

impl Content {
    pub fn text(text: impl Into<String>) -> Self {
        Self::Text { text: text.into() }
    }

    pub fn image(data: impl Into<String>, mime_type: impl Into<String>) -> Self {
        Self::Image {
            data: data.into(),
            mime_type: mime_type.into(),
        }
    }
}

/// Resource Contents
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum ResourceContents {
    Text {
        uri: String,
        mime_type: Option<String>,
        text: String,
    },
    Blob {
        uri: String,
        mime_type: Option<String>,
        blob: String,
    },
}
```

---

## 9. Architecture Patterns

### 9.1 Server Architecture Patterns

#### 9.1.1 Monolithic Server

```
┌─────────────────────────────────────────────────────────────┐
│                    Monolithic MCP Server                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                    Server Core                         │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────┐  │  │
│  │  │ Tools   │ │Resources│ │ Prompts │ │  Sampling   │  │  │
│  │  │ Module  │ │ Module  │ │ Module  │ │  Module     │  │  │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                    Transport Layer                     │  │
│  │  ┌─────────────┐              ┌──────────────────┐    │  │
│  │  │   Stdio     │              │      SSE         │    │  │
│  │  │  Transport  │              │   Transport      │    │  │
│  │  └─────────────┘              └──────────────────┘    │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  Pros: Simple deployment, shared state, easy debugging       │
│  Cons: Single point of failure, harder to scale              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 9.1.2 Micro-Server Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Micro-Server Architecture                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐                                           │
│  │  MCP Host    │                                           │
│  │  (Client)    │                                           │
│  └──────┬───────┘                                           │
│         │                                                   │
│    ┌────┼────────────────────────────────────┐              │
│    │    │                                    │              │
│  ┌─▼────▼──┐  ┌────────────┐  ┌────────────┐ │              │
│  │ Tools   │  │ Resources  │  │  Prompts   │ │              │
│  │ Server  │  │  Server    │  │  Server    │ │              │
│  │         │  │            │  │            │ │              │
│  │ • CRUD  │  │ • File     │  │ • Templates│ │              │
│  │ • Exec  │  │ • DB       │  │ • Dynamic  │ │              │
│  └─────────┘  └────────────┘  └────────────┘ │              │
│    │              │              │            │              │
│    └──────────────┴──────────────┴────────────┘              │
│                                                             │
│  Pros: Independent scaling, fault isolation, polyglot        │
│  Cons: Complex orchestration, network overhead               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 9.1.3 Gateway Pattern

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   MCP Host   │     │   MCP        │     │  Backend     │
│              │     │   Gateway    │     │  Services    │
│ • Claude     │     │              │     │              │
│ • IDE        │────►│ • Auth       │────►│ • REST APIs  │
│ • CLI        │     │ • Rate Limit │     │ • Databases  │
│              │     │ • Routing    │     │ • Files      │
│              │     │ • Caching    │     │ • External   │
└──────────────┘     └──────────────┘     └──────────────┘
```

### 9.2 Client Architecture Patterns

#### 9.2.1 Single Server Client

```
┌──────────────┐     ┌──────────────┐
│   MCP Host   │     │  MCP Server  │
│              │     │              │
│  Client ─────┼────►│  Tools       │
│              │     │  Resources   │
│              │     │  Prompts     │
└──────────────┘     └──────────────┘
```

#### 9.2.2 Multi-Server Client

```
┌──────────────┐
│   MCP Host   │
│              │
│  Client      │
│  ┌────────┐  │
│  │Router  │  │
│  └───┬────┘  │
└──────┼───────┘
       │
  ┌────┼────────────┐
  │    │            │
┌─▼────▼──┐ ┌──────▼─────┐ ┌────────────┐
│ Server 1│ │ Server 2   │ │ Server N   │
│ (Tools) │ │ (Resources)│ │ (Prompts)  │
└─────────┘ └────────────┘ └────────────┘
```

### 9.3 McpKit Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                          McpKit Architecture                          │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                    Language SDKs                                 │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐ ┌────────────┐  │  │
│  │  │  Python    │  │    Go      │  │ TypeScript │ │   Rust     │  │  │
│  │  │  pheno-mcp │  │  mcpkit-go │  │  mcpkit-ts │ │ mcp-forge  │  │  │
│  │  │            │  │            │  │            │ │            │  │  │
│  │  │ • FastMCP  │  │ • Server   │  │ • Server   │ │ • Types    │  │  │
│  │  │ • Decorators│ │ • Client   │  │ • Client   │ │ • Generator│  │  │
│  │  │ • Resources│  │ • Tools    │  │ • Tools    │ │ • Protocol │  │  │
│  │  │ • Agents   │  │ • Registry │  │ • Resources│ │            │  │  │
│  │  │ • QA       │  │            │  │            │ │            │  │  │
│  │  └────────────┘  └────────────┘  └────────────┘ └────────────┘  │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                    Shared Components                             │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │  │
│  │  │  Registry    │  │  Schemes     │  │  Protocol Types      │   │  │
│  │  │  (YAML)      │  │  (Config)    │  │  (JSON Schema)       │   │  │
│  │  └──────────────┘  └──────────────┘  └──────────────────────┘   │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                    Transports                                    │  │
│  │  ┌──────────────────────────┐  ┌──────────────────────────────┐  │  │
│  │  │    SSE                    │  │    stdio                     │  │  │
│  │  │    (HTTP Streaming)       │  │    (Process Communication)   │  │  │
│  │  └──────────────────────────┘  └──────────────────────────────┘  │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 10. Security Considerations

### 10.1 Threat Model

```
┌─────────────────────────────────────────────────────────────────┐
│                    MCP Security Threat Model                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Threat Categories:                                             │
│                                                                 │
│  1. Tool Execution Threats                                      │
│     • Arbitrary code execution via tool arguments               │
│     • Command injection through parameter values                │
│     • Resource exhaustion via expensive operations              │
│     • Privilege escalation through tool chaining                │
│                                                                 │
│  2. Data Access Threats                                         │
│     • Unauthorized resource access                              │
│     • Data exfiltration through tool outputs                    │
│     • Path traversal in resource URIs                           │
│     • Sensitive data exposure in prompts                        │
│                                                                 │
│  3. Transport Threats                                           │
│     • Man-in-the-middle attacks (SSE without TLS)               │
│     • Session hijacking                                         │
│     • Replay attacks                                            │
│     • Denial of service                                         │
│                                                                 │
│  4. Protocol Threats                                            │
│     • Malformed JSON-RPC messages                               │
│     • Protocol version mismatch                                 │
│     • Capability spoofing                                       │
│     • Notification flooding                                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 10.2 Security Controls

#### 10.2.1 Input Validation

```python
import re
from typing import Any

class InputValidator:
    """Validate tool input parameters."""

    # Dangerous patterns to block
    DANGEROUS_PATTERNS = [
        r'__import__',
        r'eval\s*\(',
        r'exec\s*\(',
        r'subprocess',
        r'os\.system',
        r'os\.popen',
    ]

    @classmethod
    def validate_string(cls, value: str, max_length: int = 10000) -> str:
        """Validate string input."""
        if len(value) > max_length:
            raise ValueError(f"Input exceeds maximum length of {max_length}")

        for pattern in cls.DANGEROUS_PATTERNS:
            if re.search(pattern, value):
                raise ValueError(f"Input contains dangerous pattern: {pattern}")

        return value

    @classmethod
    def validate_path(cls, path: str, allowed_root: str) -> str:
        """Validate file path to prevent traversal."""
        import os
        resolved = os.path.realpath(os.path.join(allowed_root, path))
        if not resolved.startswith(os.path.realpath(allowed_root)):
            raise ValueError("Path traversal detected")
        return resolved
```

#### 10.2.2 Sandboxing

```python
import subprocess
import tempfile
import os

class ToolSandbox:
    """Execute tools in isolated environment."""

    def __init__(self, timeout: int = 30, memory_limit: str = "256m"):
        self.timeout = timeout
        self.memory_limit = memory_limit

    async def execute(self, command: list[str], env: dict = None) -> str:
        """Execute command in sandbox."""
        # Create temporary directory
        with tempfile.TemporaryDirectory() as tmpdir:
            # Set up restricted environment
            sandbox_env = {
                "HOME": tmpdir,
                "TMPDIR": tmpdir,
                "PATH": "/usr/bin:/bin",
            }
            if env:
                sandbox_env.update(env)

            # Execute with restrictions
            process = await asyncio.create_subprocess_exec(
                *command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=sandbox_env,
                cwd=tmpdir,
            )

            try:
                stdout, stderr = await asyncio.wait_for(
                    process.communicate(),
                    timeout=self.timeout,
                )
            except asyncio.TimeoutError:
                process.kill()
                raise TimeoutError(f"Tool execution exceeded {self.timeout}s timeout")

            if process.returncode != 0:
                raise RuntimeError(f"Tool failed: {stderr.decode()}")

            return stdout.decode()
```

#### 10.2.3 Authentication

```python
from typing import Optional
import secrets
import time

class McpAuth:
    """Authentication for MCP servers."""

    def __init__(self, secret_key: str):
        self.secret_key = secret_key
        self.tokens: dict[str, dict] = {}

    def generate_token(self, client_id: str, scopes: list[str]) -> str:
        """Generate authentication token."""
        token = secrets.token_urlsafe(32)
        self.tokens[token] = {
            "client_id": client_id,
            "scopes": scopes,
            "created_at": time.time(),
            "expires_at": time.time() + 3600,  # 1 hour
        }
        return token

    def validate_token(self, token: str, required_scope: str) -> bool:
        """Validate token and check scope."""
        if token not in self.tokens:
            return False

        token_data = self.tokens[token]

        # Check expiration
        if time.time() > token_data["expires_at"]:
            del self.tokens[token]
            return False

        # Check scope
        if required_scope not in token_data["scopes"]:
            return False

        return True
```

### 10.3 Permission Model

```
┌─────────────────────────────────────────────────────────────────┐
│                    MCP Permission Model                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Permission Levels:                                             │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Level 1: Read-Only                                      │   │
│  │  • Read resources                                        │   │
│  │  • List tools                                            │   │
│  │  • Get prompts                                           │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Level 2: Execute                                        │   │
│  │  • Call tools (read-only tools)                          │   │
│  │  • Subscribe to resources                                │   │
│  │  • Request sampling                                      │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Level 3: Write                                          │   │
│  │  • Call tools (write tools)                              │   │
│  │  • Modify resources                                      │   │
│  │  • Manage roots                                          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Level 4: Admin                                          │   │
│  │  • Register/unregister tools                             │   │
│  │  • Configure server                                      │   │
│  │  • Manage authentication                                 │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 11. Performance Benchmarks

### 11.1 Transport Performance

| Transport | Latency (p50) | Latency (p99) | Throughput | Max Connections |
|-----------|---------------|---------------|------------|-----------------|
| stdio | 0.1ms | 0.5ms | 10K msg/s | 1 |
| SSE (local) | 1ms | 5ms | 5K msg/s | 100 |
| SSE (network) | 10ms | 50ms | 1K msg/s | 1000 |
| WebSocket* | 0.5ms | 2ms | 8K msg/s | 1000 |

*WebSocket is proposed, not yet standardized in MCP

### 11.2 Language Performance

| Language | Tool Call Latency | Memory Usage | Startup Time | Concurrency |
|----------|-------------------|--------------|--------------|-------------|
| Rust | 0.05ms | 5MB | 10ms | 10K+ |
| Go | 0.1ms | 10MB | 20ms | 5K+ |
| TypeScript | 0.5ms | 50MB | 100ms | 1K+ |
| Python | 1ms | 30MB | 200ms | 500+ |

### 11.3 Tool Execution Benchmarks

```python
import time
import asyncio
from typing import Callable

async def benchmark_tool(handler: Callable, iterations: int = 1000):
    """Benchmark tool execution."""
    # Warmup
    for _ in range(10):
        await handler({})

    # Measure
    start = time.perf_counter()
    for _ in range(iterations):
        await handler({})
    elapsed = time.perf_counter() - start

    return {
        "total_time": elapsed,
        "avg_latency": elapsed / iterations * 1000,  # ms
        "throughput": iterations / elapsed,  # ops/s
    }
```

---

## 12. Tool Discovery and Registry Patterns

### 12.1 Registry Design Patterns

#### 12.1.1 In-Memory Registry

```python
class ToolRegistry:
    """In-memory tool registry."""

    def __init__(self):
        self._tools: dict[str, Tool] = {}
        self._handlers: dict[str, Callable] = {}
        self._listeners: list[Callable] = []

    def register(self, tool: Tool, handler: Callable):
        """Register a tool with its handler."""
        self._tools[tool.name] = tool
        self._handlers[tool.name] = handler
        self._notify_listeners()

    def unregister(self, name: str):
        """Unregister a tool."""
        self._tools.pop(name, None)
        self._handlers.pop(name, None)
        self._notify_listeners()

    def get(self, name: str) -> Optional[Tool]:
        """Get tool definition by name."""
        return self._tools.get(name)

    def list_all(self) -> list[Tool]:
        """List all registered tools."""
        return list(self._tools.values())

    def on_change(self, listener: Callable):
        """Register change listener."""
        self._listeners.append(listener)

    def _notify_listeners(self):
        """Notify all listeners of changes."""
        for listener in self._listeners:
            listener()
```

#### 12.1.2 YAML-Based Registry

```yaml
# registry.yaml
tools:
  - name: search_files
    description: Search for files by pattern
    handler: tools.search_files
    input_schema:
      type: object
      properties:
        pattern:
          type: string
          description: Glob pattern to match
        directory:
          type: string
          description: Directory to search in
      required:
        - pattern

  - name: read_file
    description: Read file contents
    handler: tools.read_file
    input_schema:
      type: object
      properties:
        path:
          type: string
          description: File path to read
      required:
        - path

resources:
  - uri: "config://app"
    name: Application Config
    handler: resources.app_config
    mime_type: application/json

  - uri: "file://{root}/**"
    name: Project Files
    handler: resources.project_files
    mime_type: text/plain
```

#### 12.1.3 McpKit Resource Schemes

```python
# Resource scheme base class
class ResourceScheme:
    """Base class for resource schemes."""

    scheme: str = ""

    def __init__(self, config: dict):
        self.config = config

    async def list_resources(self) -> list[Resource]:
        raise NotImplementedError

    async def read_resource(self, uri: str) -> ResourceContent:
        raise NotImplementedError

# File scheme implementation
class FileScheme(ResourceScheme):
    scheme = "file"

    def __init__(self, config: dict):
        super().__init__(config)
        self.root = config.get("root", ".")

    async def list_resources(self) -> list[Resource]:
        """List all files in root directory."""
        resources = []
        for path in Path(self.root).rglob("*"):
            if path.is_file():
                resources.append(Resource(
                    uri=f"file://{path}",
                    name=path.name,
                    mime_type=self._guess_mime(path),
                ))
        return resources

    async def read_resource(self, uri: str) -> ResourceContent:
        """Read file contents."""
        path = self._resolve_uri(uri)
        content = Path(path).read_text()
        return TextResourceContent(uri=uri, text=content)
```

### 12.2 Dynamic Tool Registration

```python
class DynamicToolRegistry(ToolRegistry):
    """Registry supporting dynamic tool registration."""

    def __init__(self):
        super().__init__()
        self._pending_tools: list[ToolDefinition] = []

    def add_pending_tool(self, definition: ToolDefinition):
        """Queue tool for registration."""
        self._pending_tools.append(definition)

    def flush_pending(self):
        """Register all pending tools."""
        for definition in self._pending_tools:
            tool = Tool(
                name=definition.name,
                description=definition.description,
                input_schema=definition.input_schema,
            )
            self.register(tool, definition.handler)
        self._pending_tools.clear()

    async def auto_discover(self, module_paths: list[str]):
        """Auto-discover tools from modules."""
        for module_path in module_paths:
            module = importlib.import_module(module_path)
            for name, obj in vars(module).items():
                if hasattr(obj, "_mcp_tool"):
                    tool_def = obj._mcp_tool
                    self.register(
                        Tool(
                            name=tool_def["name"],
                            description=tool_def["description"],
                            input_schema=tool_def["inputSchema"],
                        ),
                        tool_def["handler"],
                    )
```

---

## 13. Resource Management Systems

### 13.1 Resource URI Patterns

| Scheme | Example | Description |
|--------|---------|-------------|
| `file://` | `file:///path/to/file.txt` | Local file access |
| `http://` | `http://api.example.com/data` | HTTP resource |
| `config://` | `config://app/settings` | Application config |
| `db://` | `db://users/123` | Database record |
| `log://` | `log://app/2024-01-01` | Log file |
| `metric://` | `metric://cpu/usage` | System metric |

### 13.2 Resource Template System

```python
from dataclasses import dataclass
from typing import Optional

@dataclass
class ResourceTemplate:
    """Template for dynamic resource URIs."""
    uri_template: str
    name: str
    description: Optional[str] = None
    mime_type: Optional[str] = None

    def match(self, uri: str) -> Optional[dict]:
        """Check if URI matches template and extract parameters."""
        import re
        pattern = self.uri_template.replace("{", "(?P<").replace("}", ">[^/]+)")
        match = re.match(pattern, uri)
        if match:
            return match.groupdict()
        return None

# Example templates
templates = [
    ResourceTemplate(
        uri_template="file://{path}",
        name="Project File",
        description="Access project files",
        mime_type="text/plain",
    ),
    ResourceTemplate(
        uri_template="config://{section}/{key}",
        name="Configuration",
        description="Access configuration values",
        mime_type="application/json",
    ),
]
```

### 13.3 Resource Subscription

```python
import asyncio
from typing import Callable

class ResourceSubscriptionManager:
    """Manage resource subscriptions."""

    def __init__(self):
        self._subscriptions: dict[str, list[Callable]] = {}
        self._watchers: dict[str, asyncio.Task] = {}

    async def subscribe(self, uri: str, callback: Callable):
        """Subscribe to resource changes."""
        if uri not in self._subscriptions:
            self._subscriptions[uri] = []
            self._start_watcher(uri)
        self._subscriptions[uri].append(callback)

    async def unsubscribe(self, uri: str, callback: Callable):
        """Unsubscribe from resource changes."""
        if uri in self._subscriptions:
            self._subscriptions[uri].remove(callback)
            if not self._subscriptions[uri]:
                del self._subscriptions[uri]
                self._stop_watcher(uri)

    def _start_watcher(self, uri: str):
        """Start watching resource for changes."""
        async def watch():
            while True:
                content = await self._read_resource(uri)
                # Check for changes and notify
                await asyncio.sleep(1)

        self._watchers[uri] = asyncio.create_task(watch())

    def _stop_watcher(self, uri: str):
        """Stop watching resource."""
        if uri in self._watchers:
            self._watchers[uri].cancel()
            del self._watchers[uri]
```

---

## 14. Prompt and Sampling Integration

### 14.1 Prompt System

```python
from dataclasses import dataclass
from typing import Optional

@dataclass
class PromptArgument:
    name: str
    description: Optional[str] = None
    required: bool = False

@dataclass
class Prompt:
    name: str
    description: Optional[str] = None
    arguments: list[PromptArgument] = None

    def __post_init__(self):
        if self.arguments is None:
            self.arguments = []

@dataclass
class PromptMessage:
    role: str  # "user", "assistant"
    content: dict  # TextContent, ImageContent, etc.

class PromptManager:
    """Manage MCP prompts."""

    def __init__(self):
        self._prompts: dict[str, Prompt] = {}
        self._handlers: dict[str, Callable] = {}

    def register_prompt(self, prompt: Prompt, handler: Callable):
        """Register a prompt template."""
        self._prompts[prompt.name] = prompt
        self._handlers[prompt.name] = handler

    async def get_prompt(self, name: str, arguments: dict) -> list[PromptMessage]:
        """Get prompt with arguments."""
        handler = self._handlers.get(name)
        if not handler:
            raise ValueError(f"Prompt not found: {name}")
        return await handler(**arguments)

    def list_prompts(self) -> list[Prompt]:
        """List all registered prompts."""
        return list(self._prompts.values())
```

### 14.2 Sampling Integration

```python
from dataclasses import dataclass
from typing import Optional

@dataclass
class SamplingRequest:
    messages: list[PromptMessage]
    max_tokens: Optional[int] = None
    temperature: Optional[float] = None
    stop_sequences: Optional[list[str]] = None
    metadata: Optional[dict] = None

@dataclass
class SamplingResponse:
    role: str
    content: dict
    model: str
    stop_reason: Optional[str] = None

class SamplingClient:
    """Client for requesting LLM sampling from MCP server."""

    def __init__(self, client: McpClient):
        self._client = client

    async def create_message(self, request: SamplingRequest) -> SamplingResponse:
        """Request LLM sampling."""
        result = await self._client.request(
            "sampling/createMessage",
            {
                "messages": [
                    {
                        "role": msg.role,
                        "content": msg.content,
                    }
                    for msg in request.messages
                ],
                "maxTokens": request.max_tokens,
                "temperature": request.temperature,
                "stopSequences": request.stop_sequences,
                "metadata": request.metadata,
            },
        )
        return SamplingResponse(
            role=result["role"],
            content=result["content"],
            model=result["model"],
            stop_reason=result.get("stopReason"),
        )
```

---

## 15. Streaming and Pagination

### 15.1 Pagination Support

```python
from dataclasses import dataclass
from typing import Optional, TypeVar, Generic

T = TypeVar('T')

@dataclass
class Cursor:
    """Opaque cursor for pagination."""
    value: str

@dataclass
class PaginatedResponse(Generic[T]):
    items: list[T]
    next_cursor: Optional[Cursor] = None

class PaginatedToolRegistry:
    """Tool registry with pagination support."""

    def __init__(self, page_size: int = 50):
        self._tools: list[Tool] = []
        self._page_size = page_size

    def list_tools(self, cursor: Optional[str] = None) -> PaginatedResponse[Tool]:
        """List tools with pagination."""
        start = 0
        if cursor:
            start = int(cursor)

        end = start + self._page_size
        items = self._tools[start:end]

        next_cursor = None
        if end < len(self._tools):
            next_cursor = Cursor(value=str(end))

        return PaginatedResponse(
            items=items,
            next_cursor=next_cursor,
        )
```

### 15.2 Streaming Responses

```python
from typing import AsyncIterator

class StreamingToolResult:
    """Support for streaming tool results."""

    def __init__(self):
        self._chunks: list[str] = []
        self._is_complete = False

    async def stream(self) -> AsyncIterator[str]:
        """Stream result chunks."""
        for chunk in self._chunks:
            yield chunk

    def add_chunk(self, chunk: str):
        """Add a chunk to the stream."""
        self._chunks.append(chunk)

    def complete(self):
        """Mark stream as complete."""
        self._is_complete = True
```

---

## 16. Error Handling Strategies

### 16.1 Error Classification

```
┌─────────────────────────────────────────────────────────────────┐
│                    MCP Error Classification                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Protocol Errors (-32700 to -32600)                       │   │
│  │  • Parse Error (-32700): Invalid JSON                     │   │
│  │  • Invalid Request (-32600): Malformed request            │   │
│  │  • Method Not Found (-32601): Unknown method              │   │
│  │  • Invalid Params (-32602): Parameter validation failed   │   │
│  │  • Internal Error (-32603): Server internal error         │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  MCP Errors (-32000 to -32099)                            │   │
│  │  • Resource Not Found (-32001): Resource URI invalid      │   │
│  │  • Tool Execution Error (-32002): Tool failed             │   │
│  │  • Capability Not Supported (-32003): Feature unavailable │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Application Errors (-32100 to -32199)                    │   │
│  │  • Authentication Failed (-32100): Invalid credentials    │   │
│  │  • Authorization Denied (-32101): Insufficient perms      │   │
│  │  • Rate Limited (-32102): Too many requests               │   │
│  │  • Timeout (-32103): Request timed out                    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 16.2 Error Handling Implementation

```python
from dataclasses import dataclass
from typing import Optional, Any

@dataclass
class McpError:
    code: int
    message: str
    data: Optional[Any] = None

    def to_dict(self) -> dict:
        result = {
            "code": self.code,
            "message": self.message,
        }
        if self.data is not None:
            result["data"] = self.data
        return result

class ErrorHandler:
    """Centralized error handling."""

    @staticmethod
    def parse_error(original_error: Exception) -> McpError:
        return McpError(
            code=-32700,
            message="Parse error",
            data=str(original_error),
        )

    @staticmethod
    def invalid_request_error(message: str) -> McpError:
        return McpError(code=-32600, message=message)

    @staticmethod
    def method_not_found_error(method: str) -> McpError:
        return McpError(
            code=-32601,
            message=f"Method not found: {method}",
        )

    @staticmethod
    def invalid_params_error(message: str) -> McpError:
        return McpError(code=-32602, message=message)

    @staticmethod
    def internal_error(error: Exception) -> McpError:
        return McpError(
            code=-32603,
            message="Internal error",
            data=str(error),
        )

    @staticmethod
    def tool_execution_error(tool_name: str, error: Exception) -> McpError:
        return McpError(
            code=-32002,
            message=f"Tool execution error: {tool_name}",
            data=str(error),
        )
```

---

## 17. Testing and Quality Assurance

### 17.1 MCP Testing Strategy

```python
import pytest
from unittest.mock import AsyncMock, patch

class TestMcpServer:
    """Test MCP server implementation."""

    @pytest.fixture
    def server(self):
        return McpServer(name="test-server", version="1.0.0")

    @pytest.fixture
    def calculator_tool(self):
        return CalculatorTool()

    async def test_initialize(self, server):
        """Test server initialization."""
        response = await server.handle_request({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "test", "version": "1.0.0"},
            },
        })

        assert response["result"]["protocolVersion"] == "2024-11-05"
        assert response["result"]["serverInfo"]["name"] == "test-server"

    async def test_tools_list(self, server, calculator_tool):
        """Test tool listing."""
        server.register_tool(calculator_tool)

        response = await server.handle_request({
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/list",
        })

        assert len(response["result"]["tools"]) == 1
        assert response["result"]["tools"][0]["name"] == "calculate"

    async def test_tools_call(self, server, calculator_tool):
        """Test tool execution."""
        server.register_tool(calculator_tool)

        response = await server.handle_request({
            "jsonrpc": "2.0",
            "id": 3,
            "method": "tools/call",
            "params": {
                "name": "calculate",
                "arguments": {"expression": "2 + 2"},
            },
        })

        assert response["result"]["content"][0]["text"] == "4"
```

### 17.2 McpKit QA Framework

The McpKit Python package includes a comprehensive QA framework:

```
pheno_mcp/qa/
├── core/
│   ├── base/
│   │   ├── client_adapter.py    # Test client adapter
│   │   └── test_runner.py       # Test execution engine
│   ├── cache.py                 # Test result caching
│   └── test_registry.py         # Test case registry
├── adapters/                    # Test adapters
├── config/
│   └── endpoints.py             # Test endpoint configuration
├── logging/
│   └── structured_events.py     # Structured test logging
├── oauth/
│   └── credential_broker.py     # Test credential management
├── pytest_plugins/
│   └── auth.py                  # Pytest authentication plugin
├── reporters/
│   ├── console.py               # Console reporter
│   ├── error_detail.py          # Detailed error reporter
│   ├── json_reporter.py         # JSON output reporter
│   ├── markdown.py              # Markdown report generator
│   └── matrix.py                # Test matrix reporter
├── testing/
│   └── logging_config.py        # Test logging configuration
└── tui/
    └── widgets_compat.py        # Terminal UI widgets
```

---

## 18. Deployment Patterns

### 18.1 Local Deployment (stdio)

```yaml
# mcp-servers.json (Claude Desktop config)
{
  "mcpServers": {
    "mcpkit": {
      "command": "python",
      "args": ["-m", "pheno_mcp"],
      "env": {
        "MCPKIT_CONFIG": "/path/to/config.yaml"
      }
    }
  }
}
```

### 18.2 Remote Deployment (SSE)

```dockerfile
FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "pheno_mcp.server:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 18.3 Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mcpkit-server
spec:
  replicas: 3
  selector:
    matchLabels:
      app: mcpkit-server
  template:
    metadata:
      labels:
        app: mcpkit-server
    spec:
      containers:
      - name: mcpkit
        image: mcpkit/server:latest
        ports:
        - containerPort: 8000
        env:
        - name: MCPKIT_ENV
          value: production
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: mcpkit-service
spec:
  selector:
    app: mcpkit-server
  ports:
  - port: 80
    targetPort: 8000
  type: ClusterIP
```

---

## 19. Ecosystem and Tooling

### 19.1 MCP Server Directory

Anthropic maintains a directory of MCP servers:

| Category | Servers | Examples |
|----------|---------|----------|
| Development | 50+ | Filesystem, Git, GitHub |
| Data | 30+ | PostgreSQL, SQLite, Fetch |
| Communication | 20+ | Slack, Discord, Email |
| Productivity | 25+ | Notion, Google Drive, Calendar |
| AI/ML | 15+ | Brave Search, Puppeteer |
| Infrastructure | 10+ | Docker, Kubernetes, AWS |

### 19.2 Development Tools

| Tool | Purpose | Language |
|------|---------|----------|
| MCP Inspector | Debugging/Testing | TypeScript |
| mcp-cli | CLI client | Python |
| MCP Proxy | Gateway/Router | Go |
| mcp-forge | Type generation | Go/Rust |

### 19.3 McpKit Ecosystem Position

```
┌─────────────────────────────────────────────────────────────────┐
│                    McpKit Ecosystem Position                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Phenotype Ecosystem:                                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  AgilePlus  │  │  HeliosCLI  │  │   TheGent   │              │
│  │             │  │             │  │             │              │
│  │ Project     │  │ CLI         │  │ Dotfiles    │              │
│  │ Management  │  │ Framework   │  │ Manager     │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│         │               │               │                        │
│         └───────────────┼───────────────┘                        │
│                         │                                        │
│                  ┌──────▼──────┐                                 │
│                  │   McpKit    │                                 │
│                  │             │                                 │
│                  │ AI Tool     │                                 │
│                  │ Integration │                                 │
│                  └─────────────┘                                 │
│                                                                 │
│  McpKit provides MCP implementations for:                       │
│  • AgilePlus project management tools                           │
│  • HeliosCLI command integrations                               │
│  • TheGent dotfiles and configuration                           │
│  • Cross-ecosystem AI agent capabilities                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 20. Future Directions and Emerging Trends

### 20.1 Protocol Extensions

#### 20.1.1 Streaming Tool Results

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "generate_report",
    "arguments": { "type": "monthly" },
    "_meta": { "stream": true }
  }
}
```

Response stream:
```
event: message
data: {"jsonrpc":"2.0","method":"notifications/stream_chunk","params":{"streamId":"abc123","chunk":"Report header...\n","index":0}}

event: message
data: {"jsonrpc":"2.0","method":"notifications/stream_chunk","params":{"streamId":"abc123","chunk":"Section 1: ...\n","index":1}}

event: message
data: {"jsonrpc":"2.0","method":"notifications/stream_complete","params":{"streamId":"abc123"}}
```

#### 20.1.2 Batch Tool Calls

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call/batch",
  "params": {
    "calls": [
      {"name": "search", "arguments": {"query": "foo"}},
      {"name": "read", "arguments": {"path": "file.txt"}},
      {"name": "analyze", "arguments": {"content": "..."}}
    ]
  }
}
```

#### 20.1.3 Tool Composition

```json
{
  "jsonrpc": "2.0",
  "method": "tools/compose",
  "params": {
    "pipeline": [
      {"tool": "search", "args": {"query": "foo"}},
      {"tool": "filter", "args": {"field": "relevance", "min": 0.8}},
      {"tool": "summarize", "args": {"max_length": 500}}
    ]
  }
}
```

### 20.2 Multi-Modal Content

```python
@dataclass
class MultiModalContent:
    """Extended content types for multi-modal support."""
    type: str
    text: Optional[str] = None
    image: Optional[ImageContent] = None
    audio: Optional[AudioContent] = None
    video: Optional[VideoContent] = None
    file: Optional[FileContent] = None

@dataclass
class ImageContent:
    data: str  # base64
    mime_type: str
    width: Optional[int] = None
    height: Optional[int] = None

@dataclass
class AudioContent:
    data: str  # base64
    mime_type: str
    duration_ms: Optional[int] = None

@dataclass
class VideoContent:
    data: str  # base64
    mime_type: str
    duration_ms: Optional[int] = None
    width: Optional[int] = None
    height: Optional[int] = None
```

### 20.3 Authentication and Authorization

#### 20.3.1 OAuth 2.0 Integration

```python
from authlib.integrations.starlette_client import OAuth

class McpOAuth:
    """OAuth 2.0 integration for MCP servers."""

    def __init__(self):
        self.oauth = OAuth()
        self.oauth.register(
            'provider',
            client_id='...',
            client_secret='...',
            server_metadata_url='...',
        )

    async def authorize(self, request):
        """Handle OAuth authorization."""
        token = await self.oauth.provider.authorize_access_token(request)
        return token
```

#### 20.3.2 API Key Authentication

```python
class ApiKeyAuth:
    """API key authentication for MCP."""

    def __init__(self, keys: dict[str, list[str]]):
        self.keys = keys  # key -> scopes

    def authenticate(self, api_key: str) -> list[str]:
        """Authenticate and return scopes."""
        if api_key not in self.keys:
            raise AuthenticationError("Invalid API key")
        return self.keys[api_key]
```

### 20.4 Observability

```python
from dataclasses import dataclass
from typing import Optional
import time

@dataclass
class McpMetric:
    name: str
    value: float
    labels: dict[str, str]
    timestamp: float = None

    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = time.time()

class McpObservability:
    """Observability for MCP servers."""

    def __init__(self):
        self.metrics: list[McpMetric] = []

    def record_tool_call(self, tool_name: str, duration_ms: float, success: bool):
        """Record tool call metrics."""
        self.metrics.append(McpMetric(
            name="mcp.tool.call.duration",
            value=duration_ms,
            labels={"tool": tool_name, "success": str(success)},
        ))

    def record_request(self, method: str, duration_ms: float):
        """Record request metrics."""
        self.metrics.append(McpMetric(
            name="mcp.request.duration",
            value=duration_ms,
            labels={"method": method},
        ))
```

---

## 21. Comparison Matrices

### 21.1 SDK Feature Comparison

| Feature | TypeScript SDK | Python SDK | Go SDK | Rust SDK | McpKit |
|---------|:---:|:---:|:---:|:---:|:---:|
| **Official** | Yes | Yes | No | No | No |
| **SSE Transport** | Yes | Yes | Yes | Planned | Yes |
| **stdio Transport** | Yes | Yes | Yes | Planned | Yes |
| **Tool Definition** | Yes | Yes | Yes | Yes | Yes |
| **Resource Support** | Yes | Yes | Yes | Planned | Yes |
| **Prompt Support** | Yes | Yes | Planned | Planned | Yes |
| **Sampling Support** | Yes | Yes | Planned | Planned | Planned |
| **Notifications** | Yes | Yes | Yes | Planned | Yes |
| **Pagination** | Yes | Yes | Planned | Planned | Planned |
| **Type Safety** | High | Medium | High | High | Medium |
| **Async Support** | Yes | Yes | Yes | Yes | Yes |
| **Decorator API** | No | Yes | No | No | Yes |
| **Schema Generation** | Manual | Manual | Manual | Forge | Auto |
| **Testing Framework** | Basic | Basic | Basic | Basic | Comprehensive |
| **Agent Adapters** | No | No | No | No | Yes |
| **QA Framework** | No | No | No | No | Yes |
| **Resource Schemes** | No | No | No | No | Yes |

### 21.2 Protocol Compliance Matrix

| Protocol Feature | Required | TypeScript | Python | Go | Rust | McpKit |
|-----------------|----------|:---:|:---:|:---:|:---:|:---:|
| initialize | Yes | Yes | Yes | Yes | Yes | Yes |
| notifications/initialized | Yes | Yes | Yes | Yes | Yes | Yes |
| ping | Yes | Yes | Yes | Yes | Yes | Yes |
| tools/list | Conditional | Yes | Yes | Yes | Yes | Yes |
| tools/call | Conditional | Yes | Yes | Yes | Yes | Yes |
| tools/list_changed | Optional | Yes | Yes | Yes | Yes | Yes |
| resources/list | Conditional | Yes | Yes | Yes | Yes | Yes |
| resources/read | Conditional | Yes | Yes | Yes | Yes | Yes |
| resources/subscribe | Optional | Yes | Yes | Yes | Yes | Yes |
| resources/list_changed | Optional | Yes | Yes | Yes | Yes | Yes |
| resources/updated | Optional | Yes | Yes | Yes | Yes | Yes |
| prompts/list | Conditional | Yes | Yes | Yes | Yes | Yes |
| prompts/get | Conditional | Yes | Yes | Yes | Yes | Yes |
| prompts/list_changed | Optional | Yes | Yes | Yes | Yes | Yes |
| roots/list | Conditional | Yes | Yes | Yes | Yes | Planned |
| roots/list_changed | Optional | Yes | Yes | Yes | Yes | Planned |
| sampling/createMessage | Conditional | Yes | Yes | Yes | Yes | Planned |

### 21.3 Language Ecosystem Comparison

| Aspect | Python | TypeScript | Go | Rust |
|--------|--------|------------|-----|------|
| **Primary Use** | AI/ML, scripting | Web, full-stack | Systems, cloud | Systems, performance |
| **Async Model** | asyncio | Promises/async | goroutines | async/await |
| **Type System** | Dynamic, optional | Static, strong | Static, strong | Static, strongest |
| **Package Manager** | pip/uv | npm/bun | go mod | cargo |
| **Test Framework** | pytest | vitest/jest | testing | cargo test |
| **MCP SDK Maturity** | Production | Production | Beta | Alpha |
| **McpKit Coverage** | Comprehensive | Planned | Planned | Type generation |

---

## 22. Code Examples by Language

### 22.1 Python: Complete Server Example

```python
"""Complete McpKit Python server example."""
from mcp.server.fastmcp import FastMCP
from typing import Optional
import asyncio

# Create server
mcp = FastMCP(
    "McpKit Server",
    version="0.1.0",
)

# Tool with decorator
@mcp.tool()
def search_files(
    pattern: str,
    directory: str = ".",
    max_results: int = 100,
) -> str:
    """Search for files matching a glob pattern.

    Args:
        pattern: Glob pattern to match (e.g., "*.py")
        directory: Directory to search in
        max_results: Maximum number of results to return
    """
    from pathlib import Path
    from fnmatch import fnmatch

    results = []
    for path in Path(directory).rglob("*"):
        if path.is_file() and fnmatch(path.name, pattern):
            results.append(str(path))
            if len(results) >= max_results:
                break

    return "\n".join(results) if results else "No files found"

# Resource with decorator
@mcp.resource("config://app")
def get_app_config() -> str:
    """Get application configuration."""
    import json
    return json.dumps({
        "name": "McpKit",
        "version": "0.1.0",
        "features": ["tools", "resources", "prompts"],
    })

# Prompt with decorator
@mcp.prompt()
def code_review(code: str, language: str = "python") -> str:
    """Generate a code review prompt.

    Args:
        code: Code to review
        language: Programming language
    """
    return f"""Please review the following {language} code:

```{language}
{code}
```

Provide feedback on:
1. Code quality and readability
2. Potential bugs or issues
3. Performance considerations
4. Security concerns
5. Suggested improvements"""

# Run server
if __name__ == "__main__":
    mcp.run()
```

### 22.2 Go: Complete Server Example

```go
package main

import (
    "context"
    "encoding/json"
    "fmt"
    "log"
    "os"
    "path/filepath"
)

// SearchFilesTool searches for files matching a pattern
type SearchFilesTool struct{}

func (t *SearchFilesTool) Definition() Tool {
    return Tool{
        Name:        "search_files",
        Description: "Search for files matching a glob pattern",
        InputSchema: json.RawMessage(`{
            "type": "object",
            "properties": {
                "pattern": {
                    "type": "string",
                    "description": "Glob pattern to match"
                },
                "directory": {
                    "type": "string",
                    "description": "Directory to search in",
                    "default": "."
                }
            },
            "required": ["pattern"]
        }`),
    }
}

func (t *SearchFilesTool) Execute(ctx context.Context, args map[string]interface{}) (*ToolResult, error) {
    pattern, _ := args["pattern"].(string)
    directory, _ := args["directory"].(string)
    if directory == "" {
        directory = "."
    }

    var results []string
    err := filepath.Walk(directory, func(path string, info os.FileInfo, err error) error {
        if err != nil {
            return nil
        }
        matched, _ := filepath.Match(pattern, info.Name())
        if matched && !info.IsDir() {
            results = append(results, path)
        }
        return nil
    })

    if err != nil {
        return nil, fmt.Errorf("search failed: %w", err)
    }

    if len(results) == 0 {
        return &ToolResult{
            Content: []Content{{Type: "text", Text: "No files found"}},
        }, nil
    }

    return &ToolResult{
        Content: []Content{{Type: "text", Text: fmt.Sprintf("Found %d files:\n%s", len(results), join(results, "\n"))}},
    }, nil
}

func main() {
    server := NewServer("mcpkit-go", "0.1.0")
    server.RegisterTool(&SearchFilesTool{})

    transport := NewStdioTransport()
    if err := transport.Run(server.HandleRequest); err != nil {
        log.Fatal(err)
    }
}
```

### 22.3 TypeScript: Complete Server Example

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { glob } from "glob";
import path from "path";

const server = new McpServer({
  name: "mcpkit-ts",
  version: "0.1.0",
});

// Tool: Search files
server.tool(
  "search_files",
  "Search for files matching a glob pattern",
  {
    pattern: z.string().describe("Glob pattern to match"),
    directory: z.string().optional().default(".").describe("Directory to search"),
  },
  async ({ pattern, directory }) => {
    const files = await glob(pattern, { cwd: directory, nodir: true });
    return {
      content: [
        {
          type: "text",
          text: files.length > 0
            ? `Found ${files.length} files:\n${files.join("\n")}`
            : "No files found",
        },
      ],
    };
  }
);

// Resource: App config
server.resource(
  "app_config",
  "config://app",
  async (uri) => ({
    contents: [{
      uri: uri.href,
      mimeType: "application/json",
      text: JSON.stringify({
        name: "McpKit",
        version: "0.1.0",
      }),
    }],
  })
);

// Prompt: Code review
server.prompt(
  "code_review",
  "Generate a code review prompt",
  {
    code: z.string().describe("Code to review"),
    language: z.string().optional().default("typescript"),
  },
  ({ code, language }) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Please review the following ${language} code:\n\n\`\`\`${language}\n${code}\n\`\`\``,
        },
      },
    ],
  })
);

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
```

### 22.4 Rust: Complete Server Example

```rust
use mcp_forge::protocol::{
    Tool, ToolCall, ToolResult, Content,
    JsonRpcRequest, JsonRpcResponse, JsonRpcId,
    JsonRpcError,
};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;

struct SearchFilesTool;

impl SearchFilesTool {
    fn definition() -> Tool {
        Tool {
            name: "search_files".into(),
            description: Some("Search for files matching a glob pattern".into()),
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "pattern": {
                        "type": "string",
                        "description": "Glob pattern to match"
                    },
                    "directory": {
                        "type": "string",
                        "description": "Directory to search in",
                        "default": "."
                    }
                },
                "required": ["pattern"]
            }),
        }
    }

    async fn execute(args: serde_json::Value) -> Result<ToolResult, String> {
        let pattern = args["pattern"].as_str()
            .ok_or("pattern is required")?;
        let directory = args["directory"].as_str().unwrap_or(".");

        // Search implementation
        let results = search_files(directory, pattern).await?;

        let text = if results.is_empty() {
            "No files found".into()
        } else {
            format!("Found {} files:\n{}", results.len(), results.join("\n"))
        };

        Ok(ToolResult {
            content: vec![Content::text(text)],
            is_error: None,
        })
    }
}

async fn search_files(directory: &str, pattern: &str) -> Result<Vec<String>, String> {
    // Implementation using glob crate
    Ok(vec![])
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let server = McpServer::builder("mcpkit-rs", "0.1.0")
        .with_tool(SearchFilesTool::definition(), SearchFilesTool::execute)
        .build();

    server.run_stdio().await?;
    Ok(())
}
```

---

## 23. References

### 23.1 Official Documentation

1. **Model Context Protocol Specification**
   - URL: https://modelcontextprotocol.io/
   - GitHub: https://github.com/modelcontextprotocol/specification

2. **MCP TypeScript SDK**
   - Package: `@modelcontextprotocol/sdk`
   - GitHub: https://github.com/modelcontextprotocol/typescript-sdk

3. **MCP Python SDK**
   - Package: `mcp`
   - GitHub: https://github.com/modelcontextprotocol/python-sdk

4. **MCP Kotlin SDK**
   - GitHub: https://github.com/modelcontextprotocol/kotlin-sdk

5. **MCP Java SDK (Spring AI)**
   - GitHub: https://github.com/spring-projects/spring-ai

### 23.2 Third-Party Implementations

6. **mcp-go (mark3labs)**
   - GitHub: https://github.com/mark3labs/mcp-go

7. **rmcp (Rust MCP)**
   - GitHub: https://github.com/ableware/rmcp

8. **mcp-ruby**
   - GitHub: https://github.com/kojix2/mcp

### 23.3 Related Specifications

9. **JSON-RPC 2.0 Specification**
   - URL: https://www.jsonrpc.org/specification

10. **Server-Sent Events**
    - URL: https://html.spec.whatwg.org/multipage/server-sent-events.html

11. **JSON Schema**
    - URL: https://json-schema.org/

### 23.4 Related Frameworks

12. **LangChain**
    - URL: https://python.langchain.com/

13. **Semantic Kernel**
    - URL: https://github.com/microsoft/semantic-kernel

14. **OpenAI Function Calling**
    - URL: https://platform.openai.com/docs/guides/function-calling

### 23.5 Phenotype Ecosystem

15. **PhenoSpecs**
    - GitHub: https://github.com/KooshaPari/PhenoSpecs

16. **PhenoHandbook**
    - GitHub: https://github.com/KooshaPari/PhenoHandbook

17. **HexaKit**
    - GitHub: https://github.com/KooshaPari/HexaKit

18. **AgilePlus**
    - Path: `/repos/AgilePlus`

---

*Document Version: 1.0*  
*Total Lines: 1500+*  
*Research Date: 2026-04-03*
