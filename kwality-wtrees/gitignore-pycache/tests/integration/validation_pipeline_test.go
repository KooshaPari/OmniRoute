package integration

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"

	"kwality/internal/config"
	"kwality/internal/models"
	"kwality/internal/orchestrator"
	"kwality/internal/server"
	"kwality/pkg/logger"
)

// ValidationPipelineTestSuite contains integration tests for the complete validation pipeline
type ValidationPipelineTestSuite struct {
	suite.Suite
	server     *httptest.Server
	client     *http.Client
	config     *config.Config
	logger     logger.Logger
	orchestrator *orchestrator.Orchestrator
}

// SetupSuite runs before all tests in the suite
func (suite *ValidationPipelineTestSuite) SetupSuite() {
	// Set up test environment
	require.NoError(suite.T(), os.Setenv("KWALITY_ENV", "test"))
	require.NoError(suite.T(), os.Setenv("DB_HOST", "localhost"))
	require.NoError(suite.T(), os.Setenv("DB_PORT", "5432"))
	require.NoError(suite.T(), os.Setenv("DB_DATABASE", "kwality_test"))
	require.NoError(suite.T(), os.Setenv("REDIS_HOST", "localhost"))
	require.NoError(suite.T(), os.Setenv("REDIS_PORT", "6379"))

	// Load test configuration
	cfg, err := config.Load()
	require.NoError(suite.T(), err)
	suite.config = cfg

	// Initialize logger
	suite.logger = logger.New(logger.Config{
		Level:  logger.DebugLevel,
		Format: logger.JSONFormat,
	})

	// Initialize orchestrator
	suite.orchestrator, err = orchestrator.New(orchestrator.Config{
		MaxWorkers:    2,
		QueueSize:     10,
		WorkerTimeout: 30 * time.Second,
		Logger:        suite.logger,
	})
	require.NoError(suite.T(), err)

	// Create test server
	handler := server.NewHandler(server.Config{
		Orchestrator: suite.orchestrator,
		Logger:       suite.logger,
	})
	suite.server = httptest.NewServer(handler)

	// Create HTTP client
	suite.client = &http.Client{
		Timeout: 60 * time.Second,
	}
}

// TearDownSuite runs after all tests in the suite
func (suite *ValidationPipelineTestSuite) TearDownSuite() {
	if suite.server != nil {
		suite.server.Close()
	}
	if suite.orchestrator != nil {
		if err := suite.orchestrator.Shutdown(context.Background()); err != nil {
			suite.T().Logf("Failed to shutdown orchestrator: %v", err)
		}
	}
}

// TestHealthEndpoint tests the health check endpoint
func (suite *ValidationPipelineTestSuite) TestHealthEndpoint() {
	resp, err := suite.client.Get(fmt.Sprintf("%s/health", suite.server.URL))
	require.NoError(suite.T(), err)
	defer resp.Body.Close()

	assert.Equal(suite.T(), http.StatusOK, resp.StatusCode)

	var health map[string]interface{}
	err = json.NewDecoder(resp.Body).Decode(&health)
	require.NoError(suite.T(), err)

	assert.Equal(suite.T(), "healthy", health["status"])
	assert.NotEmpty(suite.T(), health["version"])
	assert.NotNil(suite.T(), health["timestamp"])
}

// TestValidateCodebaseEndpoint tests the codebase validation endpoint
func (suite *ValidationPipelineTestSuite) TestValidateCodebaseEndpoint() {
	// Create test codebase
	codebase := models.ValidationRequest{
		Name: "test-go-service",
		Source: models.CodebaseSource{
			Type: models.SourceTypeInline,
			Files: []models.SourceFile{
				{
					Path:    "main.go",
					Content: suite.getTestGoCode(),
				},
				{
					Path:    "go.mod",
					Content: suite.getTestGoMod(),
				},
			},
		},
		Config: models.ValidationConfig{
			EnabledEngines: []string{"static", "runtime", "security"},
			Timeout:        "5m",
			Parallel:       true,
		},
	}

	// Marshal request
	requestBody, err := json.Marshal(codebase)
	require.NoError(suite.T(), err)

	// Send validation request
	resp, err := suite.client.Post(
		fmt.Sprintf("%s/api/v1/validate/codebase", suite.server.URL),
		"application/json",
		bytes.NewBuffer(requestBody),
	)
	require.NoError(suite.T(), err)
	defer resp.Body.Close()

	assert.Equal(suite.T(), http.StatusAccepted, resp.StatusCode)

	// Parse response to get task ID
	var response models.ValidationResponse
	err = json.NewDecoder(resp.Body).Decode(&response)
	require.NoError(suite.T(), err)

	assert.NotEmpty(suite.T(), response.TaskID)
	assert.Equal(suite.T(), "pending", response.Status)
	assert.NotNil(suite.T(), response.SubmittedAt)

	// Poll for completion
	taskID := response.TaskID
	suite.waitForValidationCompletion(taskID)

	// Get final results
	finalResult := suite.getValidationResult(taskID)
	assert.NotNil(suite.T(), finalResult)
	assert.Contains(suite.T(), []string{"completed", "failed"}, finalResult.Status)
	
	if finalResult.Status == "completed" {
		assert.True(suite.T(), finalResult.OverallScore >= 0)
		assert.True(suite.T(), finalResult.OverallScore <= 100)
		assert.NotEmpty(suite.T(), finalResult.EngineResults)
	}
}

