package database

import (
	"context"
	"database/sql"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/go-redis/redis/v8"
	_ "github.com/lib/pq"
	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
	"kwality/pkg/logger"
)

// Config holds database configuration
type Config struct {
	PostgreSQL PostgreSQLConfig `json:"postgresql"`
	Redis      RedisConfig      `json:"redis"`
	Neo4j      Neo4jConfig      `json:"neo4j"`
}

// PostgreSQLConfig holds PostgreSQL configuration
type PostgreSQLConfig struct {
	Host               string `json:"host"`
	Port               int    `json:"port"`
	Database           string `json:"database"`
	User               string `json:"user"`
	Password           string `json:"password"`
	MaxConnections     int    `json:"max_connections"`
	MaxIdleConnections int    `json:"max_idle_connections"`
	ConnMaxLifetime    string `json:"conn_max_lifetime"`
	SSLMode            string `json:"ssl_mode"`
}

// RedisConfig holds Redis configuration
type RedisConfig struct {
	Host        string `json:"host"`
	Port        int    `json:"port"`
	Password    string `json:"password"`
	DB          int    `json:"db"`
	PoolSize    int    `json:"pool_size"`
	IdleTimeout string `json:"idle_timeout"`
}

// Neo4jConfig holds Neo4j configuration
type Neo4jConfig struct {
	URI      string `json:"uri"`
	User     string `json:"user"`
	Password string `json:"password"`
	Database string `json:"database"`
}

// Manager manages database connections and operations
type Manager struct {
	logger   logger.Logger
	config   Config
	postgres *sql.DB
	redis    *redis.Client
	neo4j    neo4j.DriverWithContext
}

// HealthStatus represents database health status
type HealthStatus struct {
	Status    string    `json:"status"`
	Error     string    `json:"error,omitempty"`
	Timestamp time.Time `json:"timestamp"`
}

// OverallHealth represents overall database health
type OverallHealth struct {
	PostgreSQL HealthStatus `json:"postgresql"`
	Redis      HealthStatus `json:"redis"`
	Neo4j      HealthStatus `json:"neo4j"`
	Overall    string       `json:"overall"`
}

// NewManager creates a new database manager
func NewManager(logger logger.Logger, config Config) (*Manager, error) {
	manager := &Manager{
		logger: logger,
		config: config,
	}

	if err := manager.initializeConnections(); err != nil {
		return nil, fmt.Errorf("failed to initialize database connections: %w", err)
	}

	return manager, nil
}

// initializeConnections initializes database connections
func (m *Manager) initializeConnections() error {
	// Initialize PostgreSQL
	if err := m.initPostgreSQL(); err != nil {
		return fmt.Errorf("failed to initialize PostgreSQL: %w", err)
	}

	// Initialize Redis
	if err := m.initRedis(); err != nil {
		return fmt.Errorf("failed to initialize Redis: %w", err)
	}

	// Initialize Neo4j (optional)
	if err := m.initNeo4j(); err != nil {
		m.logger.Warn("Failed to initialize Neo4j (optional for MVP)", "error", err)
	}

	// Run migrations
	if err := m.runMigrations(); err != nil {
		return fmt.Errorf("failed to run migrations: %w", err)
	}

	m.logger.Info("Database connections initialized successfully")
	return nil
}

// initPostgreSQL initializes PostgreSQL connection
func (m *Manager) initPostgreSQL() error {
	connStr := fmt.Sprintf(
		"host=%s port=%d dbname=%s user=%s password=%s sslmode=%s",
		m.config.PostgreSQL.Host,
		m.config.PostgreSQL.Port,
		m.config.PostgreSQL.Database,
		m.config.PostgreSQL.User,
		m.config.PostgreSQL.Password,
		m.config.PostgreSQL.SSLMode,
	)

	db, err := sql.Open("postgres", connStr)
	if err != nil {
		return fmt.Errorf("failed to open PostgreSQL connection: %w", err)
	}

	// Configure connection pool
	db.SetMaxOpenConns(m.config.PostgreSQL.MaxConnections)
	db.SetMaxIdleConns(m.config.PostgreSQL.MaxIdleConnections)
	
	if m.config.PostgreSQL.ConnMaxLifetime != "" {
		lifetime, err := time.ParseDuration(m.config.PostgreSQL.ConnMaxLifetime)
		if err == nil {
			db.SetConnMaxLifetime(lifetime)
		}
	}

	// Test connection
	if err := db.Ping(); err != nil {
		return fmt.Errorf("failed to ping PostgreSQL: %w", err)
	}

	m.postgres = db
	m.logger.Info("PostgreSQL connection established")
	return nil
}

