package orchestrator

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
	"kwality/pkg/logger"
	"kwality/internal/models"
	"kwality/internal/types"
	"kwality/internal/engines"
)

// Orchestrator manages validation workflows
type Orchestrator struct {
	logger        logger.Logger
	config        Config
	taskQueue     chan *ValidationTask
	workers       []*Worker
	results       map[string]*ValidationResult
	resultsMu     sync.RWMutex
	running       bool
	runningMu     sync.RWMutex
	engines       map[string]engines.ValidationEngine
	wg            sync.WaitGroup
}

// Config holds orchestrator configuration
type Config struct {
	Logger        logger.Logger
	MaxWorkers    int
	QueueSize     int
	WorkerTimeout time.Duration
	ResultStorage string
}

// ValidationTask represents a validation job
type ValidationTask struct {
	ID          string                 `json:"id"`
	Type        ValidationTaskType     `json:"type"`
	Codebase    *models.Codebase       `json:"codebase"`
	Config      *types.ValidationConfig `json:"config"`
	CreatedAt   time.Time              `json:"created_at"`
	StartedAt   *time.Time             `json:"started_at,omitempty"`
	CompletedAt *time.Time             `json:"completed_at,omitempty"`
	Status      ValidationTaskStatus   `json:"status"`
	Priority    ValidationPriority     `json:"priority"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// ValidationTaskType defines the type of validation
type ValidationTaskType string

const (
	TaskTypeFullValidation      ValidationTaskType = "full_validation"
	TaskTypeStaticAnalysis      ValidationTaskType = "static_analysis"
	TaskTypeRuntimeValidation   ValidationTaskType = "runtime_validation"
	TaskTypeSecurityScanning    ValidationTaskType = "security_scanning"
	TaskTypeIntegrationTesting  ValidationTaskType = "integration_testing"
	TaskTypePerformanceAnalysis ValidationTaskType = "performance_analysis"
)

// ValidationTaskStatus defines the status of a validation task
type ValidationTaskStatus string

const (
	TaskStatusPending    ValidationTaskStatus = "pending"
	TaskStatusQueued     ValidationTaskStatus = "queued"
	TaskStatusRunning    ValidationTaskStatus = "running"
	TaskStatusCompleted  ValidationTaskStatus = "completed"
	TaskStatusFailed     ValidationTaskStatus = "failed"
	TaskStatusCancelled  ValidationTaskStatus = "cancelled"
	TaskStatusTimedOut   ValidationTaskStatus = "timed_out"
)

// ValidationPriority defines task priority
type ValidationPriority int

const (
	PriorityLow ValidationPriority = iota
	PriorityNormal
	PriorityHigh
	PriorityCritical
)


// ValidationResult holds the complete validation results
type ValidationResult struct {
	TaskID        string                        `json:"task_id"`
	Status        ValidationTaskStatus          `json:"status"`
	OverallScore  float64                       `json:"overall_score"`
	QualityGate   bool                          `json:"quality_gate"`
	StartedAt     time.Time                     `json:"started_at"`
	CompletedAt   *time.Time                    `json:"completed_at,omitempty"`
	Duration      time.Duration                 `json:"duration"`
	EngineResults map[string]*types.EngineResult `json:"engine_results"`
	Summary       *ValidationSummary            `json:"summary"`
	Errors        []ValidationError             `json:"errors,omitempty"`
	Metadata      map[string]interface{}        `json:"metadata,omitempty"`
}


// ValidationSummary provides high-level validation summary
type ValidationSummary struct {
	TotalFiles       int                    `json:"total_files"`
	LinesOfCode      int                    `json:"lines_of_code"`
	Languages        []string               `json:"languages"`
	QualityMetrics   QualityMetrics         `json:"quality_metrics"`
	SecurityMetrics  SecurityMetrics        `json:"security_metrics"`
	PerformanceMetrics PerformanceMetrics   `json:"performance_metrics"`
	Recommendations  []Recommendation       `json:"recommendations"`
}

// QualityMetrics holds code quality metrics
type QualityMetrics struct {
	Correctness     float64 `json:"correctness"`
	Maintainability float64 `json:"maintainability"`
	Complexity      float64 `json:"complexity"`
	Documentation   float64 `json:"documentation"`
	TestCoverage    float64 `json:"test_coverage"`
}

// SecurityMetrics holds security metrics
type SecurityMetrics struct {
	VulnerabilityCount int     `json:"vulnerability_count"`
	SecurityScore      float64 `json:"security_score"`
	CriticalIssues     int     `json:"critical_issues"`
	HighIssues         int     `json:"high_issues"`
	MediumIssues       int     `json:"medium_issues"`
	LowIssues          int     `json:"low_issues"`
}

// PerformanceMetrics holds performance metrics
type PerformanceMetrics struct {
	PerformanceScore   float64           `json:"performance_score"`
	BenchmarkResults   map[string]float64 `json:"benchmark_results"`
	MemoryUsage        int64             `json:"memory_usage"`
	CPUUsage           float64           `json:"cpu_usage"`
	ExecutionTime      time.Duration     `json:"execution_time"`
}

// Recommendation represents a validation recommendation
type Recommendation struct {
	ID          string `json:"id"`
	Type        string `json:"type"`
	Priority    string `json:"priority"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Action      string `json:"action"`
	File        string `json:"file,omitempty"`
}

