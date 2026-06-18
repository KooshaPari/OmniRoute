FROM python:3.13-slim

LABEL org.opencontainers.image.source="https://github.com/KooshaPari/pheno-mcp-router"
LABEL org.opencontainers.image.description="pheno-mcp-router with LlamaAdapter (server + direct modes)"
LABEL org.opencontainers.image.licenses="Apache-2.0"

WORKDIR /app

# Install system deps for llama-cpp-python (build-essential for the
# C++ extension when running direct mode; curl for llama.cpp server
# healthchecks).
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy project files. Adjust the build context when wiring this into
# a downstream image — see ../README.md for the canonical
# multi-stage pattern.
COPY pyproject.toml README.md ./
COPY src/ src/

# Install pheno-mcp-router with the llama extras (pulls in
# llama-cpp-python for direct mode).
RUN pip install --no-cache-dir ".[llama]"

# Expose the MCP server port (configurable via PHENO_MCP_ROUTER_PORT).
EXPOSE 20128

# Default: start pheno-mcp-router MCP server. Override CMD to run a
# llama.cpp server sidecar (see docker-compose.yml) when the
# LlamaAdapter is configured for server mode
# (LLAMA_CPP_SERVER_URL pointing at the sidecar).
CMD ["python", "-m", "pheno_mcp_router.server"]