// initRedis initializes Redis connection
func (m *Manager) initRedis() error {
	idleTimeout := 5 * time.Minute
	if m.config.Redis.IdleTimeout != "" {
		if duration, err := time.ParseDuration(m.config.Redis.IdleTimeout); err == nil {
			idleTimeout = duration
		}
	}

	rdb := redis.NewClient(&redis.Options{
		Addr:         fmt.Sprintf("%s:%d", m.config.Redis.Host, m.config.Redis.Port),
		Password:     m.config.Redis.Password,
		DB:           m.config.Redis.DB,
		PoolSize:     m.config.Redis.PoolSize,
		IdleTimeout:  idleTimeout,
		ReadTimeout:  3 * time.Second,
		WriteTimeout: 3 * time.Second,
	})

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := rdb.Ping(ctx).Err(); err != nil {
		return fmt.Errorf("failed to connect to Redis: %w", err)
	}

	m.redis = rdb
	m.logger.Info("Redis connection established")
	return nil
}

// initNeo4j initializes Neo4j connection
func (m *Manager) initNeo4j() error {
	driver, err := neo4j.NewDriverWithContext(
		m.config.Neo4j.URI,
		neo4j.BasicAuth(m.config.Neo4j.User, m.config.Neo4j.Password, ""),
	)
	if err != nil {
		return fmt.Errorf("failed to create Neo4j driver: %w", err)
	}

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := driver.VerifyConnectivity(ctx); err != nil {
		return fmt.Errorf("failed to verify Neo4j connectivity: %w", err)
	}

	m.neo4j = driver
	m.logger.Info("Neo4j connection established")
	return nil
}

// runMigrations runs database migrations
func (m *Manager) runMigrations() error {
	m.logger.Info("Running database migrations...")

	// Check if migrations table exists
	var exists bool
	err := m.postgres.QueryRow(`
		SELECT EXISTS (
			SELECT FROM information_schema.tables 
			WHERE table_name = 'migrations'
		)
	`).Scan(&exists)
	if err != nil {
		return fmt.Errorf("failed to check migrations table: %w", err)
	}

	if !exists {
		// Create migrations table
		_, err := m.postgres.Exec(`
			CREATE TABLE migrations (
				id SERIAL PRIMARY KEY,
				filename VARCHAR(255) NOT NULL UNIQUE,
				executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
			)
		`)
		if err != nil {
			return fmt.Errorf("failed to create migrations table: %w", err)
		}
		m.logger.Info("Created migrations table")
	}

	// Get executed migrations
	rows, err := m.postgres.Query("SELECT filename FROM migrations ORDER BY id")
	if err != nil {
		return fmt.Errorf("failed to get executed migrations: %w", err)
	}
	defer func() {
		if err := rows.Close(); err != nil {
			m.logger.Error("Failed to close rows", "error", err)
		}
	}()

	executedMigrations := make(map[string]bool)
	for rows.Next() {
		var filename string
		if err := rows.Scan(&filename); err != nil {
			return fmt.Errorf("failed to scan migration filename: %w", err)
		}
		executedMigrations[filename] = true
	}

	// Get migration files
	migrationDir := "database/schema"
	if _, err := os.Stat(migrationDir); os.IsNotExist(err) {
		m.logger.Info("No migration directory found, skipping migrations")
		return nil
	}

	migrationFiles, err := getMigrationFiles(migrationDir)
	if err != nil {
		return fmt.Errorf("failed to get migration files: %w", err)
	}

	// Execute pending migrations
	for _, file := range migrationFiles {
		if !executedMigrations[file] {
			if err := m.executeMigration(migrationDir, file); err != nil {
				return fmt.Errorf("failed to execute migration %s: %w", file, err)
			}
		}
	}

	m.logger.Info("All migrations completed successfully")
	return nil
}

