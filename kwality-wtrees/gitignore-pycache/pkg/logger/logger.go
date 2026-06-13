package logger

import (
	"context"
	"fmt"
	"log/slog"
	"os"
)

// Logger interface defines logging methods
type Logger interface {
	Debug(msg string, args ...interface{})
	Info(msg string, args ...interface{})
	Warn(msg string, args ...interface{})
	Error(msg string, args ...interface{})
	Fatal(msg string, args ...interface{})
	With(args ...interface{}) Logger
	WithContext(ctx context.Context) Logger
}

// Level represents log levels
type Level int

const (
	DebugLevel Level = iota
	InfoLevel
	WarnLevel
	ErrorLevel
	FatalLevel
)

// Format represents log formats
type Format string

const (
	JSONFormat Format = "json"
	TextFormat Format = "text"
)

// Config holds logger configuration
type Config struct {
	Level  Level
	Format Format
	Output string
}

// slogLogger implements Logger using slog
type slogLogger struct {
	logger *slog.Logger
	config Config
}

// New creates a new logger instance
func New(config Config) Logger {
	var level slog.Level
	switch config.Level {
	case DebugLevel:
		level = slog.LevelDebug
	case InfoLevel:
		level = slog.LevelInfo
	case WarnLevel:
		level = slog.LevelWarn
	case ErrorLevel:
		level = slog.LevelError
	default:
		level = slog.LevelInfo
	}

	opts := &slog.HandlerOptions{
		Level: level,
	}

	var handler slog.Handler
	switch config.Format {
	case JSONFormat:
		handler = slog.NewJSONHandler(os.Stdout, opts)
	case TextFormat:
		handler = slog.NewTextHandler(os.Stdout, opts)
	default:
		handler = slog.NewJSONHandler(os.Stdout, opts)
	}

	logger := slog.New(handler)

	return &slogLogger{
		logger: logger,
		config: config,
	}
}

// Debug logs at debug level
func (l *slogLogger) Debug(msg string, args ...interface{}) {
	l.logger.Debug(msg, convertArgs(args...)...)
}

// Info logs at info level
func (l *slogLogger) Info(msg string, args ...interface{}) {
	l.logger.Info(msg, convertArgs(args...)...)
}

// Warn logs at warn level
func (l *slogLogger) Warn(msg string, args ...interface{}) {
	l.logger.Warn(msg, convertArgs(args...)...)
}

// Error logs at error level
func (l *slogLogger) Error(msg string, args ...interface{}) {
	l.logger.Error(msg, convertArgs(args...)...)
}

// Fatal logs at error level and exits
func (l *slogLogger) Fatal(msg string, args ...interface{}) {
	l.logger.Error(msg, convertArgs(args...)...)
	os.Exit(1)
}

// With returns a new logger with additional context
func (l *slogLogger) With(args ...interface{}) Logger {
	return &slogLogger{
		logger: l.logger.With(convertArgs(args...)...),
		config: l.config,
	}
}

// WithContext returns a new logger with context
func (l *slogLogger) WithContext(ctx context.Context) Logger {
	return &slogLogger{
		logger: l.logger.With("trace_id", getTraceID(ctx)),
		config: l.config,
	}
}

// convertArgs converts variadic interface{} args to slog.Attr pairs
func convertArgs(args ...interface{}) []any {
	if len(args)%2 != 0 {
		// If odd number of args, add a placeholder value
		args = append(args, "")
	}

	result := make([]any, 0, len(args))
	for i := 0; i < len(args); i += 2 {
		key := fmt.Sprintf("%v", args[i])
		value := args[i+1]
		result = append(result, key, value)
	}

	return result
}

// getTraceID extracts trace ID from context (placeholder implementation)
func getTraceID(ctx context.Context) string {
	if ctx == nil {
		return ""
	}
	
	// In a real implementation, you would extract trace ID from context
	// For example, from OpenTelemetry: trace.SpanFromContext(ctx).SpanContext().TraceID()
	return "trace-id-placeholder"
}

// DefaultLogger creates a default logger
func DefaultLogger() Logger {
	return New(Config{
		Level:  InfoLevel,
		Format: JSONFormat,
		Output: "stdout",
	})
}