package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"kwality/internal/database"
	"kwality/internal/middleware"
	"kwality/pkg/logger"
)

// AuthHandler handles authentication requests
type AuthHandler struct {
	logger    logger.Logger
	dbManager *database.Manager
	jwtSecret string
}

// NewAuthHandler creates a new auth handler
func NewAuthHandler(logger logger.Logger, dbManager *database.Manager, jwtSecret string) *AuthHandler {
	return &AuthHandler{
		logger:    logger,
		dbManager: dbManager,
		jwtSecret: jwtSecret,
	}
}

// LoginRequest represents a login request
type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// RegisterRequest represents a registration request
type RegisterRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=8"`
	FullName string `json:"full_name" binding:"required"`
}

// LoginResponse represents a login response
type LoginResponse struct {
	Token        string    `json:"token"`
	RefreshToken string    `json:"refresh_token"`
	ExpiresAt    time.Time `json:"expires_at"`
	User         UserInfo  `json:"user"`
}

// UserInfo represents user information
type UserInfo struct {
	ID       string `json:"id"`
	Email    string `json:"email"`
	FullName string `json:"full_name"`
	Role     string `json:"role"`
}

// Login handles user login
func (h *AuthHandler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":     "Bad Request",
			"message":   "Invalid request format",
			"details":   err.Error(),
			"timestamp": time.Now().Format(time.RFC3339),
		})
		return
	}

	// Get user from database
	user, err := h.getUserByEmail(req.Email)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":     "Unauthorized",
			"message":   "Invalid credentials",
			"timestamp": time.Now().Format(time.RFC3339),
		})
		return
	}

	// Verify password
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":     "Unauthorized",
			"message":   "Invalid credentials",
			"timestamp": time.Now().Format(time.RFC3339),
		})
		return
	}

	// Generate JWT token
	token, expiresAt, err := h.generateToken(user.ID, user.Email, user.Role)
	if err != nil {
		h.logger.Error("Failed to generate token", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":     "Internal Server Error",
			"message":   "Failed to generate authentication token",
			"timestamp": time.Now().Format(time.RFC3339),
		})
		return
	}

	// Generate refresh token (simplified)
	refreshToken := uuid.New().String()

	// Update last login time
	h.updateLastLogin(user.ID)

	h.logger.Info("User logged in", "user_id", user.ID, "email", user.Email)

	c.JSON(http.StatusOK, LoginResponse{
		Token:        token,
		RefreshToken: refreshToken,
		ExpiresAt:    expiresAt,
		User: UserInfo{
			ID:       user.ID,
			Email:    user.Email,
			FullName: user.FullName,
			Role:     user.Role,
		},
	})
}

// Register handles user registration
func (h *AuthHandler) Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":     "Bad Request",
			"message":   "Invalid request format",
			"details":   err.Error(),
			"timestamp": time.Now().Format(time.RFC3339),
		})
		return
	}

	// Check if user already exists
	existingUser, _ := h.getUserByEmail(req.Email)
	if existingUser != nil {
		c.JSON(http.StatusConflict, gin.H{
			"error":     "Conflict",
			"message":   "User with this email already exists",
			"timestamp": time.Now().Format(time.RFC3339),
		})
		return
	}

	// Hash password
	passwordHash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		h.logger.Error("Failed to hash password", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":     "Internal Server Error",
			"message":   "Failed to process registration",
			"timestamp": time.Now().Format(time.RFC3339),
		})
		return
	}

	// Create user
	userID := uuid.New().String()
	err = h.createUser(userID, req.Email, req.FullName, string(passwordHash))
	if err != nil {
		h.logger.Error("Failed to create user", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":     "Internal Server Error",
			"message":   "Failed to create user account",
			"timestamp": time.Now().Format(time.RFC3339),
		})
		return
	}

	h.logger.Info("User registered", "user_id", userID, "email", req.Email)

	c.JSON(http.StatusCreated, gin.H{
		"message":   "User registered successfully",
		"user_id":   userID,
		"timestamp": time.Now().Format(time.RFC3339),
	})
}

// RefreshToken handles token refresh
func (h *AuthHandler) RefreshToken(c *gin.Context) {
	// Simplified refresh token implementation
	c.JSON(http.StatusNotImplemented, gin.H{
		"error":     "Not Implemented",
		"message":   "Token refresh not yet implemented",
		"timestamp": time.Now().Format(time.RFC3339),
	})
}

// Logout handles user logout
func (h *AuthHandler) Logout(c *gin.Context) {
	// In a JWT implementation, logout is typically handled client-side
	// Server-side logout would require token blacklisting
	c.JSON(http.StatusOK, gin.H{
		"message":   "Logged out successfully",
		"timestamp": time.Now().Format(time.RFC3339),
	})
}

// User represents a user record
type User struct {
	ID           string    `json:"id"`
	Email        string    `json:"email"`
	FullName     string    `json:"full_name"`
	PasswordHash string    `json:"password_hash"`
	Role         string    `json:"role"`
	IsActive     bool      `json:"is_active"`
	CreatedAt    time.Time `json:"created_at"`
	LastLoginAt  *time.Time `json:"last_login_at"`
}

// getUserByEmail retrieves a user by email
func (h *AuthHandler) getUserByEmail(email string) (*User, error) {
	query := `
		SELECT id, email, full_name, password_hash, role, is_active, created_at, last_login_at
		FROM users 
		WHERE email = $1 AND is_active = true
	`

	var user User
	err := h.dbManager.QueryRow(query, email).Scan(
		&user.ID,
		&user.Email,
		&user.FullName,
		&user.PasswordHash,
		&user.Role,
		&user.IsActive,
		&user.CreatedAt,
		&user.LastLoginAt,
	)

	if err != nil {
		return nil, err
	}

	return &user, nil
}

// createUser creates a new user
func (h *AuthHandler) createUser(userID, email, fullName, passwordHash string) error {
	query := `
		INSERT INTO users (id, email, full_name, password_hash, role, is_active, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, NOW())
	`

	_, err := h.dbManager.Exec(query, userID, email, fullName, passwordHash, "user", true)
	return err
}

// updateLastLogin updates the user's last login time
func (h *AuthHandler) updateLastLogin(userID string) {
	query := "UPDATE users SET last_login_at = NOW() WHERE id = $1"
	_, err := h.dbManager.Exec(query, userID)
	if err != nil {
		h.logger.Error("Failed to update last login", "user_id", userID, "error", err)
	}
}

// generateToken generates a JWT token
func (h *AuthHandler) generateToken(userID, email, role string) (string, time.Time, error) {
	expiresAt := time.Now().Add(24 * time.Hour) // 24 hour expiration

	claims := &middleware.Claims{
		UserID: userID,
		Email:  email,
		Role:   role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
			Issuer:    "kwality-platform",
			Subject:   userID,
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(h.jwtSecret))
	if err != nil {
		return "", time.Time{}, err
	}

	return tokenString, expiresAt, nil
}