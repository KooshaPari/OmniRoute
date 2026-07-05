# OmniRoute (Go) — build, test, ship
#
# Targets:
#   make build         build the omniroute binary for the host
#   make test          run unit + contract tests
#   make cover         run tests with coverage
#   make vet           go vet
#   make fmt           go fmt
#   make smoke         build + run a mock-backed smoke on :18080
#   make cross         cross-compile to linux+darwin, amd64+arm64
#   make image         build a distroless container image
#   make clean         remove built artifacts

BINARY        ?= omniroute
VERSION       ?= 0.1.0-dev
COMMIT        := $(shell git rev-parse --short HEAD 2>/dev/null || echo "none")
BUILT_AT      := $(shell date -u +%Y-%m-%dT%H:%M:%SZ)
LDFLAGS       := -s -w \
                 -X github.com/kooshapari/omniroute-go/internal/proxy.Version=$(VERSION) \
                 -X github.com/kooshapari/omniroute-go/internal/proxy.Commit=$(COMMIT) \
                 -X github.com/kooshapari/omniroute-go/internal/proxy.BuiltAt=$(BUILT_AT)

PLATFORMS := linux/amd64 linux/arm64 darwin/amd64 darwin/arm64

.PHONY: build test cover vet fmt smoke cross image clean tidy

build:
	CGO_ENABLED=0 go build -trimpath -ldflags="$(LDFLAGS)" -o $(BINARY) ./cmd/omniroute

test:
	go test ./... -count=1

cover:
	go test ./... -count=1 -coverprofile=coverage.out
	go tool cover -func=coverage.out | tail -1

vet:
	go vet ./...

fmt:
	gofmt -w .

tidy:
	go mod tidy

# Smoke: build, start with --mock on :18080, hit endpoints, kill.
smoke: build
	@OMNIROUTE_DATA_DIR=$$(mktemp -d) ./$(BINARY) start --mock --listen 127.0.0.1:18080 > /tmp/$(BINARY)-smoke.log 2>&1 & \
	  echo $$! > /tmp/$(BINARY)-smoke.pid; sleep 1; \
	  echo "--- /healthz ---"; curl -sS -m 5 http://127.0.0.1:18080/healthz; echo; \
	  echo "--- /v1/chat/completions (non-stream) ---"; \
	  curl -sS -m 5 -X POST http://127.0.0.1:18080/v1/chat/completions \
	    -H 'content-type: application/json' \
	    -d '{"model":"mock-gpt","messages":[{"role":"user","content":"hello smoke"}]}'; echo; \
	  echo "--- /v1/chat/completions (stream) ---"; \
	  curl -sS -m 5 -N -X POST http://127.0.0.1:18080/v1/chat/completions \
	    -H 'content-type: application/json' \
	    -d '{"model":"mock-gpt","messages":[{"role":"user","content":"stream smoke"}],"stream":true}' | head -c 600; echo; \
	  kill $$(cat /tmp/$(BINARY)-smoke.pid) 2>/dev/null || true

# Cross-compile to all supported platforms.
cross:
	@mkdir -p dist
	@for p in $(PLATFORMS); do \
	  GOOS=$${p%/*} GOARCH=$${p#*/} CGO_ENABLED=0 \
	    go build -trimpath -ldflags="$(LDFLAGS)" \
	    -o dist/$(BINARY)-$${p%/*}-$${p#*/} ./cmd/omniroute; \
	  echo "  built dist/$(BINARY)-$${p%/*}-$${p#*/}"; \
	done
	@ls -la dist

# Container image (distroless).
image:
	docker build -t omniroute:$(VERSION) -t omniroute:dev .
	docker images | grep omniroute

clean:
	rm -f $(BINARY) coverage.out
	rm -rf dist
