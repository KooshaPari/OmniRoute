# Kwality Platform Makefile
# Enhanced with PATH management and production-ready builds

PROJECT_NAME := kwality
GO_VERSION := 1.21
RUST_VERSION := 1.75
VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")

# Installation directories
INSTALL_DIR := ~/.kwality
BIN_DIR := $(INSTALL_DIR)/bin
CONFIG_DIR := $(INSTALL_DIR)/config
SYSTEM_BIN_DIR := /usr/local/bin

# Build directories
BUILD_DIR := build
DIST_DIR := dist

# Colors for output
RED := \033[0;31m
GREEN := \033[0;32m
YELLOW := \033[1;33m
BLUE := \033[0;34m
NC := \033[0m

.PHONY: help
help: ## Show this help message
	@echo "$(BLUE)Kwality Platform Build & Installation Commands$(NC)"
	@echo
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# Development setup
.PHONY: setup
setup: ## Set up development environment
	@echo "$(BLUE)Setting up development environment...$(NC)"
	@which go > /dev/null || (echo "$(RED)Go $(GO_VERSION) is required$(NC)" && exit 1)
	@which cargo > /dev/null || (echo "$(RED)Rust $(RUST_VERSION) is required$(NC)" && exit 1)
	@which docker > /dev/null || (echo "$(RED)Docker is required$(NC)" && exit 1)
	go mod download
	cd engines/runtime-validator && cargo build
	@echo "$(GREEN)Development environment ready!$(NC)"

.PHONY: deps
deps: ## Download and update dependencies
	@echo "$(BLUE)Updating dependencies...$(NC)"
	go mod download
	go mod tidy
	cd engines/runtime-validator && cargo update

# Building
.PHONY: build
build: build-go build-rust ## Build all components
	@echo "$(GREEN)All components built successfully!$(NC)"

.PHONY: build-go
build-go: ## Build Go applications
	@echo "$(BLUE)Building Go applications...$(NC)"
	@mkdir -p $(BUILD_DIR)
	CGO_ENABLED=0 go build -ldflags="-w -s -X main.version=$(VERSION)" -o $(BUILD_DIR)/kwality ./cmd/kwality
	CGO_ENABLED=0 go build -ldflags="-w -s -X main.version=$(VERSION)" -o $(BUILD_DIR)/kwality-cli ./cmd/kwality-cli
	@echo "$(GREEN)Go binaries built: $(BUILD_DIR)/kwality, $(BUILD_DIR)/kwality-cli$(NC)"

.PHONY: build-rust
build-rust: ## Build Rust runtime validator
	@echo "$(BLUE)Building Rust runtime validator...$(NC)"
	cd engines/runtime-validator && cargo build --release
	@mkdir -p $(BUILD_DIR)
	cp engines/runtime-validator/target/release/runtime-validator $(BUILD_DIR)/
	@echo "$(GREEN)Rust binary built: $(BUILD_DIR)/runtime-validator$(NC)"

.PHONY: build-release
build-release: clean build ## Clean and build release binaries
	@echo "$(GREEN)Release build completed for version $(VERSION)$(NC)"

# Installation
.PHONY: install
install: build ## Install globally (requires sudo)
	@echo "$(BLUE)Installing Kwality globally...$(NC)"
	sudo mkdir -p $(SYSTEM_BIN_DIR)
	sudo cp $(BUILD_DIR)/kwality $(SYSTEM_BIN_DIR)/
	sudo cp $(BUILD_DIR)/kwality-cli $(SYSTEM_BIN_DIR)/
	sudo cp $(BUILD_DIR)/runtime-validator $(SYSTEM_BIN_DIR)/
	sudo chmod +x $(SYSTEM_BIN_DIR)/kwality $(SYSTEM_BIN_DIR)/kwality-cli $(SYSTEM_BIN_DIR)/runtime-validator
	@echo "$(GREEN)Kwality installed globally to $(SYSTEM_BIN_DIR)$(NC)"

.PHONY: install-user
install-user: build ## Install for current user (no sudo required)
	@echo "$(BLUE)Installing Kwality for current user...$(NC)"
	mkdir -p $(BIN_DIR) $(CONFIG_DIR)
	cp $(BUILD_DIR)/kwality $(BIN_DIR)/
	cp $(BUILD_DIR)/kwality-cli $(BIN_DIR)/
	cp $(BUILD_DIR)/runtime-validator $(BIN_DIR)/
	chmod +x $(BIN_DIR)/kwality $(BIN_DIR)/kwality-cli $(BIN_DIR)/runtime-validator
	cp -r config/* $(CONFIG_DIR)/ 2>/dev/null || true
	cp .env.production.template $(CONFIG_DIR)/ 2>/dev/null || true
	cp docker-compose.production.yml $(CONFIG_DIR)/ 2>/dev/null || true
	@echo "$(GREEN)Kwality installed to $(BIN_DIR)$(NC)"
	@echo "$(YELLOW)Add to PATH: export PATH=\"$(BIN_DIR):\$$PATH\"$(NC)"

.PHONY: install-complete
install-complete: ## Complete installation with PATH setup
	@echo "$(BLUE)Running complete installation...$(NC)"
	./scripts/install-kwality.sh

.PHONY: setup-path
setup-path: ## Add Kwality to PATH (user installation)
	@echo "$(BLUE)Setting up PATH for Kwality...$(NC)"
	@SHELL_NAME=$$(basename "$$SHELL"); \
	case "$$SHELL_NAME" in \
		"bash") PROFILE_FILE="$$HOME/.bashrc"; [ -f "$$HOME/.bash_profile" ] && PROFILE_FILE="$$HOME/.bash_profile" ;; \
		"zsh") PROFILE_FILE="$$HOME/.zshrc" ;; \
		"fish") PROFILE_FILE="$$HOME/.config/fish/config.fish" ;; \
		*) PROFILE_FILE="$$HOME/.profile" ;; \
	esac; \
	if [ -f "$$PROFILE_FILE" ] && grep -q "$(BIN_DIR)" "$$PROFILE_FILE"; then \
		echo "$(YELLOW)PATH already configured in $$PROFILE_FILE$(NC)"; \
	else \
		echo "" >> "$$PROFILE_FILE"; \
		echo "# Kwality Platform" >> "$$PROFILE_FILE"; \
		echo "export PATH=\"$(BIN_DIR):\$$PATH\"" >> "$$PROFILE_FILE"; \
		echo "$(GREEN)Added Kwality to PATH in $$PROFILE_FILE$(NC)"; \
		echo "$(YELLOW)Restart your terminal or run: source $$PROFILE_FILE$(NC)"; \
	fi

# Testing
.PHONY: test
test: test-go test-rust ## Run all tests

.PHONY: test-go
test-go: ## Run Go tests
	@echo "$(BLUE)Running Go tests...$(NC)"
	go test -v -race -coverprofile=coverage.out ./...
	go tool cover -html=coverage.out -o coverage.html

.PHONY: test-rust
test-rust: ## Run Rust tests
	@echo "$(BLUE)Running Rust tests...$(NC)"
	cd engines/runtime-validator && cargo test --verbose

.PHONY: test-integration
test-integration: ## Run integration tests
	@echo "$(BLUE)Running integration tests...$(NC)"
	go test -v -tags=integration ./tests/integration/...

.PHONY: test-e2e
test-e2e: ## Run end-to-end tests
	@echo "$(BLUE)Running end-to-end tests...$(NC)"
	docker-compose -f docker-compose.kwality.yml up -d postgres redis
	@sleep 10
	go test -v -tags=e2e ./tests/e2e/...
	docker-compose -f docker-compose.kwality.yml down

# Code quality
.PHONY: lint
lint: lint-go lint-rust ## Run all linters

.PHONY: lint-go
lint-go: ## Run Go linter
	@echo "$(BLUE)Running Go linter...$(NC)"
	golangci-lint run --timeout=5m

.PHONY: lint-rust
lint-rust: ## Run Rust linter
	@echo "$(BLUE)Running Rust linter...$(NC)"
	cd engines/runtime-validator && cargo clippy --all-targets --all-features -- -D warnings

.PHONY: fmt
fmt: fmt-go fmt-rust ## Format all code

.PHONY: fmt-go
fmt-go: ## Format Go code
	@echo "$(BLUE)Formatting Go code...$(NC)"
	go fmt ./...
	goimports -w . 2>/dev/null || true

.PHONY: fmt-rust
fmt-rust: ## Format Rust code
	@echo "$(BLUE)Formatting Rust code...$(NC)"
	cd engines/runtime-validator && cargo fmt

.PHONY: check
check: lint test ## Run linters and tests

# Security
.PHONY: security
security: security-go security-rust ## Run security checks

.PHONY: security-go
security-go: ## Run Go security checks
	@echo "$(BLUE)Running Go security checks...$(NC)"
	gosec ./... || true

.PHONY: security-rust
security-rust: ## Run Rust security checks
	@echo "$(BLUE)Running Rust security checks...$(NC)"
	cd engines/runtime-validator && cargo audit || true

.PHONY: vuln-check
vuln-check: ## Check for known vulnerabilities
	@echo "$(BLUE)Checking for vulnerabilities...$(NC)"
	go list -json -deps ./... | nancy sleuth || true
	cd engines/runtime-validator && cargo audit || true

# Production operations
.PHONY: production-setup
production-setup: ## Set up production environment
	@echo "$(BLUE)Setting up production environment...$(NC)"
	./scripts/generate-secrets.sh
	@echo "$(GREEN)Production secrets generated$(NC)"
	@echo "$(YELLOW)Review .env.production before deployment$(NC)"

.PHONY: deploy-docker
deploy-docker: production-setup ## Deploy with Docker Compose
	@echo "$(BLUE)Deploying with Docker Compose...$(NC)"
	docker-compose -f docker-compose.production.yml up -d
	@echo "$(GREEN)Kwality deployed successfully$(NC)"
	@echo "$(YELLOW)Access at: https://localhost$(NC)"

.PHONY: deploy-k8s
deploy-k8s: production-setup ## Deploy to Kubernetes
	@echo "$(BLUE)Deploying to Kubernetes...$(NC)"
	kubectl apply -f k8s/kwality-deployment.production.yaml
	@echo "$(GREEN)Kwality deployed to Kubernetes$(NC)"

# Development
.PHONY: dev
dev: ## Start development environment
	@echo "$(BLUE)Starting development environment...$(NC)"
	docker-compose -f docker-compose.kwality.yml up -d postgres redis
	@sleep 5
	@echo "$(GREEN)Development environment ready!$(NC)"

.PHONY: dev-stop
dev-stop: ## Stop development environment
	@echo "$(BLUE)Stopping development environment...$(NC)"
	docker-compose -f docker-compose.kwality.yml down

.PHONY: run
run: build-go ## Run the Kwality server locally
	@echo "$(BLUE)Starting Kwality server...$(NC)"
	./$(BUILD_DIR)/kwality

.PHONY: run-cli
run-cli: build-go ## Run the Kwality CLI
	@echo "$(BLUE)Running Kwality CLI...$(NC)"
	./$(BUILD_DIR)/kwality-cli

# Utilities
.PHONY: clean
clean: ## Clean build artifacts
	@echo "$(BLUE)Cleaning build artifacts...$(NC)"
	rm -rf $(BUILD_DIR)/
	rm -rf engines/runtime-validator/target/
	rm -f coverage.out coverage.html
	docker system prune -f 2>/dev/null || true

.PHONY: clean-all
clean-all: clean ## Clean everything including Docker volumes
	@echo "$(BLUE)Cleaning all artifacts and volumes...$(NC)"
	docker-compose -f docker-compose.kwality.yml down -v 2>/dev/null || true
	docker system prune -af --volumes 2>/dev/null || true

.PHONY: uninstall
uninstall: ## Uninstall Kwality
	@echo "$(BLUE)Uninstalling Kwality...$(NC)"
	rm -rf $(INSTALL_DIR)
	sudo rm -f $(SYSTEM_BIN_DIR)/kwality $(SYSTEM_BIN_DIR)/kwality-cli $(SYSTEM_BIN_DIR)/runtime-validator 2>/dev/null || true
	@echo "$(GREEN)Kwality uninstalled$(NC)"
	@echo "$(YELLOW)Note: PATH entries in shell configs need manual removal$(NC)"

.PHONY: version
version: ## Show version information
	@echo "Version: $(VERSION)"
	@echo "Go version: $(shell go version)"
	@echo "Rust version: $(shell cd engines/runtime-validator && cargo --version 2>/dev/null || echo 'not available')"
	@echo "Docker version: $(shell docker --version 2>/dev/null || echo 'not available')"

# Documentation
.PHONY: docs
docs: ## Generate documentation
	@echo "$(BLUE)Generating documentation...$(NC)"
	go doc -all ./... > docs/api-reference.md
	cd engines/runtime-validator && cargo doc --no-deps 2>/dev/null || true

# Release
.PHONY: release
release: check build-release ## Prepare a release
	@echo "$(BLUE)Preparing release $(VERSION)...$(NC)"
	@mkdir -p $(DIST_DIR)
	@cp $(BUILD_DIR)/* $(DIST_DIR)/
	@echo "$(GREEN)Release $(VERSION) ready in $(DIST_DIR)/$(NC)"

# Help for specific workflows
.PHONY: help-dev
help-dev: ## Show development workflow help
	@echo "$(BLUE)Development Workflow:$(NC)"
	@echo "1. $(GREEN)make setup$(NC)         - Set up development environment"
	@echo "2. $(GREEN)make dev$(NC)           - Start local services (DB, Redis)"
	@echo "3. $(GREEN)make build$(NC)         - Build all components"
	@echo "4. $(GREEN)make test$(NC)          - Run tests"
	@echo "5. $(GREEN)make run$(NC)           - Start the server"
	@echo "6. $(GREEN)make dev-stop$(NC)      - Stop local services"

.PHONY: help-install
help-install: ## Show installation help
	@echo "$(BLUE)Installation Options:$(NC)"
	@echo "1. $(GREEN)make install$(NC)           - Global installation (requires sudo)"
	@echo "2. $(GREEN)make install-user$(NC)      - User installation"
	@echo "3. $(GREEN)make install-complete$(NC)  - Complete installation with PATH setup"
	@echo "4. $(GREEN)make setup-path$(NC)        - Add to PATH only"

.PHONY: help-production
help-production: ## Show production deployment help
	@echo "$(BLUE)Production Deployment:$(NC)"
	@echo "1. $(GREEN)make production-setup$(NC)  - Generate secrets and config"
	@echo "2. $(GREEN)make deploy-docker$(NC)     - Deploy with Docker Compose"
	@echo "3. $(GREEN)make deploy-k8s$(NC)        - Deploy to Kubernetes"
	@echo "4. $(GREEN)make security$(NC)          - Run security checks"

.PHONY: all
all: setup build test security ## Run complete build and test cycle