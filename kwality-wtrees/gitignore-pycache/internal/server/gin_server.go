package server

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"golang.org/x/time/rate"

	"kwality/internal/database"
	"kwality/internal/handlers"
	"kwality/internal/middleware"
	"kwality/internal/orchestrator"
	"kwality/internal/validation"
	"kwality/pkg/logger"
)

// Server represents the HTTP server
type Server struct {
	router          *gin.Engine
	httpServer      *http.Server
	logger          logger.Logger
	dbManager       *database.Manager
	validationEngine *validation.Engine
	wsUpgrader      websocket.Upgrader
	wsClients       map[*websocket.Conn]bool
	wsClientsMutex  sync.RWMutex
	config          *Config
}

// Config holds server configuration
type Config struct {
	Port               int                       `json:"port"`
	Environment        string                    `json:"environment"`
	AllowedOrigins     []string                  `json:"allowed_origins"`
	JWTSecret          string                    `json:"jwt_secret"`
	RateLimitRPS       int                       `json:"rate_limit_rps"`
	RateLimitBurst     int                       `json:"rate_limit_burst"`
	AuthRateLimitRPS   int                       `json:"auth_rate_limit_rps"`
	AuthRateLimitBurst int                       `json:"auth_rate_limit_burst"`
	ReadTimeout        int                       `json:"read_timeout"`
	WriteTimeout       int                       `json:"write_timeout"`
	IdleTimeout        int                       `json:"idle_timeout"`
	Orchestrator       *orchestrator.Orchestrator `json:"-"`
	Logger             logger.Logger              `json:"-"`
}

// NewServer creates a new HTTP server
func NewServer(logger logger.Logger, dbManager *database.Manager, config *Config) (*Server, error) {
	// Set gin mode
	if config.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	} else {
		gin.SetMode(gin.DebugMode)
	}

	// Create router
	router := gin.New()

	// Create validation engine
	validationEngine, err := validation.NewEngine(logger, dbManager)
	if err != nil {
		return nil, fmt.Errorf("failed to create validation engine: %w", err)
	}

	// WebSocket upgrader
	wsUpgrader := websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			// Allow all origins for now (should be configurable)
			return true
		},
	}

	server := &Server{
		router:           router,
		logger:           logger,
		dbManager:        dbManager,
		validationEngine: validationEngine,
		wsUpgrader:       wsUpgrader,
		wsClients:        make(map[*websocket.Conn]bool),
		config:           config,
	}

	// Setup middleware
	server.setupMiddleware()

	// Setup routes
	server.setupRoutes()

	// Create HTTP server
	server.httpServer = &http.Server{
		Addr:         fmt.Sprintf(":%d", config.Port),
		Handler:      router,
		ReadTimeout:  time.Duration(config.ReadTimeout) * time.Second,
		WriteTimeout: time.Duration(config.WriteTimeout) * time.Second,
		IdleTimeout:  time.Duration(config.IdleTimeout) * time.Second,
	}

	return server, nil
}

// NewHandler creates a new HTTP handler for testing
func NewHandler(config Config) http.Handler {
	// Set gin mode
	gin.SetMode(gin.TestMode)

	// Create router
	router := gin.New()

	// Basic recovery middleware
	router.Use(gin.Recovery())

	// Setup test routes
	setupTestRoutes(router, config)

	return router
}

// setupTestRoutes configures routes for testing
func setupTestRoutes(router *gin.Engine, config Config) {
	// Health check endpoint
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":    "healthy",
			"timestamp": time.Now().Format(time.RFC3339),
			"version":   "1.0.0",
		})
	})

	// API routes
	v1 := router.Group("/api/v1")
	{
		// Validation routes
		validate := v1.Group("/validate")
		{
			// Submit validation request
			validate.POST("/codebase", func(c *gin.Context) {
				var req map[string]interface{}
				if err := c.ShouldBindJSON(&req); err != nil {
					c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
					return
				}

				// Generate task ID
				taskID := fmt.Sprintf("task_%d", time.Now().UnixNano())

				// Submit to orchestrator if available
				if config.Orchestrator != nil {
					// TODO: Convert request to codebase and config
					// This is simplified for testing - implement actual orchestrator submission
					_ = config.Orchestrator // Suppress unused variable warning for now
				}

				c.JSON(http.StatusAccepted, gin.H{
					"task_id":      taskID,
					"status":       "pending",
					"submitted_at": time.Now().Format(time.RFC3339),
				})
			})

			// Get validation result
			validate.GET("/:id", func(c *gin.Context) {
				taskID := c.Param("id")

				// Get result from orchestrator if available
				if config.Orchestrator != nil {
					result, err := config.Orchestrator.GetValidationResult(taskID)
					if err != nil {
						c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
						return
					}
					c.JSON(http.StatusOK, result)
					return
				}

				// Mock response for testing
				c.JSON(http.StatusOK, gin.H{
					"task_id":       taskID,
					"status":        "completed",
					"overall_score": 85.0,
					"quality_gate":  true,
					"engine_results": map[string]interface{}{
						"static_analysis": map[string]interface{}{
							"engine_name": "static_analysis",
							"status":      "completed",
							"score":       85.0,
						},
					},
					"findings": []interface{}{},
				})
			})
		}
	}
}

