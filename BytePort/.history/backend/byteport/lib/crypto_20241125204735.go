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
// Decode and validate the encryption key
func GetDecodedEncryptionKey() ([]byte, error) {
	encryptionKey := os.Getenv("ENCRYPTION_KEY")
	if encryptionKey == "" {
		return nil, fmt.Errorf("encryption key is not set")
	}

	// Trim whitespace from the environment variable
	trimmedKey := strings.TrimSpace(encryptionKey)

	// Decode the Base64 key
	decodedKey, err := base64.StdEncoding.DecodeString(trimmedKey)
	if err != nil {
		return nil, fmt.Errorf("failed to decode encryption key: %v", err)
	}

	// Validate key length (AES requires 16, 24, or 32 bytes)
	keyLength := len(decodedKey)
	if keyLength != 16 && keyLength != 24 && keyLength != 32 {
		return nil, fmt.Errorf("invalid key length: %d bytes (must be 16, 24, or 32)", keyLength)
	}

	return decodedKey, nil
}
func EncryptSecret(secret string) (string, error) {
    key,err := GetDecodedEncryptionKey();
    if(err !=nil){
        log.Fatal(err)
    }
	// Validate the key length
	if len(key) != 16 && len(key) != 24 && len(key) != 32 {
		return "", fmt.Errorf("invalid key length: must be 16, 24, or 32 bytes")
	}

	// Create a new AES cipher block
	block, err := aes.NewCipher([]byte(key))
	if err != nil {
		return "", fmt.Errorf("failed to create cipher: %v", err)
	}

	// Generate a random IV
	iv := make([]byte, aes.BlockSize)
	if _, err := rand.Read(iv); err != nil {
		return "", fmt.Errorf("failed to generate IV: %v", err)
	}

	// Encrypt the secret using CFB
	cipherText := make([]byte, len(secret))
	stream := cipher.NewCFBEncrypter(block, iv)
	stream.XORKeyStream(cipherText, []byte(secret))

	// Prepend the IV to the ciphertext and encode
	finalCipherText := append(iv, cipherText...)
	return base64.StdEncoding.EncodeToString(finalCipherText), nil
}

func DecryptSecret(cipherText string) (string, error) {
	// Validate the key length
    key,err := GetDecodedEncryptionKey();
    if(err !=nil){
        log.Fatal(err)
    }
	if len(key) != 16 && len(key) != 24 && len(key) != 32 {
		return "", fmt.Errorf("invalid key length: must be 16, 24, or 32 bytes")
	}

	// Decode the base64-encoded ciphertext
	data, err := base64.StdEncoding.DecodeString(cipherText)
	if err != nil {
		return "", fmt.Errorf("failed to decode base64: %v", err)
	}

	// Separate the IV and the actual ciphertext
	if len(data) < aes.BlockSize {
		return "", fmt.Errorf("ciphertext too short")
	}
	iv := data[:aes.BlockSize]
	cipherTextData := data[aes.BlockSize:]

	// Create a new AES cipher block
	block, err := aes.NewCipher([]byte(key))
	if err != nil {
		return "", fmt.Errorf("failed to create cipher: %v", err)
	}

	// Decrypt the ciphertext using CFB
	plainText := make([]byte, len(cipherTextData))
	stream := cipher.NewCFBDecrypter(block, iv)
	stream.XORKeyStream(plainText, cipherTextData)

	return string(plainText), nil
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

	fmt.Println("Encryption key successfully generated and stored.")
	return nil
}
func PersistEncryptionKey(key string) error {
	file, err := os.OpenFile(os.ExpandEnv("$HOME/.zshrc"), os.O_APPEND|os.O_WRONLY, 0600)
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


