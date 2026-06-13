# Multi-stage build for Go orchestration service
FROM golang:1.21-alpine AS builder

# Install build dependencies
RUN apk add --no-cache git ca-certificates tzdata

# Create app directory
WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY cmd/ ./cmd/
COPY internal/ ./internal/
COPY pkg/ ./pkg/

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o kwality ./cmd/kwality

# Runtime stage
FROM alpine:3.18

# Install runtime dependencies
RUN apk add --no-cache \
    ca-certificates \
    tzdata \
    curl \
    git \
    docker-cli

# Create app directory and user
RUN addgroup -g 1000 kwality && \
    adduser -D -s /bin/sh -u 1000 -G kwality kwality

WORKDIR /app

# Copy binary from builder stage
COPY --from=builder /app/kwality .

# Copy configuration files if they exist
COPY config/ ./config/ 2>/dev/null || true

# Set ownership
RUN chown -R kwality:kwality /app

# Switch to non-root user
USER kwality

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Default command
CMD ["./kwality"]