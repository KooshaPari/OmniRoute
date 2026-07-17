# Security Patterns and Threat Modeling - State of the Art Research

> **Project:** Guardis  
> **Category:** Security Patterns, Threat Modeling & Frameworks  
**Date:** April 2026  
> **Status:** SOTA Research Synthesis

---

## Executive Summary

This document presents a comprehensive analysis of security patterns and threat modeling methodologies essential for designing robust security architectures. Security patterns provide reusable solutions to common security problems, while threat modeling offers systematic approaches to identifying and mitigating potential threats.

The convergence of these disciplines—security patterns and threat modeling—enables organizations to build security into systems from the ground up, rather than retrofitting it later. This shift-left approach to security is critical for modern software development and infrastructure management.

---

## 1. Security Patterns Catalog

### 1.1 Defense in Depth

**Pattern Intent**: Layer multiple security controls to protect resources

**Problem**: Single security mechanisms can fail or be bypassed

**Solution**: Implement overlapping security mechanisms at different layers

```
┌──────────────────────────────────────────────────────────────┐
│                    Defense in Depth Layers                   │
├──────────────────────────────────────────────────────────────┤
│ Layer 7: Application        │ Input validation, output        │
│                             │ encoding, secure session mgmt   │
├─────────────────────────────┼─────────────────────────────────┤
│ Layer 6: Data               │ Encryption, masking,            │
│                             │ classification, DLP             │
├─────────────────────────────┼─────────────────────────────────┤
│ Layer 5: Endpoint           │ EDR, host firewall,             │
│                             │ application whitelisting        │
├─────────────────────────────┼─────────────────────────────────┤
│ Layer 4: Internal Network   │ Segmentation, east-west         │
│                             │ traffic inspection, IDS/IPS     │
├─────────────────────────────┼─────────────────────────────────┤
│ Layer 3: Perimeter Network  │ Firewalls, DDoS protection,     │
│                             │ VPN, WAF                        │
├─────────────────────────────┼─────────────────────────────────┤
│ Layer 2: Endpoint Security  │ Device compliance, MDM,         │
│                             │ hardware security modules       │
├─────────────────────────────┼─────────────────────────────────┤
│ Layer 1: Physical           │ Data center security,             │
│                             │ hardware access controls        │
├─────────────────────────────┼─────────────────────────────────┤
│ Layer 0: Policies &         │ Governance, training,           │
│ Procedures                  │ incident response               │
└─────────────────────────────┴─────────────────────────────────┘
```

**Key Principles:**
- Each layer must provide value independently
- Layer failures should not cascade
- Monitoring at every layer
- Principle of least privilege at each boundary

**Implementation Example:**
```
Web Application Defense in Depth:

User Request
    │
    ▼
┌─────────────┐  DDoS Protection, Geo-blocking
│   CDN/WAF   │  (Layer 3-4)
└──────┬──────┘
       │
       ▼
┌─────────────┐  TLS, Certificate pinning
│   Load      │  (Layer 3)
│  Balancer   │
└──────┬──────┘
       │
       ▼
┌─────────────┐  API Gateway, Rate limiting
│   API       │  Authentication (Layer 7)
│   Gateway   │
└──────┬──────┘
       │
       ▼
┌─────────────┐  Input validation, Parameterized
│ Application │  queries, Output encoding
│   Server    │  (Layer 7)
└──────┬──────┘
       │
       ▼
┌─────────────┐  Encryption at rest, Access
│   Database  │  controls (Layer 6)
└─────────────┘
```

### 1.2 Least Privilege

**Pattern Intent**: Grant minimum permissions necessary for a task

**Problem**: Excessive permissions increase attack surface and blast radius

**Solution**: Implement fine-grained access control with just-in-time elevation

**Implementation Patterns:**

| Pattern | Description | Use Case |
|---------|-------------|----------|
| RBAC | Role-Based Access Control | Hierarchical organizations |
| ABAC | Attribute-Based Access Control | Dynamic environments |
| PBAC | Policy-Based Access Control | Complex compliance requirements |
| JIT Access | Just-in-Time Access | Privileged operations |
| Break-Glass | Emergency access | Incident response |

**RBAC vs ABAC vs PBAC:**
```
RBAC: Role → Permissions
     "Admin" → [read, write, delete]
     "User"  → [read, write]

ABAC: User Attributes + Resource Attributes + Environment → Decision
     [dept:engineering, level:senior] + [classification:internal] + [time:business_hours] → ALLOW

PBAC: Policy Rules → Decision
     IF user.department == resource.owner_department AND context.risk_score < 50 THEN ALLOW
```

