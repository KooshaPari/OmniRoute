// Package observability provides structured logging, correlation IDs, and OTel hooks.
package observability

import (
	"context"
	"io"
	"log/slog"
	"os"
	"strings"
	"sync"
	"time"
)

type ctxKey int

const (
	correlationIDKey ctxKey = iota
	loggerKey
)

var (
	once   sync.Once
	defLog *slog.Logger
)

// New returns a JSON logger writing to w at the given level.
// Empty level defaults to INFO.
func New(w io.Writer, level string) *slog.Logger {
	if w == nil {
		w = os.Stderr
	}
	lvl := slog.LevelInfo
	switch strings.ToUpper(level) {
	case "DEBUG":
		lvl = slog.LevelDebug
	case "WARN", "WARNING":
		lvl = slog.LevelWarn
	case "ERROR":
		lvl = slog.LevelError
	}
	h := slog.NewJSONHandler(w, &slog.HandlerOptions{Level: lvl, AddSource: false})
	return slog.New(h)
}

// Default returns a process-wide JSON logger, initialized once on first use.
func Default() *slog.Logger {
	once.Do(func() {
		defLog = New(os.Stderr, os.Getenv("OMNIROUTE_LOG_LEVEL"))
	})
	return defLog
}

// WithCorrelationID returns a context carrying the given correlation ID.
func WithCorrelationID(ctx context.Context, id string) context.Context {
	return context.WithValue(ctx, correlationIDKey, id)
}

// CorrelationID extracts the correlation ID from ctx, or "" if none.
func CorrelationID(ctx context.Context) string {
	if v, ok := ctx.Value(correlationIDKey).(string); ok {
		return v
	}
	return ""
}

// WithLogger attaches a per-request logger to ctx.
func WithLogger(ctx context.Context, l *slog.Logger) context.Context {
	return context.WithValue(ctx, loggerKey, l)
}

// LoggerFrom returns the per-request logger, or Default if none.
func LoggerFrom(ctx context.Context) *slog.Logger {
	if v, ok := ctx.Value(loggerKey).(*slog.Logger); ok {
		return v
	}
	return Default()
}

// Timer is a tiny helper that records the elapsed duration into a slog attribute.
type Timer struct {
	start time.Time
}

func StartTimer() Timer                          { return Timer{start: time.Now()} }
func (t Timer) Attr(op string) slog.Attr        { return slog.Duration(op+"_elapsed", time.Since(t.start)) }
func (t Timer) Since() time.Duration            { return time.Since(t.start) }
