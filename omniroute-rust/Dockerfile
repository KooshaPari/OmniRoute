# Multi-stage Dockerfile for OmniRoute (Rust) — distroless final image.
# Build: docker build -t omniroute:latest -f Dockerfile ..
# Run:   docker run --rm -p 9090:9090 -v omniroute-data:/data omniroute:latest

FROM rust:1.86-slim-bookworm AS builder

ENV CARGO_TERM_COLOR=always \
    CARGO_HOME=/usr/local/cargo \
    RUSTUP_HOME=/usr/local/rustup

RUN apt-get update && apt-get install -y --no-install-recommends \
        pkg-config libssl-dev ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /build

# Cache deps first
COPY Cargo.toml Cargo.lock ./
COPY crates ./crates
RUN mkdir -p /build/src && echo "fn main(){}" > /build/src/main.rs && \
    cargo build --release --workspace --locked && \
    rm -rf /build/src

# Real build
COPY . .
RUN cargo build --release --workspace --locked

# Final stage — distroless for minimal CVE surface
FROM gcr.io/distroless/cc-debian12:nonroot

LABEL org.opencontainers.image.title="omniroute" \
      org.opencontainers.image.description="OmniRoute — unified AI router (Rust rewrite)" \
      org.opencontainers.image.source="https://github.com/KooshaPari/OmniRoute" \
      org.opencontainers.image.licenses="MIT"

COPY --from=builder /build/target/release/omni-server /usr/local/bin/omni-server
COPY --from=builder /build/target/release/omniroute   /usr/local/bin/omniroute

USER nonroot:nonroot
EXPOSE 9090

ENV OMNIROUTE_DATA_DIR=/data \
    RUST_LOG=info

VOLUME ["/data"]
ENTRYPOINT ["/usr/local/bin/omni-server"]
