# Multi-stage build for Rust runtime validator
FROM rust:1.75-slim-bullseye AS builder

# Install system dependencies for building
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy Cargo files
COPY Cargo.toml Cargo.lock ./

# Copy source code
COPY src/ ./src/

# Build the application in release mode
RUN cargo build --release

# Runtime stage - multi-language execution environment
FROM ubuntu:22.04

# Install runtime dependencies and language toolchains
RUN apt-get update && apt-get install -y \
    # System utilities
    curl \
    wget \
    git \
    ca-certificates \
    # Language runtimes
    python3 \
    python3-pip \
    nodejs \
    npm \
    openjdk-17-jdk \
    # Go installation
    && curl -fsSL https://golang.org/dl/go1.21.5.linux-amd64.tar.gz | tar -xzC /usr/local \
    # Rust installation  
    && curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y \
    # Cleanup
    && rm -rf /var/lib/apt/lists/*

# Set up environment variables
ENV PATH="/usr/local/go/bin:/root/.cargo/bin:${PATH}"
ENV GOPATH="/go"
ENV GOCACHE="/go-cache"

# Create workspace directories
RUN mkdir -p /workspace /go /go-cache \
    && chmod 755 /workspace /go /go-cache

# Install additional language tools
RUN pip3 install --no-cache-dir \
    pylint \
    bandit \
    safety \
    pytest

# Install Node.js tools
RUN npm install -g \
    eslint \
    @typescript-eslint/parser \
    @typescript-eslint/eslint-plugin \
    typescript

# Install Go tools
RUN go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest \
    && go install honnef.co/go/tools/cmd/staticcheck@latest

# Install Rust tools
RUN /root/.cargo/bin/rustup component add clippy rustfmt \
    && /root/.cargo/bin/cargo install cargo-audit cargo-deny

# Copy the built runtime validator
COPY --from=builder /app/target/release/runtime-validator /usr/local/bin/

# Create non-root user for security
RUN useradd -m -u 1000 validator \
    && chown -R validator:validator /workspace

# Set working directory
WORKDIR /workspace

# Switch to non-root user
USER validator

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD runtime-validator --health-check || exit 1

# Default command
CMD ["runtime-validator"]