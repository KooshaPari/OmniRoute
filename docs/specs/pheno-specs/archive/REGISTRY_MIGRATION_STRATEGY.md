# Registry Migration Strategy

**Date**: 2025-01-27
**Phase**: 1.3 Migration Strategy
**Status**: In Progress

## Overview

This document outlines the strategy for migrating existing registry implementations to the unified registry system. The migration will be done incrementally to minimize disruption and ensure backward compatibility.

## Migration Phases

### Phase 1: Core Registry Enhancement ✅
- **Status**: Complete
- **Actions**:
  - Enhanced `pheno.core.registry` with advanced features
  - Created `pheno.core.unified_registry` for centralized management
  - Added migration utilities in `pheno.core.registry_migration`

### Phase 2: Provider Registry Migration ✅
- **Status**: Complete
- **Actions**:
  - Migrated to `pheno.providers.registry_unified`
  - Added compatibility layer
  - Maintained backward compatibility

### Phase 3: Adapter Registry Migration ⏳
- **Status**: In Progress
- **Actions**:
  - Migrate `pheno.adapters.registry` to use unified system
  - Add deprecation warnings
  - Create migration guide

### Phase 4: Infrastructure Registry Migration ⏳
- **Status**: Pending
- **Actions**:
  - Migrate infrastructure registries
  - Update resource management
  - Consolidate port registries

### Phase 5: MCP Registry Migration ⏳
- **Status**: Pending
- **Actions**:
  - Migrate MCP tool registries
  - Consolidate MCP resource registries
  - Update MCP adapters

### Phase 6: Cleanup ⏳
- **Status**: Pending
- **Actions**:
  - Remove legacy registry implementations
  - Update documentation
  - Add comprehensive tests

## Migration Approach

### 1. Backward Compatibility
- Maintain existing APIs during migration
- Add deprecation warnings
- Provide migration guides

### 2. Incremental Migration
- Migrate one registry type at a time
- Test each migration thoroughly
- Rollback capability for each phase

### 3. Zero Breaking Changes
- All existing code continues to work
- New code uses unified system
- Gradual transition period

## Migration Steps

### Step 1: Add Deprecation Warnings
```python
import warnings
from pheno.core.registry_migration import deprecated_registry

@deprecated_registry(
    old_name="pheno.adapters.registry.AdapterRegistry",
    new_name="pheno.core.registry.AdapterRegistry",
    migration_guide="https://docs.pheno-sdk.com/migration/registry",
    removal_version="3.0.0"
)
class OldAdapterRegistry:
    # ... existing implementation
```

### Step 2: Create Compatibility Layer
```python
from pheno.core.registry_migration import LegacyRegistryAdapter

# Create adapter for legacy registry
legacy_registry = OldAdapterRegistry()
adapter = LegacyRegistryAdapter(legacy_registry, "adapters")

# Use adapter as drop-in replacement
adapter.register("llm:openai", OpenAIAdapter)
```

### Step 3: Update Imports
```python
# Old imports
from pheno.adapters.registry import AdapterRegistry

# New imports
from pheno.core.registry import get_adapter_registry
```

### Step 4: Migrate Data
```python
from pheno.core.registry_migration import get_migration_manager

# Run migration
migration_manager = get_migration_manager()
migration_manager.run_migration("old_adapter_registry")
```

## Registry-Specific Migration Plans

### 1. Adapter Registry Migration

#### Current State
- **File**: `src/pheno/adapters/registry.py`
- **Features**: Adapter management, type-based registration
- **Usage**: Used by adapter system

#### Migration Plan
1. **Add deprecation warnings** to existing AdapterRegistry
2. **Create compatibility layer** that forwards to unified system
3. **Update imports** in consuming code
4. **Migrate data** from old to new registry
5. **Remove old implementation** after migration period

#### Code Changes
```python
# Before
from pheno.adapters.registry import AdapterRegistry
registry = AdapterRegistry()
registry.register_adapter(AdapterType.LLM, "openai", OpenAIAdapter)

# After
from pheno.core.registry import get_adapter_registry
registry = get_adapter_registry()
registry.register_adapter(AdapterType.LLM, "openai", OpenAIAdapter)
```

### 2. Infrastructure Registry Migration

