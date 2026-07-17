# phenotype-forge User Journeys

> Visual workflows for Phenotype component

## Available Journeys

| Journey | Duration | Description |
|---------|----------|-------------|
| [Quick Start](./quick-start) | < 5 min | Get started with phenotype-forge |
| [Core Workflow](./core-workflow) | 10 min | Primary use case |
| [Advanced Setup](./advanced-setup) | 20 min | Production configuration |

## Architecture Overview

```mermaid
flowchart TB
    subgraph User["User"]
        U[Developer]
    end
    
    subgraph phenotype-forge["phenotype-forge"]
        API[API Layer]
        Core[Core Engine]
        Storage[Storage]
    end
    
    U -->|Requests| API
    API -->|Processes| Core
    Core -->|Persists| Storage
```

## Performance Targets

| Operation | P50 | P99 |
|-----------|-----|-----|
| Initialize | < 10ms | < 50ms |
| Process | < 100ms | < 500ms |
| Query | < 50ms | < 200ms |
