#!/bin/bash

# Kwality Platform Deployment Script
# This script sets up and deploys the complete Kwality validation platform

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker-compose.kwality.yml"
ENV_FILE=".env"
BACKUP_DIR="backups"

# Functions
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

check_dependencies() {
    log_info "Checking dependencies..."
    
    # Check if Docker is installed and running
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        log_error "Docker is not running. Please start Docker first."
        exit 1
    fi
    
    # Check if Docker Compose is installed
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    log_success "All dependencies are available"
}

create_env_file() {
    if [[ ! -f "$ENV_FILE" ]]; then
        log_info "Creating environment file..."
        cat > "$ENV_FILE" << EOF
# Kwality Platform Configuration

# Database Configuration
POSTGRES_DB=kwality
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres_secure_password_change_me

# Redis Configuration
REDIS_PASSWORD=redis_secure_password_change_me

# Security Configuration
JWT_SECRET=your_secure_jwt_secret_key_change_me
SECURITY_SECRETS_DETECTION=true

# Container Configuration
RUNTIME_MEMORY_LIMIT_MB=512
RUNTIME_CPU_LIMIT_CORES=1.0
RUNTIME_TIMEOUT_SECONDS=300

# Monitoring Configuration
GRAFANA_ADMIN_PASSWORD=admin_secure_password_change_me

# API Keys (optional)
DEEPEVAL_API_KEY=your_deepeval_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Network Configuration
KWALITY_SUBNET=172.21.0.0/16
EOF
        log_warning "Created default environment file. Please review and update $ENV_FILE with your configuration."
    else
        log_info "Environment file already exists"
    fi
}

create_directories() {
    log_info "Creating necessary directories..."
    
    directories=(
        "logs"
        "data/postgres"
        "data/redis"
        "data/prometheus"
        "data/grafana"
        "data/jaeger"
        "data/registry"
        "config"
        "monitoring/grafana/dashboards"
        "monitoring/grafana/provisioning"
        "nginx/ssl"
        "$BACKUP_DIR"
        "/tmp/kwality-analysis"
        "/tmp/kwality-security"
        "/tmp/kwality-go"
        "/tmp/kwality-rust"
        "/tmp/kwality-python"
        "/tmp/kwality-node"
        "/tmp/kwality-java"
        "/tmp/kwality-worker-1"
        "/tmp/kwality-worker-2"
    )
    
    for dir in "${directories[@]}"; do
        mkdir -p "$dir"
        chmod 755 "$dir"
    done
    
    log_success "Directories created successfully"
}

build_images() {
    log_info "Building Kwality Docker images..."
    
    # Build Go orchestrator
    log_info "Building Go orchestrator..."
    docker build -f Dockerfile.go -t kwality/orchestrator:latest .
    
    # Build Rust runtime validator
    log_info "Building Rust runtime validator..."
    docker build -f engines/runtime-validator/Dockerfile -t kwality/runtime-validator:latest engines/runtime-validator/
    
    log_success "Docker images built successfully"
}

deploy_services() {
    log_info "Deploying Kwality services..."
    
    # Use docker-compose or docker compose based on availability
    if command -v docker-compose &> /dev/null; then
        COMPOSE_CMD="docker-compose"
    else
        COMPOSE_CMD="docker compose"
    fi
    
    # Start services
    $COMPOSE_CMD -f "$COMPOSE_FILE" up -d
    
    log_success "Services deployed successfully"
}

wait_for_services() {
    log_info "Waiting for services to be ready..."
    
    services=(
        "http://localhost:8080/health:Kwality Orchestrator"
        "http://localhost:9090:Prometheus"
        "http://localhost:3001:Grafana"
    )
    
    for service_info in "${services[@]}"; do
        IFS=':' read -r url name <<< "$service_info"
        log_info "Waiting for $name to be ready..."
        
        max_attempts=30
        attempt=1
        
        while [[ $attempt -le $max_attempts ]]; do
            if curl -s -f "$url" > /dev/null 2>&1; then
                log_success "$name is ready"
                break
            fi
            
            if [[ $attempt -eq $max_attempts ]]; then
                log_warning "$name is not responding after $max_attempts attempts"
                break
            fi
            
            sleep 10
            ((attempt++))
        done
    done
}