**Least Privilege Implementation:**
```
Permission Levels:

System      → Admin      → Operator   → User       → Guest
────────────┼────────────┼────────────┼────────────┼────────
Full        │ Scoped     │ Limited    │ Self-only  │ Public
Access      │ Admin      │ Operations │ Data       │ Info
            │ Rights     │            │            │
            │            │            │            │
├─ Full     │            │            │            │
│  Control  │            │            │            │
│            │            │            │            │
├─ Scoped   │ ├─ Scoped  │            │            │
│  Control   │ │  Control │            │            │
│            │ │          │            │            │
├─ Limited  │ ├─ Limited │ ├─ Limited │            │
│  Operations│ │ Ops      │ │ Ops      │            │
│            │ │          │ │          │            │
├─ Self Data│ ├─ Self    │ ├─ Self    │ ├─ Self    │
│            │ │  Data    │ │  Data    │ │  Data    │
│            │ │          │ │          │ │          │
└─ Public    │ └─ Public  │ └─ Public  │ └─ Public  │ └─ Public
   Info      │    Info    │    Info    │    Info    │    Info
```

### 1.3 Secure By Default

**Pattern Intent**: Systems should be secure out of the box

**Problem**: Insecure defaults lead to vulnerabilities when misconfigured

**Solution**: Make the most secure option the default option

**Secure by Default Principles:**

| Aspect | Insecure Default | Secure Default |
|--------|-----------------|----------------|
| Authentication | No password / admin/admin | Random password, MFA required |
| Encryption | Optional, disabled | Mandatory, enabled |
| Ports | All open | Only required open |
| Logging | Minimal | Comprehensive |
| Error Messages | Detailed stack traces | Generic, logged details |
| Permissions | Permissive | Restrictive |

**Example - Database Security:**
```
Insecure Defaults (Traditional):
┌─────────────────────────────────────────┐
│ MySQL Default Install                   │
│ - Root password: empty                 │
│ - Remote access: enabled                │
│ - Test database: present                │
│ - Anonymous users: allowed              │
└─────────────────────────────────────────┘

Secure by Default (Modern):
┌─────────────────────────────────────────┐
│ PostgreSQL Hardened Install             │
│ - Generated strong password required     │
│ - Local connections only by default      │
│ - No default databases                  │
│ - SSL/TLS required                      │
│ - Query logging enabled                 │
└─────────────────────────────────────────┘
```

### 1.4 Fail Secure

**Pattern Intent**: When security controls fail, the system fails to a secure state

**Problem**: Component failures can open security holes

**Solution**: Design systems to default to secure state on failure

**Fail Secure States:**

| Component | Fail Secure State |
|-----------|-------------------|
| Firewall | Block all traffic |
| Authentication | Deny access |
| Authorization | Deny permission |
| Encryption | Prevent transmission |
| Monitoring | Alert on data loss |
| Door lock | Lock (if power fails) |

**Fail Safe vs Fail Secure:**
```
Fail Safe (Safety-Critical):    Fail Secure (Security-Critical):
───────────────────────────     ─────────────────────────────
Fire door unlocks on power      Door locks on power failure
failure (safety egress)         (prevent unauthorized entry)

Database allows read-only       Database denies all access
on replication failure          on authentication failure
(preserves availability)        (preserves confidentiality)
```

### 1.5 Separation of Duties

**Pattern Intent**: Divide critical operations among multiple parties

**Problem**: Single individuals can abuse or misuse privileges

**Solution**: Require multiple parties for sensitive operations

**SoD Patterns:**

| Pattern | Implementation |
|---------|---------------|
| Two-Person Rule | Two authorized users required |
| Maker-Checker | One creates, another approves |
| Dual Control | Both parties must act simultaneously |
| Segregation | Different teams for different functions |

**Example - Financial Transaction:**
```
Transaction Approval Flow:

┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ Request  │───▶│ Validate │───▶│  Authorize│───▶│ Execute  │
│ (User)   │    │ (System) │    │ (Manager) │    │ (System) │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
                     │                │
                     ▼                ▼
                ┌──────────┐     ┌──────────┐
                │ Policy   │     │ Audit    │
                │ Check    │     │ Log      │
                └──────────┘     └──────────┘
```

### 1.6 Defense in Breadth

**Pattern Intent**: Diversify security controls to prevent single points of failure

**Problem**: Multiple layers using same mechanism fail together

**Solution**: Use different types of controls at each layer