// getMigrationFiles gets sorted migration files
func getMigrationFiles(dir string) ([]string, error) {
	var files []string
	
	err := filepath.WalkDir(dir, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if !d.IsDir() && strings.HasSuffix(d.Name(), ".sql") {
			files = append(files, d.Name())
		}
		return nil
	})
	
	if err != nil {
		return nil, err
	}
	
	sort.Strings(files)
	return files, nil
}

// executeMigration executes a single migration
func (m *Manager) executeMigration(migrationDir, filename string) error {
	m.logger.Info("Executing migration", "file", filename)

	// Read migration file
	migrationPath := filepath.Join(migrationDir, filename)
	migrationSQL, err := os.ReadFile(migrationPath)
	if err != nil {
		return fmt.Errorf("failed to read migration file: %w", err)
	}

	// Execute in transaction
	tx, err := m.postgres.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer func() {
		if err := tx.Rollback(); err != nil {
			m.logger.Warn("Failed to rollback transaction", "error", err)
		}
	}()

	// Execute migration SQL
	if _, err := tx.Exec(string(migrationSQL)); err != nil {
		return fmt.Errorf("failed to execute migration SQL: %w", err)
	}

	// Record migration
	if _, err := tx.Exec("INSERT INTO migrations (filename) VALUES ($1)", filename); err != nil {
		return fmt.Errorf("failed to record migration: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit migration: %w", err)
	}

	m.logger.Info("Migration executed successfully", "file", filename)
	return nil
}

// PostgreSQL operations

// Query executes a query and returns result
func (m *Manager) Query(query string, args ...interface{}) (*sql.Rows, error) {
	start := time.Now()
	rows, err := m.postgres.Query(query, args...)
	duration := time.Since(start)

	if duration > time.Second {
		m.logger.Warn("Slow query detected", "duration", duration, "query", query)
	}

	return rows, err
}

// QueryRow executes a query that returns a single row
func (m *Manager) QueryRow(query string, args ...interface{}) *sql.Row {
	return m.postgres.QueryRow(query, args...)
}

// Exec executes a query without returning rows
func (m *Manager) Exec(query string, args ...interface{}) (sql.Result, error) {
	return m.postgres.Exec(query, args...)
}

// Transaction executes a function within a database transaction
func (m *Manager) Transaction(fn func(*sql.Tx) error) error {
	tx, err := m.postgres.Begin()
	if err != nil {
		return err
	}
	defer func() {
		if err := tx.Rollback(); err != nil {
			m.logger.Warn("Failed to rollback transaction", "error", err)
		}
	}()

	if err := fn(tx); err != nil {
		return err
	}

	return tx.Commit()
}

// Redis operations

// CacheGet retrieves a value from cache
func (m *Manager) CacheGet(ctx context.Context, key string) (string, error) {
	result, err := m.redis.Get(ctx, key).Result()
	if err == redis.Nil {
		return "", nil // Key doesn't exist
	}
	return result, err
}

// CacheSet stores a value in cache with TTL
func (m *Manager) CacheSet(ctx context.Context, key string, value interface{}, ttl time.Duration) error {
	return m.redis.Set(ctx, key, value, ttl).Err()
}

// CacheDel deletes a key from cache
func (m *Manager) CacheDel(ctx context.Context, keys ...string) error {
	return m.redis.Del(ctx, keys...).Err()
}

// Neo4j operations

// Neo4jExecuteQuery executes a Neo4j query
func (m *Manager) Neo4jExecuteQuery(ctx context.Context, query string, params map[string]interface{}) (neo4j.ResultWithContext, error) {
	if m.neo4j == nil {
		return nil, fmt.Errorf("Neo4j driver not initialized")
	}
	
	session := m.neo4j.NewSession(ctx, neo4j.SessionConfig{
		DatabaseName: m.config.Neo4j.Database,
	})
	defer func() {
		if err := session.Close(ctx); err != nil {
			m.logger.Error("Failed to close Neo4j session", "error", err)
		}
	}()
	
	return session.Run(ctx, query, params)
}