// setupMiddleware configures middleware
func (s *Server) setupMiddleware() {
	// Recovery middleware
	s.router.Use(gin.Recovery())

	// Logger middleware
	s.router.Use(gin.LoggerWithConfig(gin.LoggerConfig{
		Formatter: func(param gin.LogFormatterParams) string {
			return fmt.Sprintf("%s - [%s] \"%s %s %s %d %s \"%s\" %s\"\n",
				param.ClientIP,
				param.TimeStamp.Format(time.RFC3339),
				param.Method,
				param.Path,
				param.Request.Proto,
				param.StatusCode,
				param.Latency,
				param.Request.UserAgent(),
				param.ErrorMessage,
			)
		},
	}))

	// CORS middleware
	corsConfig := cors.DefaultConfig()
	if len(s.config.AllowedOrigins) > 0 {
		corsConfig.AllowOrigins = s.config.AllowedOrigins
	} else {
		corsConfig.AllowAllOrigins = true
	}
	corsConfig.AllowCredentials = true
	corsConfig.AllowHeaders = []string{"Origin", "Content-Length", "Content-Type", "Authorization", "X-API-Key"}
	corsConfig.AllowMethods = []string{"GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"}
	s.router.Use(cors.New(corsConfig))

	// Rate limiting middleware
	rateLimiter := rate.NewLimiter(rate.Limit(s.config.RateLimitRPS), s.config.RateLimitBurst)
	s.router.Use(middleware.RateLimiterMiddleware(rateLimiter))

	// Request ID middleware
	s.router.Use(middleware.RequestIDMiddleware())

	// Security headers middleware
	s.router.Use(middleware.SecurityHeadersMiddleware())
}

