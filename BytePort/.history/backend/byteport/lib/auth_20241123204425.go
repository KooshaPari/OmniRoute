package lib

import (
	"byteport/models"
	"time"

	"aidanwoods.dev/go-paseto"
)
func generateSymmetricKey() string {
    key := paseto.NewV4SymmetricKey()
    return key.ExportHex()
}

func generateToken(user User) string {
	token := paseto.NewToken()
	token.SetAudience(user.Email)
	token.SetExpiration(time.Now().Add(time.Hour * 1))
	token.SetSubject("session")
	token.SetIssuer("BytePort")
	token.SetIssuedAt(time.Now())
	token.SetNotBefore(time.Now())
	token.SetString("user-id", user.ID.String())

	if keyHex == "" {
        return "", errors.New("symmetric key not set in environment variable")
    }

	key := paseto.NewV4SymmetricKey()
	encryptedToken := token.V4Encrypt(key,nil)
	// Add to existing user entry
	var userDB User
	models.DB.Where("email = ?", user.Email).First(&userDB).Updates(map[string]interface{}{
    "encrypted_token": encryptedToken,
    "secret_key":      string(key),
})
	
	return encryptedToken
}