// Neo4jExecuteReadTransaction executes a read transaction
func (m *Manager) Neo4jExecuteReadTransaction(ctx context.Context, work neo4j.ManagedTransactionWork) (interface{}, error) {
	if m.neo4j == nil {
		return nil, fmt.Errorf("Neo4j driver not initialized")
	}
	
	session := m.neo4j.NewSession(ctx, neo4j.SessionConfig{
		DatabaseName: m.config.Neo4j.Database,
	})
	defer func() {
		if err := session.Close(ctx); err != nil {
			m.logger.Error("Failed to close Neo4j session", "error", err)
		}
	}()
	
	return session.ExecuteRead(ctx, work)
}

// Neo4jExecuteWriteTransaction executes a write transaction
func (m *Manager) Neo4jExecuteWriteTransaction(ctx context.Context, work neo4j.ManagedTransactionWork) (interface{}, error) {
	if m.neo4j == nil {
		return nil, fmt.Errorf("Neo4j driver not initialized")
	}
	
	session := m.neo4j.NewSession(ctx, neo4j.SessionConfig{
		DatabaseName: m.config.Neo4j.Database,
	})
	defer func() {
		if err := session.Close(ctx); err != nil {
			m.logger.Error("Failed to close Neo4j session", "error", err)
		}
	}()
	
	return session.ExecuteWrite(ctx, work)
}

// Health checks

// CheckPostgreSQLHealth checks PostgreSQL health
func (m *Manager) CheckPostgreSQLHealth() HealthStatus {
	status := HealthStatus{Timestamp: time.Now()}
	
	if err := m.postgres.Ping(); err != nil {
		status.Status = "unhealthy"
		status.Error = err.Error()
	} else {
		status.Status = "healthy"
	}
	
	return status
}

// CheckRedisHealth checks Redis health
func (m *Manager) CheckRedisHealth() HealthStatus {
	status := HealthStatus{Timestamp: time.Now()}
	
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	
	if err := m.redis.Ping(ctx).Err(); err != nil {
		status.Status = "unhealthy"
		status.Error = err.Error()
	} else {
		status.Status = "healthy"
	}
	
	return status
}

// CheckNeo4jHealth checks Neo4j health
func (m *Manager) CheckNeo4jHealth() HealthStatus {
	status := HealthStatus{Timestamp: time.Now()}
	
	if m.neo4j == nil {
		status.Status = "unavailable"
		status.Error = "Neo4j driver not initialized"
		return status
	}
	
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	
	if err := m.neo4j.VerifyConnectivity(ctx); err != nil {
		status.Status = "unhealthy"
		status.Error = err.Error()
	} else {
		status.Status = "healthy"
	}
	
	return status
}

// GetHealthStatus returns overall database health status
func (m *Manager) GetHealthStatus() OverallHealth {
	postgresql := m.CheckPostgreSQLHealth()
	redis := m.CheckRedisHealth()
	neo4j := m.CheckNeo4jHealth()
	
	overall := "healthy"
	if postgresql.Status != "healthy" || redis.Status != "healthy" {
		overall = "degraded"
	}
	// Neo4j is optional, so we don't consider it for overall health
	
	return OverallHealth{
		PostgreSQL: postgresql,
		Redis:      redis,
		Neo4j:      neo4j,
		Overall:    overall,
	}
}

// Close closes all database connections
func (m *Manager) Close() error {
	var errs []error
	
	if m.postgres != nil {
		if err := m.postgres.Close(); err != nil {
			errs = append(errs, fmt.Errorf("failed to close PostgreSQL: %w", err))
		}
	}
	
	if m.redis != nil {
		if err := m.redis.Close(); err != nil {
			errs = append(errs, fmt.Errorf("failed to close Redis: %w", err))
		}
	}
	
	if m.neo4j != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := m.neo4j.Close(ctx); err != nil {
			errs = append(errs, fmt.Errorf("failed to close Neo4j: %w", err))
		}
	}
	
	if len(errs) > 0 {
		return fmt.Errorf("errors closing connections: %v", errs)
	}
	
	m.logger.Info("All database connections closed")
	return nil
}