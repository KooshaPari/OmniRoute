# Product Requirements Document (PRD)
# Guardis - Enterprise Secrets Management System

**Version:** 3.0  
**Date:** 2026-04-05  
**Status:** Active Development  
**Author:** Guardis Architecture Team  
**Scope:** Enterprise Secrets Management  

---

## 1. Executive Summary

### 1.1 Product Overview

Guardis is a comprehensive enterprise secrets management system for the Phenotype ecosystem. Built on HashiCorp Vault with integrated Raft consensus, Guardis provides secure secret storage, dynamic credential generation, encryption-as-a-service, and PKI infrastructure. It addresses the critical need for centralized secret management with enterprise-grade security, compliance, and audit capabilities.

**Mission Statement:**  
*Provide an enterprise-grade secrets management platform that ensures sensitive data is securely stored, dynamically generated, and strictly audited while maintaining high availability and seamless integration with modern infrastructure.*

### 1.2 Key Capabilities

| Capability | Description | Status |
|------------|-------------|--------|
| Secret Storage | KV secrets with versioning | Active |
| Dynamic Credentials | On-demand DB/cloud credentials | Active |
| Encryption-as-a-Service | Transit encryption/decryption | Active |
| PKI Infrastructure | Certificate management | Active |
| Raft Consensus | High availability clustering | Active |
| Multi-Tenancy | Namespace isolation | Active |
| Audit Logging | Tamper-proof audit trails | Active |
| Identity Integration | Multiple auth methods | Active |

### 1.3 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Guardis Enterprise                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Vault Cluster (5-node Raft)                  │   │
│  │    ┌──────────┐  ┌──────────┐  ┌──────────┐             │   │
│  │    │ Node 1   │  │ Node 2   │  │ Node 3   │             │   │
│  │    │ (Leader) │  │(Follower)│  │(Follower)│             │   │
│  │    └──────────┘  └──────────┘  └──────────┘             │   │
│  │    ┌──────────┐  ┌──────────┐                           │   │
│  │    │ Node 4   │  │ Node 5   │                           │   │
│  │    │(Follower)│  │(Follower)│                           │   │
│  │    └──────────┘  └──────────┘                           │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   Secret Engines                            │   │
│  │   KV-v2 │ Database │ AWS │ Azure │ GCP │ Transit │ PKI     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   Auth Methods                              │   │
│  │   Token │ Kubernetes │ GitHub │ LDAP │ OIDC │ AppRole    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.4 Current State

| Component | Version | Status |
|-----------|---------|--------|
| Core Vault | 1.15+ | Active |
| Raft Storage | Integrated | Active |
| Secret Engines | 8+ | Active |
| Auth Methods | 10+ | Active |
| Documentation | v3.0 | Active |

---

## 2. Problem Statement

### 2.1 Core Problems Addressed

#### Problem 1: Secret Sprawl
Organizations store secrets across multiple systems—environment variables, configuration files, databases, and code repositories—creating security vulnerabilities and management nightmares.

**Evidence:**
- 70% of organizations have secrets in code repositories
- Average enterprise has secrets in 15+ different locations
- 60% of breaches involve leaked credentials
- Secret rotation is rarely performed due to complexity

#### Problem 2: Static Credentials
Traditional approaches use long-lived static credentials that, once compromised, provide attackers persistent access. Rotation is manual and error-prone.

**Evidence:**
- Average credential lifetime: 18 months
- Manual rotation causes 30% of production incidents
- Static credentials found in 85% of security audits
- Developers share credentials for convenience

#### Problem 3: Lack of Audit Trails
Organizations cannot track who accessed what secrets when, making compliance impossible and breach investigation difficult.

**Evidence:**
- 50% of organizations cannot trace secret access
- Compliance audits fail due to missing audit trails
- Insider threats go undetected
- Forensic analysis takes weeks

#### Problem 4: High Availability Gaps
Secret management systems are often single points of failure. When they go down, applications cannot authenticate or retrieve secrets.

**Evidence:**
- 40% of secret management systems are single-node
- Downtime blocks application startup
- No disaster recovery procedures
- Geographic limitations