**Defense in Breadth Strategy:**
```
Single Vendor Stack (Risky):    Diverse Stack (Robust):
┌─────────────┐                  ┌─────────────┐
│ Vendor A    │                  │ WAF (Vendor X)│
│ Firewall    │                  ├─────────────┤
├─────────────┤                  │ IDS (Vendor Y)│
│ Vendor A    │                  ├─────────────┤
│ IDS/IPS     │                  │ EDR (Vendor Z)│
├─────────────┤                  ├─────────────┤
│ Vendor A    │                  │ SIEM (Vendor W)│
│ Endpoint    │                  └─────────────┘
└─────────────┘

Single vulnerability affects     Different vulnerabilities
all layers                       needed to breach layers
```

### 1.7 Security Monitoring and Auditing

**Pattern Intent**: Continuous visibility into security-relevant events

**Problem**: Unknown security events cannot be detected or responded to

**Solution**: Comprehensive logging, monitoring, and alerting

**Monitoring Layers:**

| Layer | What to Monitor | Key Metrics |
|-------|----------------|-------------|
| Application | API calls, user actions | Error rates, latency, anomalies |
| Network | Traffic flows, connections | Bandwidth, DDoS indicators |
| Endpoint | Process execution, file access | Malware detection, compliance |
| Identity | Authentication attempts | Failed logins, MFA failures |
| Data | Access patterns, downloads | DLP alerts, access anomalies |

**Audit Trail Requirements:**
```
Comprehensive Audit Log:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Timestamp: 2024-01-15T09:23:17Z
Event Type: FILE_ACCESS
Severity: HIGH

Actor:
  User ID: user@company.com
  Session ID: sess_abc123
  IP Address: 203.0.113.42
  Device ID: device_xyz789
  Authentication: MFA-verified

Action:
  Type: DOWNLOAD
  Resource: /data/confidential/financial_report.pdf
  Classification: CONFIDENTIAL
  Size: 2.4 MB

Context:
  Location: Office (expected)
  Time: Business hours
  Risk Score: 15 (low)
  Policy Applied: DLP-CONFIDENTIAL-ACCESS

Result: ALLOWED (with warning)
Policy Justification: User is member of Finance group
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 1.8 Encryption Patterns

#### 1.8.1 Encryption at Rest

**Pattern**: Protect stored data from unauthorized access

**Implementation:**
- **Database Encryption**: Transparent Data Encryption (TDE)
- **File Encryption**: Full disk encryption (FDE)
- **Object Storage**: Client-side or server-side encryption
- **Key Management**: Hardware Security Modules (HSM), KMS

**Encryption at Rest Tiers:**
```
Storage Layer Encryption:

┌─────────────────────────────────────────┐
│ Application-Level                       │
│ - Field-level encryption                │
│ - Application-managed keys              │
│ - Most granular control                 │
├─────────────────────────────────────────┤
│ Database-Level                          │
│ - Transparent Data Encryption (TDE)     │
│ - Column-level encryption               │
│ - Database-managed keys                 │
├─────────────────────────────────────────┤
│ File System-Level                       │
│ - Encrypted volumes                     │
│ - File-based encryption                 │
│ - OS-managed keys                       │
├─────────────────────────────────────────┤
│ Disk-Level                              │
│ - Full Disk Encryption (FDE)            │
│ - Hardware-based encryption             │
│ - Self-encrypting drives (SED)          │
└─────────────────────────────────────────┘
```

#### 1.8.2 Encryption in Transit

**Pattern**: Protect data during transmission

**Implementation:**
- **TLS 1.3**: Latest transport security standard
- **mTLS**: Mutual authentication with certificates
- **VPN**: Encrypted network tunnels
- **Application-level**: End-to-end encryption

**Encryption in Transit Hierarchy:**
```
Security Level    │ Protocol          │ Use Case
──────────────────┼───────────────────┼────────────────────
Maximum           │ mTLS + App Crypto │ Financial transactions
High              │ TLS 1.3           │ Web applications, APIs
Medium            │ TLS 1.2           │ Legacy systems
Basic             │ TLS 1.1/1.0       │ Legacy (deprecated)
──────────────────┴───────────────────┴────────────────────
```

#### 1.8.3 End-to-End Encryption

**Pattern**: Data encrypted from source to destination, unreadable by intermediaries

**Implementation:**
- **Client-Side Encryption**: Data encrypted before leaving client
- **Zero-Knowledge Architecture**: Service cannot access plaintext
- **Key Escrow Alternatives**: Distributed key management

```
End-to-End Encryption Flow:

