# PRD — BytePort

## Overview

BytePort is an Infrastructure-as-Code (IaC) deployment and UX generation platform for software developer portfolios. Developers define their application and infrastructure in a single IaC manifest; BytePort deploys the project to AWS and generates interactive portfolio site templates to showcase and provide access to the deployed projects.

## Epics

### E1 — IaC Manifest Parsing

| Story | Description | Acceptance Criteria |
|-------|-------------|---------------------|
| E1.1 | Developer writes a single NVMS/BytePort manifest describing app structure and infra | Manifest parses without errors; schema is validated |
| E1.2 | Manifest supports multi-service applications | Each service definition maps to a distinct deployable unit |

### E2 — AWS Deployment

| Story | Description | Acceptance Criteria |
|-------|-------------|---------------------|
| E2.1 | BytePort reads manifest and provisions AWS resources | EC2/ECS/Lambda resources appear in AWS console after deploy |
| E2.2 | Deployment pulls source from GitHub repository | Correct branch/ref is deployed to target infrastructure |
| E2.3 | BytePort reports deployment status and endpoint URLs | CLI outputs live URLs on success |

### E3 — Portfolio UX Generation

| Story | Description | Acceptance Criteria |
|-------|-------------|---------------------|
| E3.1 | BytePort generates portfolio site components for deployed projects | Object templates are emitted for addition to portfolio sites |
| E3.2 | Generated components provide interaction access to deployed project | Live project endpoints are embedded in portfolio widget |
| E3.3 | AI-assisted template generation (ChatGPT/LLaMA) | LLM enhances generated template text and descriptions |

### E4 — CLI Interface

| Story | Description | Acceptance Criteria |
|-------|-------------|---------------------|
| E4.1 | Developer runs `byteport deploy` to trigger full pipeline | Single command completes deploy + portfolio generation |
| E4.2 | Developer runs `byteport status` to check deployments | Output shows per-service health and endpoint |

## Non-Goals

- Multi-cloud (Azure, GCP) in v1
- Custom domain management
- Billing/cost management UI
