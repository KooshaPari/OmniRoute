package models

import (
	"fmt"
	"time"
)

// Codebase represents a codebase to be validated
type Codebase struct {
	ID          string            `json:"id"`
	Name        string            `json:"name"`
	Description string            `json:"description,omitempty"`
	Source      CodebaseSource    `json:"source"`
	Files       []File            `json:"files"`
	Languages   []string          `json:"languages"`
	Framework   string            `json:"framework,omitempty"`
	Version     string            `json:"version,omitempty"`
	CreatedAt   time.Time         `json:"created_at"`
	UpdatedAt   time.Time         `json:"updated_at"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// CodebaseSource represents the source of the codebase
type CodebaseSource struct {
	Type       SourceType    `json:"type"`
	Files      []SourceFile  `json:"files,omitempty"`
	Repository *Repository   `json:"repository,omitempty"`
	Archive    *Archive      `json:"archive,omitempty"`
	Upload     *Upload       `json:"upload,omitempty"`
}

// SourceType defines the type of codebase source
type SourceType string

const (
	SourceTypeGit      SourceType = "git"
	SourceTypeArchive  SourceType = "archive"
	SourceTypeUpload   SourceType = "upload"
	SourceTypeLocal    SourceType = "local"
	SourceTypeInline   SourceType = "inline"
)

// Repository represents a Git repository source
type Repository struct {
	URL        string `json:"url"`
	Branch     string `json:"branch,omitempty"`
	Commit     string `json:"commit,omitempty"`
	Tag        string `json:"tag,omitempty"`
	Token      string `json:"token,omitempty"`
	SSHKey     string `json:"ssh_key,omitempty"`
	Depth      int    `json:"depth,omitempty"`
	Submodules bool   `json:"submodules"`
}

// Archive represents an archive file source (zip, tar.gz, etc.)
type Archive struct {
	URL      string            `json:"url"`
	Format   string            `json:"format"`
	Headers  map[string]string `json:"headers,omitempty"`
	ChecksumSHA256 string       `json:"checksum_sha256,omitempty"`
}

// Upload represents an uploaded file source
type Upload struct {
	Filename string `json:"filename"`
	Size     int64  `json:"size"`
	MimeType string `json:"mime_type"`
	Hash     string `json:"hash"`
}

// SourceFile represents a source file for inline sources
type SourceFile struct {
	Path    string `json:"path"`
	Content string `json:"content"`
}

// File represents a file in the codebase
type File struct {
	Path        string            `json:"path"`
	Content     []byte            `json:"content"`
	Size        int64             `json:"size"`
	Hash        string            `json:"hash"`
	Language    string            `json:"language,omitempty"`
	Type        FileType          `json:"type"`
	Encoding    string            `json:"encoding"`
	LineCount   int               `json:"line_count"`
	IsGenerated bool              `json:"is_generated"`
	IsBinary    bool              `json:"is_binary"`
	IsTest      bool              `json:"is_test"`
	ModifiedAt  *time.Time        `json:"modified_at,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// FileType defines the type of file
type FileType string

const (
	FileTypeSource      FileType = "source"
	FileTypeTest        FileType = "test"
	FileTypeConfig      FileType = "config"
	FileTypeDocumentation FileType = "documentation"
	FileTypeBuild       FileType = "build"
	FileTypeAsset       FileType = "asset"
	FileTypeData        FileType = "data"
	FileTypeOther       FileType = "other"
)

// ValidationContext provides context for validation
type ValidationContext struct {
	ProjectType    string            `json:"project_type"`
	Framework      string            `json:"framework,omitempty"`
	BuildTool      string            `json:"build_tool,omitempty"`
	TestFramework  string            `json:"test_framework,omitempty"`
	Dependencies   []Dependency      `json:"dependencies"`
	Environment    map[string]string `json:"environment,omitempty"`
	Requirements   []Requirement     `json:"requirements,omitempty"`
	Constraints    []Constraint      `json:"constraints,omitempty"`
}

// Dependency represents a project dependency
type Dependency struct {
	Name         string `json:"name"`
	Version      string `json:"version"`
	Type         string `json:"type"` // direct, indirect, dev, test
	Source       string `json:"source"`
	License      string `json:"license,omitempty"`
	Manager      string `json:"manager"` // npm, go mod, cargo, pip, etc.
	Required     bool   `json:"required"`
	Deprecated   bool   `json:"deprecated"`
	SecurityRisk bool   `json:"security_risk"`
}

// Requirement represents a validation requirement
type Requirement struct {
	ID          string                 `json:"id"`
	Type        string                 `json:"type"`
	Description string                 `json:"description"`
	Priority    string                 `json:"priority"`
	Criteria    map[string]interface{} `json:"criteria"`
	Mandatory   bool                   `json:"mandatory"`
}

// Constraint represents a validation constraint
type Constraint struct {
	ID          string                 `json:"id"`
	Type        string                 `json:"type"`
	Description string                 `json:"description"`
	Rule        string                 `json:"rule"`
	Parameters  map[string]interface{} `json:"parameters"`
	Enforced    bool                   `json:"enforced"`
}

// CodebaseStats provides statistics about the codebase
type CodebaseStats struct {
	TotalFiles      int                    `json:"total_files"`
	TotalSize       int64                  `json:"total_size"`
	TotalLines      int                    `json:"total_lines"`
	CodeLines       int                    `json:"code_lines"`
	CommentLines    int                    `json:"comment_lines"`
	BlankLines      int                    `json:"blank_lines"`
	Languages       map[string]int         `json:"languages"`
	FileTypes       map[string]int         `json:"file_types"`
	LargestFile     string                 `json:"largest_file"`
	LargestFileSize int64                  `json:"largest_file_size"`
	TestCoverage    float64                `json:"test_coverage"`
	Dependencies    int                    `json:"dependencies"`
	GeneratedAt     time.Time              `json:"generated_at"`
}

// NewCodebase creates a new codebase instance
func NewCodebase(id, name string, source CodebaseSource) *Codebase {
	return &Codebase{
		ID:        id,
		Name:      name,
		Source:    source,
		Files:     make([]File, 0),
		Languages: make([]string, 0),
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
		Metadata:  make(map[string]interface{}),
	}
}

// AddFile adds a file to the codebase
func (c *Codebase) AddFile(file File) {
	c.Files = append(c.Files, file)
	c.UpdatedAt = time.Now()
}

// GetFilesByLanguage returns files filtered by language
func (c *Codebase) GetFilesByLanguage(language string) []File {
	var files []File
	for _, file := range c.Files {
		if file.Language == language {
			files = append(files, file)
		}
	}
	return files
}

// GetFilesByType returns files filtered by type
func (c *Codebase) GetFilesByType(fileType FileType) []File {
	var files []File
	for _, file := range c.Files {
		if file.Type == fileType {
			files = append(files, file)
		}
	}
	return files
}

// GetStats calculates and returns codebase statistics
func (c *Codebase) GetStats() CodebaseStats {
	stats := CodebaseStats{
		Languages:   make(map[string]int),
		FileTypes:   make(map[string]int),
		GeneratedAt: time.Now(),
	}

	for _, file := range c.Files {
		stats.TotalFiles++
		stats.TotalSize += file.Size
		stats.TotalLines += file.LineCount

		// Count by language
		if file.Language != "" {
			stats.Languages[file.Language]++
		}

		// Count by file type
		stats.FileTypes[string(file.Type)]++

		// Track largest file
		if file.Size > stats.LargestFileSize {
			stats.LargestFile = file.Path
			stats.LargestFileSize = file.Size
		}

		// Count line types (simplified)
		if !file.IsBinary {
			if file.IsTest {
				// Test files contribute to test coverage calculation
			} else {
				// Simplified line counting - would need actual content analysis
				stats.CodeLines += file.LineCount
			}
		}
	}

	return stats
}

// DetectLanguages analyzes files and detects programming languages
func (c *Codebase) DetectLanguages() {
	languageSet := make(map[string]bool)
	
	for i, file := range c.Files {
		if file.Language == "" {
			// Detect language based on file extension
			lang := detectLanguageFromExtension(file.Path)
			c.Files[i].Language = lang
		}
		
		if c.Files[i].Language != "" {
			languageSet[c.Files[i].Language] = true
		}
	}
	
	// Convert set to slice
	c.Languages = make([]string, 0, len(languageSet))
	for lang := range languageSet {
		c.Languages = append(c.Languages, lang)
	}
}

// detectLanguageFromExtension detects language from file extension
func detectLanguageFromExtension(path string) string {
	extensions := map[string]string{
		".go":     "go",
		".js":     "javascript",
		".ts":     "typescript",
		".jsx":    "javascript",
		".tsx":    "typescript",
		".py":     "python",
		".rs":     "rust",
		".java":   "java",
		".cpp":    "cpp",
		".c":      "c",
		".cs":     "csharp",
		".php":    "php",
		".rb":     "ruby",
		".kt":     "kotlin",
		".scala":  "scala",
		".sh":     "shell",
		".bash":   "shell",
		".ps1":    "powershell",
		".yaml":   "yaml",
		".yml":    "yaml",
		".json":   "json",
		".xml":    "xml",
		".html":   "html",
		".css":    "css",
		".scss":   "scss",
		".less":   "less",
		".sql":    "sql",
		".md":     "markdown",
		".dockerfile": "dockerfile",
		".tf":     "terraform",
		".hcl":    "hcl",
	}
	
	// Extract extension
	for i := len(path) - 1; i >= 0; i-- {
		if path[i] == '.' {
			ext := path[i:]
			if lang, exists := extensions[ext]; exists {
				return lang
			}
			break
		}
	}
	
	// Special cases for files without extensions
	if path == "Dockerfile" {
		return "dockerfile"
	}
	if path == "Makefile" {
		return "makefile"
	}
	
	return ""
}

// Validate validates the codebase structure
func (c *Codebase) Validate() error {
	if c.ID == "" {
		return fmt.Errorf("codebase ID is required")
	}
	
	if c.Name == "" {
		return fmt.Errorf("codebase name is required")
	}
	
	if len(c.Files) == 0 {
		return fmt.Errorf("codebase must contain at least one file")
	}
	
	// Validate files
	for i, file := range c.Files {
		if file.Path == "" {
			return fmt.Errorf("file at index %d is missing path", i)
		}
		
		if file.Content == nil {
			return fmt.Errorf("file %s is missing content", file.Path)
		}
	}
	
	return nil
}