┌─────────┐         ┌─────────┐         ┌─────────┐
│ Client A│────────▶│ Server  │────────▶│ Client B│
│         │  [Encrypted]       │  [Encrypted]       │         │
│ ┌─────┐ │         │  (Can't │         │ ┌─────┐ │
│ │Plain│ │         │  read)   │         │ │Plain│ │
│ │text │ │────────▶│─────────│────────▶│ │text │ │
│ └──┬──┘ │         │         │         │ └──┬──┘ │
│    │    │         │         │         │    │    │
│ ┌──▼──┐ │         │         │         │ ┌──▼──┐ │
│ │Encrypt│ │         │         │         │ │Decrypt│ │
│ │Key A │ │         │         │         │ │Key B │ │
│ └─────┘ │         │         │         │ └─────┘ │
└─────────┘         └─────────┘         └─────────┘

Server sees only encrypted data
```

### 1.9 Secure Communication Patterns

#### 1.9.1 Secure Session Management

**Pattern**: Maintain secure stateful connections between entities

**Implementation:**
- **Session Tokens**: Cryptographically secure, random tokens
- **Token Binding**: Bind tokens to client characteristics
- **Session Timeout**: Automatic expiration
- **Concurrent Session Control**: Limit parallel sessions

**Secure Session Architecture:**
```
Session Establishment:

┌─────────┐                    ┌─────────┐
│ Client  │────────────────────│ Server  │
│         │ 1. Login (HTTPS)   │         │
│         │────────────────────▶│         │
│         │                    │ ┌───────┐ │
│         │ 2. Generate Token │ │Create │ │
│         │    + Set Expiry   │ │Session│ │
│         │    + Sign         │ │Record │ │
│         │                    │ └───┬───┘ │
│         │ 3. Set-Cookie:    │     │     │
│         │    session=xxx    │     │     │
│         │◀──────────────────│     │     │
│         │                    │     │     │
│ ┌───────┐                    │ ┌───▼───┐ │
│ Store   │                    │ Store   │ │
│ Cookie  │                    │ Session │ │
└─────────┘                    └─────────┘

Session Validation:
┌─────────┐                    ┌─────────┐
│ Client  │────────────────────│ Server  │
│         │ 4. Request +      │         │
│         │    Cookie         │         │
│         │────────────────────▶│         │
│         │                    │ ┌───────┐ │
│         │                    │ │Validate│ │
│         │                    │ │Token   │ │
│         │ 5. Response       │ │Signature│ │
│         │◀──────────────────│ │Expiry  │ │
│         │                    │ └───────┘ │
└─────────┘                    └─────────┘
```

---

## 2. Threat Modeling

### 2.1 STRIDE Methodology

STRIDE is a threat classification model developed by Microsoft for identifying security threats.

**STRIDE Categories:**

| Category | Description | Example | Mitigation |
|----------|-------------|---------|------------|
| **S**poofing | Impersonating something/someone | Fake login page | Authentication |
| **T**ampering | Modifying data/code | Modifying request payload | Integrity checks, digital signatures |
| **R**epudiation | Denying action performed | Deleting logs after attack | Logging, audit trails |
| **I**nformation Disclosure | Exposing information | Reading database dumps | Encryption, access control |
| **D**enial of Service | Disrupting service availability | DDoS attack | Rate limiting, redundancy |
| **E**levation of Privilege | Gaining unauthorized access | Exploiting privilege escalation bug | Authorization, least privilege |

**STRIDE per Element:**
```
Component: Web Application API

┌─────────────────────────────────────────────────────────┐
│ External Entity: User                                    │
├─────────────────────────────────────────────────────────┤
│ Spoofing    │ Strong authentication required             │
│ Tampering   │ HTTPS/TLS for transit protection           │
│ Repudiation │ All actions logged with non-repudiation  │
│ Info Disclosure│ Minimum data principle, access controls  │
│ DoS         │ Rate limiting, resource quotas             │
│ Elevation   │ Session binding, privilege checks          │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Process: API Server                                      │
├─────────────────────────────────────────────────────────┤
│ Spoofing    │ Service identity via mTLS                  │
│ Tampering   │ Input validation, parameterized queries    │
│ Repudiation │ Structured logging to immutable store        │
│ Info Disclosure│ Error handling without info leakage    │
│ DoS         │ Resource limits, circuit breakers            │
│ Elevation   │ RBAC, permission checks                    │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Data Store: Database                                     │
├─────────────────────────────────────────────────────────┤
│ Spoofing    │ Network restrictions, authentication       │
│ Tampering   │ Transaction integrity, backups             │
│ Repudiation │ Audit logging, change tracking             │
│ Info Disclosure│ Encryption at rest, access controls      │
│ DoS         │ Connection pooling, query optimization       │
│ Elevation   │ Database roles, principle of least privilege │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Attack Trees

