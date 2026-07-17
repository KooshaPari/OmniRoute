# AGENTS.md — Guardis

## Project Overview

- **Name**: Guardis (Security & Compliance Platform)
- **Description**: Security scanning, policy enforcement, and compliance monitoring platform
- **Location**: `/Users/kooshapari/CodeProjects/Phenotype/repos/Guardis`
- **Language Stack**: TypeScript, Node.js 20+, PostgreSQL
- **Published**: Private (Phenotype org)

## Quick Start

```bash
# Navigate to project
cd /Users/kooshapari/CodeProjects/Phenotype/repos/Guardis

# Install dependencies
npm install

# Set up environment
cp .env.example .env

# Run database migrations
npm run migrate

# Start development
npm run dev
```

## Architecture

### Security Platform Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Scanning Engine                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐   │
│  │   SAST          │  │   DAST          │  │   Secrets       │   │
│  │   (Code)        │  │   (Runtime)     │  │   Detection     │   │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘   │
└───────────┼───────────────────┼───────────────────┼──────────────┘
            │                   │                   │
            └───────────────────┼───────────────────┘
                                │
┌───────────────────────────────▼───────────────────────────────┐
│                     Policy Engine                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │              Open Policy Agent (OPA)                        │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │ │
│  │  │ Rego     │  │ Violation│  │ Remediate│  │ Enforce  │  │ │
│  │  │ Rules    │  │ Tracking │  │ Actions  │  │ Gates    │  │ │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   Compliance    │  │   Risk Score    │  │   Reporting     │ │
│  │   Frameworks    │  │   Calculator    │  │   Engine        │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
            │
┌───────────▼─────────────────────────────────────────────────────┐
│                     Integration Layer                            │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐│
│  │   CI/CD         │  │   SIEM          │  │   Ticketing     ││
│  │   (GitHub/      │  │   (Splunk/      │  │   (Jira/        ││
│  │   GitLab)       │  │   Datadog)      │  │   Linear)       ││
│  └─────────────────┘  └─────────────────┘  └─────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### Security Scanning Pipeline

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Source  │───▶│  Scan    │───▶│  Analyze │───▶│  Policy  │───▶│  Report  │
│  Code    │    │  Tools   │    │  Results │    │  Check   │    │  Output  │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
     │               │               │               │               │
     ▼               ▼               ▼               ▼               ▼
 Repository     Semgrep       Normalize      OPA Eval      Dashboard
 Container      Trivy         SARIF/JSON     Pass/Fail     Jira Ticket

```

## Quality Standards

### TypeScript Quality

- **Formatter**: Prettier
- **Linter**: ESLint with strict TypeScript
- **Tests**: Jest >80% coverage
- **Security**: `npm audit`, Snyk

### Policy Quality

- Rego policies tested
- Benchmark suite for performance
- Version controlled rules

## Git Workflow

### Branch Naming

Format: `<type>/<domain>/<description>`

Examples:
- `feat/scanner/add-trivy-integration`
- `fix/policy/correct-csp-check`
- `compliance/soc2/add-controls`

### Commit Messages

Format: `<type>(<scope>): <description>`

Examples:
- `feat(scanner): implement container scanning`
- `fix(opa): handle null input gracefully`
- `compliance(soc2): add access control evidence`

## File Structure

```
Guardis/
├── src/
│   ├── server.ts              # API server
│   ├── scanners/              # Scanning modules
│   ├── policies/              # OPA policies
│   ├── compliance/            # Compliance frameworks
│   └── reporting/             # Report generation
├── policies/                  # Rego policies
│   ├── security/
│   ├── compliance/
│   └── custom/
├── tests/
├── docs/
└── AGENTS.md                  # This file
```

## CLI Commands

```bash
# Development
npm run dev
npm run build
npm start

# Testing
npm test
npm run test:security

# Policies
opa test policies/
opa check policies/

# Scanning
npm run scan -- --target ./src
```

## Configuration

### Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection |
| `OPA_URL` | OPA server URL |
| `GITHUB_TOKEN` | GitHub API token |

## Troubleshooting

### Policy evaluation fails

```bash
# Test policy
opa test policies/security -v

# Debug evaluation
opa eval -i input.json -d policies/ 'data.security.violations'
```

## Resources

- [Open Policy Agent](https://www.openpolicyagent.org/)
- [SARIF Specification](https://sarifweb.azurewebsites.net/)
- [Phenotype Registry](https://github.com/KooshaPari/phenotype-registry)

## Agent Notes

**Critical Details:**
- All scan results must be auditable
- Policies are evaluated in sandbox
- Secrets must never be logged
- CI gates can block deployments

**Known Gotchas:**
- False positives require tuning
- Large repos need chunked scanning
- Policy changes affect all projects
- SARIF formats vary by tool
