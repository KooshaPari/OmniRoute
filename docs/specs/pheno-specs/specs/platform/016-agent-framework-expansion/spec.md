# Agent Framework Expansion

## Meta

- **ID**: 016-agent-framework-expansion
- **Title**: Complete Agent Framework Across 6 Repositories
- **Created**: 2026-04-01
- **State**: specified
- **Scope**: Cross-repo (6 repositories)

## Context

The Phenotype ecosystem is building a comprehensive agent framework to support autonomous AI agents, multi-agent orchestration, and agent-to-agent communication. Currently, agent infrastructure is scattered across 6 repositories with incomplete implementations, inconsistent protocols, and missing integration points.

Agentora provides agent orchestration foundations but lacks multi-agent coordination. AgentMCP implements the Model Context Protocol but doesn't integrate with the orchestration layer. agent-wave provides event-driven communication but operates independently. agent-devops-setups handles agent deployment and configuration but lacks integration with the core framework. agentops-policy-federation manages policy distribution but doesn't connect to agent orchestration. helMo provides agent mobility capabilities but lacks integration with the rest of the framework.

This spec completes the agent framework by implementing agent orchestration, MCP protocol integration, event-driven communication, policy distribution, and agent mobility with full integration across all components.

## Problem Statement

Agent framework is incomplete and fragmented:
- **Agent orchestration** — basic orchestration, missing multi-agent coordination
- **MCP protocol** — implemented but not integrated with orchestration
- **Event-driven communication** — standalone, no integration with agent lifecycle
- **Policy distribution** — isolated policy management, no agent integration
- **Agent mobility** — prototype, not integrated with orchestration
- **No unified agent lifecycle** — agents managed independently across components

## Goals

- Complete agent orchestration with multi-agent coordination
- Integrate MCP protocol with orchestration layer
- Implement event-driven communication integrated with agent lifecycle
- Complete policy distribution with agent integration
- Implement agent mobility with orchestration support
- Establish unified agent lifecycle management

## Non-Goals

- Creating new agent types beyond the existing framework
- Implementing agent UI/UX features
- Building agent marketplace or distribution system
- Adding agent training or fine-tuning capabilities

## Repositories Affected

| Repo | Language | Current State | Action |
|------|----------|---------------|--------|
| Agentora | Rust | Basic orchestration | Complete multi-agent coordination, integrate with MCP |
| AgentMCP | Rust | MCP protocol implementation | Integrate with orchestration layer |
| agent-wave | Rust | Event-driven communication | Integrate with agent lifecycle |
| agent-devops-setups | Rust/TOML | Agent deployment config | Integrate with core framework |
| agentops-policy-federation | Rust | Policy distribution | Integrate with agent orchestration |
| helMo | Rust | Agent mobility prototype | Complete mobility, integrate with orchestration |

## Technical Approach

### Phase 1: Architecture Design (Week 1-2)
1. Design unified agent framework architecture
2. Define interfaces between orchestration, MCP, communication, policy, mobility
3. Design agent lifecycle states and transitions
4. Plan integration points between all components

### Phase 2: Orchestration and MCP Integration (Week 2-4)
1. Complete Agentora multi-agent coordination
2. Integrate AgentMCP with orchestration layer
3. Implement agent task decomposition and assignment
4. Add agent coordination patterns (leader-follower, peer-to-peer)

### Phase 3: Communication and Policy Integration (Week 4-6)
1. Integrate agent-wave event-driven communication with agent lifecycle
2. Implement event routing and filtering
3. Integrate agentops-policy-federation with agent orchestration
4. Implement policy distribution and enforcement

### Phase 4: Mobility and DevOps Integration (Week 6-8)
1. Complete helMo agent mobility implementation
2. Integrate mobility with orchestration layer
3. Integrate agent-devops-setups with core framework
4. Implement agent deployment and configuration management

### Phase 5: Testing and Documentation (Week 8-10)
1. Comprehensive integration testing across all components
2. Multi-agent scenario testing
3. Performance testing for communication and mobility
4. Complete documentation for agent framework usage

## Success Criteria

- Complete agent orchestration with multi-agent coordination
- MCP protocol integrated with orchestration layer
- Event-driven communication integrated with agent lifecycle
- Policy distribution integrated with agent orchestration
- Agent mobility integrated with orchestration support
- Unified agent lifecycle management operational
- Comprehensive documentation and examples
- All quality checks passing (clippy, tests, fmt)

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Complex integration between components | High | Clear interfaces, integration tests, phased approach |
| Performance overhead from communication layer | Medium | Benchmark communication, optimize hot paths |
| Policy distribution security issues | High | Secure policy distribution, signature verification |
| Agent mobility stability issues | Medium | Thorough testing, rollback mechanisms |
| Scope creep from additional agent features | Medium | Strict scope enforcement, defer to future specs |

## Work Packages

| ID | Description | State |
|----|-------------|-------|
| WP001 | Architecture design | specified |
| WP002 | Orchestration and MCP integration | specified |
| WP003 | Communication and policy integration | specified |
| WP004 | Mobility and DevOps integration | specified |
| WP005 | Testing and documentation | specified |

## Traces

- Related: 007-thegent-completion
- Related: 015-plugin-system-completion
- Related: 001-spec-driven-development-engine