#### Problem 5: Multi-Tenancy Challenges
Sharing secret management across teams requires proper isolation. Without it, teams see each other's secrets or need separate instances.

**Evidence:**
- 80% of teams share secret management instances
- No namespace isolation in basic solutions
- RBAC complexity leads to over-permissioning
- Cost of separate instances per team

### 2.2 Target User Pain Points

| User Type | Pain Point | Impact |
|-----------|------------|--------|
| Security Team | Secret sprawl | Breach risk |
| DevOps | Manual rotation | Toil, errors |
| Developers | Complex access | Productivity loss |
| Compliance | Audit gaps | Fines, failed audits |
| Architects | Single points of failure | Downtime risk |
| Platform Team | Multi-tenancy gaps | Cost, complexity |

---

## 3. Target Users

### 3.1 Primary User Personas

#### Persona 1: CISO "Victoria"
- **Demographics:** 45 years old, security executive
- **Experience:** 20 years cybersecurity, CISSP
- **Goals:** Reduce breach risk, pass audits, demonstrate security posture
- **Pain Points:** No visibility into secret usage, compliance gaps
- **Usage Pattern:** Dashboards, audit reports, policy enforcement

#### Persona 2: DevOps Engineer "Diego"
- **Demographics:** 32 years old, platform engineering
- **Experience:** 8 years DevOps, Kubernetes expert
- **Goals:** Automate secret management, reduce toil
- **Pain Points:** Manual credential rotation, secret sprawl
- **Usage Pattern:** Terraform, CLI, Kubernetes integration

#### Persona 3: Application Developer "Alex"
- **Demographics:** 28 years old, full-stack developer
- **Experience:** 5 years development, cloud-native
- **Goals:** Easy secret access without security burden
- **Pain Points:** Complex secret retrieval, blocked by missing access
- **Usage Pattern:** SDKs, environment variables, token auth

#### Persona 4: Compliance Officer "Rachel"
- **Demographics:** 40 years old, compliance specialist
- **Experience:** 15 years audit, risk management
- **Goals:** Demonstrate control effectiveness, pass audits
- **Pain Points:** Missing audit trails, can't prove compliance
- **Usage Pattern:** Audit logs, reports, evidence collection

#### Persona 5: Platform Architect "Marcus"
- **Demographics:** 42 years old, infrastructure architect
- **Experience:** 18 years infrastructure, cloud architecture
- **Goals:** Design resilient, scalable secret management
- **Pain Points:** Single points of failure, scaling challenges
- **Usage Pattern:** Architecture diagrams, performance metrics

### 3.2 User Needs Matrix

| Need | Victoria | Diego | Alex | Rachel | Marcus |
|------|----------|-------|------|--------|--------|
| Centralized Storage | Critical | High | Medium | High | Medium |
| Dynamic Credentials | High | Critical | Medium | Medium | High |
| Audit Logging | Critical | Medium | Low | Critical | Medium |
| High Availability | High | High | Medium | Medium | Critical |
| Multi-Tenancy | High | Critical | Low | High | Critical |
| Automation | Medium | Critical | High | Medium | High |
| Encryption | Critical | High | Low | High | High |
| Integration | Medium | Critical | High | Low | High |

---

## 4. Functional Requirements

### 4.1 Secret Storage (FR-STORAGE-001 to FR-STORAGE-020)

#### FR-STORAGE-001: KV Secrets Engine v2
- Store arbitrary secrets as key-value pairs
- Versioning with history
- Soft delete with recovery
- Metadata tracking (created, updated, versions)

**API Example:**
```bash
vault kv put secret/app/config db_password=s3cr3t api_key=abc123
vault kv get secret/app/config
vault kv put secret/app/config db_password=newpass  # Creates v2
vault kv get -version=1 secret/app/config  # Retrieve old version
```

#### FR-STORAGE-002: Path-Based Organization
- Hierarchical secret paths
- Path-based policies
- List operations at path levels
- Bulk operations

#### FR-STORAGE-003: Secret Metadata
- Creation timestamp
- Last update timestamp
- Version number
- Deletion timestamp (for soft delete)
- Custom metadata (max 128KB)

