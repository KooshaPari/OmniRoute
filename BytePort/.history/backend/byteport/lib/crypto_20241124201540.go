package lib

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"log"
	"os"
	"strings"

	"golang.org/x/crypto/argon2"
)

var (
    ErrInvalidHash         = errors.New("the encoded hash is not in the correct format")
    ErrIncompatibleVersion = errors.New("incompatible version of argon2")
)


type params struct {
    memory      uint32
    iterations  uint32
    parallelism uint8
    saltLength  uint32
    keyLength   uint32
}

func EncryptPass(password string) string {
    

    // Establish the parameters to use for Argon2.
    p := &params{
        memory:      64 * 1024,
        iterations:  3,
        parallelism: 2,
        saltLength:  16,
        keyLength:   32,
    }

    hash, err := generateFromPassword(password, p)
    if err != nil {
        log.Fatal(err)
    }

    return hash
}
func ValidatePass(password string, hash string) bool{
    match,err := comparePasswordAndHash(password,hash)
    if(err != nil){
        log.Fatal(err)
    }
    return match
}
func generateFromPassword(password string, p *params) (encodedHash string, err error) {
    salt, err := generateRandomBytes(p.saltLength)
    if err != nil {
        return "", err
    }

    hash := argon2.IDKey([]byte(password), salt, p.iterations, p.memory, p.parallelism, p.keyLength)

    // Base64 encode the salt and hashed password.
    b64Salt := base64.RawStdEncoding.EncodeToString(salt)
    b64Hash := base64.RawStdEncoding.EncodeToString(hash)

    // Return a string using the standard encoded hash representation.
    encodedHash = fmt.Sprintf("$argon2id$v=%d$m=%d,t=%d,p=%d$%s$%s", argon2.Version, p.memory, p.iterations, p.parallelism, b64Salt, b64Hash)

    return encodedHash, nil
}


func generateRandomBytes(n uint32) ([]byte, error) {
    b := make([]byte, n)
    _, err := rand.Read(b)
    if err != nil {
        return nil, err
    }

    return b, nil
}
func comparePasswordAndHash(password, encodedHash string) (match bool, err error) {
    // Extract the parameters, salt and derived key from the encoded password
    // hash.
    p, salt, hash, err := decodeHash(encodedHash)
    if err != nil {
        return false, err
    }

    // Derive the key from the other password using the same parameters.
    otherHash := argon2.IDKey([]byte(password), salt, p.iterations, p.memory, p.parallelism, p.keyLength)

    // Check that the contents of the hashed passwords are identical. Note
    // that we are using the subtle.ConstantTimeCompare() function for this
    // to help prevent timing attacks.
    if subtle.ConstantTimeCompare(hash, otherHash) == 1 {
        return true, nil
    }
    return false, nil
}

func decodeHash(encodedHash string) (p *params, salt, hash []byte, err error) {
    vals := strings.Split(encodedHash, "$")
    if len(vals) != 6 {
        return nil, nil, nil, ErrInvalidHash
    }

    var version int
    _, err = fmt.Sscanf(vals[2], "v=%d", &version)
    if err != nil {
        return nil, nil, nil, err
    }
    if version != argon2.Version {
        return nil, nil, nil, ErrIncompatibleVersion
    }

    p = &params{}
    _, err = fmt.Sscanf(vals[3], "m=%d,t=%d,p=%d", &p.memory, &p.iterations, &p.parallelism)
    if err != nil {
        return nil, nil, nil, err
    }

    salt, err = base64.RawStdEncoding.Strict().DecodeString(vals[4])
    if err != nil {
        return nil, nil, nil, err
    }
    p.saltLength = uint32(len(salt))

    hash, err = base64.RawStdEncoding.Strict().DecodeString(vals[5])
    if err != nil {
        return nil, nil, nil, err
    }
    p.keyLength = uint32(len(hash))

    return p, salt, hash, nil
}

func EncryptSecret(secret string, key string)  (string, error) {
    block, err := aes.NewCipher([]byte(key))
    if err != nil {
        return "", err
    }
    cipherText := make([]byte, len(secret))
    stream := cipher.NewCFBEncrypter(block, []byte(key)[:aes.BlockSize])
    stream.XORKeyStream(cipherText, []byte(secret))
    return base64.StdEncoding.EncodeToString(cipherText), nil
}


func DecryptSecret(cipherText string, key string) (string, error) {
    decodedText, _ := base64.StdEncoding.DecodeString(cipherText)
    block, err := aes.NewCipher([]byte(key))
    if err != nil {
        return "", err
    }
    plainText := make([]byte, len(decodedText))
    stream := cipher.NewCFBDecrypter(block, []byte(key)[:aes.BlockSize])
    stream.XORKeyStream(plainText, decodedText)
    return string(plaintext), nil
}
    

    
    func GenerateEncryptionKey() (string, error) {
	key := make([]byte, 32)
	_, err := rand.Read(key)
	if err != nil {
		return "", fmt.Errorf("failed to generate encryption key: %v", err)
	}
	return base64.StdEncoding.EncodeToString(key), nil
}

func SetEncryptionKeyEnvVar(key string) error {
	return os.Setenv("ENCRYPTION_KEY", key)
}
func InitializeEncryptionKey() error {
	// Check if the key already exists
	key := os.Getenv("ENCRYPTION_KEY")
	if key != "" {
		fmt.Println("Encryption key already exists.")
		return nil
	}
    newKey, err := GenerateEncryptionKey()
	if err != nil {
		return fmt.Errorf("failed to generate encryption key: %v", err)
	}

	// Set the key in the environment
	err = SetEncryptionKeyEnvVar(newKey)
	if err != nil {
		return fmt.Errorf("failed to set encryption key in environment: %v", err)
	}
    err = PersistEncryptionKey(newKey)
	if err != nil {
		return fmt.Errorf("failed to persist encryption key: %v", err)
	}

	fmt.Println("Encryption key successfully generated and stored.")
	return nil
}
func PersistEncryptionKey(key string) error {
	file, err := os.OpenFile(os.ExpandEnv("$HOME/.bashrc"), os.O_APPEND|os.O_WRONLY, 0600)
	if err != nil {
		return err
	}
	defer file.Close()

	_, err = file.WriteString(fmt.Sprintf("\nexport ENCRYPTION_KEY=\"%s\"\n", key))
	if err != nil {
		return err
	}
	return nil
}


