package validation

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"kwality/internal/database"
	"kwality/pkg/logger"
)

// Engine represents the validation engine
type Engine struct {
	logger    logger.Logger
	dbManager *database.Manager
	validators map[string]Validator
}

// Validator interface for all validation types
type Validator interface {
	Validate(ctx context.Context, testDefinition map[string]interface{}, expectedResult map[string]interface{}) (*ValidationResult, error)
}

// ValidationResult represents the result of a validation
type ValidationResult struct {
	Status      string                 `json:"status"`       // passed, failed, error
	Score       float64                `json:"score"`        // 0-100
	MaxScore    float64                `json:"max_score"`    // typically 100
	Details     map[string]interface{} `json:"details"`      // validation-specific details
	ExecutionTime time.Duration        `json:"execution_time"`
	Error       string                 `json:"error,omitempty"`
}

// TestExecution represents a test execution request
type TestExecution struct {
	ExecutionID    string                 `json:"execution_id"`
	TestID         string                 `json:"test_id"`
	TestDefinition map[string]interface{} `json:"test_definition"`
	ExpectedResult map[string]interface{} `json:"expected_result"`
	TargetType     string                 `json:"target_type"`
}

// NewEngine creates a new validation engine
func NewEngine(logger logger.Logger, dbManager *database.Manager) (*Engine, error) {
	engine := &Engine{
		logger:     logger,
		dbManager:  dbManager,
		validators: make(map[string]Validator),
	}

	// Register default validators
	engine.registerDefaultValidators()

	return engine, nil
}

// registerDefaultValidators registers the built-in validators
func (e *Engine) registerDefaultValidators() {
	e.validators["llm_model"] = NewLLMValidator(e.logger)
	e.validators["code_function"] = NewCodeValidator(e.logger)
	e.validators["api_endpoint"] = NewAPIValidator(e.logger)
	e.validators["data_pipeline"] = NewDataPipelineValidator(e.logger)
	e.validators["ui_component"] = NewUIValidator(e.logger)
}

// RegisterValidator registers a custom validator
func (e *Engine) RegisterValidator(targetType string, validator Validator) {
	e.validators[targetType] = validator
	e.logger.Info("Validator registered", "type", targetType)
}

// GetAvailableValidators returns list of available validator types
func (e *Engine) GetAvailableValidators() []string {
	types := make([]string, 0, len(e.validators))
	for t := range e.validators {
		types = append(types, t)
	}
	return types
}

// ExecuteValidation executes a single validation test
func (e *Engine) ExecuteValidation(ctx context.Context, execution *TestExecution) (*ValidationResult, error) {
	startTime := time.Now()
	
	e.logger.Info("Executing validation", 
		"execution_id", execution.ExecutionID,
		"test_id", execution.TestID,
		"target_type", execution.TargetType)

	// Update test status to running
	err := e.updateTestStatus(execution.ExecutionID, execution.TestID, "running", time.Now(), nil)
	if err != nil {
		e.logger.Error("Failed to update test status to running", "error", err)
	}

	// Get validator
	validator, exists := e.validators[execution.TargetType]
	if !exists {
		result := &ValidationResult{
			Status:        "error",
			Score:         0,
			MaxScore:      100,
			ExecutionTime: time.Since(startTime),
			Error:         fmt.Sprintf("No validator found for target type: %s", execution.TargetType),
		}
		
		// Update test result
		if err := e.updateTestResult(execution.ExecutionID, execution.TestID, result); err != nil {
			e.logger.Error("Failed to update test result", "error", err)
		}
		return result, fmt.Errorf("no validator found for target type: %s", execution.TargetType)
	}

	// Execute validation with timeout
	validationCtx, cancel := context.WithTimeout(ctx, 5*time.Minute)
	defer cancel()

	result, err := validator.Validate(validationCtx, execution.TestDefinition, execution.ExpectedResult)
	if err != nil {
		result = &ValidationResult{
			Status:        "error",
			Score:         0,
			MaxScore:      100,
			ExecutionTime: time.Since(startTime),
			Error:         err.Error(),
		}
	} else {
		result.ExecutionTime = time.Since(startTime)
	}

	// Update test result in database
	if err := e.updateTestResult(execution.ExecutionID, execution.TestID, result); err != nil {
		e.logger.Error("Failed to update test result", "error", err)
	}

	e.logger.Info("Validation completed",
		"execution_id", execution.ExecutionID,
		"test_id", execution.TestID,
		"status", result.Status,
		"score", result.Score,
		"duration", result.ExecutionTime)

	return result, nil
}

