# Kwality Production Deployment Guide

**Enterprise-Grade Deployment for Unsupervised Production Usage**

## 🎯 Overview

This guide provides step-by-step instructions for deploying Kwality in a production environment with enterprise security hardening, monitoring, and operational readiness.

## ✅ Pre-Deployment Checklist

### Infrastructure Requirements

**Minimum System Requirements:**
- **CPU**: 8 cores (16 recommended)
- **Memory**: 16GB RAM (32GB recommended)
- **Storage**: 100GB SSD (500GB recommended)
- **Network**: 1Gbps connectivity
- **OS**: Ubuntu 20.04+ or RHEL 8+

**Container Runtime:**
- Docker 24.0+ or containerd 1.6+
- Kubernetes 1.28+ (for K8s deployment)
- Helm 3.12+ (optional)

**Security Requirements:**
- SSL certificates (Let's Encrypt or commercial)
- Secret management system (HashiCorp Vault recommended)
- Network firewall configuration
- Backup storage (S3-compatible or NFS)

## 🔐 Security Setup

### 1. Generate Production Secrets

```bash
# Clone the repository
git clone https://github.com/KooshaPari/kwality.git
cd kwality

# Generate secure secrets for production
./scripts/generate-secrets.sh

# Verify secrets were created
ls -la secrets/
ls -la .env.production
```

### 2. SSL Certificate Setup

**Option A: Let's Encrypt (Recommended)**
```bash
# Install certbot
sudo apt update && sudo apt install certbot

# Generate certificate
sudo certbot certonly --standalone \
  -d kwality.yourdomain.com \
  -d monitoring.yourdomain.com

# Copy certificates
sudo cp /etc/letsencrypt/live/kwality.yourdomain.com/fullchain.pem nginx/ssl/kwality.crt
sudo cp /etc/letsencrypt/live/kwality.yourdomain.com/privkey.pem nginx/ssl/kwality.key
sudo chown $(whoami):$(whoami) nginx/ssl/*
```

**Option B: Self-Signed (Development Only)**
```bash
mkdir -p nginx/ssl
openssl req -x509 -newkey rsa:4096 -keyout nginx/ssl/kwality.key \
  -out nginx/ssl/kwality.crt -days 365 -nodes \
  -subj "/C=US/ST=CA/L=SF/O=YourOrg/CN=kwality.yourdomain.com"
```

### 3. Configure Environment

Edit `.env.production` with your specific values:

```bash
# Update domain settings
sed -i 's/yourdomain.com/your-actual-domain.com/g' .env.production

# Update CORS origins
sed -i 's/CORS_ORIGINS=.*/CORS_ORIGINS=https:\/\/kwality.your-actual-domain.com/' .env.production
```

## 🚀 Deployment Options

### Option 1: Docker Compose (Recommended for Single Node)

```bash
# 1. Build production images
docker build -t kwality/orchestrator:latest -f Dockerfile.go .
cd engines/runtime-validator
docker build -t kwality/runtime-validator:latest -f Dockerfile.production .
cd ../..

# 2. Deploy with production configuration
docker-compose -f docker-compose.production.yml up -d

# 3. Verify deployment
docker-compose -f docker-compose.production.yml ps
curl -k https://localhost/health
```

### Option 2: Kubernetes (Recommended for High Availability)

```bash
# 1. Create namespace and secrets
kubectl create namespace kwality

# 2. Deploy production configuration
kubectl apply -f k8s/kwality-deployment.production.yaml

# 3. Verify deployment
kubectl get pods -n kwality
kubectl get services -n kwality
kubectl get ingress -n kwality

# 4. Test connectivity
kubectl port-forward -n kwality svc/kwality-orchestrator-service 8080:8080
curl http://localhost:8080/health
```

### Option 3: Kubernetes with Helm (Advanced)

```bash
# 1. Add Helm repository (if published)
helm repo add kwality https://charts.kwality.io
helm repo update

# 2. Deploy with custom values
helm install kwality kwality/kwality \
  --namespace kwality \
  --create-namespace \
  --values values.production.yaml

# 3. Verify deployment
helm status kwality -n kwality
```

## 📊 Post-Deployment Verification

### 1. Health Checks

```bash
# Check all services are healthy
curl -k https://kwality.yourdomain.com/health

# Expected response:
{
  "status": "healthy",
  "version": "v1.0.0",
  "services": {
    "database": "healthy",
    "redis": "healthy",
    "runtime-validator": "healthy"
  },
  "timestamp": "2024-01-15T10:00:00Z"
}
```

### 2. Security Validation

```bash
# Verify SSL configuration
curl -I https://kwality.yourdomain.com

# Check security headers
curl -I -k https://kwality.yourdomain.com | grep -E "(X-Frame-Options|X-Content-Type-Options|Strict-Transport-Security)"

# Verify no privileged containers (Docker)
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}" | grep kwality

# Verify security contexts (Kubernetes)
kubectl get pods -n kwality -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.securityContext}{"\n"}{end}'
```

### 3. Performance Testing

```bash
# Basic API performance test
curl -w "@curl-format.txt" -s -o /dev/null https://kwality.yourdomain.com/api/v1/health

# Load testing (install hey first: go install github.com/rakyll/hey@latest)
hey -n 1000 -c 10 https://kwality.yourdomain.com/api/v1/health
```

## 🔍 Monitoring Setup

### 1. Access Monitoring Dashboards

**Grafana**: https://monitoring.yourdomain.com/grafana
- Username: admin
- Password: [Generated in secrets/grafana-admin-password.txt]

**Prometheus**: https://monitoring.yourdomain.com/prometheus

### 2. Configure Alerting

```bash
# Update monitoring/prometheus.production.yml with your alerting endpoints
# Configure Grafana notification channels for:
# - Email alerts
# - Slack notifications
# - PagerDuty integration
```

### 3. Log Aggregation

```bash
# Option A: ELK Stack
docker-compose -f monitoring/elk-stack.yml up -d

# Option B: Loki + Grafana
docker-compose -f monitoring/loki-stack.yml up -d

# Option C: External (Datadog, Splunk, etc.)
# Configure log forwarding in docker-compose.production.yml
```

## 🗂️ Backup and Recovery

### 1. Database Backup

```bash
# Create backup script
cat > scripts/backup-database.sh << 'EOF'
#!/bin/bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="backup_${TIMESTAMP}.sql"
POSTGRES_PASSWORD=$(cat secrets/db-password.txt)

PGPASSWORD=$POSTGRES_PASSWORD pg_dump \
  -h localhost \
  -U kwality \
  -d kwality \
  > backups/$BACKUP_FILE

# Upload to S3 or backup storage
# aws s3 cp backups/$BACKUP_FILE s3://your-backup-bucket/database/
EOF

chmod +x scripts/backup-database.sh

# Run backup
mkdir -p backups
./scripts/backup-database.sh
```

### 2. Automated Backup Cron

```bash
# Add to crontab
crontab -e

# Add these lines:
# Daily database backup at 2 AM
0 2 * * * /path/to/kwality/scripts/backup-database.sh

# Weekly full system backup at 3 AM Sunday
0 3 * * 0 /path/to/kwality/scripts/backup-full-system.sh
```

### 3. Disaster Recovery Testing

```bash
# Test recovery procedure
./scripts/test-disaster-recovery.sh

# This script should:
# 1. Stop services
# 2. Restore from backup
# 3. Verify data integrity
# 4. Start services
# 5. Run health checks
```

## 🔄 Operational Procedures

### 1. Rolling Updates

**Docker Compose:**
```bash
# Build new images
docker build -t kwality/orchestrator:v1.1.0 .

# Update with zero downtime
docker-compose -f docker-compose.production.yml up -d --no-deps orchestrator
```

**Kubernetes:**
```bash
# Update image tag
kubectl set image deployment/kwality-orchestrator orchestrator=kwality/orchestrator:v1.1.0 -n kwality

# Monitor rollout
kubectl rollout status deployment/kwality-orchestrator -n kwality
```

### 2. Scaling Operations

**Horizontal Scaling (Kubernetes):**
```bash
# Scale orchestrator
kubectl scale deployment kwality-orchestrator --replicas=5 -n kwality

# Scale runtime validators
kubectl scale deployment kwality-runtime-validator --replicas=10 -n kwality
```

**Vertical Scaling (Docker):**
```bash
# Update resource limits in docker-compose.production.yml
# Then restart services
docker-compose -f docker-compose.production.yml up -d
```

### 3. Security Maintenance

```bash
# Monthly secret rotation
./scripts/rotate-secrets.sh

# Security patch updates
./scripts/update-security-patches.sh

# Vulnerability scanning
./scripts/security-scan.sh
```

## 🚨 Troubleshooting

### Common Issues

**1. SSL Certificate Issues**
```bash
# Check certificate validity
openssl x509 -in nginx/ssl/kwality.crt -text -noout

# Verify certificate chain
curl -I https://kwality.yourdomain.com
```

**2. Database Connection Issues**
```bash
# Test database connectivity
PGPASSWORD=$(cat secrets/db-password.txt) psql -h localhost -U kwality -d kwality -c "SELECT version();"
```

**3. Container Startup Issues**
```bash
# Check container logs
docker-compose -f docker-compose.production.yml logs orchestrator
kubectl logs -n kwality deployment/kwality-orchestrator
```

**4. Memory/Performance Issues**
```bash
# Monitor resource usage
docker stats
kubectl top pods -n kwality
```

### Performance Tuning

**Database Optimization:**
```sql
-- Add to postgresql.conf
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
```

**Redis Optimization:**
```conf
# Add to redis.production.conf
maxmemory-policy allkeys-lru
tcp-keepalive 300
timeout 0
```

## 📞 Support and Maintenance

### Regular Maintenance Schedule

**Daily:**
- Monitor dashboards and alerts
- Check backup completion
- Review error logs

**Weekly:**
- Update container images
- Security vulnerability scan
- Performance metrics review

**Monthly:**
- Rotate secrets
- Capacity planning review
- Disaster recovery test

**Quarterly:**
- Full security audit
- Infrastructure cost optimization
- Documentation updates

### Emergency Procedures

**High Priority Incidents:**
1. Check monitoring dashboards
2. Review recent deployments
3. Scale resources if needed
4. Follow incident response plan

**Contact Information:**
- **DevOps Team**: devops@yourdomain.com
- **Security Team**: security@yourdomain.com
- **On-Call**: Defined in your incident management system

---

**Deployment Checklist:**
- [ ] Secrets generated and secure
- [ ] SSL certificates installed
- [ ] Environment variables configured
- [ ] Monitoring dashboards accessible
- [ ] Backup procedures tested
- [ ] Security validation completed
- [ ] Performance testing passed
- [ ] Documentation updated
- [ ] Team training completed
- [ ] Go-live approval obtained

**Last Updated**: $(date)
**Version**: 2.0.0
**Classification**: Internal Use Only