#### FR-STORAGE-004: Versioning
- Automatic versioning on update
- Minimum versions to retain (configurable)
- Version retrieval
- Rollback capability
- Permanent deletion of versions

### 4.2 Dynamic Secrets (FR-DYNAMIC-001 to FR-DYNAMIC-020)

#### FR-DYNAMIC-001: Database Secret Engine
- Generate dynamic database credentials
- Support: PostgreSQL, MySQL, MongoDB, MSSQL, Oracle
- Automatic credential rotation
- Revocation on lease expiration
- TTL-based leases

**API Example:**
```bash
vault read database/creds/readonly
# Returns: username, password, lease_id, lease_duration, renewable
```

#### FR-DYNAMIC-002: Cloud Secret Engines
- AWS: Generate IAM credentials, STS tokens
- Azure: Generate service principals, access tokens
- GCP: Generate service account keys, access tokens
- Automatic revocation
- Role-based permission scoping

#### FR-DYNAMIC-003: Lease Management
- Configurable TTL
- Lease renewal
- Lease revocation
- Bulk lease operations
- Lease listing and filtering

#### FR-DYNAMIC-004: Role Configuration
- Creation statements (database schemas)
- Revocation statements
- Default TTL
- Max TTL
- Statement templating

### 4.3 Encryption (FR-ENCRYPT-001 to FR-ENCRYPT-015)

#### FR-ENCRYPT-001: Transit Secrets Engine
- Encryption-as-a-service
- Decryption with key management
- Sign/verify operations
- HMAC operations
- Key rotation

**API Example:**
```bash
vault write transit/encrypt/app-key plaintext=$(base64 <<< "sensitive data")
vault write transit/decrypt/app-key ciphertext=vault:v1:abcde...
```

#### FR-ENCRYPT-002: Key Management
- Named encryption keys
- Automatic key rotation
- Manual key rotation
- Key export (with authorization)
- Key derivation

#### FR-ENCRYPT-003: Convergent Encryption
- Same plaintext → same ciphertext
- Deduplication support
- Context-based encryption

#### FR-ENCRYPT-004: Batch Operations
- Batch encrypt/decrypt
- Batch sign/verify
- Performance optimization

### 4.4 PKI (FR-PKI-001 to FR-PKI-020)

#### FR-PKI-001: Root CA Management
- Generate root CAs
- Import external CAs
- CA chaining
- CA rotation

#### FR-PKI-002: Intermediate CA
- Generate intermediate CAs
- CA signing
- Certificate policy enforcement

#### FR-PKI-003: Certificate Issuance
- Role-based certificate issuance
- TTL enforcement
- Key type selection (RSA, ECDSA, Ed25519)
- Subject alternative names (SANs)

**API Example:**
```bash
vault write pki/issue/app-role \
  common_name=app.example.com \
  ttl=720h \
  alt_names=api.example.com
```

#### FR-PKI-004: Certificate Revocation
- CRL generation
- OCSP support
- Revocation tracking
- Auto-revocation on expiration

### 4.5 Authentication (FR-AUTH-001 to FR-AUTH-020)

#### FR-AUTH-001: Token Auth
- Vault tokens
- Token policies
- Token hierarchies (parent/child)
- Service token vs batch token
- Token TTL and renewal

#### FR-AUTH-002: Kubernetes Auth
- Service account verification
- JWT validation
- Role mapping
- In-cluster and external cluster

#### FR-AUTH-003: GitHub Auth
- GitHub team/organization mapping
- Personal access token verification
- Organization restriction

#### FR-AUTH-004: LDAP Auth
- LDAP bind authentication
- Group membership mapping
- User search
- TLS/StartTLS

#### FR-AUTH-005: OIDC/OAuth2
- OpenID Connect integration
- OAuth2 token validation
- Userinfo endpoint support
- Group/claim mapping

#### FR-AUTH-006: AppRole
- RoleID/SecretID authentication
- Push/pull delivery modes
- SecretID constraints (CIDR, TTL)
- Multi-factor equivalent

