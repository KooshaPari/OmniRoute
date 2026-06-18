# BytePort Library

Core functionality for BytePort backend services including authentication, encryption, GitHub integration, and API validation.

## Features

### Authentication & Token Management

- **PASETO Token Generation**: Secure token generation using PASETO v4
- **User Authentication**: Request validation and user extraction from tokens
- **NVMS Service Tokens**: Short-lived tokens for service-to-service communication
- **Gin Middleware**: Drop-in authentication middleware for HTTP handlers

### Encryption & Secrets

- **Password Hashing**: Argon2id-based password hashing with configurable parameters
- **Secret Encryption**: AES-CFB encryption for sensitive data storage
- **Key Management**: Generation, environment variable handling, and persistence

### GitHub Integration

- **OAuth Flow**: User authorization via GitHub OAuth
- **Repository Access**: List and validate repository access
- **Token Management**: Automatic refresh of expiring GitHub tokens

### API Validation

- **Portfolio API**: Validate BytePort Portfolio API credentials
- **Git Repository**: Validate Git repository URLs and access
- **OpenAI Credentials**: Verify OpenAI API keys
- **AWS Credentials**: Validate AWS access key and secret key

## Usage

```go
import "byteport/lib"

// Initialize authentication system
if err := lib.InitAuthSystem(); err != nil {
    log.Fatal(err)
}

// Generate user token
token, err := lib.GenerateToken(user)

// Validate credentials
if err := lib.ValidateAWSCredentials(accessKey, secretKey); err != nil {
    log.Fatal(err)
}

// Use Gin middleware
r.Use(lib.AuthMiddleware())
```

## Exports

| Category | Functions |
|----------|----------|
| Auth | `InitAuthSystem`, `GenerateToken`, `GenerateNVMSToken`, `AuthenticateRequest`, `ValidateToken`, `ValidateServiceToken`, `AuthMiddleware` |
| Crypto | `EncryptPass`, `ValidatePass`, `GetDecodedEncryptionKey`, `EncryptSecret`, `DecryptSecret`, `GenerateEncryptionKey`, `InitializeEncryptionKey`, `PersistEncryptionKey` |
| Git | `ListRepositories`, `LinkWithGithub`, `GenerateGitPaseto`, `GetUserAccessToken`, `StartTokenRefreshJob` |
| Validation | `ValidatePortfolioAPI`, `ValidateGit`, `ValidateGitRepo`, `ValidateOpenAICredentials`, `ValidateAWSCredentials` |

## Dependencies

- `aidanwoods.dev/go-paseto` - PASETO token generation/validation
- `github.com/gin-gonic/gin` - HTTP framework
- `github.com/zalando/go-keyring` - Secure key storage
- `github.com/aws/aws-sdk-go` - AWS SDK
- `golang.org/x/crypto` - Argon2 password hashing
