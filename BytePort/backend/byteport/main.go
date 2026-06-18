package main

import (
	"byteport/lib"
	"byteport/models"
	"byteport/routes"
	"context"
	"fmt"
	"os"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/stdout/stdouttrace"
	"go.opentelemetry.io/otel/sdk/trace"
)

// initTracer sets up the OTel tracer provider with a ConsoleSpanExporter.
func initTracer() (*trace.TracerProvider, error) {
	exporter, err := stdouttrace.New(stdouttrace.WithPrettyPrint())
	if err != nil {
		return nil, fmt.Errorf("failed to create stdouttrace exporter: %w", err)
	}
	tp := trace.NewTracerProvider(
		trace.WithBatcher(exporter),
	)
	otel.SetTracerProvider(tp)
	return tp, nil
}

func setupRouter() *gin.Engine {
	r := gin.Default()
	r.Use(cors.New(cors.Config{
		AllowOrigins: []string{
			"http://localhost:5173",
			"http://0.0.0.0:5173",
			"http://tauri.localhost",
			"http://tauri.0.0.0.0:5173",
			"http://localhost:8081",
			"http://0.0.0.0:8081",
			"http://10.0.2.2:5173",
			"http://10.0.2.2:8081",
			// Add other needed origins
		},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		AllowWildcard:    true, // Enable wildcard matching
		MaxAge:           12 * time.Hour,
	}))
	protected := r.Group("/")
	protected.Use(lib.AuthMiddleware())
	{

		protected.GET("/link", routes.LinkHandler)
		protected.POST("/link", routes.ValidateLink)
		protected.GET("/authenticate", routes.Authenticate)
		protected.GET("/instances", routes.GetInstances)
		protected.GET("/projects", routes.GetProjects)
		protected.GET("/api/github/repositories", routes.RetrieveRepositories)
		protected.POST("/deploy", routes.DeployProject)
		protected.POST("/terminate", routes.TerminateInstance)
		protected.GET("/user/:id/creds", routes.UpdateLink)
		protected.PUT("/user/:id/creds", routes.UpdateUser)
		//protected.GET("/github/status", routes.GitHubStatusHandler)
	}
	r.POST("/login", routes.Login)
	r.POST("/signup", routes.Signup)
	r.GET("/api/github/callback", routes.HandleCallback)

	// gh webhook at /api/github/auth/webhook

	return r
}

func main() {
	ctx := context.Background()

	tp, err := initTracer()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error initializing tracer: %v\n", err)
		os.Exit(1)
	}
	defer func() {
		if err := tp.Shutdown(ctx); err != nil {
			fmt.Fprintf(os.Stderr, "Error shutting down tracer: %v\n", err)
		}
	}()

	err = lib.InitializeEncryptionKey()
	if err != nil {
		fmt.Printf("Error initializing encryption key: %v\n", err)
		os.Exit(1)
	}

	models.ConnectDatabase()
	err = lib.InitAuthSystem()
	if err != nil {
		fmt.Printf("Error initializing auth system: %v\n", err)
		os.Exit(1)
	}
	var temp models.GitSecret
	result := models.DB.First(&temp) // Retrieve the first entry
	if result.Error != nil {
		if result.RowsAffected == 0 {
			fmt.Println("No entries found in git_secrets table.")
		} else {
			fmt.Printf("Error retrieving data from git_secrets table: %v\n", result.Error)
		}
		os.Exit(1)
	}
	//models.DB.Exec("Delete from projects")
	r := setupRouter()
	//models.DB.Exec("Delete from users")

	go lib.StartTokenRefreshJob()
	if err := r.Run("0.0.0.0:8081"); err != nil {
		fmt.Printf("Error starting server: %v\n", err)
		os.Exit(1)
	}
}