### 4.6 Authorization (FR-AUTHZ-001 to FR-AUTHZ-015)

#### FR-AUTHZ-001: Policy-Based Access Control
- HCL policy syntax
- Path-based rules
- Operation restrictions (read, write, delete, list, sudo)
- Parameter constraints

**Policy Example:**
```hcl
path "secret/app/*" {
  capabilities = ["read", "list"]
}

path "secret/app/admin" {
  capabilities = ["deny"]
}
```

#### FR-AUTHZ-002: Namespaces
- Multi-tenancy isolation
- Namespace-scoped policies
- Namespace administration
- Hierarchical namespaces (enterprise)

#### FR-AUTHZ-003: Entities and Groups
- Entity (user) management
- Group membership
- Group policies
- Identity aliases

### 4.7 High Availability (FR-HA-001 to FR-HA-015)

#### FR-HA-001: Raft Consensus
- Integrated Raft storage
- 3/5/7 node clusters
- Automatic leader election
- Log replication
- Quorum-based writes

**Configuration:**
| Cluster Size | Quorum | Fault Tolerance |
|-------------|--------|-----------------|
| 3 nodes | 2 | 1 node |
| 5 nodes | 3 | 2 nodes |
| 7 nodes | 4 | 3 nodes |

#### FR-HA-002: Disaster Recovery
- Automated snapshots
- Snapshot restoration
- DR cluster promotion
- Cross-region replication

#### FR-HA-003: Performance Standby
- Read scaling with performance standbys
- Automatic failover
- Client redirection

### 4.8 Audit Logging (FR-AUDIT-001 to FR-AUDIT-015)

#### FR-AUDIT-001: Audit Devices
- File audit device
- Socket audit device
- Syslog audit device
- Custom audit backends

#### FR-AUDIT-002: Audit Entry Format
- Standardized JSON format
- Request/response hashing
- Client information
- Authentication details

**Example Audit Entry:**
```json
{
  "time": "2026-04-05T12:00:00Z",
  "type": "request",
  "auth": {
    "display_name": "app-role",
    "policies": ["app-policy"]
  },
  "request": {
    "operation": "read",
    "path": "secret/app/config"
  }
}
```

#### FR-AUDIT-003: Tamper Resistance
- Response hashing (hmac-sha256)
- Forward-only log devices
- External SIEM integration
- Immutable storage options

---

## 5. Non-Functional Requirements

### 5.1 Performance Requirements (NFR-PERF-001 to NFR-PERF-010)

#### NFR-PERF-001: Throughput
| Operation | Target | Max |
|-----------|--------|-----|
| KV read | 10,000 ops/sec | 25,000 |
| KV write | 5,000 ops/sec | 15,000 |
| Transit encrypt | 5,000 ops/sec | 12,000 |
| PKI issue | 500 ops/sec | 1,000 |
| Dynamic creds | 200 ops/sec | 500 |

#### NFR-PERF-002: Latency
| Operation | p50 | p99 |
|-----------|-----|-----|
| KV read | <5ms | <20ms |
| KV write | <10ms | <50ms |
| Transit encrypt | <5ms | <20ms |
| Authentication | <50ms | <200ms |

#### NFR-PERF-003: Cluster Performance
- Leader change: <5 seconds
- Data replication: <100ms lag
- Snapshot creation: <1 minute per GB
- Recovery: <30 seconds

### 5.2 Reliability Requirements (NFR-REL-001 to NFR-REL-010)

#### NFR-REL-001: Availability
- 99.99% uptime (5-node cluster)
- Automatic failover
- No single point of failure
- Graceful degradation

#### NFR-REL-002: Data Durability
- Write-ahead logging
- Automatic snapshots
- Transaction safety
- No data loss on failover

#### NFR-REL-003: Disaster Recovery
- RPO: <5 minutes
- RTO: <15 minutes
- Cross-region replication (optional)
- Automated backup testing

### 5.3 Security Requirements (NFR-SEC-001 to NFR-SEC-015)

#### NFR-SEC-001: Encryption
- Data at rest: AES-256-GCM
- Data in transit: TLS 1.3
- Key encryption: Shamir's Secret Sharing
- Master key: Auto-unseal or manual