// setupRoutes configures all routes
func (s *Server) setupRoutes() {
	// Health check endpoint
	s.router.GET("/health", s.healthCheckHandler)

	// Metrics endpoint
	s.router.GET("/metrics", gin.WrapH(promhttp.Handler()))

	// Root endpoint
	s.router.GET("/", s.rootHandler)

	// WebSocket endpoint
	s.router.GET("/ws", s.websocketHandler)

	// API routes
	v1 := s.router.Group("/api/v1")
	{
		// Auth routes (with specific rate limiter)
		authLimiter := rate.NewLimiter(rate.Limit(s.config.AuthRateLimitRPS), s.config.AuthRateLimitBurst)
		auth := v1.Group("/auth")
		auth.Use(middleware.RateLimiterMiddleware(authLimiter))
		{
			authHandler := handlers.NewAuthHandler(s.logger, s.dbManager, s.config.JWTSecret)
			auth.POST("/login", authHandler.Login)
			auth.POST("/register", authHandler.Register)
			auth.POST("/refresh", authHandler.RefreshToken)
			auth.POST("/logout", authHandler.Logout)
		}

		// Protected routes
		protected := v1.Group("/")
		protected.Use(middleware.AuthMiddleware(s.config.JWTSecret))
		{
			// User routes
			users := protected.Group("/users")
			{
				userHandler := handlers.NewUserHandler(s.logger, s.dbManager)
				users.GET("/profile", userHandler.GetProfile)
				users.PUT("/profile", userHandler.UpdateProfile)
				users.GET("/:id", userHandler.GetUser)
			}

			// Project routes
			projects := protected.Group("/projects")
			{
				projectHandler := handlers.NewProjectHandler(s.logger, s.dbManager)
				projects.GET("/", projectHandler.GetProjects)
				projects.POST("/", projectHandler.CreateProject)
				projects.GET("/:id", projectHandler.GetProject)
				projects.PUT("/:id", projectHandler.UpdateProject)
				projects.DELETE("/:id", projectHandler.DeleteProject)
			}

			// Validation routes
			validation := protected.Group("/validation")
			{
				validationHandler := handlers.NewValidationHandler(s.logger, s.dbManager, s.validationEngine)
				
				// Validation targets
				targets := validation.Group("/targets")
				{
					targets.GET("/", validationHandler.GetTargets)
					targets.POST("/", validationHandler.CreateTarget)
					targets.GET("/:id", validationHandler.GetTarget)
					targets.PUT("/:id", validationHandler.UpdateTarget)
					targets.DELETE("/:id", validationHandler.DeleteTarget)
				}

				// Validation suites
				suites := validation.Group("/suites")
				{
					suites.GET("/", validationHandler.GetSuites)
					suites.POST("/", validationHandler.CreateSuite)
					suites.GET("/:id", validationHandler.GetSuite)
					suites.PUT("/:id", validationHandler.UpdateSuite)
					suites.DELETE("/:id", validationHandler.DeleteSuite)
				}

				// Tests
				tests := validation.Group("/tests")
				{
					tests.GET("/", validationHandler.GetTests)
					tests.POST("/", validationHandler.CreateTest)
					tests.GET("/:id", validationHandler.GetTest)
					tests.PUT("/:id", validationHandler.UpdateTest)
					tests.DELETE("/:id", validationHandler.DeleteTest)
				}

				// Validation execution
				validation.POST("/execute", validationHandler.ExecuteValidation)
				validation.GET("/executions/:id", validationHandler.GetExecutionResults)
				validation.GET("/executions", validationHandler.GetExecutions)
			}

			// Knowledge Graph routes
			knowledgeGraph := protected.Group("/knowledge-graph")
			{
				kgHandler := handlers.NewKnowledgeGraphHandler(s.logger, s.dbManager)
				knowledgeGraph.GET("/nodes", kgHandler.GetNodes)
				knowledgeGraph.POST("/nodes", kgHandler.CreateNode)
				knowledgeGraph.GET("/relationships", kgHandler.GetRelationships)
				knowledgeGraph.POST("/relationships", kgHandler.CreateRelationship)
				knowledgeGraph.GET("/query", kgHandler.QueryGraph)
			}

			// Metrics routes
			metrics := protected.Group("/metrics")
			{
				metricsHandler := handlers.NewMetricsHandler(s.logger, s.dbManager)
				metrics.GET("/dashboard", metricsHandler.GetDashboardMetrics)
				metrics.GET("/validation", metricsHandler.GetValidationMetrics)
				metrics.GET("/performance", metricsHandler.GetPerformanceMetrics)
			}

			// Admin routes
			admin := protected.Group("/admin")
			admin.Use(middleware.AdminMiddleware())
			{
				adminHandler := handlers.NewAdminHandler(s.logger, s.dbManager)
				admin.GET("/users", adminHandler.GetUsers)
				admin.PUT("/users/:id", adminHandler.UpdateUser)
				admin.DELETE("/users/:id", adminHandler.DeleteUser)
				admin.GET("/system", adminHandler.GetSystemInfo)
				admin.POST("/system/maintenance", adminHandler.SetMaintenanceMode)
			}
		}
	}

	// 404 handler
	s.router.NoRoute(func(c *gin.Context) {
		c.JSON(http.StatusNotFound, gin.H{
			"error":     "Not Found",
			"message":   fmt.Sprintf("Route %s not found", c.Request.URL.Path),
			"timestamp": time.Now().Format(time.RFC3339),
		})
	})
}

// rootHandler handles the root endpoint
func (s *Server) rootHandler(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"name":        "Kwality LLM Validation Platform API",
		"version":     "1.0.0",
		"environment": s.config.Environment,
		"timestamp":   time.Now().Format(time.RFC3339),
		"endpoints": gin.H{
			"health":  "/health",
			"metrics": "/metrics",
			"docs":    "/api/v1/docs",
			"ws":      "/ws",
		},
	})
}

// healthCheckHandler handles health check requests
func (s *Server) healthCheckHandler(c *gin.Context) {
	healthStatus := s.dbManager.GetHealthStatus()
	
	status := http.StatusOK
	if healthStatus.Overall != "healthy" {
		status = http.StatusServiceUnavailable
	}
	
	c.JSON(status, gin.H{
		"status":     healthStatus.Overall,
		"timestamp":  time.Now().Format(time.RFC3339),
		"databases":  healthStatus,
		"version":    "1.0.0",
		"uptime":     time.Since(time.Now()).String(), // This should be actual uptime
	})
}

