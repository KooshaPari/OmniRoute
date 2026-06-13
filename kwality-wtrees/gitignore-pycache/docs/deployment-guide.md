# Kwality Platform Deployment Guide

This comprehensive guide covers deployment options for the Kwality AI codebase validation platform, from development environments to enterprise production deployments.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start (Development)](#quick-start-development)
- [Docker Deployment](#docker-deployment)
- [Kubernetes Deployment](#kubernetes-deployment)
- [Cloud Deployments](#cloud-deployments)
- [Enterprise Deployment](#enterprise-deployment)
- [Configuration Management](#configuration-management)
- [Monitoring and Observability](#monitoring-and-observability)
- [Security Considerations](#security-considerations)
- [Scaling and Performance](#scaling-and-performance)
- [Backup and Disaster Recovery](#backup-and-disaster-recovery)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements

**Minimum Requirements:**
- CPU: 4 cores
- RAM: 8GB
- Storage: 50GB free space
- Network: Stable internet connection

**Recommended Requirements:**
- CPU: 8+ cores
- RAM: 16GB+
- Storage: 100GB+ SSD
- Network: High-bandwidth connection

**Enterprise Requirements:**
- CPU: 16+ cores per node
- RAM: 32GB+ per node
- Storage: 500GB+ SSD with backup
- Network: Redundant network connections

### Software Dependencies

**Required:**
- Docker 20.10+
- Docker Compose 2.0+
- Git 2.30+

**For Kubernetes:**
- Kubernetes 1.25+
- kubectl configured
- Helm 3.8+ (optional)

**For Development:**
- Go 1.21+
- Rust 1.75+
- Node.js 18+ (for UI)

## Quick Start (Development)

### 1. Clone and Setup

```bash
# Clone repository
git clone https://github.com/KooshaPari/kwality.git
cd kwality

# Make deployment script executable
chmod +x scripts/deploy-kwality.sh

# Quick development setup
make setup
```

### 2. Start Development Environment

```bash
# Start with default configuration
./scripts/deploy-kwality.sh deploy

# Or use make commands
make dev
make run
```

### 3. Verify Installation

```bash
# Check service health
curl http://localhost:8080/health

# Run a test validation
curl -X POST http://localhost:8080/api/v1/validate/codebase \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test",
    "source": {
      "type": "inline",
      "files": [
        {
          "path": "main.go",
          "content": "package main\n\nimport \"fmt\"\n\nfunc main() {\n\tfmt.Println(\"Hello, World!\")\n}"
        }
      ]
    },
    "config": {
      "enabled_engines": ["static"],
      "timeout": "2m"
    }
  }'
```

## Docker Deployment

### 1. Basic Docker Compose Deployment

```bash
# Download and start services
curl -sSL https://raw.githubusercontent.com/KooshaPari/kwality/main/docker-compose.kwality.yml -o docker-compose.yml

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Deploy
docker-compose up -d

# Check status
docker-compose ps
```

### 2. Production Docker Deployment

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  kwality-orchestrator:
    image: ghcr.io/kooshapari/kwality/orchestrator:latest
    restart: unless-stopped
    environment:
      - KWALITY_ENV=production
      - DB_HOST=postgres
      - REDIS_HOST=redis
    volumes:
      - ./config:/app/config:ro
      - ./logs:/app/logs
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  kwality-runtime-validator:
    image: ghcr.io/kooshapari/kwality/runtime-validator:latest
    restart: unless-stopped
    privileged: true
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./config:/config:ro

  postgres:
    image: postgres:15-alpine
    restart: unless-stopped
    environment:
      - POSTGRES_DB=kwality
      - POSTGRES_USER=kwality
      - POSTGRES_PASSWORD_FILE=/run/secrets/postgres_password
    secrets:
      - postgres_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backup:/backup

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server /etc/redis/redis.conf
    volumes:
      - redis_data:/data
      - ./config/redis.conf:/etc/redis/redis.conf

secrets:
  postgres_password:
    file: ./secrets/postgres_password.txt

volumes:
  postgres_data:
  redis_data:
```

### 3. High Availability Docker Setup

```bash
# docker-compose.ha.yml with multiple instances
version: '3.8'

services:
  # Load balancer
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./nginx/ssl:/etc/ssl/nginx
    depends_on:
      - kwality-orchestrator-1
      - kwality-orchestrator-2
      - kwality-orchestrator-3

  # Multiple orchestrator instances
  kwality-orchestrator-1:
    image: ghcr.io/kooshapari/kwality/orchestrator:latest
    environment:
      - INSTANCE_ID=1
      - CLUSTER_MODE=true

  kwality-orchestrator-2:
    image: ghcr.io/kooshapari/kwality/orchestrator:latest
    environment:
      - INSTANCE_ID=2
      - CLUSTER_MODE=true

  kwality-orchestrator-3:
    image: ghcr.io/kooshapari/kwality/orchestrator:latest
    environment:
      - INSTANCE_ID=3
      - CLUSTER_MODE=true

  # Multiple worker instances
  kwality-worker-pool:
    image: ghcr.io/kooshapari/kwality/runtime-validator:latest
    deploy:
      replicas: 5
      resources:
        limits:
          memory: 2G
          cpus: '2'
```

## Kubernetes Deployment

### 1. Basic Kubernetes Deployment

```bash
# Apply the deployment manifests
kubectl apply -f k8s/kwality-deployment.yaml

# Check deployment status
kubectl get pods -n kwality
kubectl get services -n kwality

# Port forward for testing
kubectl port-forward -n kwality service/kwality-orchestrator-service 8080:8080
```

### 2. Helm Chart Deployment

```bash
# Add Kwality Helm repository
helm repo add kwality https://charts.kwality.dev
helm repo update

# Install with custom values
helm install kwality kwality/kwality \
  --namespace kwality \
  --create-namespace \
  --values values.yaml
```

**values.yaml example:**

```yaml
# values.yaml
orchestrator:
  replicas: 3
  image:
    repository: ghcr.io/kooshapari/kwality/orchestrator
    tag: "latest"
  resources:
    requests:
      memory: "512Mi"
      cpu: "500m"
    limits:
      memory: "1Gi"
      cpu: "1000m"

runtimeValidator:
  replicas: 5
  image:
    repository: ghcr.io/kooshapari/kwality/runtime-validator
    tag: "latest"
  resources:
    requests:
      memory: "1Gi"
      cpu: "1000m"
    limits:
      memory: "2Gi"
      cpu: "2000m"

postgresql:
  enabled: true
  auth:
    database: kwality
    username: kwality
    password: "secure-password"
  primary:
    persistence:
      size: 50Gi

redis:
  enabled: true
  auth:
    enabled: true
    password: "secure-password"

ingress:
  enabled: true
  className: nginx
  hosts:
    - host: kwality.your-domain.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: kwality-tls
      hosts:
        - kwality.your-domain.com

monitoring:
  prometheus:
    enabled: true
  grafana:
    enabled: true
    adminPassword: "secure-password"

autoscaling:
  enabled: true
  orchestrator:
    minReplicas: 3
    maxReplicas: 10
    targetCPUUtilizationPercentage: 70
  runtimeValidator:
    minReplicas: 5
    maxReplicas: 20
    targetCPUUtilizationPercentage: 75
```

### 3. Production Kubernetes Configuration

```yaml
# production-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: kwality-config
  namespace: kwality
data:
  config.yaml: |
    server:
      port: 8080
      read_timeout: 30s
      write_timeout: 30s
      idle_timeout: 120s
    
    orchestrator:
      max_workers: 20
      queue_size: 1000
      worker_timeout: 30m
    
    database:
      max_connections: 50
      max_idle_connections: 10
      connection_lifetime: 1h
    
    redis:
      pool_size: 20
      idle_timeout: 5m
    
    validation:
      default_timeout: 10m
      max_timeout: 60m
      parallel_execution: true
    
    security:
      enable_network_isolation: true
      enable_syscall_monitoring: true
      blocked_syscalls:
        - ptrace
        - mount
        - umount
    
    performance:
      enable_profiling: true
      memory_limit_mb: 2048
      cpu_limit_cores: 2.0

---
apiVersion: v1
kind: Secret
metadata:
  name: kwality-secrets
  namespace: kwality
type: Opaque
stringData:
  database-password: "your-secure-database-password"
  redis-password: "your-secure-redis-password"
  jwt-secret: "your-secure-jwt-secret"
  api-key: "your-secure-api-key"
```

## Cloud Deployments

### 1. AWS ECS Deployment

```bash
# Create ECS cluster
aws ecs create-cluster --cluster-name kwality-production

# Register task definition
aws ecs register-task-definition --cli-input-json file://task-definition.json

# Create service
aws ecs create-service \
  --cluster kwality-production \
  --service-name kwality-orchestrator \
  --task-definition kwality-orchestrator:1 \
  --desired-count 3 \
  --load-balancers targetGroupArn=arn:aws:elasticloadbalancing:...,containerName=orchestrator,containerPort=8080
```

**task-definition.json:**

```json
{
  "family": "kwality-orchestrator",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "executionRoleArn": "arn:aws:iam::123456789012:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::123456789012:role/ecsTaskRole",
  "containerDefinitions": [
    {
      "name": "orchestrator",
      "image": "ghcr.io/kooshapari/kwality/orchestrator:latest",
      "portMappings": [
        {
          "containerPort": 8080,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {"name": "KWALITY_ENV", "value": "production"},
        {"name": "DB_HOST", "value": "kwality-db.cluster-xxx.us-west-2.rds.amazonaws.com"}
      ],
      "secrets": [
        {
          "name": "DB_PASSWORD",
          "valueFrom": "arn:aws:secretsmanager:us-west-2:123456789012:secret:kwality/db-password"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/kwality-orchestrator",
          "awslogs-region": "us-west-2",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": [
          "CMD-SHELL",
          "curl -f http://localhost:8080/health || exit 1"
        ],
        "interval": 30,
        "timeout": 5,
        "retries": 3
      }
    }
  ]
}
```

### 2. Google Cloud Run Deployment

```bash
# Build and deploy to Cloud Run
gcloud builds submit --tag gcr.io/PROJECT_ID/kwality-orchestrator

# Deploy service
gcloud run deploy kwality-orchestrator \
  --image gcr.io/PROJECT_ID/kwality-orchestrator \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --concurrency 100 \
  --max-instances 10 \
  --set-env-vars KWALITY_ENV=production
```

### 3. Azure Container Instances

```bash
# Create resource group
az group create --name kwality-rg --location eastus

# Deploy container group
az container create \
  --resource-group kwality-rg \
  --name kwality-orchestrator \
  --image ghcr.io/kooshapari/kwality/orchestrator:latest \
  --cpu 2 \
  --memory 4 \
  --ports 8080 \
  --environment-variables KWALITY_ENV=production \
  --secure-environment-variables DB_PASSWORD=your-password \
  --restart-policy Always
```

## Enterprise Deployment

### 1. Multi-Region Setup

```yaml
# multi-region-deployment.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: kwality-us-east-1
  namespace: argocd
spec:
  project: kwality
  source:
    repoURL: https://github.com/KooshaPari/kwality
    targetRevision: main
    path: k8s/overlays/production/us-east-1
  destination:
    server: https://kubernetes-us-east-1.example.com
    namespace: kwality
  syncPolicy:
    automated:
      prune: true
      selfHeal: true

---
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: kwality-eu-west-1
  namespace: argocd
spec:
  project: kwality
  source:
    repoURL: https://github.com/KooshaPari/kwality
    targetRevision: main
    path: k8s/overlays/production/eu-west-1
  destination:
    server: https://kubernetes-eu-west-1.example.com
    namespace: kwality
```

### 2. GitOps with ArgoCD

```yaml
# argo-application.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: kwality-production
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/KooshaPari/kwality
    targetRevision: main
    path: k8s/overlays/production
  destination:
    server: https://kubernetes.default.svc
    namespace: kwality
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
      - PrunePropagationPolicy=foreground
      - PruneLast=true
  ignoreDifferences:
    - group: apps
      kind: Deployment
      jsonPointers:
        - /spec/replicas
```

### 3. Enterprise Security Configuration

```yaml
# security-policies.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: kwality-network-policy
  namespace: kwality
spec:
  podSelector:
    matchLabels:
      app: kwality-orchestrator
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              name: ingress-nginx
        - podSelector:
            matchLabels:
              app: kwality-orchestrator
      ports:
        - protocol: TCP
          port: 8080
  egress:
    - to:
        - podSelector:
            matchLabels:
              app: postgres
      ports:
        - protocol: TCP
          port: 5432
    - to:
        - podSelector:
            matchLabels:
              app: redis
      ports:
        - protocol: TCP
          port: 6379

---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: kwality-orchestrator
  namespace: kwality
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::123456789012:role/KwalityOrchestratorRole

---
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: kwality-mtls
  namespace: kwality
spec:
  mtls:
    mode: STRICT
```

## Configuration Management

### 1. Environment-Specific Configurations

```bash
# configs/
├── base/
│   ├── config.yaml
│   └── secrets.yaml
├── development/
│   ├── config.yaml
│   └── patches/
├── staging/
│   ├── config.yaml
│   └── patches/
└── production/
    ├── config.yaml
    └── patches/
```

### 2. Secrets Management

**Using Kubernetes Secrets:**

```bash
# Create secrets
kubectl create secret generic kwality-secrets \
  --from-literal=database-password='secure-password' \
  --from-literal=redis-password='secure-password' \
  --from-literal=jwt-secret='secure-jwt-secret' \
  --namespace kwality
```

**Using HashiCorp Vault:**

```yaml
# vault-secret.yaml
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: vault-backend
  namespace: kwality
spec:
  provider:
    vault:
      server: "https://vault.example.com"
      path: "secret"
      version: "v2"
      auth:
        kubernetes:
          mountPath: "kubernetes"
          role: "kwality"

---
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: kwality-secrets
  namespace: kwality
spec:
  refreshInterval: 15s
  secretStoreRef:
    name: vault-backend
    kind: SecretStore
  target:
    name: kwality-secrets
    creationPolicy: Owner
  data:
    - secretKey: database-password
      remoteRef:
        key: kwality/database
        property: password
```

### 3. Configuration Validation

```bash
# Validate configuration before deployment
make validate-config

# Test configuration with dry-run
kubectl apply --dry-run=client -f k8s/

# Validate Helm chart
helm template kwality ./charts/kwality --values values.yaml | kubectl apply --dry-run=client -f -
```

## Monitoring and Observability

### 1. Prometheus and Grafana Setup

```yaml
# monitoring-stack.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-config
  namespace: monitoring
data:
  prometheus.yml: |
    global:
      scrape_interval: 15s
    scrape_configs:
      - job_name: 'kwality-orchestrator'
        kubernetes_sd_configs:
          - role: endpoints
            namespaces:
              names:
                - kwality
        relabel_configs:
          - source_labels: [__meta_kubernetes_service_name]
            action: keep
            regex: kwality-orchestrator-service

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: grafana
  namespace: monitoring
spec:
  replicas: 1
  selector:
    matchLabels:
      app: grafana
  template:
    metadata:
      labels:
        app: grafana
    spec:
      containers:
        - name: grafana
          image: grafana/grafana:latest
          ports:
            - containerPort: 3000
          env:
            - name: GF_SECURITY_ADMIN_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: grafana-secrets
                  key: admin-password
          volumeMounts:
            - name: grafana-dashboards
              mountPath: /var/lib/grafana/dashboards
      volumes:
        - name: grafana-dashboards
          configMap:
            name: kwality-dashboards
```

### 2. Logging with ELK Stack

```yaml
# logging-stack.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: elasticsearch
  namespace: logging
spec:
  replicas: 3
  selector:
    matchLabels:
      app: elasticsearch
  template:
    metadata:
      labels:
        app: elasticsearch
    spec:
      containers:
        - name: elasticsearch
          image: elasticsearch:8.5.0
          env:
            - name: discovery.type
              value: single-node
            - name: ES_JAVA_OPTS
              value: "-Xms1g -Xmx1g"
          ports:
            - containerPort: 9200

---
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: fluent-bit
  namespace: logging
spec:
  selector:
    matchLabels:
      app: fluent-bit
  template:
    metadata:
      labels:
        app: fluent-bit
    spec:
      containers:
        - name: fluent-bit
          image: fluent/fluent-bit:latest
          volumeMounts:
            - name: varlog
              mountPath: /var/log
              readOnly: true
            - name: config
              mountPath: /fluent-bit/etc
      volumes:
        - name: varlog
          hostPath:
            path: /var/log
        - name: config
          configMap:
            name: fluent-bit-config
```

### 3. Distributed Tracing with Jaeger

```bash
# Install Jaeger operator
kubectl apply -f https://github.com/jaegertracing/jaeger-operator/releases/download/v1.39.0/jaeger-operator.yaml

# Deploy Jaeger instance
kubectl apply -f - <<EOF
apiVersion: jaegertracing.io/v1
kind: Jaeger
metadata:
  name: kwality-tracing
  namespace: kwality
spec:
  strategy: production
  storage:
    type: elasticsearch
    elasticsearch:
      nodeCount: 3
      redundancyPolicy: SingleRedundancy
      resources:
        requests:
          memory: 2Gi
          cpu: 500m
        limits:
          memory: 4Gi
          cpu: 1
EOF
```

## Security Considerations

### 1. Network Security

```bash
# Enable Istio service mesh
istioctl install --set values.defaultRevision=default

# Apply security policies
kubectl apply -f - <<EOF
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: kwality-authz
  namespace: kwality
spec:
  rules:
    - from:
        - source:
            principals: ["cluster.local/ns/kwality/sa/kwality-orchestrator"]
      to:
        - operation:
            methods: ["GET", "POST"]
      when:
        - key: request.headers[authorization]
          values: ["Bearer *"]
EOF
```

### 2. Pod Security Standards

```yaml
# pod-security-policy.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: kwality
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted

---
apiVersion: v1
kind: SecurityContext
metadata:
  name: kwality-security-context
spec:
  runAsNonRoot: true
  runAsUser: 1000
  runAsGroup: 1000
  fsGroup: 1000
  seccompProfile:
    type: RuntimeDefault
  capabilities:
    drop:
      - ALL
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true
```

### 3. Image Security Scanning

```bash
# Scan images before deployment
trivy image ghcr.io/kooshapari/kwality/orchestrator:latest
trivy image ghcr.io/kooshapari/kwality/runtime-validator:latest

# Set up admission controller for image scanning
kubectl apply -f - <<EOF
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionWebhook
metadata:
  name: image-scanner
webhooks:
  - name: scan.images.io
    clientConfig:
      service:
        name: image-scanner
        namespace: security
        path: /scan
    rules:
      - operations: ["CREATE", "UPDATE"]
        apiGroups: [""]
        apiVersions: ["v1"]
        resources: ["pods"]
EOF
```

## Scaling and Performance

### 1. Horizontal Pod Autoscaling

```yaml
# hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: kwality-orchestrator-hpa
  namespace: kwality
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: kwality-orchestrator
  minReplicas: 3
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
    - type: Pods
      pods:
        metric:
          name: validation_queue_depth
        target:
          type: AverageValue
          averageValue: "10"
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 100
          periodSeconds: 15
        - type: Pods
          value: 2
          periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 10
          periodSeconds: 60
```

### 2. Vertical Pod Autoscaling

```yaml
# vpa.yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: kwality-orchestrator-vpa
  namespace: kwality
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: kwality-orchestrator
  updatePolicy:
    updateMode: "Auto"
  resourcePolicy:
    containerPolicies:
      - containerName: orchestrator
        minAllowed:
          cpu: 100m
          memory: 128Mi
        maxAllowed:
          cpu: 2
          memory: 4Gi
        controlledResources: ["cpu", "memory"]
```

### 3. Cluster Autoscaling

```yaml
# cluster-autoscaler.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cluster-autoscaler
  namespace: kube-system
spec:
  replicas: 1
  selector:
    matchLabels:
      app: cluster-autoscaler
  template:
    metadata:
      labels:
        app: cluster-autoscaler
    spec:
      containers:
        - image: k8s.gcr.io/autoscaling/cluster-autoscaler:v1.25.0
          name: cluster-autoscaler
          command:
            - ./cluster-autoscaler
            - --v=4
            - --stderrthreshold=info
            - --cloud-provider=aws
            - --skip-nodes-with-local-storage=false
            - --expander=least-waste
            - --node-group-auto-discovery=asg:tag=k8s.io/cluster-autoscaler/enabled,k8s.io/cluster-autoscaler/kwality-cluster
            - --balance-similar-node-groups
            - --skip-nodes-with-system-pods=false
```

## Backup and Disaster Recovery

### 1. Database Backup

```bash
# Automated PostgreSQL backup
kubectl apply -f - <<EOF
apiVersion: batch/v1
kind: CronJob
metadata:
  name: postgres-backup
  namespace: kwality
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: postgres-backup
              image: postgres:15-alpine
              command:
                - /bin/bash
                - -c
                - |
                  pg_dump -h postgres -U kwality -d kwality | gzip > /backup/backup-$(date +%Y%m%d-%H%M%S).sql.gz
                  # Upload to S3
                  aws s3 cp /backup/backup-$(date +%Y%m%d-%H%M%S).sql.gz s3://kwality-backups/database/
              env:
                - name: PGPASSWORD
                  valueFrom:
                    secretKeyRef:
                      name: kwality-secrets
                      key: database-password
              volumeMounts:
                - name: backup-storage
                  mountPath: /backup
          volumes:
            - name: backup-storage
              emptyDir: {}
          restartPolicy: OnFailure
EOF
```

### 2. Application State Backup

```bash
# Backup validation results and configurations
kubectl apply -f - <<EOF
apiVersion: batch/v1
kind: CronJob
metadata:
  name: kwality-state-backup
  namespace: kwality
spec:
  schedule: "0 3 * * *"  # Daily at 3 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: state-backup
              image: kwality/backup-tool:latest
              command:
                - /backup-script.sh
              env:
                - name: BACKUP_TYPE
                  value: "full"
                - name: S3_BUCKET
                  value: "kwality-backups"
              volumeMounts:
                - name: data-volume
                  mountPath: /data
          volumes:
            - name: data-volume
              persistentVolumeClaim:
                claimName: kwality-data-pvc
          restartPolicy: OnFailure
EOF
```

### 3. Disaster Recovery Plan

```bash
# disaster-recovery.sh
#!/bin/bash

set -e

BACKUP_DATE=${1:-$(date +%Y%m%d)}
NAMESPACE="kwality"

echo "Starting disaster recovery for date: $BACKUP_DATE"

# 1. Restore database
echo "Restoring database..."
kubectl exec -it postgres-0 -n $NAMESPACE -- psql -U kwality -c "DROP DATABASE IF EXISTS kwality;"
kubectl exec -it postgres-0 -n $NAMESPACE -- psql -U kwality -c "CREATE DATABASE kwality;"
aws s3 cp s3://kwality-backups/database/backup-$BACKUP_DATE.sql.gz - | gunzip | kubectl exec -i postgres-0 -n $NAMESPACE -- psql -U kwality -d kwality

# 2. Restore application data
echo "Restoring application data..."
aws s3 sync s3://kwality-backups/data/$BACKUP_DATE /tmp/restore-data/
kubectl cp /tmp/restore-data kwality/kwality-orchestrator-0:/restore-data

# 3. Restart services
echo "Restarting services..."
kubectl rollout restart deployment/kwality-orchestrator -n $NAMESPACE
kubectl rollout restart deployment/kwality-runtime-validator -n $NAMESPACE

# 4. Verify recovery
echo "Verifying recovery..."
kubectl wait --for=condition=available --timeout=300s deployment/kwality-orchestrator -n $NAMESPACE
curl -f http://kwality.example.com/health

echo "Disaster recovery completed successfully"
```

## Troubleshooting

### 1. Common Issues and Solutions

**Issue: Pods stuck in Pending state**

```bash
# Check node resources
kubectl describe nodes

# Check pod events
kubectl describe pod <pod-name> -n kwality

# Check resource quotas
kubectl describe resourcequota -n kwality

# Solution: Scale cluster or adjust resource requests
kubectl scale deployment kwality-orchestrator --replicas=2 -n kwality
```

**Issue: High memory usage**

```bash
# Check memory usage
kubectl top pods -n kwality

# Get detailed metrics
kubectl exec -it kwality-orchestrator-<id> -n kwality -- ps aux

# Adjust memory limits
kubectl patch deployment kwality-orchestrator -n kwality -p '{"spec":{"template":{"spec":{"containers":[{"name":"orchestrator","resources":{"limits":{"memory":"2Gi"}}}]}}}}'
```

**Issue: Database connection failures**

```bash
# Check database pod
kubectl logs postgres-0 -n kwality

# Test connectivity
kubectl exec -it kwality-orchestrator-<id> -n kwality -- nc -zv postgres 5432

# Check secrets
kubectl get secret kwality-secrets -n kwality -o yaml

# Restart database connection pool
kubectl rollout restart deployment/kwality-orchestrator -n kwality
```

### 2. Performance Debugging

```bash
# Monitor performance metrics
kubectl exec -it kwality-orchestrator-<id> -n kwality -- curl localhost:8080/metrics

# Check validation queue
kubectl exec -it kwality-orchestrator-<id> -n kwality -- curl localhost:8080/api/v1/queue/status

# Analyze slow queries
kubectl exec -it postgres-0 -n kwality -- psql -U kwality -d kwality -c "SELECT query, mean_time, calls FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"
```

### 3. Log Analysis

```bash
# Centralized logging query examples

# Get all error logs
kubectl logs -n kwality -l app=kwality-orchestrator --tail=100 | grep ERROR

# Filter validation failures
kubectl logs -n kwality -l app=kwality-orchestrator --since=1h | grep "validation.*failed"

# Monitor validation performance
kubectl logs -n kwality -l app=kwality-orchestrator --since=1h | grep "validation.*completed" | awk '{print $NF}' | sort -n
```

### 4. Health Checks and Monitoring

```bash
# Comprehensive health check script
#!/bin/bash

NAMESPACE="kwality"
FAILURES=0

# Check pod health
echo "Checking pod health..."
if ! kubectl get pods -n $NAMESPACE | grep -q "Running"; then
    echo "ERROR: Some pods are not running"
    FAILURES=$((FAILURES + 1))
fi

# Check service endpoints
echo "Checking service endpoints..."
if ! curl -s -f http://kwality.example.com/health > /dev/null; then
    echo "ERROR: Health endpoint not responding"
    FAILURES=$((FAILURES + 1))
fi

# Check database connectivity
echo "Checking database..."
if ! kubectl exec -it postgres-0 -n $NAMESPACE -- pg_isready; then
    echo "ERROR: Database not ready"
    FAILURES=$((FAILURES + 1))
fi

# Check Redis connectivity
echo "Checking Redis..."
if ! kubectl exec -it redis-0 -n $NAMESPACE -- redis-cli ping; then
    echo "ERROR: Redis not responding"
    FAILURES=$((FAILURES + 1))
fi

if [ $FAILURES -eq 0 ]; then
    echo "All health checks passed"
    exit 0
else
    echo "Health checks failed: $FAILURES issues found"
    exit 1
fi
```

This comprehensive deployment guide covers all aspects of deploying Kwality from development to enterprise production environments, including security, monitoring, scaling, and disaster recovery considerations.