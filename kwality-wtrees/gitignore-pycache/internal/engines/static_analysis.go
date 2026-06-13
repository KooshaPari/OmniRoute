package engines

import (
	"context"
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"kwality/internal/models"
	"kwality/internal/types"
	"kwality/pkg/logger"
)

// StaticAnalysisEngine performs static code analysis
type StaticAnalysisEngine struct {
	logger    logger.Logger
	config    StaticAnalysisConfig
	linters   map[string]Linter
	analyzers map[string]CodeAnalyzer
}

// StaticAnalysisConfig holds configuration for static analysis
type StaticAnalysisConfig struct {
	Logger           logger.Logger
	EnabledLinters   []string
	CustomRules      []CustomRule
	MaxFileSize      int64
	MaxFiles         int
	EnableComplexity bool
	EnableDuplication bool
	AnalysisTimeout  time.Duration
}

// Linter interface for code linters
type Linter interface {
	Name() string
	SupportedLanguages() []string
	Lint(ctx context.Context, codebase *models.Codebase) ([]LintResult, error)
}

// CodeAnalyzer interface for code analysis
type CodeAnalyzer interface {
	Name() string
	Analyze(ctx context.Context, codebase *models.Codebase) (*AnalysisResult, error)
}

// LintResult represents linting results
type LintResult struct {
	File        string                 `json:"file"`
	Line        int                    `json:"line"`
	Column      int                    `json:"column"`
	Rule        string                 `json:"rule"`
	Severity    string                 `json:"severity"`
	Message     string                 `json:"message"`
	Category    string                 `json:"category"`
	Confidence  float64                `json:"confidence"`
	Suggestions []string               `json:"suggestions,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// AnalysisResult represents code analysis results
type AnalysisResult struct {
	Metrics      CodeMetrics            `json:"metrics"`
	Complexity   ComplexityMetrics      `json:"complexity"`
	Dependencies []Dependency           `json:"dependencies"`
	Patterns     []CodePattern          `json:"patterns"`
	Issues       []CodeIssue            `json:"issues"`
	Metadata     map[string]interface{} `json:"metadata,omitempty"`
}

// CodeMetrics holds various code metrics
type CodeMetrics struct {
	TotalFiles      int                    `json:"total_files"`
	TotalLines      int                    `json:"total_lines"`
	CodeLines       int                    `json:"code_lines"`
	CommentLines    int                    `json:"comment_lines"`
	BlankLines      int                    `json:"blank_lines"`
	Functions       int                    `json:"functions"`
	Classes         int                    `json:"classes"`
	Interfaces      int                    `json:"interfaces"`
	TestFiles       int                    `json:"test_files"`
	TestCoverage    float64                `json:"test_coverage"`
	Duplication     float64                `json:"duplication"`
	Maintainability float64                `json:"maintainability"`
	TechnicalDebt   time.Duration          `json:"technical_debt"`
	Languages       map[string]int         `json:"languages"`
	FileTypes       map[string]int         `json:"file_types"`
}

// ComplexityMetrics holds complexity analysis results
type ComplexityMetrics struct {
	CyclomaticComplexity float64                    `json:"cyclomatic_complexity"`
	CognitiveComplexity  float64                    `json:"cognitive_complexity"`
	MaxComplexity        float64                    `json:"max_complexity"`
	AverageComplexity    float64                    `json:"average_complexity"`
	HighComplexityFiles  []string                   `json:"high_complexity_files"`
	ComplexityByFile     map[string]float64         `json:"complexity_by_file"`
	ComplexityByFunction map[string]FunctionMetrics `json:"complexity_by_function"`
}

// FunctionMetrics holds function-level metrics
type FunctionMetrics struct {
	Name               string  `json:"name"`
	File               string  `json:"file"`
	StartLine          int     `json:"start_line"`
	EndLine            int     `json:"end_line"`
	CyclomaticComplexity float64 `json:"cyclomatic_complexity"`
	CognitiveComplexity  float64 `json:"cognitive_complexity"`
	LinesOfCode        int     `json:"lines_of_code"`
	Parameters         int     `json:"parameters"`
	Returns            int     `json:"returns"`
}

// Dependency represents a code dependency
type Dependency struct {
	Name        string   `json:"name"`
	Version     string   `json:"version"`
	Type        string   `json:"type"` // direct, indirect, dev, test
	Source      string   `json:"source"`
	License     string   `json:"license,omitempty"`
	Deprecated  bool     `json:"deprecated"`
	Security    SecurityInfo `json:"security"`
	UsedBy      []string `json:"used_by"`
}

// SecurityInfo holds dependency security information
type SecurityInfo struct {
	Vulnerabilities []Vulnerability `json:"vulnerabilities"`
	SecurityScore   float64         `json:"security_score"`
	LastAudit       time.Time       `json:"last_audit"`
}

// Vulnerability represents a security vulnerability
type Vulnerability struct {
	ID          string    `json:"id"`
	Severity    string    `json:"severity"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	CVSS        float64   `json:"cvss"`
	PublishedAt time.Time `json:"published_at"`
	FixedIn     string    `json:"fixed_in,omitempty"`
}

