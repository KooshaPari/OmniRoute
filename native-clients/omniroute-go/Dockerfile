# syntax=docker/dockerfile:1.7
# OmniRoute (Go) — distroless, single static binary, no shell, no package manager.
# Build from the omniroute-go module root (this directory).

FROM golang:1.26 AS build
WORKDIR /src
COPY go.mod go.sum* ./
RUN go mod download
COPY . .
ARG VERSION=0.1.0-dev
ARG COMMIT=none
ARG BUILT_AT=unknown
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -trimpath -ldflags="-s -w \
      -X github.com/kooshapari/omniroute-go/internal/proxy.Version=${VERSION} \
      -X github.com/kooshapari/omniroute-go/internal/proxy.Commit=${COMMIT} \
      -X github.com/kooshapari/omniroute-go/internal/proxy.BuiltAt=${BUILT_AT}" \
    -o /out/omniroute ./cmd/omniroute

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/omniroute /usr/local/bin/omniroute
USER nonroot:nonroot
EXPOSE 8080
ENV OMNIROUTE_LISTEN=:8080 \
    OMNIROUTE_DATA_DIR=/var/lib/omniroute
VOLUME ["/var/lib/omniroute"]
ENTRYPOINT ["/usr/local/bin/omniroute"]
CMD ["start"]