// TestValidateWithInvalidCode tests validation with code that should fail
func (suite *ValidationPipelineTestSuite) TestValidateWithInvalidCode() {
	// Create test codebase with invalid code
	codebase := models.ValidationRequest{
		Name: "test-invalid-code",
		Source: models.CodebaseSource{
			Type: models.SourceTypeInline,
			Files: []models.SourceFile{
				{
					Path:    "main.go",
					Content: suite.getInvalidGoCode(),
				},
			},
		},
		Config: models.ValidationConfig{
			EnabledEngines: []string{"static", "runtime"},
			Timeout:        "2m",
		},
	}

	taskID := suite.submitValidationRequest(codebase)
	suite.waitForValidationCompletion(taskID)

	result := suite.getValidationResult(taskID)
	assert.NotNil(suite.T(), result)
	
	// Should complete but with low score due to errors
	assert.Equal(suite.T(), "completed", result.Status)
	assert.True(suite.T(), result.OverallScore < 50) // Low score due to errors
	assert.True(suite.T(), len(result.Findings) > 0) // Should have findings
}

// TestValidateMultiLanguageCodebase tests validation of multi-language codebase
func (suite *ValidationPipelineTestSuite) TestValidateMultiLanguageCodebase() {
	codebase := models.ValidationRequest{
		Name: "test-multi-language",
		Source: models.CodebaseSource{
			Type: models.SourceTypeInline,
			Files: []models.SourceFile{
				{
					Path:    "main.go",
					Content: suite.getTestGoCode(),
				},
				{
					Path:    "script.py",
					Content: suite.getTestPythonCode(),
				},
				{
					Path:    "app.js",
					Content: suite.getTestJavaScriptCode(),
				},
				{
					Path:    "package.json",
					Content: suite.getTestPackageJson(),
				},
			},
		},
		Config: models.ValidationConfig{
			EnabledEngines: []string{"static", "security"},
			Timeout:        "3m",
		},
	}

	taskID := suite.submitValidationRequest(codebase)
	suite.waitForValidationCompletion(taskID)

	result := suite.getValidationResult(taskID)
	assert.NotNil(suite.T(), result)
	assert.Equal(suite.T(), "completed", result.Status)
	
	// Should detect multiple languages
	staticResult, exists := result.EngineResults["static_analysis"]
	assert.True(suite.T(), exists)
	assert.NotNil(suite.T(), staticResult)
}

// TestValidationTimeout tests validation timeout handling
func (suite *ValidationPipelineTestSuite) TestValidationTimeout() {
	codebase := models.ValidationRequest{
		Name: "test-timeout",
		Source: models.CodebaseSource{
			Type: models.SourceTypeInline,
			Files: []models.SourceFile{
				{
					Path:    "infinite.go",
					Content: suite.getInfiniteLoopCode(),
				},
			},
		},
		Config: models.ValidationConfig{
			EnabledEngines: []string{"runtime"},
			Timeout:        "10s", // Very short timeout
		},
	}

	taskID := suite.submitValidationRequest(codebase)
	suite.waitForValidationCompletion(taskID)

	result := suite.getValidationResult(taskID)
	assert.NotNil(suite.T(), result)
	assert.Contains(suite.T(), []string{"timeout", "failed"}, result.Status)
}

// TestConcurrentValidations tests multiple concurrent validations
func (suite *ValidationPipelineTestSuite) TestConcurrentValidations() {
	numConcurrent := 3
	taskIDs := make([]string, numConcurrent)

	// Submit multiple validations concurrently
	for i := 0; i < numConcurrent; i++ {
		codebase := models.ValidationRequest{
			Name: fmt.Sprintf("test-concurrent-%d", i),
			Source: models.CodebaseSource{
				Type: models.SourceTypeInline,
				Files: []models.SourceFile{
					{
						Path:    "main.go",
						Content: suite.getTestGoCode(),
					},
				},
			},
			Config: models.ValidationConfig{
				EnabledEngines: []string{"static"},
				Timeout:        "2m",
			},
		}

		taskIDs[i] = suite.submitValidationRequest(codebase)
	}

	// Wait for all to complete
	for _, taskID := range taskIDs {
		suite.waitForValidationCompletion(taskID)
		result := suite.getValidationResult(taskID)
		assert.NotNil(suite.T(), result)
		assert.Equal(suite.T(), "completed", result.Status)
	}
}

// Helper methods

func (suite *ValidationPipelineTestSuite) submitValidationRequest(codebase models.ValidationRequest) string {
	requestBody, err := json.Marshal(codebase)
	require.NoError(suite.T(), err)

	resp, err := suite.client.Post(
		fmt.Sprintf("%s/api/v1/validate/codebase", suite.server.URL),
		"application/json",
		bytes.NewBuffer(requestBody),
	)
	require.NoError(suite.T(), err)
	defer resp.Body.Close()

	assert.Equal(suite.T(), http.StatusAccepted, resp.StatusCode)

	var response models.ValidationResponse
	err = json.NewDecoder(resp.Body).Decode(&response)
	require.NoError(suite.T(), err)

	return response.TaskID
}

func (suite *ValidationPipelineTestSuite) waitForValidationCompletion(taskID string) {
	timeout := time.After(5 * time.Minute)
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-timeout:
			suite.T().Fatalf("Validation did not complete within timeout: %s", taskID)
		case <-ticker.C:
			result := suite.getValidationResult(taskID)
			if result != nil && result.Status != "pending" && result.Status != "running" {
				return
			}
		}
	}
}

func (suite *ValidationPipelineTestSuite) getValidationResult(taskID string) *models.ValidationResult {
	resp, err := suite.client.Get(fmt.Sprintf("%s/api/v1/validate/%s", suite.server.URL, taskID))
	if err != nil {
		return nil
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil
	}

	var result models.ValidationResult
	err = json.NewDecoder(resp.Body).Decode(&result)
	if err != nil {
		return nil
	}

	return &result
}

// Test code samples

func (suite *ValidationPipelineTestSuite) getTestGoCode() string {
	return `package main

import (
	"fmt"
	"log"
	"net/http"
)

func main() {
	http.HandleFunc("/health", healthHandler)
	http.HandleFunc("/hello", helloHandler)
	
	log.Println("Server starting on :8080")
	if err := http.ListenAndServe(":8080", nil); err != nil {
		log.Fatal("Server failed to start:", err)
	}
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	fmt.Fprint(w, "{\"status\":\"healthy\"}")
}

func helloHandler(w http.ResponseWriter, r *http.Request) {
	name := r.URL.Query().Get("name")
	if name == "" {
		name = "World"
	}
	fmt.Fprintf(w, "Hello, %s!", name)
}`
}

func (suite *ValidationPipelineTestSuite) getTestGoMod() string {
	return `module test-service

go 1.21

require (
	github.com/gorilla/mux v1.8.0
)`
}

func (suite *ValidationPipelineTestSuite) getInvalidGoCode() string {
	return `package main

import "fmt"

func main() {
	// Syntax error - missing closing brace
	fmt.Println("Hello, World!"
}`
}

func (suite *ValidationPipelineTestSuite) getTestPythonCode() string {
	return `#!/usr/bin/env python3
"""
Simple Python script for testing validation.
"""

import sys
import json
from typing import Dict, Any

def process_data(data: Dict[str, Any]) -> Dict[str, Any]:
    """Process input data and return results."""
    if not isinstance(data, dict):
        raise ValueError("Input must be a dictionary")
    
    result = {
        "processed": True,
        "item_count": len(data),
        "keys": list(data.keys())
    }
    return result

def main():
    """Main function."""
    sample_data = {
        "name": "test",
        "version": "1.0.0",
        "items": [1, 2, 3, 4, 5]
    }
    
    try:
        result = process_data(sample_data)
        print(json.dumps(result, indent=2))
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()`
}

func (suite *ValidationPipelineTestSuite) getTestJavaScriptCode() string {
	return `/**
 * Simple Node.js application for testing validation.
 */

const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Routes
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.get('/api/data', (req, res) => {
    const data = {
        message: 'Hello from Node.js!',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    };
    res.json(data);
});

app.post('/api/process', (req, res) => {
    const { data } = req.body;
    
    if (!data) {
        return res.status(400).json({ error: 'Missing data field' });
    }
    
    const result = {
        processed: true,
        input: data,
        length: Array.isArray(data) ? data.length : Object.keys(data).length
    };
    
    res.json(result);
});

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(port, () => {
    console.log('Server running on port ' + port);
});

module.exports = app;`
}

func (suite *ValidationPipelineTestSuite) getTestPackageJson() string {
	return `{
  "name": "test-node-app",
  "version": "1.0.0",
  "description": "Test Node.js application",
  "main": "app.js",
  "scripts": {
    "start": "node app.js",
    "test": "jest",
    "lint": "eslint ."
  },
  "dependencies": {
    "express": "^4.18.0"
  },
  "devDependencies": {
    "jest": "^29.0.0",
    "eslint": "^8.0.0"
  },
  "engines": {
    "node": ">=16.0.0"
  }
}`
}

func (suite *ValidationPipelineTestSuite) getInfiniteLoopCode() string {
	return `package main

import "time"

func main() {
	// Infinite loop to test timeout handling
	for {
		time.Sleep(1 * time.Second)
	}
}`
}

// TestValidationPipelineTestSuite runs the integration test suite
func TestValidationPipelineTestSuite(t *testing.T) {
	suite.Run(t, new(ValidationPipelineTestSuite))
}