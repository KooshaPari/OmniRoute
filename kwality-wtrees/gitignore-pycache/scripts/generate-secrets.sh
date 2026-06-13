#!/bin/bash

# Kwality Production Secret Generation Script
# Generates secure secrets for production deployment

set -euo pipefail

# Configuration
SECRETS_DIR="./secrets"
NAMESPACE="kwality"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Generate secure random password
generate_password() {
    local length=${1:-32}
    openssl rand -base64 $length | tr -d "=+/" | cut -c1-$length
}

# Generate JWT secret (256-bit)
generate_jwt_secret() {
    openssl rand -base64 64 | tr -d "=+/" | cut -c1-64
}

# Create secrets directory
create_secrets_dir() {
    if [ ! -d "$SECRETS_DIR" ]; then
        mkdir -p "$SECRETS_DIR"
        chmod 700 "$SECRETS_DIR"
        log_info "Created secrets directory: $SECRETS_DIR"
    fi
}

# Generate all secrets
generate_secrets() {
    log_info "Generating production secrets..."
    
    # Database password
    DB_PASSWORD=$(generate_password 32)
    echo -n "$DB_PASSWORD" > "$SECRETS_DIR/db-password.txt"
    chmod 600 "$SECRETS_DIR/db-password.txt"
    
    # Redis password
    REDIS_PASSWORD=$(generate_password 32)
    echo -n "$REDIS_PASSWORD" > "$SECRETS_DIR/redis-password.txt"
    chmod 600 "$SECRETS_DIR/redis-password.txt"
    
    # JWT secret
    JWT_SECRET=$(generate_jwt_secret)
    echo -n "$JWT_SECRET" > "$SECRETS_DIR/jwt-secret.txt"
    chmod 600 "$SECRETS_DIR/jwt-secret.txt"
    
    # Grafana admin password
    GRAFANA_PASSWORD=$(generate_password 24)
    echo -n "$GRAFANA_PASSWORD" > "$SECRETS_DIR/grafana-admin-password.txt"
    chmod 600 "$SECRETS_DIR/grafana-admin-password.txt"
    
    # API key for system integration
    API_KEY=$(generate_password 40)
    echo -n "$API_KEY" > "$SECRETS_DIR/api-key.txt"
    chmod 600 "$SECRETS_DIR/api-key.txt"
    
    log_success "Generated all secrets in $SECRETS_DIR/"
}

# Create .env.production file
create_env_file() {
    log_info "Creating .env.production file..."
    
    cat > .env.production << EOF
# Kwality Production Environment Variables
# Generated on $(date)
# DO NOT COMMIT THIS FILE TO VERSION CONTROL

# Server Configuration
KWALITY_ENV=production
KWALITY_PORT=8080
KWALITY_HOST=0.0.0.0

# Database Configuration
DB_HOST=postgres
DB_PORT=5432
DB_USERNAME=kwality
DB_PASSWORD=$(cat "$SECRETS_DIR/db-password.txt")
DB_DATABASE=kwality
DB_SSL_MODE=require
DB_MAX_CONNS=50
DB_MAX_IDLE_CONNS=10

# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=$(cat "$SECRETS_DIR/redis-password.txt")
REDIS_DB=0
REDIS_POOL_SIZE=20

# Security Configuration
JWT_SECRET=$(cat "$SECRETS_DIR/jwt-secret.txt")
API_KEY_HEADER=X-API-Key
RATE_LIMIT_RPS=50
CORS_ORIGINS=https://kwality.yourdomain.com
SESSION_TIMEOUT=8h

# Grafana Configuration
GRAFANA_ADMIN_PASSWORD=$(cat "$SECRETS_DIR/grafana-admin-password.txt")

# Runtime Validation
RUNTIME_CONTAINER_IMAGE=kwality/runner:latest
RUNTIME_MEMORY_LIMIT_MB=1024
RUNTIME_CPU_LIMIT_CORES=2.0
RUNTIME_TIMEOUT_SECONDS=600
RUNTIME_NETWORK_ISOLATION=true

# Security Scanning
SECURITY_ENABLED_SCANNERS=semgrep,gosec,bandit,trivy
SECURITY_SECRETS_DETECTION=true
SECURITY_DEPENDENCY_SCANNING=true

# Orchestrator
ORCHESTRATOR_MAX_WORKERS=20
ORCHESTRATOR_QUEUE_SIZE=500
ORCHESTRATOR_TIMEOUT_MINUTES=60

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
LOG_OUTPUT=stdout

# Production Flags
PRODUCTION_MODE=true
DEBUG_MODE=false
EOF

    chmod 600 .env.production
    log_success "Created .env.production file"
}