// ExecuteSuite executes all tests in a validation suite
func (e *Engine) ExecuteSuite(ctx context.Context, executionID, suiteID string) error {
	e.logger.Info("Executing validation suite", "execution_id", executionID, "suite_id", suiteID)

	// Get all tests for the suite
	tests, err := e.getTestsForSuite(suiteID)
	if err != nil {
		return fmt.Errorf("failed to get tests for suite: %w", err)
	}

	if len(tests) == 0 {
		return fmt.Errorf("no active tests found for suite %s", suiteID)
	}

	// Execute tests sequentially (could be parallelized)
	successCount := 0
	errorCount := 0

	for _, test := range tests {
		execution := &TestExecution{
			ExecutionID:    executionID,
			TestID:         test.ID,
			TestDefinition: test.TestDefinition,
			ExpectedResult: test.ExpectedResult,
			TargetType:     test.TargetType,
		}

		result, err := e.ExecuteValidation(ctx, execution)
		if err != nil {
			errorCount++
			e.logger.Error("Test execution failed", "test_id", test.ID, "error", err)
		} else if result.Status == "passed" {
			successCount++
		}
	}

	// Update execution status
	var finalStatus string
	if errorCount > 0 {
		finalStatus = "failed"
	} else {
		finalStatus = "completed"
	}

	err = e.updateExecutionStatus(executionID, finalStatus, time.Now())
	if err != nil {
		e.logger.Error("Failed to update execution status", "error", err)
	}

	e.logger.Info("Suite execution completed",
		"execution_id", executionID,
		"suite_id", suiteID,
		"total_tests", len(tests),
		"successful", successCount,
		"errors", errorCount,
		"status", finalStatus)

	return nil
}

// Test represents a test record
type Test struct {
	ID             string                 `json:"id"`
	Name           string                 `json:"name"`
	TestDefinition map[string]interface{} `json:"test_definition"`
	ExpectedResult map[string]interface{} `json:"expected_result"`
	TargetType     string                 `json:"target_type"`
}

// getTestsForSuite retrieves all active tests for a validation suite
func (e *Engine) getTestsForSuite(suiteID string) ([]Test, error) {
	query := `
		SELECT 
			t.id,
			t.name,
			t.test_definition,
			t.expected_result,
			vt.type as target_type
		FROM tests t
		JOIN validation_targets vt ON t.validation_target_id = vt.id
		WHERE t.validation_suite_id = $1 AND t.is_active = true
		ORDER BY t.priority DESC, t.created_at ASC
	`

	rows, err := e.dbManager.Query(query, suiteID)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err := rows.Close(); err != nil {
			e.logger.Warn("Failed to close rows", "error", err)
		}
	}()

	var tests []Test
	for rows.Next() {
		var test Test
		var testDefJSON, expectedResultJSON string

		err := rows.Scan(
			&test.ID,
			&test.Name,
			&testDefJSON,
			&expectedResultJSON,
			&test.TargetType,
		)
		if err != nil {
			return nil, err
		}

		// Parse JSON fields
		if err := json.Unmarshal([]byte(testDefJSON), &test.TestDefinition); err != nil {
			return nil, fmt.Errorf("failed to parse test definition: %w", err)
		}

		if err := json.Unmarshal([]byte(expectedResultJSON), &test.ExpectedResult); err != nil {
			return nil, fmt.Errorf("failed to parse expected result: %w", err)
		}

		tests = append(tests, test)
	}

	return tests, nil
}

// updateTestStatus updates the status of a test
func (e *Engine) updateTestStatus(executionID, testID, status string, startedAt time.Time, completedAt *time.Time) error {
	query := `
		UPDATE validation_results 
		SET status = $1, started_at = $2, completed_at = $3
		WHERE validation_execution_id = $4 AND test_id = $5
	`

	_, err := e.dbManager.Exec(query, status, startedAt, completedAt, executionID, testID)
	return err
}

// updateTestResult updates the complete test result
func (e *Engine) updateTestResult(executionID, testID string, result *ValidationResult) error {
	completedAt := time.Now()
	resultDataJSON, err := json.Marshal(result.Details)
	if err != nil {
		return fmt.Errorf("failed to marshal result data: %w", err)
	}

	query := `
		UPDATE validation_results 
		SET status = $1, score = $2, max_score = $3, completed_at = $4, 
		    execution_time_ms = $5, result_data = $6, error_message = $7
		WHERE validation_execution_id = $8 AND test_id = $9
	`

	_, err = e.dbManager.Exec(query,
		result.Status,
		result.Score,
		result.MaxScore,
		completedAt,
		result.ExecutionTime.Milliseconds(),
		string(resultDataJSON),
		result.Error,
		executionID,
		testID,
	)

	return err
}

// updateExecutionStatus updates the status of a validation execution
func (e *Engine) updateExecutionStatus(executionID, status string, completedAt time.Time) error {
	query := `
		UPDATE validation_executions 
		SET status = $1, completed_at = $2
		WHERE id = $3
	`

	_, err := e.dbManager.Exec(query, status, completedAt, executionID)
	return err
}