Attack trees provide a structured way to analyze how an attacker might achieve a goal.

**Attack Tree Structure:**
```
Goal: Steal Customer Credit Card Data

                                ┌─────────────────┐
                                │   Steal CC Data │
                                └────────┬────────┘
                                         │
                    ┌────────────────────┼────────────────────┐
                    │                    │                    │
                    ▼                    ▼                    ▼
            ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
            │  From DB     │ OR │  From App    │ OR │  From Network│
            │  Server      │    │  Memory      │    │  Traffic     │
            └──────┬───────┘    └──────┬───────┘    └──────┬───────┘
                   │                   │                   │
       ┌───────────┴──────────┐       │           ┌────────┴────────┐
       │                      │       │           │                 │
       ▼                      ▼       ▼           ▼                 ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ SQL Injection│ AND│  Extract from│    │Memory        │    │  MITM Attack │
│              │    │  Backup      │    │ Dump         │    │  on API      │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
       │
       ▼
┌──────────────┐
│ Escalate to  │
│ DB User      │
└──────────────┘
```

**Attack Tree Analysis:**

| Node | Attack | Difficulty | Impact | Likelihood |
|------|--------|------------|--------|------------|
| SQL Injection | Inject malicious SQL | Medium | High | Medium |
| Memory Dump | Extract from RAM | High | High | Low |
| MITM | Intercept traffic | Low (without TLS) | Medium | High |
| Backup Extraction | Access backups | Medium | High | Low |

**Calculating Attack Probability:**
```
AND Node: Multiply probabilities
OR Node:  Use highest probability (attacker picks easiest)

Example:
From DB Server = SQL Injection (0.3) AND Extract from Backup (0.2)
               = 0.3 × 0.2 = 0.06 (6%)

Overall = max(0.06, Memory Dump, MITM)
        = max(0.06, 0.1, 0.4) 
        = 0.4 (40% without TLS)
        = 0.06 (6% with TLS)
```

### 2.3 DREAD Risk Assessment

DREAD provides a quantitative risk scoring methodology:

| Factor | Description | Score Range |
|--------|-------------|-------------|
| **D**amage | Financial, reputational, operational impact | 0-10 |
| **R**eproducibility | How easily can the attack be repeated | 0-10 |
| **E**xploitability | Skill and resources required | 0-10 |
| **A**ffected Users | Number of users impacted | 0-10 |
| **D**iscoverability | How easily can the vulnerability be found | 0-10 |

**Risk Score Calculation:**
```
Total Score = (Damage + Reproducibility + Exploitability + AffectedUsers + Discoverability) / 5

Interpretation:
0-3:   Low Risk      - Accept or monitor
4-6:   Medium Risk   - Plan remediation
7-8:   High Risk     - Remediate soon
9-10:  Critical Risk - Remediate immediately
```

**DREAD Example:**
```
Threat: SQL Injection in Login Form

Factor              │ Rating │ Justification
────────────────────┼────────┼────────────────────────────────
Damage              │   9    │ Full database compromise possible
Reproducibility     │   10   │ Works every time with correct payload
Exploitability      │   8    │ Public tools available, low skill needed
Affected Users      │   10   │ All customer data at risk
Discoverability     │   7    │ Error messages may reveal vulnerability
────────────────────┼────────┼────────────────────────────────
Total Score         │  8.8   │ CRITICAL RISK

Recommendation: Immediate remediation required
- Implement parameterized queries
- Input validation
- WAF rules
- Principle of least privilege on DB
```

---

## 3. Security Frameworks

### 3.1 NIST Cybersecurity Framework

The NIST CSF provides a comprehensive approach to security risk management.

**Core Functions:**