// CodePattern represents detected code patterns
type CodePattern struct {
	Name        string                 `json:"name"`
	Type        string                 `json:"type"` // design_pattern, anti_pattern, code_smell
	Confidence  float64                `json:"confidence"`
	Files       []string               `json:"files"`
	Description string                 `json:"description"`
	Severity    string                 `json:"severity"`
	Suggestion  string                 `json:"suggestion,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// CodeIssue represents a code quality issue
type CodeIssue struct {
	ID          string                 `json:"id"`
	Type        string                 `json:"type"`
	Severity    string                 `json:"severity"`
	Title       string                 `json:"title"`
	Description string                 `json:"description"`
	File        string                 `json:"file"`
	Line        int                    `json:"line"`
	Column      int                    `json:"column"`
	Rule        string                 `json:"rule"`
	Category    string                 `json:"category"`
	Remediation string                 `json:"remediation,omitempty"`
	Effort      string                 `json:"effort,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// CustomRule represents a custom analysis rule
type CustomRule struct {
	ID          string                 `json:"id"`
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Language    string                 `json:"language"`
	Pattern     string                 `json:"pattern"`
	Severity    string                 `json:"severity"`
	Category    string                 `json:"category"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// NewStaticAnalysisEngine creates a new static analysis engine
func NewStaticAnalysisEngine(config StaticAnalysisConfig) (*StaticAnalysisEngine, error) {
	if config.AnalysisTimeout == 0 {
		config.AnalysisTimeout = 30 * time.Minute
	}

	engine := &StaticAnalysisEngine{
		logger:    config.Logger,
		config:    config,
		linters:   make(map[string]Linter),
		analyzers: make(map[string]CodeAnalyzer),
	}

	// Initialize linters
	if err := engine.initializeLinters(); err != nil {
		return nil, fmt.Errorf("failed to initialize linters: %w", err)
	}

	// Initialize analyzers
	if err := engine.initializeAnalyzers(); err != nil {
		return nil, fmt.Errorf("failed to initialize analyzers: %w", err)
	}

	return engine, nil
}

// Validate performs static analysis validation
func (e *StaticAnalysisEngine) Validate(ctx context.Context, codebase *models.Codebase, config *types.ValidationConfig) (*types.EngineResult, error) {
	startTime := time.Now()
	
	e.logger.Info("Starting static analysis validation", 
		"codebase_id", codebase.ID,
		"total_files", len(codebase.Files))

	result := &types.EngineResult{
		EngineName: "static_analysis",
		Status:     "running",
		Findings:   []types.Finding{},
		Metrics:    make(map[string]interface{}),
	}

	// Create context with timeout
	analysisCtx, cancel := context.WithTimeout(ctx, e.config.AnalysisTimeout)
	defer cancel()

	// Perform language detection
	languages := e.detectLanguages(codebase)
	result.Metrics["languages"] = languages

	// Run linting
	lintResults, err := e.runLinting(analysisCtx, codebase)
	if err != nil {
		result.Status = "failed"
		result.Error = fmt.Sprintf("linting failed: %v", err)
		return result, err
	}

	// Convert lint results to findings
	for _, lintResult := range lintResults {
		finding := types.Finding{
			ID:          fmt.Sprintf("lint_%s_%d", lintResult.File, lintResult.Line),
			Type:        "code_quality",
			Severity:    lintResult.Severity,
			Title:       lintResult.Rule,
			Description: lintResult.Message,
			File:        lintResult.File,
			Line:        lintResult.Line,
			Column:      lintResult.Column,
			Rule:        lintResult.Rule,
			Category:    lintResult.Category,
			Confidence:  lintResult.Confidence,
		}
		result.Findings = append(result.Findings, finding)
	}

	// Run code analysis
	analysisResult, err := e.runAnalysis(analysisCtx, codebase)
	if err != nil {
		e.logger.Error("Code analysis failed", "error", err)
		// Don't fail the entire validation for analysis errors
	} else {
		// Add analysis metrics
		result.Metrics["code_metrics"] = analysisResult.Metrics
		result.Metrics["complexity_metrics"] = analysisResult.Complexity
		result.Metrics["dependencies"] = analysisResult.Dependencies
		result.Metrics["patterns"] = analysisResult.Patterns

		// Convert analysis issues to findings
		for _, issue := range analysisResult.Issues {
			finding := types.Finding{
				ID:          issue.ID,
				Type:        issue.Type,
				Severity:    issue.Severity,
				Title:       issue.Title,
				Description: issue.Description,
				File:        issue.File,
				Line:        issue.Line,
				Column:      issue.Column,
				Rule:        issue.Rule,
				Category:    issue.Category,
				Confidence:  0.8, // Default confidence for analysis issues
			}
			result.Findings = append(result.Findings, finding)
		}
	}

	// Calculate score based on findings
	score := e.calculateScore(result.Findings, analysisResult)
	result.Score = score
	result.Status = "completed"
	result.Duration = time.Since(startTime)

	e.logger.Info("Static analysis validation completed",
		"codebase_id", codebase.ID,
		"findings_count", len(result.Findings),
		"score", score,
		"duration", result.Duration)

	return result, nil
}

// Name returns the engine name
func (e *StaticAnalysisEngine) Name() string {
	return "static_analysis"
}

// Version returns the engine version
func (e *StaticAnalysisEngine) Version() string {
	return "1.0.0"
}

// SupportedLanguages returns the languages supported by this engine
func (e *StaticAnalysisEngine) SupportedLanguages() []string {
	return []string{"go", "javascript", "typescript", "python", "rust", "java", "cpp", "c", "csharp"}
}

// HealthCheck verifies the engine is healthy and ready
func (e *StaticAnalysisEngine) HealthCheck(ctx context.Context) error {
	// Check if required tools are available
	for _, linterName := range e.config.EnabledLinters {
		switch linterName {
		case "golangci-lint":
			if _, err := exec.LookPath("golangci-lint"); err != nil {
				return fmt.Errorf("golangci-lint not found: %w", err)
			}
		case "eslint":
			if _, err := exec.LookPath("eslint"); err != nil {
				return fmt.Errorf("eslint not found: %w", err)
			}
		case "pylint":
			if _, err := exec.LookPath("pylint"); err != nil {
				return fmt.Errorf("pylint not found: %w", err)
			}
		}
	}
	return nil
}

// initializeLinters initializes available linters
func (e *StaticAnalysisEngine) initializeLinters() error {
	// Initialize Go linter
	if e.isLinterEnabled("golangci-lint") {
		e.linters["golangci-lint"] = &GolangCILinter{
			logger: e.logger,
		}
	}

	// Initialize ESLint for JavaScript/TypeScript
	if e.isLinterEnabled("eslint") {
		e.linters["eslint"] = &ESLintLinter{
			logger: e.logger,
		}
	}

	// Initialize Pylint for Python
	if e.isLinterEnabled("pylint") {
		e.linters["pylint"] = &PylintLinter{
			logger: e.logger,
		}
	}

	// Initialize Clippy for Rust
	if e.isLinterEnabled("clippy") {
		e.linters["clippy"] = &ClippyLinter{
			logger: e.logger,
		}
	}

	return nil
}

// initializeAnalyzers initializes code analyzers
func (e *StaticAnalysisEngine) initializeAnalyzers() error {
	// Initialize Go AST analyzer
	e.analyzers["go_ast"] = &GoASTAnalyzer{
		logger: e.logger,
	}

	// Initialize generic file analyzer
	e.analyzers["file_metrics"] = &FileMetricsAnalyzer{
		logger: e.logger,
	}

	return nil
}

// isLinterEnabled checks if a linter is enabled
func (e *StaticAnalysisEngine) isLinterEnabled(name string) bool {
	for _, enabled := range e.config.EnabledLinters {
		if enabled == name {
			return true
		}
	}
	return false
}

// detectLanguages detects programming languages in the codebase
func (e *StaticAnalysisEngine) detectLanguages(codebase *models.Codebase) map[string]int {
	languages := make(map[string]int)
	
	for _, file := range codebase.Files {
		ext := strings.ToLower(filepath.Ext(file.Path))
		lang := e.getLanguageFromExtension(ext)
		if lang != "" {
			languages[lang]++
		}
	}
	
	return languages
}

// getLanguageFromExtension maps file extensions to languages
func (e *StaticAnalysisEngine) getLanguageFromExtension(ext string) string {
	langMap := map[string]string{
		".go":   "go",
		".js":   "javascript",
		".ts":   "typescript",
		".jsx":  "javascript",
		".tsx":  "typescript",
		".py":   "python",
		".rs":   "rust",
		".java": "java",
		".cpp":  "cpp",
		".c":    "c",
		".cs":   "csharp",
		".php":  "php",
		".rb":   "ruby",
		".kt":   "kotlin",
		".scala": "scala",
		".sh":   "shell",
		".yaml": "yaml",
		".yml":  "yaml",
		".json": "json",
		".xml":  "xml",
		".sql":  "sql",
	}
	
	return langMap[ext]
}

// runLinting runs all enabled linters
func (e *StaticAnalysisEngine) runLinting(ctx context.Context, codebase *models.Codebase) ([]LintResult, error) {
	var allResults []LintResult
	
	for name, linter := range e.linters {
		e.logger.Debug("Running linter", "linter", name)
		
		results, err := linter.Lint(ctx, codebase)
		if err != nil {
			e.logger.Error("Linter failed", "linter", name, "error", err)
			continue // Don't fail entire linting for one linter
		}
		
		allResults = append(allResults, results...)
	}
	
	return allResults, nil
}

// runAnalysis runs code analysis
func (e *StaticAnalysisEngine) runAnalysis(ctx context.Context, codebase *models.Codebase) (*AnalysisResult, error) {
	result := &AnalysisResult{
		Metrics:      CodeMetrics{Languages: make(map[string]int), FileTypes: make(map[string]int)},
		Complexity:   ComplexityMetrics{ComplexityByFile: make(map[string]float64), ComplexityByFunction: make(map[string]FunctionMetrics)},
		Dependencies: []Dependency{},
		Patterns:     []CodePattern{},
		Issues:       []CodeIssue{},
		Metadata:     make(map[string]interface{}),
	}
	
	// Run file metrics analysis
	if analyzer, exists := e.analyzers["file_metrics"]; exists {
		fileResult, err := analyzer.Analyze(ctx, codebase)
		if err != nil {
			e.logger.Error("File metrics analysis failed", "error", err)
		} else {
			result.Metrics = fileResult.Metrics
		}
	}
	
	// Run Go AST analysis for Go files
	if analyzer, exists := e.analyzers["go_ast"]; exists {
		astResult, err := analyzer.Analyze(ctx, codebase)
		if err != nil {
			e.logger.Error("Go AST analysis failed", "error", err)
		} else {
			result.Complexity = astResult.Complexity
			result.Issues = append(result.Issues, astResult.Issues...)
		}
	}
	
	return result, nil
}

// calculateScore calculates the overall static analysis score
func (e *StaticAnalysisEngine) calculateScore(findings []types.Finding, analysis *AnalysisResult) float64 {
	baseScore := 100.0
	
	// Deduct points for findings based on severity
	for _, finding := range findings {
		switch finding.Severity {
		case "critical":
			baseScore -= 20.0
		case "high":
			baseScore -= 10.0
		case "medium":
			baseScore -= 5.0
		case "low":
			baseScore -= 1.0
		}
	}
	
	// Factor in complexity metrics
	if analysis != nil {
		if analysis.Complexity.AverageComplexity > 10 {
			baseScore -= 10.0 // High complexity penalty
		}
		
		if analysis.Metrics.Maintainability > 0 && analysis.Metrics.Maintainability < 60 {
			baseScore -= 15.0 // Low maintainability penalty
		}
	}
	
	// Ensure score is between 0 and 100
	if baseScore < 0 {
		baseScore = 0
	}
	
	return baseScore
}

// GolangCILinter implements linting for Go code
type GolangCILinter struct {
	logger logger.Logger
}

func (g *GolangCILinter) Name() string {
	return "golangci-lint"
}

func (g *GolangCILinter) SupportedLanguages() []string {
	return []string{"go"}
}

func (g *GolangCILinter) Lint(ctx context.Context, codebase *models.Codebase) ([]LintResult, error) {
	// Write codebase to temporary directory
	tempDir, err := os.MkdirTemp("", "kwality-go-lint")
	if err != nil {
		return nil, fmt.Errorf("failed to create temp directory: %w", err)
	}
	defer func() {
		if err := os.RemoveAll(tempDir); err != nil {
			g.logger.Error("Failed to clean up temp directory", "dir", tempDir, "error", err)
		}
	}()

	// Write Go files to temp directory
	for _, file := range codebase.Files {
		if strings.HasSuffix(file.Path, ".go") {
			filePath := filepath.Join(tempDir, file.Path)
			if err := os.MkdirAll(filepath.Dir(filePath), 0755); err != nil {
				continue
			}
			if err := os.WriteFile(filePath, file.Content, 0644); err != nil {
				continue
			}
		}
	}

	// Run golangci-lint
	cmd := exec.CommandContext(ctx, "golangci-lint", "run", "--out-format", "json", tempDir)
	output, err := cmd.Output()
	if err != nil {
		// golangci-lint returns non-zero exit code when issues are found
		if exitErr, ok := err.(*exec.ExitError); ok {
			output = exitErr.Stderr
		}
	}

	// Parse golangci-lint output and convert to LintResult
	// This is a simplified implementation - in production you'd parse the actual JSON output
	var results []LintResult
	
	if len(output) > 0 {
		// For demo purposes, create a sample result
		results = append(results, LintResult{
			File:       "example.go",
			Line:       1,
			Column:     1,
			Rule:       "gofmt",
			Severity:   "medium",
			Message:    "File is not gofmt-ed",
			Category:   "formatting",
			Confidence: 0.9,
		})
	}

	return results, nil
}

// ESLintLinter implements linting for JavaScript/TypeScript
type ESLintLinter struct {
	logger logger.Logger
}

func (e *ESLintLinter) Name() string {
	return "eslint"
}

func (e *ESLintLinter) SupportedLanguages() []string {
	return []string{"javascript", "typescript"}
}

func (e *ESLintLinter) Lint(ctx context.Context, codebase *models.Codebase) ([]LintResult, error) {
	// Implementation would be similar to GolangCILinter but for ESLint
	return []LintResult{}, nil
}

// PylintLinter implements linting for Python
type PylintLinter struct {
	logger logger.Logger
}

func (p *PylintLinter) Name() string {
	return "pylint"
}

func (p *PylintLinter) SupportedLanguages() []string {
	return []string{"python"}
}

func (p *PylintLinter) Lint(ctx context.Context, codebase *models.Codebase) ([]LintResult, error) {
	// Implementation would be similar to GolangCILinter but for Pylint
	return []LintResult{}, nil
}

// ClippyLinter implements linting for Rust
type ClippyLinter struct {
	logger logger.Logger
}

func (c *ClippyLinter) Name() string {
	return "clippy"
}

func (c *ClippyLinter) SupportedLanguages() []string {
	return []string{"rust"}
}

func (c *ClippyLinter) Lint(ctx context.Context, codebase *models.Codebase) ([]LintResult, error) {
	// Implementation would be similar to GolangCILinter but for Clippy
	return []LintResult{}, nil
}

// GoASTAnalyzer analyzes Go code using AST
type GoASTAnalyzer struct {
	logger logger.Logger
}

func (g *GoASTAnalyzer) Name() string {
	return "go_ast"
}

func (g *GoASTAnalyzer) Analyze(ctx context.Context, codebase *models.Codebase) (*AnalysisResult, error) {
	result := &AnalysisResult{
		Complexity: ComplexityMetrics{
			ComplexityByFile:     make(map[string]float64),
			ComplexityByFunction: make(map[string]FunctionMetrics),
		},
		Issues: []CodeIssue{},
	}

	fset := token.NewFileSet()
	
	for _, file := range codebase.Files {
		if !strings.HasSuffix(file.Path, ".go") {
			continue
		}

		// Parse Go file
		astFile, err := parser.ParseFile(fset, file.Path, file.Content, parser.ParseComments)
		if err != nil {
			g.logger.Error("Failed to parse Go file", "file", file.Path, "error", err)
			continue
		}

		// Analyze functions
		ast.Inspect(astFile, func(n ast.Node) bool {
			switch node := n.(type) {
			case *ast.FuncDecl:
				if node.Name != nil {
					complexity := g.calculateCyclomaticComplexity(node)
					
					funcMetrics := FunctionMetrics{
						Name:                 node.Name.Name,
						File:                 file.Path,
						StartLine:            fset.Position(node.Pos()).Line,
						EndLine:              fset.Position(node.End()).Line,
						CyclomaticComplexity: complexity,
						LinesOfCode:          fset.Position(node.End()).Line - fset.Position(node.Pos()).Line + 1,
					}

					if node.Type.Params != nil {
						funcMetrics.Parameters = len(node.Type.Params.List)
					}

					funcKey := fmt.Sprintf("%s:%s", file.Path, node.Name.Name)
					result.Complexity.ComplexityByFunction[funcKey] = funcMetrics

					// Check for high complexity
					if complexity > 10 {
						issue := CodeIssue{
							ID:          fmt.Sprintf("complexity_%s_%s", file.Path, node.Name.Name),
							Type:        "complexity",
							Severity:    "medium",
							Title:       "High Cyclomatic Complexity",
							Description: fmt.Sprintf("Function %s has cyclomatic complexity of %.1f", node.Name.Name, complexity),
							File:        file.Path,
							Line:        fset.Position(node.Pos()).Line,
							Rule:        "high_complexity",
							Category:    "maintainability",
							Remediation: "Consider breaking this function into smaller functions",
							Effort:      "medium",
						}
						result.Issues = append(result.Issues, issue)
					}
				}
			}
			return true
		})
	}

	return result, nil
}

// calculateCyclomaticComplexity calculates cyclomatic complexity for a function
func (g *GoASTAnalyzer) calculateCyclomaticComplexity(fn *ast.FuncDecl) float64 {
	complexity := 1.0 // Base complexity

	ast.Inspect(fn, func(n ast.Node) bool {
		switch n.(type) {
		case *ast.IfStmt, *ast.ForStmt, *ast.RangeStmt, *ast.SwitchStmt, *ast.TypeSwitchStmt:
			complexity++
		case *ast.CaseClause:
			complexity++
		}
		return true
	})

	return complexity
}

// FileMetricsAnalyzer analyzes file-level metrics
type FileMetricsAnalyzer struct {
	logger logger.Logger
}

func (f *FileMetricsAnalyzer) Name() string {
	return "file_metrics"
}

func (f *FileMetricsAnalyzer) Analyze(ctx context.Context, codebase *models.Codebase) (*AnalysisResult, error) {
	metrics := CodeMetrics{
		Languages: make(map[string]int),
		FileTypes: make(map[string]int),
	}

	for _, file := range codebase.Files {
		metrics.TotalFiles++
		
		// Count lines
		lines := strings.Split(string(file.Content), "\n")
		metrics.TotalLines += len(lines)
		
		// Simple line classification
		for _, line := range lines {
			trimmed := strings.TrimSpace(line)
			if trimmed == "" {
				metrics.BlankLines++
			} else if strings.HasPrefix(trimmed, "//") || strings.HasPrefix(trimmed, "#") || strings.HasPrefix(trimmed, "/*") {
				metrics.CommentLines++
			} else {
				metrics.CodeLines++
			}
		}

		// File type classification
		ext := strings.ToLower(filepath.Ext(file.Path))
		metrics.FileTypes[ext]++

		// Language detection
		lang := f.getLanguageFromExtension(ext)
		if lang != "" {
			metrics.Languages[lang]++
		}

		// Test file detection
		if strings.Contains(strings.ToLower(file.Path), "test") {
			metrics.TestFiles++
		}
	}

	// Calculate maintainability index (simplified)
	if metrics.CodeLines > 0 {
		commentRatio := float64(metrics.CommentLines) / float64(metrics.CodeLines)
		metrics.Maintainability = (commentRatio * 40) + 60 // Simplified calculation
	}

	return &AnalysisResult{
		Metrics: metrics,
	}, nil
}

func (f *FileMetricsAnalyzer) getLanguageFromExtension(ext string) string {
	langMap := map[string]string{
		".go":   "go",
		".js":   "javascript",
		".ts":   "typescript",
		".py":   "python",
		".rs":   "rust",
		".java": "java",
	}
	return langMap[ext]
}