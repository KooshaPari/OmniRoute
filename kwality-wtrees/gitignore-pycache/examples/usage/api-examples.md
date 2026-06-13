# Kwality API Usage Examples

This document provides comprehensive examples of how to use the Kwality API for validating AI-generated codebases.

## Table of Contents

- [Authentication](#authentication)
- [Basic Validation](#basic-validation)
- [Advanced Validation](#advanced-validation)
- [Multi-Language Validation](#multi-language-validation)
- [Batch Validation](#batch-validation)
- [Webhook Integration](#webhook-integration)
- [Monitoring and Status](#monitoring-and-status)
- [Error Handling](#error-handling)

## Authentication

### API Key Authentication

```bash
export KWALITY_API_KEY="your-api-key-here"

curl -H "Authorization: Bearer $KWALITY_API_KEY" \
     http://localhost:8080/api/v1/health
```

### JWT Token Authentication

```bash
# Login to get JWT token
response=$(curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "your-username",
    "password": "your-password"
  }')

token=$(echo $response | jq -r '.token')

# Use token for subsequent requests
curl -H "Authorization: Bearer $token" \
     http://localhost:8080/api/v1/validate/codebase
```

## Basic Validation

### 1. Simple Go Application Validation

```bash
curl -X POST http://localhost:8080/api/v1/validate/codebase \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $KWALITY_API_KEY" \
  -d '{
    "name": "simple-go-app",
    "source": {
      "type": "inline",
      "files": [
        {
          "path": "main.go",
          "content": "package main\n\nimport \"fmt\"\n\nfunc main() {\n\tfmt.Println(\"Hello, World!\")\n}"
        },
        {
          "path": "go.mod",
          "content": "module hello-world\n\ngo 1.21"
        }
      ]
    },
    "config": {
      "enabled_engines": ["static", "runtime"],
      "timeout": "5m"
    }
  }'
```

### 2. Git Repository Validation

```bash
curl -X POST http://localhost:8080/api/v1/validate/codebase \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $KWALITY_API_KEY" \
  -d '{
    "name": "ai-microservice",
    "source": {
      "type": "git",
      "repository": {
        "url": "https://github.com/example/ai-microservice.git",
        "branch": "main",
        "commit": "abc123def"
      }
    },
    "config": {
      "enabled_engines": ["static", "runtime", "security"],
      "timeout": "10m",
      "parallel": true
    }
  }'
```

### 3. Archive Upload Validation

```bash
# First, upload the archive
curl -X POST http://localhost:8080/api/v1/upload \
  -H "Authorization: Bearer $KWALITY_API_KEY" \
  -F "file=@codebase.zip" \
  -F "name=ai-service-v2"

# Then validate using the upload ID
curl -X POST http://localhost:8080/api/v1/validate/codebase \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $KWALITY_API_KEY" \
  -d '{
    "name": "ai-service-v2",
    "source": {
      "type": "upload",
      "upload_id": "upload-uuid-here"
    },
    "config": {
      "enabled_engines": ["static", "runtime", "security", "performance"],
      "timeout": "15m"
    }
  }'
```

## Advanced Validation

### 1. Custom Security Configuration

```bash
curl -X POST http://localhost:8080/api/v1/validate/codebase \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $KWALITY_API_KEY" \
  -d '{
    "name": "secure-api",
    "source": {
      "type": "git",
      "repository": {
        "url": "https://github.com/example/secure-api.git"
      }
    },
    "config": {
      "enabled_engines": ["static", "security"],
      "timeout": "8m",
      "security": {
        "scanners": ["semgrep", "gosec", "bandit"],
        "min_severity": "medium",
        "secrets_detection": true,
        "compliance_frameworks": ["SOC2", "PCI-DSS"],
        "fail_on_critical": true
      }
    }
  }'
```

### 2. Performance Validation with Benchmarks

```bash
curl -X POST http://localhost:8080/api/v1/validate/codebase \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $KWALITY_API_KEY" \
  -d '{
    "name": "high-performance-service",
    "source": {
      "type": "git",
      "repository": {
        "url": "https://github.com/example/performance-service.git"
      }
    },
    "config": {
      "enabled_engines": ["runtime", "performance"],
      "timeout": "20m",
      "performance": {
        "benchmarks": {
          "cpu_intensive": true,
          "memory_allocation": true,
          "io_operations": true,
          "concurrent_load": true
        },
        "thresholds": {
          "max_execution_time": "5s",
          "max_memory_usage": "512MB",
          "max_cpu_usage": "80%",
          "min_throughput": "1000 req/s"
        }
      }
    }
  }'
```

### 3. Fuzzing Validation

```bash
curl -X POST http://localhost:8080/api/v1/validate/codebase \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $KWALITY_API_KEY" \
  -d '{
    "name": "fuzz-target-service",
    "source": {
      "type": "git",
      "repository": {
        "url": "https://github.com/example/input-parser.git"
      }
    },
    "config": {
      "enabled_engines": ["runtime", "fuzzing"],
      "timeout": "30m",
      "fuzzing": {
        "enabled": true,
        "duration_seconds": 300,
        "iterations": 10000,
        "strategy": "mutation",
        "coverage_guided": true
      }
    }
  }'
```

## Multi-Language Validation

### 1. Full-Stack Application

```bash
curl -X POST http://localhost:8080/api/v1/validate/codebase \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $KWALITY_API_KEY" \
  -d '{
    "name": "fullstack-app",
    "source": {
      "type": "inline",
      "files": [
        {
          "path": "backend/main.go",
          "content": "package main\n\nimport (\n\t\"net/http\"\n\t\"github.com/gin-gonic/gin\"\n)\n\nfunc main() {\n\tr := gin.Default()\n\tr.GET(\"/api/health\", func(c *gin.Context) {\n\t\tc.JSON(http.StatusOK, gin.H{\"status\": \"healthy\"})\n\t})\n\tr.Run(\":8080\")\n}"
        },
        {
          "path": "backend/go.mod",
          "content": "module fullstack-backend\n\ngo 1.21\n\nrequire github.com/gin-gonic/gin v1.9.1"
        },
        {
          "path": "frontend/src/App.js",
          "content": "import React from \"react\";\nimport axios from \"axios\";\n\nfunction App() {\n  const [health, setHealth] = React.useState(null);\n\n  React.useEffect(() => {\n    axios.get(\"/api/health\")\n      .then(response => setHealth(response.data.status));\n  }, []);\n\n  return (\n    <div>\n      <h1>App Status: {health}</h1>\n    </div>\n  );\n}\n\nexport default App;"
        },
        {
          "path": "frontend/package.json",
          "content": "{\n  \"name\": \"frontend\",\n  \"version\": \"1.0.0\",\n  \"dependencies\": {\n    \"react\": \"^18.0.0\",\n    \"axios\": \"^1.0.0\"\n  }\n}"
        },
        {
          "path": "ml/train.py",
          "content": "import pandas as pd\nimport numpy as np\nfrom sklearn.model_selection import train_test_split\nfrom sklearn.ensemble import RandomForestClassifier\n\ndef train_model(data_path):\n    df = pd.read_csv(data_path)\n    X = df.drop(\"target\", axis=1)\n    y = df[\"target\"]\n    \n    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2)\n    \n    model = RandomForestClassifier(n_estimators=100)\n    model.fit(X_train, y_train)\n    \n    return model, X_test, y_test\n\nif __name__ == \"__main__\":\n    model, X_test, y_test = train_model(\"data.csv\")\n    score = model.score(X_test, y_test)\n    print(f\"Model accuracy: {score:.2f}\")"
        }
      ]
    },
    "config": {
      "enabled_engines": ["static", "runtime", "security"],
      "timeout": "15m",
      "parallel": true
    }
  }'
```

### 2. Microservices Architecture

```bash
curl -X POST http://localhost:8080/api/v1/validate/codebase \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $KWALITY_API_KEY" \
  -d '{
    "name": "microservices-system",
    "source": {
      "type": "git",
      "repository": {
        "url": "https://github.com/example/microservices.git"
      }
    },
    "config": {
      "enabled_engines": ["static", "runtime", "security", "integration"],
      "timeout": "25m",
      "parallel": true,
      "integration": {
        "test_frameworks": ["pytest", "jest", "go-test"],
        "test_categories": ["unit", "integration", "contract"],
        "coverage_requirements": {
          "min_line_coverage": 80.0,
          "min_branch_coverage": 70.0
        }
      }
    }
  }'
```

## Batch Validation

### 1. Multiple Repositories

```bash
curl -X POST http://localhost:8080/api/v1/validate/batch \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $KWALITY_API_KEY" \
  -d '{
    "batch_name": "ai-services-audit",
    "codebases": [
      {
        "name": "user-service",
        "source": {
          "type": "git",
          "repository": {
            "url": "https://github.com/example/user-service.git"
          }
        }
      },
      {
        "name": "payment-service",
        "source": {
          "type": "git",
          "repository": {
            "url": "https://github.com/example/payment-service.git"
          }
        }
      },
      {
        "name": "notification-service",
        "source": {
          "type": "git",
          "repository": {
            "url": "https://github.com/example/notification-service.git"
          }
        }
      }
    ],
    "config": {
      "enabled_engines": ["static", "security"],
      "timeout": "10m",
      "parallel": true
    }
  }'
```

### 2. Organization-Wide Scan

```bash
curl -X POST http://localhost:8080/api/v1/validate/organization \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $KWALITY_API_KEY" \
  -d '{
    "organization": "example-org",
    "filters": {
      "language": ["go", "python", "javascript"],
      "updated_after": "2024-01-01",
      "exclude_archived": true
    },
    "config": {
      "enabled_engines": ["static", "security"],
      "timeout": "5m",
      "security": {
        "min_severity": "high",
        "compliance_frameworks": ["SOC2"]
      }
    }
  }'
```

## Webhook Integration

### 1. Setup Webhook

```bash
curl -X POST http://localhost:8080/api/v1/webhooks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $KWALITY_API_KEY" \
  -d '{
    "url": "https://your-service.com/kwality-webhook",
    "events": ["validation.completed", "validation.failed", "security.critical"],
    "secret": "your-webhook-secret",
    "active": true
  }'
```

### 2. Webhook Payload Example

When a validation completes, Kwality will send a POST request to your webhook URL:

```json
{
  "event": "validation.completed",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "validation_id": "val-123456",
    "codebase_name": "ai-service",
    "status": "completed",
    "overall_score": 87.5,
    "quality_gate": true,
    "duration": "5m30s",
    "summary": {
      "total_files": 45,
      "lines_of_code": 3247,
      "languages": ["go", "javascript"],
      "critical_issues": 0,
      "high_issues": 2,
      "medium_issues": 8
    },
    "reports": {
      "json": "https://reports.kwality.com/val-123456.json",
      "html": "https://reports.kwality.com/val-123456.html",
      "pdf": "https://reports.kwality.com/val-123456.pdf"
    }
  }
}
```

## Monitoring and Status

### 1. Check Validation Status

```bash
# Get specific validation status
curl -H "Authorization: Bearer $KWALITY_API_KEY" \
     http://localhost:8080/api/v1/validate/val-123456

# List all validations
curl -H "Authorization: Bearer $KWALITY_API_KEY" \
     "http://localhost:8080/api/v1/validate?status=completed&limit=50"

# Get validation logs
curl -H "Authorization: Bearer $KWALITY_API_KEY" \
     http://localhost:8080/api/v1/validate/val-123456/logs
```

### 2. System Health and Metrics

```bash
# System health check
curl http://localhost:8080/health

# Detailed system status
curl -H "Authorization: Bearer $KWALITY_API_KEY" \
     http://localhost:8080/api/v1/system/status

# Performance metrics
curl -H "Authorization: Bearer $KWALITY_API_KEY" \
     http://localhost:8080/api/v1/metrics

# Queue status
curl -H "Authorization: Bearer $KWALITY_API_KEY" \
     http://localhost:8080/api/v1/queue/status
```

### 3. Real-time Updates via WebSocket

```javascript
const ws = new WebSocket('wss://kwality.example.com/ws/validation/val-123456');

ws.onopen = function(event) {
    console.log('Connected to validation updates');
};

ws.onmessage = function(event) {
    const update = JSON.parse(event.data);
    console.log('Validation update:', update);
    
    // Update UI with progress
    updateProgressBar(update.progress);
    updateCurrentPhase(update.current_phase);
};

ws.onclose = function(event) {
    console.log('Validation updates connection closed');
};
```

## Error Handling

### 1. Common Error Responses

```bash
# Invalid request (400 Bad Request)
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Missing required field: source",
    "details": {
      "field": "source",
      "reason": "required"
    }
  }
}

# Authentication error (401 Unauthorized)
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or expired API key",
    "details": {
      "reason": "invalid_credentials"
    }
  }
}

# Rate limit exceeded (429 Too Many Requests)
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests",
    "details": {
      "retry_after": 60,
      "limit": 100,
      "reset_time": "2024-01-15T11:00:00Z"
    }
  }
}

# Validation timeout (408 Request Timeout)
{
  "error": {
    "code": "VALIDATION_TIMEOUT",
    "message": "Validation exceeded maximum time limit",
    "details": {
      "timeout": "30m",
      "elapsed": "35m",
      "phase": "runtime_execution"
    }
  }
}
```

### 2. Retry Logic Example

```bash
#!/bin/bash

# Function to retry API calls with exponential backoff
retry_api_call() {
    local url=$1
    local max_attempts=5
    local delay=1
    
    for ((i=1; i<=max_attempts; i++)); do
        echo "Attempt $i of $max_attempts"
        
        response=$(curl -s -w "%{http_code}" -H "Authorization: Bearer $KWALITY_API_KEY" "$url")
        http_code=${response: -3}
        
        if [[ $http_code == "200" ]]; then
            echo "Success!"
            echo "${response%???}"  # Remove last 3 chars (HTTP code)
            return 0
        elif [[ $http_code == "429" ]]; then
            echo "Rate limited. Waiting ${delay} seconds..."
            sleep $delay
            delay=$((delay * 2))  # Exponential backoff
        elif [[ $http_code == "5"* ]]; then
            echo "Server error ($http_code). Retrying in ${delay} seconds..."
            sleep $delay
            delay=$((delay * 2))
        else
            echo "Client error ($http_code). Not retrying."
            echo "${response%???}"
            return 1
        fi
    done
    
    echo "All retry attempts failed"
    return 1
}

# Usage
retry_api_call "http://localhost:8080/api/v1/validate/val-123456"
```

### 3. Validation Failure Analysis

```bash
# Get detailed error information
curl -H "Authorization: Bearer $KWALITY_API_KEY" \
     http://localhost:8080/api/v1/validate/val-123456/errors

# Example error response
{
  "validation_id": "val-123456",
  "status": "failed",
  "errors": [
    {
      "engine": "static_analysis",
      "error_code": "ANALYSIS_FAILED",
      "message": "Go module parsing failed",
      "details": {
        "file": "go.mod",
        "line": 5,
        "reason": "invalid module declaration"
      },
      "timestamp": "2024-01-15T10:25:30Z"
    },
    {
      "engine": "runtime_validation",
      "error_code": "CONTAINER_START_FAILED",
      "message": "Failed to start container",
      "details": {
        "image": "kwality/runner:latest",
        "reason": "insufficient resources"
      },
      "timestamp": "2024-01-15T10:26:15Z"
    }
  ],
  "recommendations": [
    "Check go.mod syntax and module declarations",
    "Verify container resource limits and availability",
    "Contact support if issues persist"
  ]
}
```

## SDK Examples

### Python SDK

```python
from kwality import KwalityClient

# Initialize client
client = KwalityClient(
    api_key="your-api-key",
    base_url="https://kwality.example.com"
)

# Submit validation
validation = client.validate_codebase(
    name="my-ai-service",
    source={
        "type": "git",
        "repository": {
            "url": "https://github.com/example/ai-service.git"
        }
    },
    config={
        "enabled_engines": ["static", "runtime", "security"],
        "timeout": "10m"
    }
)

print(f"Validation ID: {validation.id}")

# Wait for completion
result = client.wait_for_completion(validation.id, timeout=600)

print(f"Status: {result.status}")
print(f"Score: {result.overall_score}")

# Download reports
client.download_report(validation.id, format="pdf", path="./report.pdf")
```

### Go SDK

```go
package main

import (
    "context"
    "fmt"
    "time"
    
    "github.com/kwality/kwality-go-sdk"
)

func main() {
    client := kwality.NewClient("your-api-key")
    
    // Submit validation
    validation, err := client.ValidateCodebase(context.Background(), &kwality.ValidationRequest{
        Name: "my-ai-service",
        Source: &kwality.Source{
            Type: "git",
            Repository: &kwality.Repository{
                URL: "https://github.com/example/ai-service.git",
            },
        },
        Config: &kwality.Config{
            EnabledEngines: []string{"static", "runtime", "security"},
            Timeout:       "10m",
        },
    })
    if err != nil {
        panic(err)
    }
    
    fmt.Printf("Validation ID: %s\n", validation.ID)
    
    // Poll for completion
    for {
        result, err := client.GetValidation(context.Background(), validation.ID)
        if err != nil {
            panic(err)
        }
        
        if result.Status == "completed" || result.Status == "failed" {
            fmt.Printf("Status: %s\n", result.Status)
            fmt.Printf("Score: %.1f\n", result.OverallScore)
            break
        }
        
        time.Sleep(10 * time.Second)
    }
}
```

This comprehensive API documentation covers all major use cases for the Kwality platform, from simple validations to complex enterprise scenarios with webhooks, monitoring, and error handling.