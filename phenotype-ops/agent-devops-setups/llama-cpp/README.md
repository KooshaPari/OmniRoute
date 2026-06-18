# llama-cpp — pheno-mcp-router + llama.cpp server stack

Two-container Docker Compose stack that brings up a local llama.cpp
server alongside a `pheno-mcp-router` MCP server. The router talks to
llama.cpp via `LlamaAdapter` (server mode); cost / budget / quota /
audit tracking is enabled via `CostAwareLlmAdapter`.

This stack is the **dogfood target** for Steps 5–7 of the
Dmouse92 → pheno-mcp-router migration (L5-104). It is intentionally
minimal — production deployments should add reverse-proxy TLS,
persistent volume for the audit JSONL sink, and a metrics sidecar.

## Quick start (server mode, CPU)

```bash
mkdir -p models
curl -L -o models/llama-3-8b-instruct.Q4_K_M.gguf \
  https://huggingface.co/.../llama-3-8b-instruct.Q4_K_M.gguf

MODEL_FILE=llama-3-8b-instruct.Q4_K_M.gguf docker compose up -d
curl http://localhost:8080/health        # llama.cpp
curl http://localhost:20128/health       # pheno-mcp-router
```

## Modes

### Server mode (default — recommended)

- llama.cpp loads the GGUF in a separate container and exposes
  `/completion` + `/v1/chat/completions`.
- `pheno-mcp-router` connects to it via `LLAMA_CPP_SERVER_URL`.
- Either `LlamaAdapter` (server-mode branch) or `OpenAICompatAdapter`
  (with `OPENAI_COMPAT_BASE_URL=http://llama-cpp:8080/v1`) works.

### Direct mode

- Drop the `llama-cpp` service and the `depends_on` block.
- Mount the GGUF into the `pheno-mcp-router` container:
  ```yaml
  volumes:
    - ./models:/models:ro
  environment:
    - LLAMA_CPP_MODEL_PATH=/models/llama-3-8b-instruct.Q4_K_M.gguf
  ```
- `LlamaAdapter` will load the model in-process via
  `llama-cpp-python` (slower startup, but no sidecar needed).

## Files

- `Dockerfile` — pheno-mcp-router image with llama extras.
- `docker-compose.yml` — two-service stack (llama-cpp sidecar +
  pheno-mcp-router MCP server).

## Environment variables

### pheno-mcp-router service

| Variable                          | Purpose                                              |
| :-------------------------------- | :--------------------------------------------------- |
| `PHENO_MCP_ROUTER_PORT`           | MCP server port (default 20128).                     |
| `LLAMA_CPP_SERVER_URL`            | Server-mode endpoint (server mode only).             |
| `LLAMA_CPP_MODEL_PATH`            | Direct-mode in-container GGUF path (direct mode only). |
| `PHENO_MCP_COST_TRACKING`         | `enabled` to wrap LlamaAdapter in CostAwareLlmAdapter. |
| `OMNIROUTE_URL`                   | Optional: route through OmniRoute fleet.             |
| `LOG_LEVEL`                       | Python logging level.                                |

### llama-cpp service

| Variable                  | Purpose                                                  |
| :------------------------ | :------------------------------------------------------- |
| `LLAMA_CPP_MODEL_PATH`    | Path to the GGUF file inside the container.              |
| `LLAMA_CPP_N_CTX`         | Context window (default 4096).                           |
| `LLAMA_CPP_N_GPU_LAYERS`  | GPU layers (-1 = all, 0 = CPU-only).                     |
| `LLAMA_CPP_PORT`          | Listen port (default 8080).                              |
| `MODEL_FILE`              | Filename under `./models/` on the host.                 |

## Source

Ported from `KooshaPari/dispatch-mcp` W2-1 (`docker/Dockerfile.llama`
+ `docker/llama-compose.yml`) per L5-104.1 §Step 7. Adaptations:

- Renamed dispatch-mcp → pheno-mcp-router throughout.
- Updated env-var names to match the substrate:
  `DISPATCH_COST_TRACKING` → `PHENO_MCP_COST_TRACKING`,
  `OMNIROUTE_URL` kept as-is (OmniRoute is the canonical fleet
  router for both stacks).
- CMake `build` context points at the pheno-mcp-router repo root
  (`../..`) so the Dockerfile can `COPY src/ src/`.
