package models

// add owning user uuid
type GitSecret struct {
	PrivateKey   string `gorm:"column:private_key"` // Encrypted private key
	AppID        string `gorm:"column:app_id"`      // GitHub App ID
	ClientID     string `gorm:"column:client_id"`
	ClientSecret string `gorm:"column:client_secret"`
}
