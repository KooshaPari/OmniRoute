# Guardis Charter

## Mission Statement

Guardis provides a comprehensive security platform that enables organizations to identify, monitor, and remediate security vulnerabilities across their entire software development lifecycle—from code commit to production deployment.

Our mission is to make enterprise-grade security accessible to teams of all sizes by providing automated, intelligent security scanning that integrates seamlessly with existing workflows and provides actionable remediation guidance.

---

## Tenets (unless you know better ones)

These tenets guide the security scanning, vulnerability detection, and remediation philosophy:

### 1. Shift Left by Default

Security scanning happens at commit time, not deploy time. Issues are caught in IDE, caught in CI, prevented from reaching production.

- **Rationale**: Earlier detection is cheaper
- **Implication**: Developer-first tooling
- **Trade-off**: Developer friction for prevention

### 2. Actionable Over Comprehensive**

10 actionable findings beat 100 theoretical issues. Each alert includes severity, impact, and fix guidance. No alert fatigue.

- **Rationale**: Unactionable findings are ignored
- **Implication**: Prioritization and context
- **Trade-off**: Scope for actionability

### 3. Context-Aware Scanning**

A vulnerability in a demo app differs from production. Context (environment, data sensitivity, exposure) modifies severity.

- **Rationale**: Not all code is equally critical
- **Implication**: Contextual risk scoring
- **Trade-off**: Complexity for accuracy

### 4. Continuous, Not Point-in-Time**

Security is continuous monitoring, not annual audits. New vulnerabilities trigger alerts. Drift detection is automatic.

- **Rationale**: Threats evolve continuously
- **Implication**: Continuous scanning infrastructure
- **Trade-off**: Compute for vigilance

### 5. Privacy-Preserving**

Source code analysis happens locally or in customer-controlled environments. No code leaves customer control without explicit consent.

- **Rationale**: Code is intellectual property
- **Implication**: Local-first architecture
- **Trade-off**: Architecture constraints for trust

### 6. Compliance as Code**

Compliance requirements (SOC2, PCI-DSS, etc.) are encoded as scan rules. Compliance is automated verification, not manual checkbox.

- **Rationale**: Compliance requires evidence
- **Implication**: Compliance rule packs
- **Trade-off**: Maintenance for assurance

---

## Scope & Boundaries

### In Scope

1. **Code Security**
   - SAST (Static Application Security Testing)
   - Secret detection (keys, tokens, passwords)
   - Dependency vulnerability scanning
   - License compliance

2. **Runtime Security**
   - Container image scanning
   - Infrastructure as Code scanning
   - Runtime application protection (RASP)
   - Behavioral anomaly detection

3. **Developer Tools**
   - IDE plugins
   - CLI for local scanning
   - Git hooks
   - PR annotations

4. **CI/CD Integration**
   - GitHub Actions
   - GitLab CI
   - Jenkins
   - Azure DevOps

5. **Reporting & Analytics**
   - Security dashboards
   - Trend analysis
   - Compliance reports
   - Executive summaries

### Out of Scope

1. **Penetration Testing**
   - Manual pen testing
   - Red team exercises
   - Automated pen test integration only

2. **Security Operations**
   - SIEM
   - Incident response
   - Threat hunting
   - Integration with SOAR

3. **Network Security**
   - Firewall management
   - Network scanning
   - Focus on application/code

4. **Identity Management**
   - IAM
   - SSO
   - PAM
   - Integration with IdP

5. **GRC Platform**
   - Governance
   - Risk management
   - Compliance workflow
   - Security scanning only

---

## Target Users

### Primary Users

1. **Security Engineers**
   - Implementing AppSec programs
   - Need comprehensive scanning
   - Require integration capabilities

2. **Developers**
   - Writing secure code
   - Need IDE feedback
   - Require actionable guidance

3. **DevOps/SRE**
   - Securing pipelines
   - Need CI integration
   - Require automated gates

### Secondary Users

1. **Compliance Officers**
   - Generating audit evidence
   - Need compliance reports
   - Require policy enforcement

2. **CISOs**
   - Understanding security posture
   - Need executive dashboards
   - Require risk metrics

### User Personas

#### Persona: Alex (Security Engineer)
- **Role**: Building AppSec program
- **Pain Points**: Tool sprawl, false positives
- **Goals**: Consolidated, accurate scanning
- **Success Criteria**: 80% of issues caught pre-commit

#### Persona: Sarah (Developer)
- **Role**: Writing Go microservices
- **Pain Points**: Security alerts too late
- **Goals**: Fix issues as I code
- **Success Criteria**: Zero security issues in PR

#### Persona: Jordan (DevOps Lead)
- **Role**: Securing deployment pipeline
- **Pain Points**: Manual security reviews
- **Goals**: Automated security gates
- **Success Criteria**: Security block on critical findings

---

## Success Criteria

### Detection Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| False Positive Rate | <10% | User feedback |
| True Positive Rate | >95% | Validation |
| Time to Detection | <1 min | CI timing |
| Coverage | >90% | Code analysis |

### Remediation Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Mean Time to Fix | <7 days | Tracking |
| Auto-Fix Rate | 30%+ | Automation |
| Developer Satisfaction | >4.0/5 | Survey |
| Remediation Guidance | 100% | Audit |

### Adoption Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Repositories Scanned | 10k+ | Count |
| Daily Scans | 100k+ | Metrics |
| Integrations | 10+ | Available |
| Enterprise Customers | 100+ | Contracts |

---

## Governance Model

### Project Structure

```
Security Lead
    ├── Research Team
    │       ├── Vulnerability Research
    │       ├── Rule Development
    │       └── Threat Intelligence
    ├── Engineering Team
    │       ├── Scanning Engines
    │       ├── Integrations
    │       └── Platform
    └── Customer Team
            ├── Success
            ├── Support
            └── Training
```

### Decision Authority

| Decision Type | Authority | Process |
|--------------|-----------|---------|
| Vulnerability Rules | Security Lead | Research |
| Engine Changes | Engineering Lead | Review |
| False Positive | Research Team | Validation |
| Roadmap | Security Lead | Input |

---

## Charter Compliance Checklist

### Detection Quality

| Check | Method | Requirement |
|-------|--------|-------------|
| Accuracy | Validation | <10% FP |
| Coverage | Analysis | >90% |
| Performance | Benchmark | <1 min |

### Engineering Quality

| Check | Method | Requirement |
|-------|--------|-------------|
| Tests | CI | >90% coverage |
| Security | Audit | Zero critical |
| Privacy | Review | Local-first |

---

## Amendment History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-04-05 | Security Lead | Initial charter creation |

---

*This charter is a living document. All changes must be approved by the Security Lead.*