#### NFR-SEC-002: Access Control
- Defense in depth
- Least privilege
- Separation of duties
- Regular access review

#### NFR-SEC-003: Audit
- 100% operation logging
- Immutable audit trail
- SIEM integration
- Real-time alerting

#### NFR-SEC-004: Compliance
- FIPS 140-2 Level 3 (with HSM)
- SOC 2 Type II support
- PCI DSS compliance
- GDPR data protection

### 5.4 Scalability Requirements (NFR-SCALE-001 to NFR-SCALE-010)

#### NFR-SCALE-001: Data Scale
- 10M+ secrets per cluster
- 100K+ namespaces
- 1M+ active leases
- 10GB+ audit logs/day

#### NFR-SCALE-002: Client Scale
- 10,000+ concurrent clients
- 100,000+ authenticated entities
- 1,000+ namespaces

---

## 6. User Stories

### 6.1 Security Team Stories

#### US-SEC-001: Centralized Secret Management
**As a** CISO  
**I want** all secrets in a centralized, encrypted store  
**So that** I can enforce security policies

**Acceptance Criteria:**
- [ ] Single source of truth for secrets
- [ ] Policy enforcement at central point
- [ ] Audit logging of all access
- [ ] Encryption at rest and in transit

#### US-SEC-002: Audit Compliance
**As a** compliance officer  
**I want** complete audit trails of secret access  
**So that** I can pass compliance audits

**Acceptance Criteria:**
- [ ] Every secret access logged
- [ ] Who, what, when for each access
- [ ] Tamper-evident logs
- [ ] Exportable audit reports

### 6.2 DevOps Stories

#### US-DEVOPS-001: Automated Secret Rotation
**As a** DevOps engineer  
**I want** credentials rotated automatically  
**So that** I don't have to manage rotation manually

**Acceptance Criteria:**
- [ ] Dynamic credentials generated on demand
- [ ] Automatic expiration and revocation
- [ ] No manual rotation procedures
- [ ] Application handles rotation transparently

#### US-DEVOPS-002: Infrastructure as Code
**As a** DevOps engineer  
**I want** to manage Guardis through Terraform  
**So that** configuration is version controlled

**Acceptance Criteria:**
- [ ] Terraform provider available
- [ ] All resources manageable via IaC
- [ ] State import/export supported
- [ ] Drift detection functional

### 6.3 Developer Stories

#### US-DEV-001: Easy Secret Access
**As a** developer  
**I want** to retrieve secrets with minimal code  
**So that** I can focus on business logic

**Acceptance Criteria:**
- [ ] Simple SDK integration
- [ ] Environment variable injection
- [ ] Kubernetes integration
- [ ] Clear error messages

#### US-DEV-002: Local Development
**As a** developer  
**I want** to develop locally with Guardis  
**So that** I can test secret integration

**Acceptance Criteria:**
- [ ] Local dev instance easy to run
- [ ] Dev/prod parity maintained
- [ ] Mock/test modes available
- [ ] Documentation for setup

---

## 7. Features

### 7.1 Core Features

#### F-CORE-001: Vault Cluster
**Description:** HashiCorp Vault with Raft consensus

**Capabilities:**
- 3/5/7 node clustering
- Automatic leader election
- Log replication
- Snapshot management
- Auto-unseal (with cloud KMS)

---

#### F-CORE-002: Secret Engines
**Description:** Multiple secret backends

**Engines:**
- KV-v2: Versioned key-value
- Database: Dynamic database credentials
- AWS/Azure/GCP: Cloud credentials
- Transit: Encryption-as-a-service
- PKI: Certificate management
- SSH: SSH key signing
- TOTP: Time-based one-time passwords

---

#### F-CORE-003: Auth Methods
**Description:** Multiple authentication backends

**Methods:**
- Token: Vault-native tokens
- Kubernetes: Service account auth
- GitHub: GitHub token auth
- LDAP: Corporate directory
- OIDC: OpenID Connect
- AppRole: Application authentication
- JWT/OIDC: JWT validation
- AWS/Azure/GCP: Cloud IAM