show_status() {
    log_info "Service Status:"
    echo
    
    # Use docker-compose or docker compose based on availability
    if command -v docker-compose &> /dev/null; then
        COMPOSE_CMD="docker-compose"
    else
        COMPOSE_CMD="docker compose"
    fi
    
    $COMPOSE_CMD -f "$COMPOSE_FILE" ps
    
    echo
    log_info "Access URLs:"
    echo "  Kwality API:          http://localhost:8080"
    echo "  Kwality Health:       http://localhost:8080/health"
    echo "  Grafana Dashboard:    http://localhost:3001 (admin/admin)"
    echo "  Prometheus:           http://localhost:9090"
    echo "  Jaeger Tracing:       http://localhost:16686"
    echo "  Container Registry:   http://localhost:5000"
    echo
}

backup_data() {
    log_info "Creating backup..."
    
    timestamp=$(date +"%Y%m%d_%H%M%S")
    backup_file="$BACKUP_DIR/kwality_backup_$timestamp.tar.gz"
    
    tar -czf "$backup_file" \
        data/ \
        logs/ \
        config/ \
        "$ENV_FILE" \
        2>/dev/null || true
    
    log_success "Backup created: $backup_file"
}

stop_services() {
    log_info "Stopping Kwality services..."
    
    # Use docker-compose or docker compose based on availability
    if command -v docker-compose &> /dev/null; then
        COMPOSE_CMD="docker-compose"
    else
        COMPOSE_CMD="docker compose"
    fi
    
    $COMPOSE_CMD -f "$COMPOSE_FILE" down
    
    log_success "Services stopped"
}

cleanup() {
    log_warning "This will remove all containers, networks, and volumes. Data will be lost!"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "Cleaning up..."
        
        # Use docker-compose or docker compose based on availability
        if command -v docker-compose &> /dev/null; then
            COMPOSE_CMD="docker-compose"
        else
            COMPOSE_CMD="docker compose"
        fi
        
        $COMPOSE_CMD -f "$COMPOSE_FILE" down -v --remove-orphans
        docker system prune -f
        
        log_success "Cleanup completed"
    else
        log_info "Cleanup cancelled"
    fi
}

show_help() {
    echo "Kwality Platform Deployment Script"
    echo
    echo "Usage: $0 [COMMAND]"
    echo
    echo "Commands:"
    echo "  deploy      Deploy the complete Kwality platform (default)"
    echo "  start       Start existing services"
    echo "  stop        Stop all services"
    echo "  restart     Restart all services"
    echo "  status      Show service status"
    echo "  logs        Show service logs"
    echo "  backup      Create a backup of data"
    echo "  cleanup     Remove all containers and data"
    echo "  help        Show this help message"
    echo
    echo "Examples:"
    echo "  $0 deploy          # Deploy the platform"
    echo "  $0 status          # Check service status"
    echo "  $0 logs            # View logs"
    echo "  $0 backup          # Create backup"
    echo
}

# Main execution
main() {
    case "${1:-deploy}" in
        "deploy")
            check_dependencies
            create_env_file
            create_directories
            build_images
            deploy_services
            wait_for_services
            show_status
            log_success "Kwality platform deployed successfully!"
            ;;
        "start")
            docker-compose -f "$COMPOSE_FILE" start
            log_success "Services started"
            ;;
        "stop")
            stop_services
            ;;
        "restart")
            docker-compose -f "$COMPOSE_FILE" restart
            log_success "Services restarted"
            ;;
        "status")
            show_status
            ;;
        "logs")
            docker-compose -f "$COMPOSE_FILE" logs -f
            ;;
        "backup")
            backup_data
            ;;
        "cleanup")
            cleanup
            ;;
        "help"|"-h"|"--help")
            show_help
            ;;
        *)
            log_error "Unknown command: $1"
            show_help
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"