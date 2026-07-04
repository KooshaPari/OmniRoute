FROM rust:1.87-slim AS builder
WORKDIR /app
COPY . .
RUN cargo build --release --locked
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y libssl3 ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/sharecli /usr/local/bin/sharecli
ENTRYPOINT ["sharecli"]
