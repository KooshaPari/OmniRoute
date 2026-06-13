package engines

import (
	"context"
	"fmt"
	"kwality/internal/models"
	"kwality/internal/types"
)

// ValidationEngine defines the interface for validation engines
type ValidationEngine interface {
	// Validate performs validation on the given codebase
	Validate(ctx context.Context, codebase *models.Codebase, config *types.ValidationConfig) (*types.EngineResult, error)
	
	// Name returns the engine name
	Name() string
	
	// Version returns the engine version
	Version() string
	
	// SupportedLanguages returns the languages supported by this engine
	SupportedLanguages() []string
	
	// HealthCheck verifies the engine is healthy and ready
	HealthCheck(ctx context.Context) error
}

// EngineType represents different types of validation engines
type EngineType string

const (
	EngineTypeStatic      EngineType = "static"
	EngineTypeRuntime     EngineType = "runtime"
	EngineTypeSecurity    EngineType = "security"
	EngineTypeIntegration EngineType = "integration"
	EngineTypePerformance EngineType = "performance"
	EngineTypeCustom      EngineType = "custom"
)

// EngineMetadata holds metadata about an engine
type EngineMetadata struct {
	Name              string            `json:"name"`
	Version           string            `json:"version"`
	Type              EngineType        `json:"type"`
	Description       string            `json:"description"`
	SupportedLanguages []string         `json:"supported_languages"`
	RequiredTools     []string          `json:"required_tools"`
	OptionalTools     []string          `json:"optional_tools"`
	ConfigSchema      interface{}       `json:"config_schema,omitempty"`
	Author            string            `json:"author"`
	License           string            `json:"license"`
	Documentation     string            `json:"documentation,omitempty"`
	Capabilities      []string          `json:"capabilities"`
	Performance       PerformanceInfo   `json:"performance"`
}

// PerformanceInfo holds performance characteristics of an engine
type PerformanceInfo struct {
	AverageExecutionTime string  `json:"average_execution_time"`
	MemoryUsage         string  `json:"memory_usage"`
	CPUIntensive        bool    `json:"cpu_intensive"`
	DiskIntensive       bool    `json:"disk_intensive"`
	NetworkRequired     bool    `json:"network_required"`
	Parallelizable      bool    `json:"parallelizable"`
	ScalingFactor       float64 `json:"scaling_factor"`
}

// EngineFactory creates validation engines
type EngineFactory interface {
	// CreateEngine creates a new engine instance
	CreateEngine(engineType EngineType, config interface{}) (ValidationEngine, error)
	
	// ListAvailableEngines returns all available engine types
	ListAvailableEngines() []EngineMetadata
	
	// GetEngineMetadata returns metadata for a specific engine
	GetEngineMetadata(engineType EngineType) (*EngineMetadata, error)
}

// EngineRegistry manages available engines
type EngineRegistry struct {
	engines  map[EngineType]func(config interface{}) (ValidationEngine, error)
	metadata map[EngineType]EngineMetadata
}

// NewEngineRegistry creates a new engine registry
func NewEngineRegistry() *EngineRegistry {
	return &EngineRegistry{
		engines:  make(map[EngineType]func(config interface{}) (ValidationEngine, error)),
		metadata: make(map[EngineType]EngineMetadata),
	}
}

// RegisterEngine registers a new engine type
func (r *EngineRegistry) RegisterEngine(
	engineType EngineType,
	factory func(config interface{}) (ValidationEngine, error),
	metadata EngineMetadata,
) {
	r.engines[engineType] = factory
	r.metadata[engineType] = metadata
}

// CreateEngine creates an engine instance
func (r *EngineRegistry) CreateEngine(engineType EngineType, config interface{}) (ValidationEngine, error) {
	factory, exists := r.engines[engineType]
	if !exists {
		return nil, fmt.Errorf("engine type %s not registered", engineType)
	}
	
	return factory(config)
}

// ListAvailableEngines returns all available engines
func (r *EngineRegistry) ListAvailableEngines() []EngineMetadata {
	engines := make([]EngineMetadata, 0, len(r.metadata))
	for _, metadata := range r.metadata {
		engines = append(engines, metadata)
	}
	return engines
}

// GetEngineMetadata returns metadata for a specific engine
func (r *EngineRegistry) GetEngineMetadata(engineType EngineType) (*EngineMetadata, error) {
	metadata, exists := r.metadata[engineType]
	if !exists {
		return nil, fmt.Errorf("engine type %s not found", engineType)
	}
	
	return &metadata, nil
}