---
layout: doc
title: Traceability Matrix
---

# Schemaforge Traceability Matrix

> Feature-to-Test-to-Code mapping

<TraceabilityMatrix
    :features="[{ id: 'REQ-001', name: 'Core API', tests: ['test_api'], code: ['src/api.rs'], coverage: 95 },
                { id: 'REQ-002', name: 'Config', tests: ['test_config'], code: ['src/config.rs'], coverage: 90 },
                { id: 'REQ-003', name: 'Error Handling', tests: ['test_error'], code: ['src/error.rs'], coverage: 88 }]"
/>

## Functional Requirements

| ID | Requirement | Status | Coverage |
|----|-------------|--------|----------|
| REQ-001 | Core API | ✅ Implemented | 95% |
| REQ-002 | Configuration | ✅ Implemented | 90% |
| REQ-003 | Error Handling | ✅ Implemented | 88% |
| REQ-004 | Async Support | 🚧 In Progress | 70% |
| REQ-005 | Metrics | 📋 Planned | 0% |

<TestCoverageBadge :overall="92" :unit="95" :integration="89" :e2e="85" />