// ValidationError represents an error during validation
type ValidationError struct {
	Code        string `json:"code"`
	Message     string `json:"message"`
	Details     string `json:"details,omitempty"`
	Engine      string `json:"engine,omitempty"`
	Recoverable bool   `json:"recoverable"`
}

// Worker represents a validation worker
type Worker struct {
	ID       int
	taskChan chan *ValidationTask
	quit     chan bool
	orch     *Orchestrator
}

// New creates a new orchestrator instance
func New(config Config) (*Orchestrator, error) {
	if config.MaxWorkers <= 0 {
		config.MaxWorkers = 5
	}
	if config.QueueSize <= 0 {
		config.QueueSize = 100
	}

	orch := &Orchestrator{
		logger:    config.Logger,
		config:    config,
		taskQueue: make(chan *ValidationTask, config.QueueSize),
		results:   make(map[string]*ValidationResult),
		engines:   make(map[string]engines.ValidationEngine),
	}

	// Initialize workers
	orch.workers = make([]*Worker, config.MaxWorkers)
	for i := 0; i < config.MaxWorkers; i++ {
		orch.workers[i] = &Worker{
			ID:       i,
			taskChan: orch.taskQueue,
			quit:     make(chan bool),
			orch:     orch,
		}
	}

	// Initialize validation engines
	if err := orch.initializeEngines(); err != nil {
		return nil, fmt.Errorf("failed to initialize validation engines: %w", err)
	}

	return orch, nil
}

// Start starts the orchestrator
func (o *Orchestrator) Start(ctx context.Context) error {
	o.runningMu.Lock()
	if o.running {
		o.runningMu.Unlock()
		return fmt.Errorf("orchestrator is already running")
	}
	o.running = true
	o.runningMu.Unlock()

	o.logger.Info("Starting orchestrator workers", "count", len(o.workers))

	// Start workers
	for _, worker := range o.workers {
		o.wg.Add(1)
		go worker.Start(ctx, &o.wg)
	}

	return nil
}

// Stop stops the orchestrator gracefully
func (o *Orchestrator) Stop(ctx context.Context) error {
	o.runningMu.Lock()
	if !o.running {
		o.runningMu.Unlock()
		return nil
	}
	o.running = false
	o.runningMu.Unlock()

	o.logger.Info("Stopping orchestrator workers")

	// Signal workers to quit
	for _, worker := range o.workers {
		worker.quit <- true
	}

	// Wait for workers to finish with timeout
	done := make(chan struct{})
	go func() {
		o.wg.Wait()
		close(done)
	}()

	select {
	case <-done:
		o.logger.Info("All workers stopped gracefully")
	case <-ctx.Done():
		o.logger.Warn("Workers did not stop within timeout")
		return ctx.Err()
	}

	return nil
}

// Shutdown is an alias for Stop for compatibility
func (o *Orchestrator) Shutdown(ctx context.Context) error {
	return o.Stop(ctx)
}

// SubmitValidation submits a new validation task
func (o *Orchestrator) SubmitValidation(codebase *models.Codebase, config *types.ValidationConfig) (*ValidationTask, error) {
	o.runningMu.RLock()
	if !o.running {
		o.runningMu.RUnlock()
		return nil, fmt.Errorf("orchestrator is not running")
	}
	o.runningMu.RUnlock()

	task := &ValidationTask{
		ID:        uuid.New().String(),
		Type:      TaskTypeFullValidation,
		Codebase:  codebase,
		Config:    config,
		CreatedAt: time.Now(),
		Status:    TaskStatusPending,
		Priority:  PriorityNormal,
		Metadata:  make(map[string]interface{}),
	}

	// Add task to queue
	select {
	case o.taskQueue <- task:
		task.Status = TaskStatusQueued
		o.logger.Info("Validation task queued", "task_id", task.ID, "type", task.Type)
		return task, nil
	default:
		return nil, fmt.Errorf("task queue is full")
	}
}