# Create Kubernetes secrets
create_k8s_secrets() {
    log_info "Creating Kubernetes secrets..."
    
    # Check if kubectl is available
    if ! command -v kubectl &> /dev/null; then
        log_warning "kubectl not found. Skipping Kubernetes secret creation."
        return
    fi
    
    # Create namespace if it doesn't exist
    kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
    
    # Create secrets
    kubectl create secret generic kwality-secrets \
        --namespace="$NAMESPACE" \
        --from-file=db-password="$SECRETS_DIR/db-password.txt" \
        --from-file=redis-password="$SECRETS_DIR/redis-password.txt" \
        --from-file=jwt-secret="$SECRETS_DIR/jwt-secret.txt" \
        --from-file=grafana-admin-password="$SECRETS_DIR/grafana-admin-password.txt" \
        --from-file=api-key="$SECRETS_DIR/api-key.txt" \
        --dry-run=client -o yaml | kubectl apply -f -
    
    log_success "Created Kubernetes secrets in namespace: $NAMESPACE"
}

# Create Docker secrets for Docker Swarm
create_docker_secrets() {
    log_info "Creating Docker secrets..."
    
    # Check if docker is available and in swarm mode
    if ! command -v docker &> /dev/null; then
        log_warning "Docker not found. Skipping Docker secret creation."
        return
    fi
    
    if ! docker info --format '{{.Swarm.LocalNodeState}}' | grep -q "active"; then
        log_warning "Docker not in swarm mode. Skipping Docker secret creation."
        return
    fi
    
    # Create Docker secrets
    docker secret create kwality_db_password "$SECRETS_DIR/db-password.txt" 2>/dev/null || log_warning "Docker secret kwality_db_password already exists"
    docker secret create kwality_redis_password "$SECRETS_DIR/redis-password.txt" 2>/dev/null || log_warning "Docker secret kwality_redis_password already exists"
    docker secret create kwality_jwt_secret "$SECRETS_DIR/jwt-secret.txt" 2>/dev/null || log_warning "Docker secret kwality_jwt_secret already exists"
    docker secret create kwality_grafana_password "$SECRETS_DIR/grafana-admin-password.txt" 2>/dev/null || log_warning "Docker secret kwality_grafana_password already exists"
    
    log_success "Created Docker secrets"
}

# Display security warnings and instructions
display_instructions() {
    echo
    log_warning "IMPORTANT SECURITY INSTRUCTIONS:"
    echo
    echo "1. NEVER commit the generated secrets to version control"
    echo "2. Store secrets securely using a secret management system"
    echo "3. Rotate secrets regularly (recommended: every 90 days)"
    echo "4. Limit access to secrets to authorized personnel only"
    echo "5. Monitor secret access and usage"
    echo
    echo "Generated files:"
    echo "  - .env.production (for Docker Compose)"
    echo "  - $SECRETS_DIR/ (individual secret files)"
    echo
    echo "Next steps:"
    echo "  1. Review and customize CORS_ORIGINS in .env.production"
    echo "  2. Set up SSL certificates"
    echo "  3. Deploy using: docker-compose -f docker-compose.production.yml up -d"
    echo "  4. Or deploy to Kubernetes: kubectl apply -f k8s/kwality-deployment.production.yaml"
    echo
    log_warning "Remember to add .env.production and secrets/ to your .gitignore!"
}

# Main execution
main() {
    log_info "Kwality Production Secret Generation"
    log_info "===================================="
    
    # Check prerequisites
    if ! command -v openssl &> /dev/null; then
        log_error "OpenSSL is required but not installed. Please install OpenSSL."
        exit 1
    fi
    
    # Create secrets
    create_secrets_dir
    generate_secrets
    create_env_file
    create_k8s_secrets
    create_docker_secrets
    display_instructions
    
    log_success "Secret generation completed successfully!"
}

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi