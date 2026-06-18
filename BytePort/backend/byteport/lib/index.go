// Package lib provides core functionality for BytePort including
// authentication, encryption, GitHub integration, and API validation.
//
// # Exports
//
// This package exports the following public functions:
//
// Authentication & Token Management:
//
//	InitAuthSystem() error
//	GenerateToken(user models.User) (string, error)
//	GenerateNVMSToken(project models.Project) (string, error)
//	AuthenticateRequest(encryptedToken string) (*models.User, error)
//	ValidateToken(encryptedToken string) (bool, *paseto.Token, error)
//	ValidateServiceToken(encryptedToken string) (bool, *paseto.Token, error)
//	AuthMiddleware() gin.HandlerFunc
//
// Encryption & Secrets:
//
//	EncryptPass(password string) string
//	ValidatePass(password, hash string) bool
//	GetDecodedEncryptionKey() ([]byte, error)
//	EncryptSecret(secret string) (string, error)
//	DecryptSecret(cipherText string) (string, error)
//	GenerateEncryptionKey() (string, error)
//	SetEncryptionKeyEnvVar(key string) error
//	InitializeEncryptionKey() error
//	PersistEncryptionKey(key string) error
//
// GitHub Integration:
//
//	ListRepositories(accessToken string) (string, error)
//	LinkWithGithub(c *gin.Context, user models.User)
//	GenerateGitPaseto(user models.User) (string, error)
//	GetUserAccessToken(pasetoToken, code string) (models.Git, error)
//	StartTokenRefreshJob()
//
// API Validation:
//
//	ValidatePortfolioAPI(rootEndpoint, apiKey string) error
//	ValidateGit(user models.User) error
//	ValidateGitRepo(repoURL, installationToken string) error
//	ValidateOpenAICredentials(apiToken string) error
//	ValidateAWSCredentials(accessKey, secretKey string) error
//
// Error Types:
//
//	ErrInvalidHash - returned when the encoded hash is not in the correct format
//	ErrIncompatibleVersion - returned when the argon2 version is incompatible
//
// Types:
// (see auth.go for NVMSAuthHeader and other authentication types)
package lib