// GetValidationResult retrieves validation results
func (o *Orchestrator) GetValidationResult(taskID string) (*ValidationResult, error) {
	o.resultsMu.RLock()
	defer o.resultsMu.RUnlock()

	result, exists := o.results[taskID]
	if !exists {
		return nil, fmt.Errorf("validation result not found for task ID: %s", taskID)
	}

	return result, nil
}

// ListTasks returns a list of tasks with optional filtering
func (o *Orchestrator) ListTasks(status ValidationTaskStatus, limit int) ([]*ValidationTask, error) {
	// This is a simplified implementation
	// In production, you'd want to store tasks in a database
	var tasks []*ValidationTask
	
	o.resultsMu.RLock()
	defer o.resultsMu.RUnlock()
	
	count := 0
	for _, result := range o.results {
		if status == "" || result.Status == status {
			// Convert result back to task (simplified)
			task := &ValidationTask{
				ID:     result.TaskID,
				Status: result.Status,
			}
			tasks = append(tasks, task)
			count++
			if limit > 0 && count >= limit {
				break
			}
		}
	}
	
	return tasks, nil
}

// GetHealthStatus returns the orchestrator health status
func (o *Orchestrator) GetHealthStatus() map[string]interface{} {
	o.runningMu.RLock()
	running := o.running
	o.runningMu.RUnlock()

	status := map[string]interface{}{
		"status":          "healthy",
		"running":         running,
		"worker_count":    len(o.workers),
		"queue_size":      len(o.taskQueue),
		"queue_capacity":  cap(o.taskQueue),
		"total_results":   len(o.results),
		"engines":         len(o.engines),
	}

	if !running {
		status["status"] = "stopped"
	} else if float64(len(o.taskQueue)) > float64(cap(o.taskQueue))*0.8 {
		status["status"] = "degraded"
	}

	return status
}

// initializeEngines initializes validation engines
func (o *Orchestrator) initializeEngines() error {
	// Initialize static analysis engine
	staticEngine, err := engines.NewStaticAnalysisEngine(engines.StaticAnalysisConfig{
		Logger: o.logger,
	})
	if err != nil {
		return fmt.Errorf("failed to initialize static analysis engine: %w", err)
	}
	o.engines["static"] = staticEngine

	// Initialize other engines as needed
	// Runtime engine, security engine, etc.

	o.logger.Info("Validation engines initialized", "count", len(o.engines))
	return nil
}

// Start starts a worker
func (w *Worker) Start(ctx context.Context, wg *sync.WaitGroup) {
	defer wg.Done()
	
	w.orch.logger.Info("Worker started", "worker_id", w.ID)
	
	for {
		select {
		case task := <-w.taskChan:
			w.processTask(ctx, task)
		case <-w.quit:
			w.orch.logger.Info("Worker stopping", "worker_id", w.ID)
			return
		case <-ctx.Done():
			w.orch.logger.Info("Worker context cancelled", "worker_id", w.ID)
			return
		}
	}
}

// processTask processes a validation task
func (w *Worker) processTask(ctx context.Context, task *ValidationTask) {
	w.orch.logger.Info("Processing validation task", 
		"worker_id", w.ID, 
		"task_id", task.ID, 
		"type", task.Type)

	startTime := time.Now()
	task.StartedAt = &startTime
	task.Status = TaskStatusRunning

	result := &ValidationResult{
		TaskID:        task.ID,
		Status:        TaskStatusRunning,
		StartedAt:     startTime,
		EngineResults: make(map[string]*types.EngineResult),
		Metadata:      make(map[string]interface{}),
	}

	// Store interim result
	w.orch.resultsMu.Lock()
	w.orch.results[task.ID] = result
	w.orch.resultsMu.Unlock()

	// Execute validation engines
	err := w.executeValidation(ctx, task, result)
	
	completedTime := time.Now()
	task.CompletedAt = &completedTime
	result.CompletedAt = &completedTime
	result.Duration = completedTime.Sub(startTime)

	if err != nil {
		w.orch.logger.Error("Validation task failed", 
			"worker_id", w.ID, 
			"task_id", task.ID, 
			"error", err)
		
		task.Status = TaskStatusFailed
		result.Status = TaskStatusFailed
		result.Errors = append(result.Errors, ValidationError{
			Code:        "EXECUTION_ERROR",
			Message:     err.Error(),
			Recoverable: false,
		})
	} else {
		task.Status = TaskStatusCompleted
		result.Status = TaskStatusCompleted
		
		// Calculate overall score and quality gate
		w.calculateOverallScore(result)
	}

	// Update final result
	w.orch.resultsMu.Lock()
	w.orch.results[task.ID] = result
	w.orch.resultsMu.Unlock()

	w.orch.logger.Info("Validation task completed", 
		"worker_id", w.ID, 
		"task_id", task.ID, 
		"status", task.Status,
		"duration", result.Duration,
		"overall_score", result.OverallScore)
}