---

### 7.2 Enterprise Features

#### F-ENT-001: Namespaces
**Description:** Multi-tenancy isolation

**Capabilities:**
- Scoped secrets and policies
- Namespace administration
- Self-service for teams
- Isolated audit logs

---

#### F-ENT-002: Sentinel
**Description:** Policy as code (enterprise)

**Capabilities:**
- Fine-grained access control
- Request/response inspection
- Custom policy logic
- EGP (Endpoint Governing Policies)

---

#### F-ENT-003: Replication
**Description:** Cross-region disaster recovery

**Capabilities:**
- DR replication
- Performance replication
- Filtered replication
- Automated failover

---

## 8. Metrics and Success Criteria

### 8.1 Adoption Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Secrets managed | 1M+ | Vault metrics |
| Applications onboarded | 500+ | Entity count |
| Dynamic credentials/month | 1M+ | Lease metrics |
| API calls/day | 10M+ | Audit logs |

### 8.2 Security Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Static credentials eliminated | >90% | Scanning |
| Secret rotation compliance | >95% | Policy check |
| Audit coverage | 100% | Audit log review |
| Security incidents | 0 | Incident tracking |

### 8.3 Performance Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Availability | 99.99% | Monitoring |
| Read latency p99 | <20ms | Metrics |
| Write latency p99 | <50ms | Metrics |
| Auth latency p99 | <200ms | Metrics |

### 8.4 Reliability Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Leader changes | <1/month | Monitoring |
| Replication lag | <100ms | Metrics |
| Backup success | 100% | Job status |
| DR test success | 100% | DR exercises |

---

## 9. Release Criteria

### 9.1 Pre-Release Checklist

#### Security
- [ ] Security audit complete
- [ ] Penetration testing passed
- [ ] FIPS compliance (if required)
- [ ] Secrets scanning clean

#### Performance
- [ ] Load testing passed
- [ ] Latency targets met
- [ ] Throughput targets met
- [ ] Failover tested

#### Documentation
- [ ] Architecture documented
- [ ] Runbooks complete
- [ ] API reference current
- [ ] Troubleshooting guide ready

#### Operations
- [ ] Monitoring configured
- [ ] Alerting validated
- [ ] Backup tested
- [ ] DR procedure tested

### 9.2 Release Gates

| Gate | Criteria | Owner |
|------|----------|-------|
| Security | Security sign-off | CISO |
| Performance | Benchmarks pass | Performance Team |
| Reliability | HA testing complete | SRE Team |
| Documentation | Docs complete | Docs Team |
| Operations | Runbooks ready | Operations |
| Final | Product Owner approval | Product Owner |

---

## 10. Appendix

### 10.1 Architecture Decision Records

Refer to SPEC.md for detailed ADRs:
- ADR-001: Raft vs. Consul storage
- ADR-002: Auto-unseal strategy
- ADR-003: Namespace isolation model
- ADR-004: Audit log format

### 10.2 Glossary

| Term | Definition |
|------|------------|
| Vault | HashiCorp secrets management tool |
| Raft | Consensus algorithm for distributed systems |
| Seal/Unseal | Encrypt/decrypt the master key |
| Lease | Time-limited credential grant |
| Namespace | Isolated tenant space |
| Entity | Authenticated user or application |
| Policy | Access control rules |
| Secret Engine | Backend for specific secret types |
| Auth Method | Authentication backend |
| Transit | Encryption-as-a-service |
| PKI | Public Key Infrastructure |
| HSM | Hardware Security Module |

### 10.3 Related Documents

- SPEC.md - Complete specification
- RUNBOOK.md - Operational procedures
- SECURITY.md - Security policies
- INTEGRATION.md - Integration guides

---

**Document Control**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2024-01-15 | Guardis Team | Initial release |
| 2.0 | 2025-06-20 | Guardis Team | Added namespaces |
| 3.0 | 2026-04-05 | Guardis Team | Enterprise features |

**Review Schedule:** Quarterly  
**Next Review:** 2026-07-05  
**Approvals Required:** CISO, CTO, Product Owner