```
┌─────────────────────────────────────────────────────────┐
│              NIST CSF Core Functions                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐             │
│  │ IDENTIFY│───▶│ PROTECT │───▶│  DETECT │             │
│  │         │    │         │    │         │             │
│  │ Assets  │    │ Access  │    │ Anomalies│             │
│  │ Risks   │    │ Control │    │ Events   │             │
│  │ Threats │    │ Data Sec│    │ Continuous│            │
│  └────┬────┘    └────┬────┘    └────┬────┘             │
│       │              │              │                   │
│       │         ┌────┴────┐    ┌────┴────┐             │
│       │         │         │    │         │             │
│       └────────▶│ RESPOND │◀───│ RECOVER │◀───────────┘
│                 │         │    │         │             │
│                 │ Response│    │ Restore │             │
│                 │ Planning│    │ Improve │             │
│                 │ Analysis│    │         │             │
│                 └─────────┘    └─────────┘             │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Identify Function Categories:**

| Category | Description | Key Activities |
|------------|-------------|----------------|
| Asset Management | Data, hardware, software inventory | Hardware inventory, software authorization |
| Business Environment | Organization's mission, objectives | Critical service delivery, dependencies |
| Governance | Policies, procedures, processes | Legal/regulatory requirements, risk management |
| Risk Assessment | Identifying cybersecurity risks | Threat intelligence, vulnerability identification |
| Risk Management Strategy | Risk tolerance, priorities | Risk assessment methodology |

**Protect Function Categories:**

| Category | Description | Key Activities |
|------------|-------------|----------------|
| Identity Management & Access Control | Manage access to assets | Identity proofing, least privilege |
| Awareness & Training | Security skills and awareness | Security training, phishing tests |
| Data Security | Protect data confidentiality | Data-at-rest, in-transit protection |
| Information Protection Processes | Maintain security processes | Configuration change control |
| Maintenance | Repair security components | Timely maintenance, remote maintenance |
| Protective Technology | Technical security solutions | Audit/log records, protective tools |

### 3.2 ISO/IEC 27001

ISO 27001 is the international standard for information security management systems (ISMS).

**ISO 27001 Structure:**
```
ISO/IEC 27001:2022 (Annex A Controls)

Organizational Controls (5.x)
├── Information security policies
├── Organization of information security
├── Human resource security
├── Asset management
├── Access control
├── Cryptography
├── Physical and environmental security
├── Operations security
├── Communications security
├── System acquisition, development and maintenance
├── Supplier relationships
├── Information security incident management
├── Information security continuity
└── Compliance

People Controls (6.x)
├── Screening
├── Terms and conditions
├── Awareness, education and training
├── Disciplinary process
├── Responsibilities after termination
├── Confidentiality agreements
└── Remote working

Physical Controls (7.x)
├── Physical security perimeters
├── Physical entry controls
├── Securing offices, rooms and facilities
├── Physical security monitoring
├── Protecting against physical and environmental threats
├── Working in secure areas
├── Clear desk and clear screen
├── Equipment siting and protection
├── Supporting utilities
├── Cabling security
├── Equipment maintenance
└── Secure disposal of equipment

Technological Controls (8.x)
├── User endpoint devices
├── Privileged access rights
├── Information access restriction
├── Access to source code
├── Secure authentication
├── Capacity management
├── Protection against malware
├── Management of technical vulnerabilities
├── Configuration management
├── Removal of assets
├── Data masking
├── Data leakage prevention
├── Information backup
├── Logging
├── Monitoring activities
├── Clock synchronization
└── Use of privileged utility programs
```

**ISO 27001 vs NIST CSF Comparison:**

| Aspect | ISO 27001 | NIST CSF |
|--------|-----------|----------|
| Type | Certifiable standard | Framework/guidance |
| Focus | ISMS establishment | Risk-based approach |
| Controls | 93 controls in 4 categories | Flexible, outcome-based |
| Certification | Third-party audit | Self-assessment or third-party |
| Updates | 2022 (latest version) | CSF 2.0 (2024) |
| Geographic | International | US-origin, globally adopted |

### 3.3 CIS Controls

Center for Internet Security (CIS) Controls provide prioritized security actions.

**CIS Controls v8 Implementation Groups:**

```
Implementation Group 1 (Basic Cyber Hygiene):
├── Inventory and Control of Enterprise Assets
├── Inventory and Control of Software Assets
├── Data Protection
├── Secure Configuration of Enterprise Assets
├── Account Management
├── Access Control Management
├── Continuous Vulnerability Management
├── Audit Log Management
└── Email and Web Browser Protections

Implementation Group 2 (Foundational):
├── (All IG1 controls)
├── Malware Defenses
├── Data Recovery
├── Network Infrastructure Management
├── Network Monitoring and Defense
├── Security Awareness and Skills Training
├── Service Provider Management
├── Application Software Security
└── Incident Response Management

Implementation Group 3 (Organizational):
├── (All IG1 and IG2 controls)
├── Penetration Testing
└── Red Team exercises
```

**CIS Controls vs NIST Mapping:**
```
NIST CSF Function  │ CIS Control Example
───────────────────┼────────────────────────────────
IDENTIFY           │ Asset Inventory (CIS 1, 2)
                   │ Software Inventory (CIS 2)
                   │ Vulnerability Management (CIS 7)
───────────────────┼────────────────────────────────
PROTECT            │ Secure Configuration (CIS 4)
                   │ Account Management (CIS 5, 6)
                   │ Data Protection (CIS 3)
                   │ Malware Defenses (CIS 10)
───────────────────┼────────────────────────────────
DETECT             │ Audit Log Management (CIS 8)
                   │ Network Monitoring (CIS 13)
───────────────────┼────────────────────────────────
RESPOND            │ Incident Response (CIS 17)
───────────────────┼────────────────────────────────
RECOVER            │ Data Recovery (CIS 11)
───────────────────┴────────────────────────────────
```

### 3.4 OWASP Top 10

The OWASP Top 10 represents the most critical web application security risks.

**OWASP Top 10 2021:**

| Rank | Risk | Description | Prevention |
|------|------|-------------|------------|
| A01:2021 | Broken Access Control | Improper access enforcement | Deny by default, rate limiting, JWT validation |
| A02:2021 | Cryptographic Failures | Weak or missing encryption | TLS 1.3, strong algorithms, no hardcoded keys |
| A03:2021 | Injection | SQL, NoSQL, OS injection | Parameterized queries, input validation |
| A04:2021 | Insecure Design | Missing security controls | Threat modeling, secure design patterns |
| A05:2021 | Security Misconfiguration | Default configs, verbose errors | Hardening, minimal features, security headers |
| A06:2021 | Vulnerable Components | Outdated libraries | Dependency scanning, SBOM |
| A07:2021 | Auth Failures | Weak password policies, session mgmt | MFA, secure session handling, strong passwords |
| A08:2021 | Integrity Failures | Untrusted dependencies | SRI, signed commits, verified packages |
| A09:2021 | Logging Failures | Insufficient monitoring | Comprehensive logging, real-time monitoring |
| A10:2021 | SSRF | Server-side request forgery | URL validation, deny-list, network segmentation |

**OWASP Proactive Controls:**
```
C1: Define Security Requirements
C2: Leverage Security Frameworks and Libraries
C3: Secure Database Access
C4: Encode and Escape Data
C5: Validate All Inputs
C6: Implement Digital Identity
C7: Enforce Access Controls
C8: Protect Data Everywhere
C9: Implement Security Logging and Monitoring
C10: Handle All Errors and Exceptions
```

---

## 4. Security Architecture Patterns

### 4.1 API Security Gateway Pattern

```
┌─────────────────────────────────────────────────────────┐
│                    Client Applications                     │
│  (Web, Mobile, IoT, Partners, Internal)                   │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                   API Security Gateway                     │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │ Rate        │  │ AuthN/      │  │   Request       │  │
│  │ Limiting    │  │ AuthZ       │  │   Validation    │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │ TLS/mTLS    │  │ Token       │  │   DLP           │  │
│  │ Termination │  │ Validation  │  │   Inspection    │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │ Logging &   │  │ Threat      │  │   Caching       │  │
│  │ Monitoring  │  │ Detection   │  │                 │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Public    │    │  Internal   │    │  Legacy     │
│   APIs      │    │  APIs       │    │  Systems    │
│  (Open)     │    │  (Scoped)   │    │  (Wrapped)  │
└─────────────┘    └─────────────┘    └─────────────┘
```

### 4.2 Secure Microservices Pattern

```
Service-to-Service Communication:

┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│  Service A  │──────│  Service    │──────│  Service C  │
│             │ mTLS │  Mesh/Istio │ mTLS │             │
└──────┬──────┘      └─────────────┘      └──────┬──────┘
       │                                          │
       │         ┌─────────────┐                  │
       └────────▶│  Mutual TLS │◀─────────────────┘
                  │  + Identity │
                  │  (SPIFFE)   │
                  └─────────────┘

Service Mesh Security:
┌─────────────────────────────────────────────────────────┐
│                    Control Plane                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │   CA/Istiod │  │   Policy    │  │   Telemetry       │  │
│  │   (mTLS)    │  │   Engine    │  │   Collection    │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────┐
│                    Data Plane                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │  Sidecar    │  │  Sidecar    │  │   Sidecar       │  │
│  │  Proxy      │  │  Proxy      │  │   Proxy         │  │
│  │  (Envoy)    │  │  (Envoy)    │  │   (Envoy)       │  │
│  └──────┬──────┘  └──────┬──────┘  └────────┬────────┘  │
│         │                │                  │          │
│  ┌──────▼──────┐  ┌──────▼──────┐  ┌───────▼────────┐  │
│  │  Service A  │  │  Service B  │  │   Service C    │  │
│  └─────────────┘  └─────────────┘  └────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 4.3 Secure CI/CD Pipeline

```
Secure DevOps Pipeline (DevSecOps):

┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐
│  Plan   │──▶│  Code   │──▶│  Build  │──▶│  Test   │──▶│ Release │
│         │   │         │   │         │   │         │   │         │
│ Threat  │   │ Secrets │   │ SCA/    │   │ SAST    │   │ Sign    │
│ Model   │   │ Scan    │   │ SAST    │   │ DAST    │   │ Verify  │
│         │   │ Linting │   │         │   │ Fuzz    │   │         │
└─────────┘   └─────────┘   └─────────┘   └─────────┘   └─────────┘
     │                                               │
     └───────────────────────────────────────────────┘
                          │
                          ▼
                   ┌─────────────┐
                   │  Deploy     │
                   │  Monitor    │
                   │  RASP       │
                   │  IAST       │
                   └─────────────┘

Security Gates:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Gate 1 (Code):    No secrets, Lint passing, Peer review
Gate 2 (Build):   No critical vulnerabilities (SCA)
Gate 3 (Test):    SAST/DAST passing, Security tests green
Gate 4 (Release): Signed artifacts, SBOM generated
Gate 5 (Deploy):  Policy compliance, Gradual rollout
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 5. References and Resources

### 5.1 Books and Publications

- "Threat Modeling: Designing for Security" - Adam Shostack
- "Zero Trust Networks: Building Secure Systems in Untrusted Networks" - Evan Gilman, Doug Barth
- "The Tangled Web: A Guide to Securing Modern Web Applications" - Michal Zalewski
- "Security Engineering" - Ross Anderson
- "Applied Cryptography" - Bruce Schneier

### 5.2 Standards and Guidelines

- NIST SP 800-53: Security and Privacy Controls
- NIST SP 800-171: Protecting Controlled Unclassified Information
- ISO/IEC 27002: Information Security Controls
- OWASP ASVS: Application Security Verification Standard
- OWASP Testing Guide
- CIS Benchmarks

### 5.3 Tools and Resources

| Category | Tools |
|----------|-------|
| Threat Modeling | Microsoft Threat Modeling Tool, OWASP Threat Dragon, pytm |
| SAST | SonarQube, Semgrep, Checkmarx, CodeQL |
| DAST | OWASP ZAP, Burp Suite, Veracode |
| SCA/Dependency | Snyk, OWASP Dependency-Check, GitHub Dependabot |
| Secrets Detection | GitLeaks, TruffleHog, GitGuardian |
| Container Security | Trivy, Clair, Anchore, Snyk Container |
| IaC Security | Checkov, tfsec, Terrascan |

### 5.4 Online Resources

- OWASP (owasp.org)
- NIST Cybersecurity Framework (nist.gov/cyberframework)
- CIS Controls (cisecurity.org/controls)
- Microsoft Security Development Lifecycle (microsoft.com/sdl)
- CISA (cisa.gov)

---

## 6. Conclusion

Security patterns and threat modeling provide the foundation for building secure systems. The patterns cataloged in this document—from Defense in Depth to Fail Secure—offer proven solutions to common security challenges. Threat modeling methodologies like STRIDE and Attack Trees enable systematic identification of threats before they can be exploited.

Key recommendations for Guardis implementation:

1. **Integrate Security Early**: Threat model during design, not after implementation
2. **Layer Defenses**: Implement Defense in Depth with diverse controls
3. **Verify Continuously**: Security is not a one-time activity but a continuous process
4. **Follow Standards**: Leverage NIST CSF, ISO 27001, and CIS Controls as baselines
5. **Automate Testing**: Integrate security testing into CI/CD pipelines
6. **Monitor Everything**: You cannot protect what you cannot see

The security landscape continues to evolve with new threats and attack vectors. Staying current with security patterns, regularly reviewing threat models, and maintaining awareness of emerging threats are essential for maintaining a strong security posture.

---

*Document generated for Guardis Project - Security Patterns & Threat Modeling*
*Research Date: April 2026*
