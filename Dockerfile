# syntax=docker/dockerfile:1.7
ARG NODE_VERSION=22.10.0
ARG RUST_VERSION=1.85

FROM node:${NODE_VERSION}-bookworm-slim AS web
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@10.33.2 --activate
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages packages
COPY apps/web apps/web
COPY tsconfig.base.json ./
RUN pnpm install --frozen-lockfile
RUN pnpm --filter web build

FROM rust:${RUST_VERSION}-bookworm AS gateway
WORKDIR /repo
RUN apt-get update && apt-get install -y --no-install-recommends pkg-config libssl-dev ca-certificates && rm -rf /var/lib/apt/lists/*
COPY Cargo.toml ./
COPY crates crates
RUN cargo build --release -p omniroute-gateway

FROM debian:bookworm-slim AS runtime
ARG NODE_VERSION=NODE_VERSION_PLACEHOLDER
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=web /repo/apps/web/build ./web
COPY --from=gateway /repo/target/release/omniroute-gateway ./bin/omniroute-gateway
COPY --from=gateway /repo/target/release/libomniroute_gateway.so ./bin/libomniroute_gateway.so
ENV NODE_ENV=production
EXPOSE 5173
CMD ["./bin/omniroute-gateway"]