// websocketHandler handles WebSocket connections
func (s *Server) websocketHandler(c *gin.Context) {
	conn, err := s.wsUpgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		s.logger.Error("WebSocket upgrade failed", "error", err)
		return
	}
	defer func() {
		if err := conn.Close(); err != nil {
			s.logger.Error("Failed to close WebSocket connection", "error", err)
		}
	}()

	// Register client
	s.wsClientsMutex.Lock()
	s.wsClients[conn] = true
	s.wsClientsMutex.Unlock()

	// Cleanup on disconnect
	defer func() {
		s.wsClientsMutex.Lock()
		delete(s.wsClients, conn)
		s.wsClientsMutex.Unlock()
	}()

	s.logger.Info("WebSocket connection established")

	// Send welcome message
	err = conn.WriteJSON(map[string]interface{}{
		"type":      "welcome",
		"message":   "Connected to Kwality LLM Validation Platform WebSocket",
		"timestamp": time.Now().Format(time.RFC3339),
	})
	if err != nil {
		s.logger.Error("Failed to send welcome message", "error", err)
		return
	}

	// Handle messages
	for {
		var msg map[string]interface{}
		err := conn.ReadJSON(&msg)
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				s.logger.Error("WebSocket read error", "error", err)
			}
			break
		}

		s.handleWebSocketMessage(conn, msg)
	}
}

// handleWebSocketMessage handles incoming WebSocket messages
func (s *Server) handleWebSocketMessage(conn *websocket.Conn, msg map[string]interface{}) {
	msgType, ok := msg["type"].(string)
	if !ok {
		s.sendWebSocketError(conn, "Invalid message format: missing type")
		return
	}

	switch msgType {
	case "subscribe":
		validationID, ok := msg["validation_id"].(string)
		if !ok {
			s.sendWebSocketError(conn, "Invalid subscription: missing validation_id")
			return
		}
		// Store subscription info (you might want to use a more sophisticated approach)
		s.logger.Info("WebSocket subscribed to validation", "validation_id", validationID)
		
	case "unsubscribe":
		s.logger.Info("WebSocket unsubscribed from validation updates")
		
	case "ping":
		err := conn.WriteJSON(map[string]interface{}{
			"type":      "pong",
			"timestamp": time.Now().Format(time.RFC3339),
		})
		if err != nil {
			s.logger.Error("Failed to send pong", "error", err)
		}
		
	default:
		s.sendWebSocketError(conn, fmt.Sprintf("Unknown message type: %s", msgType))
	}
}

// sendWebSocketError sends an error message via WebSocket
func (s *Server) sendWebSocketError(conn *websocket.Conn, message string) {
	err := conn.WriteJSON(map[string]interface{}{
		"type":      "error",
		"message":   message,
		"timestamp": time.Now().Format(time.RFC3339),
	})
	if err != nil {
		s.logger.Error("Failed to send WebSocket error", "error", err)
	}
}

// BroadcastValidationUpdate broadcasts validation updates to WebSocket clients
func (s *Server) BroadcastValidationUpdate(validationID string, update interface{}) {
	s.wsClientsMutex.RLock()
	defer s.wsClientsMutex.RUnlock()

	message := map[string]interface{}{
		"type":          "validation_update",
		"validation_id": validationID,
		"update":        update,
		"timestamp":     time.Now().Format(time.RFC3339),
	}

	for conn := range s.wsClients {
		err := conn.WriteJSON(message)
		if err != nil {
			s.logger.Error("Failed to send WebSocket message", "error", err)
			// Remove failed connection
			delete(s.wsClients, conn)
			if err := conn.Close(); err != nil {
				s.logger.Error("Failed to close WebSocket connection", "error", err)
			}
		}
	}
}

// Start starts the HTTP server
func (s *Server) Start() error {
	s.logger.Info("Starting HTTP server", "port", s.config.Port, "environment", s.config.Environment)
	
	// Start server in a goroutine
	go func() {
		if err := s.httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			s.logger.Error("HTTP server failed to start", "error", err)
		}
	}()

	// Wait for interrupt signal to gracefully shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	s.logger.Info("Shutting down HTTP server...")

	// Graceful shutdown
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := s.httpServer.Shutdown(ctx); err != nil {
		s.logger.Error("HTTP server forced to shutdown", "error", err)
		return err
	}

	s.logger.Info("HTTP server shutdown complete")
	return nil
}

// Stop stops the HTTP server
func (s *Server) Stop() error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	return s.httpServer.Shutdown(ctx)
}