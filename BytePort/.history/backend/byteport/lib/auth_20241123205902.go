package lib

import (
	"log"
	"time"

	"aidanwoods.dev/go-paseto"
	"github.com/zalando/go-keyring"
)
const (
    keyringService = "BytePortService"
    keyringUser    = "BytePortUser"
)

func storeSymmetricKey(key string) error {
    return keyring.Set(keyringService, keyringUser, key)
}

func getSymmetricKey() (string, error) {
    return keyring.Get(keyringService, keyringUser)
}
func InitAuthSystem() error {
	keyHex := generateSymmetricKey()
	err := storeSymmetricKey(keyHex)
	if(err != nil){
		log.Fatal(err)
	}
	return nil
	

}
func generateSymmetricKey() string {
    key := paseto.NewV4SymmetricKey()
    return key.ExportHex()
}

func generateToken(user User) (string,error) {
	token := paseto.NewToken()
	token.SetAudience(user.Email)
	token.SetExpiration(time.Now().Add(time.Hour * 1))
	token.SetSubject("session")
	token.SetIssuer("BytePort")
	token.SetIssuedAt(time.Now())
	token.SetNotBefore(time.Now())
	token.SetString("user-id", user.UUID)
	keyHex,err := getSymmetricKey()
	if(err != nil){
		log.Fatal(err)
	}
	key, err := paseto.V4SymmetricKeyFromHex(keyHex)
    if err != nil {
        return "", err
    }

	encryptedToken := token.V4Encrypt(key,nil)
	

	
	return encryptedToken,nil
}func ValidateToken(encryptedToken string) (bool, *paseto.Token, error) {
	// Retrieve the symmetric key
	keyHex, err := getSymmetricKey()
	if err != nil {
		return false, nil, err
	}

	key, err := paseto.V4SymmetricKeyFromHex(keyHex)
	if err != nil {
		return false, nil, err
	}

	// Create a parser
	parser := paseto.NewParser()

	// Parse and validate the token
	token, err := parser.ParseV4Local(key, encryptedToken, nil)
	if err != nil {
		return false, nil, err
	}

	if !token.ValidAt(time.Now()) {
		return false, token, fmt.Errorf("token is not valid at this time")
	}



	return true, token, nil
}