#### Current State
- **Files**:
  - `src/pheno/infrastructure/resources/registry.py`
  - `src/pheno/infra/port_registry.py`
  - `src/pheno/infra/tunneling/registry.py`
- **Features**: Resource management, port allocation, tunnel management
- **Usage**: Used by infrastructure system

#### Migration Plan
1. **Consolidate** all infrastructure registries into unified system
2. **Create specialized registries** for each infrastructure type
3. **Update infrastructure managers** to use unified registries
4. **Migrate existing data** to new registries
5. **Remove old implementations**

#### Code Changes
```python
# Before
from pheno.infrastructure.resources.registry import ResourceRegistry
from pheno.infra.port_registry import PortRegistry
from pheno.infra.tunneling.registry import TunnelRegistry

# After
from pheno.core.registry import get_resource_registry, get_component_registry
resource_registry = get_resource_registry()
port_registry = get_component_registry()  # For port management
tunnel_registry = get_component_registry()  # For tunnel management
```

### 3. MCP Registry Migration

#### Current State
- **Files**:
  - `src/pheno/ports/mcp/tool_registry.py`
  - `src/pheno/mcp/adapters/tool_registry.py`
  - `src/pheno/mcp/resources/registry.py`
- **Features**: MCP tool management, resource management
- **Usage**: Used by MCP system

#### Migration Plan
1. **Consolidate** MCP registries into unified system
2. **Create MCP-specific registries** in unified system
3. **Update MCP adapters** to use unified registries
4. **Migrate MCP data** to new registries
5. **Remove old implementations**

## Testing Strategy

### 1. Unit Tests
- Test each registry migration individually
- Verify data integrity after migration
- Test backward compatibility

### 2. Integration Tests
- Test registry interactions
- Verify system functionality
- Test performance impact

### 3. Regression Tests
- Run full test suite after each migration
- Verify no breaking changes
- Test rollback scenarios

## Rollback Strategy

### 1. Code Rollback
- Keep old implementations during migration period
- Use feature flags to switch between old and new
- Maintain backward compatibility

### 2. Data Rollback
- Backup registry data before migration
- Provide rollback scripts
- Test rollback procedures

### 3. Configuration Rollback
- Maintain old configuration formats
- Provide configuration migration tools
- Support both old and new configurations

## Success Metrics

### 1. Code Reduction
- **Target**: 3,200+ LOC reduction
- **Current**: 0 LOC reduced
- **Progress**: 0%

### 2. Registry Consolidation
- **Target**: 39 registries → 6 unified registries
- **Current**: 39 registries
- **Progress**: 0%

### 3. Performance Impact
- **Target**: No performance degradation
- **Current**: Not measured
- **Progress**: 0%

### 4. Breaking Changes
- **Target**: Zero breaking changes
- **Current**: Zero breaking changes
- **Progress**: 100%

## Timeline

### Week 1: Adapter Registry Migration
- Add deprecation warnings
- Create compatibility layer
- Update imports
- Test migration

### Week 2: Infrastructure Registry Migration
- Consolidate infrastructure registries
- Update infrastructure managers
- Test integration
- Verify performance

### Week 3: MCP Registry Migration
- Consolidate MCP registries
- Update MCP adapters
- Test MCP functionality
- Verify compatibility

### Week 4: Cleanup and Documentation
- Remove legacy implementations
- Update documentation
- Add comprehensive tests
- Final verification

## Risk Mitigation

### 1. Breaking Changes
- **Risk**: Code breaks during migration
- **Mitigation**: Maintain backward compatibility, gradual migration

### 2. Data Loss
- **Risk**: Registry data lost during migration
- **Mitigation**: Backup data, test migration thoroughly

### 3. Performance Impact
- **Risk**: System performance degrades
- **Mitigation**: Performance testing, optimization

### 4. Integration Issues
- **Risk**: System integration breaks
- **Mitigation**: Comprehensive testing, rollback capability

## Conclusion

The registry migration strategy provides a comprehensive plan for consolidating all registry implementations into a unified system. The incremental approach ensures minimal disruption while achieving significant code reduction and improved maintainability.

The migration will be completed over 4 weeks with careful testing and rollback capabilities to ensure system stability throughout the process.
