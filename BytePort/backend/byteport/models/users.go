package models

import "time"

type User struct {
	UUID      string     `json:"uuid" gorm:"type:text;primaryKey"`
	Name      string     `json:"name" gorm:"not null"`
	Email     string     `json:"email" gorm:"unique;not null"`
	Password  string     `json:"password" gorm:"not null"`
	AwsCreds  AwsCreds   `json:"awsCreds" gorm:"embedded;embeddedPrefix:aws_"`
	LLMConfig LLM        `json:"llmConfig" gorm:"embedded;embeddedPrefix:llm_"`
	Portfolio Portfolio  `json:"portfolio" gorm:"embedded;embeddedPrefix:portfolio_"`
	Git       Git        `json:"git" gorm:"embedded;embeddedPrefix:git_"`
	Projects  []Project  `json:"projects" gorm:"foreignKey:Owner;references:UUID"`
	Instances []Instance `json:"instances" gorm:"foreignKey:Owner;references:UUID"`
}

type LLM struct {
	Provider  string                `json:"provider" gorm:"column:Provider"`
	Providers map[string]AIProvider `json:"providers" gorm:"serializer:json"`
}

type AIProvider struct {
	Modal  string `json:"modal" gorm:"column:modal"`
	APIKey string `json:"api_key" gorm:"column:api_key"`
}

type AwsCreds struct {
	AccessKeyID     string `gorm:"column:access_key_id"`
	SecretAccessKey string `gorm:"column:secret_access_key"`
}

type Portfolio struct {
	RootEndpoint string `gorm:"column:root_endpoint"`
	APIKey       string `gorm:"column:api_key"`
}

type Git struct {
	Token              string    `gorm:"column:access_token"`
	RefreshToken       string    `gorm:"column:refresh_token"`
	TokenExpiry        time.Time `gorm:"column:token_expiry"`
	RefreshTokenExpiry time.Time `gorm:"column:refresh_token_expiry"` // User-specific GitHub App installation ID
	Repositories       []string  `gorm:"-"`                           // A list of repository names (optional, for frontend display)
}
type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}
type SignupRequest struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

// contains everything not in signup request but in the original user object
type LinkRequest struct {
	AwsCreds  AwsCreds  `gorm:"embedded;embeddedPrefix:aws_"`
	LLMConfig LLM       `gorm:"embedded;embeddedPrefix:openai_"`
	Portfolio Portfolio `gorm:"embedded;embeddedPrefix:portfolio_"`
	Git       Git       `gorm:"embedded;embeddedPrefix:git_"`
}