// executeValidation executes the validation using appropriate engines
func (w *Worker) executeValidation(ctx context.Context, task *ValidationTask, result *ValidationResult) error {
	enabledEngines := task.Config.EnabledEngines
	if len(enabledEngines) == 0 {
		enabledEngines = []string{"static"} // Default to static analysis
	}

	var wg sync.WaitGroup
	errorChan := make(chan error, len(enabledEngines))

	for _, engineName := range enabledEngines {
		engine, exists := w.orch.engines[engineName]
		if !exists {
			w.orch.logger.Warn("Validation engine not found", "engine", engineName)
			continue
		}

		wg.Add(1)
		go func(name string, eng engines.ValidationEngine) {
			defer wg.Done()
			
			engineResult, err := eng.Validate(ctx, task.Codebase, task.Config)
			if err != nil {
				errorChan <- fmt.Errorf("engine %s failed: %w", name, err)
				return
			}

			// Store engine result
			w.orch.resultsMu.Lock()
			result.EngineResults[name] = engineResult
			w.orch.resultsMu.Unlock()
		}(engineName, engine)
	}

	wg.Wait()
	close(errorChan)

	// Check for errors
	for err := range errorChan {
		if err != nil {
			return err
		}
	}

	return nil
}

// calculateOverallScore calculates the overall validation score
func (w *Worker) calculateOverallScore(result *ValidationResult) {
	if len(result.EngineResults) == 0 {
		result.OverallScore = 0
		result.QualityGate = false
		return
	}

	// Weight factors for different engine types
	weights := map[string]float64{
		"static":      0.25,
		"runtime":     0.20,
		"security":    0.25,
		"integration": 0.15,
		"performance": 0.15,
	}

	totalScore := 0.0
	totalWeight := 0.0

	for engineName, engineResult := range result.EngineResults {
		weight := weights[engineName]
		if weight == 0 {
			weight = 0.1 // Default weight for unknown engines
		}
		
		totalScore += engineResult.Score * weight
		totalWeight += weight
	}

	if totalWeight > 0 {
		result.OverallScore = totalScore / totalWeight
	}

	// Quality gate: Overall score >= 80 AND Security score >= 90
	result.QualityGate = result.OverallScore >= 80.0
	if securityResult, exists := result.EngineResults["security"]; exists {
		result.QualityGate = result.QualityGate && securityResult.Score >= 90.0
	}

	// Generate summary
	result.Summary = w.generateSummary(result)
}

// generateSummary generates a validation summary
func (w *Worker) generateSummary(result *ValidationResult) *ValidationSummary {
	summary := &ValidationSummary{
		QualityMetrics:     QualityMetrics{},
		SecurityMetrics:    SecurityMetrics{},
		PerformanceMetrics: PerformanceMetrics{},
		Recommendations:    []Recommendation{},
	}

	// Aggregate metrics from engine results
	for engineName, engineResult := range result.EngineResults {
		switch engineName {
		case "static":
			summary.QualityMetrics.Correctness = engineResult.Score
			if metrics, ok := engineResult.Metrics["maintainability"].(float64); ok {
				summary.QualityMetrics.Maintainability = metrics
			}
		case "security":
			summary.SecurityMetrics.SecurityScore = engineResult.Score
			for _, finding := range engineResult.Findings {
				switch finding.Severity {
				case "critical":
					summary.SecurityMetrics.CriticalIssues++
				case "high":
					summary.SecurityMetrics.HighIssues++
				case "medium":
					summary.SecurityMetrics.MediumIssues++
				case "low":
					summary.SecurityMetrics.LowIssues++
				}
			}
			summary.SecurityMetrics.VulnerabilityCount = len(engineResult.Findings)
		case "performance":
			summary.PerformanceMetrics.PerformanceScore = engineResult.Score
			if benchmarks, ok := engineResult.Metrics["benchmarks"].(map[string]float64); ok {
				summary.PerformanceMetrics.BenchmarkResults = benchmarks
			}
		}
	}

	return summary
}