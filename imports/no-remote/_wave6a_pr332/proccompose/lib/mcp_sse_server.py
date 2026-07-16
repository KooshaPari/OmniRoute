"""
proccompose SSE/HTTP MCP transport.

A tiny stdlib-only Python HTTP server that proxies JSON-RPC 2.0 requests
to `proccompose serve-stdio` (the bash MCP transport) and returns responses
either as JSON (POST /jsonrpc) or as Server-Sent Events (GET /sse).

Endpoints:
  GET  /health      liveness probe
  GET  /tools       passthrough: initialize + tools/list
  POST /jsonrpc     full JSON-RPC 2.0 request/response (single request per call)
  GET  /sse         Server-Sent Events; each 'data:' line is a JSON-RPC response
                    the client can issue requests via POST /jsonrpc OR via
                    '?' query params (?method=...&id=...&params=...)
"""
import json
import os
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

PORT = int(os.environ.get("PORT", "4323"))
PROCCOMPOSE_BIN = os.environ.get("PROCCOMPOSE_BIN", os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "proccompose"))


def call_stdio(method, params, rpc_id):
    """Send one JSON-RPC request to the proccompose serve-stdio subprocess."""
    req = {"jsonrpc": "2.0", "id": str(rpc_id), "method": method, "params": params or {}}
    payload = json.dumps(req) + "\n"
    try:
        proc = subprocess.run(
            [PROCCOMPOSE_BIN, "serve-stdio"],
            input=payload.encode("utf-8"),
            capture_output=True,
            timeout=30,
        )
        out = proc.stdout.decode("utf-8", errors="replace").strip()
        # The stdio transport prints one JSON-RPC response per line
        for line in out.splitlines():
            line = line.strip()
            if not line.startswith("{"):
                continue
            try:
                return json.loads(line)
            except json.JSONDecodeError:
                continue
        return {"jsonrpc": "2.0", "id": str(rpc_id), "error": {"code": -32603, "message": f"no JSON-RPC response (stderr: {proc.stderr[:200]})"}}
    except subprocess.TimeoutExpired:
        return {"jsonrpc": "2.0", "id": str(rpc_id), "error": {"code": -32603, "message": "stdio transport timeout"}}
    except FileNotFoundError as e:
        return {"jsonrpc": "2.0", "id": str(rpc_id), "error": {"code": -32603, "message": f"proccompose not found: {e}"}}


def call_via_args(method, params):
    """Run a proccompose subcommand directly (fallback for tools that hang via stdio)."""
    sub = method.replace("proccompose_", "").replace("_", "-")
    args = []
    if isinstance(params, dict):
        args = params.get("args", [])
        if not args and "arguments" in params:
            args = params["arguments"].get("args", [])
    try:
        proc = subprocess.run([PROCCOMPOSE_BIN, sub] + list(args), capture_output=True, timeout=30)
        return {
            "jsonrpc": "2.0",
            "id": None,
            "result": {
                "content": [{"type": "text", "text": proc.stdout.decode("utf-8", errors="replace")}],
                "stderr": proc.stderr.decode("utf-8", errors="replace"),
                "rc": proc.returncode,
                "isError": proc.returncode != 0,
            },
        }
    except Exception as e:
        return {"jsonrpc": "2.0", "id": None, "error": {"code": -32603, "message": str(e)}}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        sys.stderr.write("[proccompose-sse] " + (fmt % args) + "\n")

    def _send_json(self, status, body):
        data = json.dumps(body).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(data)

    def _proxy(self, body):
        """Proxy a JSON-RPC body via the stdio subprocess."""
        method = body.get("method")
        params = body.get("params") or {}
        rpc_id = body.get("id")
        if not method:
            return {"jsonrpc": "2.0", "id": rpc_id, "error": {"code": -32600, "message": "missing method"}}
        # Use the direct-args path for tools/call (works reliably); stdio for everything else
        if method == "tools/call":
            return call_via_args(params.get("name", ""), params.get("arguments", {}))
        resp = call_stdio(method, params, rpc_id)
        # Fall back to direct call if stdio returned nothing useful
        if resp.get("error", {}).get("code") == -32603:
            fallback = call_via_args(method.replace("proccompose_", "").replace("_", "-"), params)
            if fallback.get("result"):
                return fallback
        return resp

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/health":
            return self._send_json(200, {"ok": True, "service": "proccompose-sse", "version": "1.0.0", "stdio_backend": PROCCOMPOSE_BIN})
        if path == "/tools":
            # initialize + tools/list chained via stdio
            init = call_stdio("initialize", {}, "init")
            tools = call_stdio("tools/list", {}, "list")
            return self._send_json(200, {
                "initialize": init.get("result", {}),
                "tools": tools.get("result", {}).get("tools", []),
            })
        if path == "/sse":
            # Accept ?method=...&id=...&params=<json> for one-shot SSE responses
            qs = parse_qs(urlparse(self.url if hasattr(self, 'url') else self.path).query)
            method = (qs.get("method") or ["initialize"])[0]
            rpc_id = (qs.get("id") or ["sse"])[0]
            params_raw = (qs.get("params") or ["{}"])[0]
            try:
                params = json.loads(params_raw)
            except json.JSONDecodeError:
                params = {}
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Connection", "keep-alive")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            # Stream a 'ready' event with the tool list as the initial payload
            ready = {"jsonrpc": "2.0", "method": "ready", "params": {}}
            self.wfile.write(f"event: ready\ndata: {json.dumps(ready)}\n\n".encode("utf-8"))
            self.wfile.flush()
            # Now respond to the actual request and emit a 'data:' line
            resp = self._proxy({"jsonrpc": "2.0", "id": rpc_id, "method": method, "params": params})
            self.wfile.write(f"event: message\ndata: {json.dumps(resp)}\n\n".encode("utf-8"))
            self.wfile.flush()
            # Heartbeat until client disconnects
            try:
                while True:
                    time.sleep(15)
                    self.wfile.write(b": heartbeat\n\n")
                    self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError):
                pass
            return
        return self._send_json(404, {"error": "not found"})

    def do_POST(self):
        path = urlparse(self.path).path
        if path != "/jsonrpc":
            return self._send_json(404, {"error": "not found"})
        length = int(self.headers.get("Content-Length", "0"))
        try:
            body = json.loads(self.rfile.read(length).decode("utf-8") or "{}")
        except json.JSONDecodeError as e:
            return self._send_json(400, {"jsonrpc": "2.0", "id": None, "error": {"code": -32700, "message": f"parse error: {e}"}})
        return self._send_json(200, self._proxy(body))

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()


def main():
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    sys.stderr.write(f"[proccompose-sse] listening on http://0.0.0.0:{PORT}\n")
    sys.stderr.write(f"[proccompose-sse] stdio backend: {PROCCOMPOSE_BIN}\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
