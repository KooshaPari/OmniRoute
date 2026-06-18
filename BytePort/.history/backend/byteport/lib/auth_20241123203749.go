package lib

import (
	"byteport/models"
	"time"

	"aidanwoods.dev/go-paseto"
)

func generateToken(user User) string {
	token := paseto.NewToken()
	token.SetAudience(user.Email)
	token.SetExpiration(time.Now().Add(time.Hour * 1))
	token.SetSubject("session")
	token.SetIssuer("BytePort")
	token.SetIssuedAt(time.Now())
	token.SetNotBefore(time.Now())
	token.SetString("user-id", "<uuid>")

	key := paseto.NewV4SymmetricKey()
	encryptedToken := token.V4Encrypt(key,nil)
	// Add to existing user entry
	models.DB.
	models.DB.Create(&models.User{
		Name: user.Name,
		Email: user.Email,
		Password: user.Password,
		AwsCreds: user.AwsCreds,
		OpenAICreds: user.OpenAICreds,
		Portfolio: user.Portfolio,
		Git: user.Git,
		SessionToken: encryptedToken,
	})
	return encryptedToken
}