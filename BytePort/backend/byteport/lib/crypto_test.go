package lib

import (
	"encoding/base64"
	"os"
	"strings"
	"testing"
)

func TestEncryptAndValidatePass(t *testing.T) {
	password := "testPassword123!"

	// Encrypt the password
	hash := EncryptPass(password)
	if hash == "" {
		t.Fatal("EncryptPass returned empty string")
	}

	// Verify hash format
	if !strings.HasPrefix(hash, "$argon2id$") {
		t.Fatalf("hash does not have expected prefix: %s", hash)
	}

	// Validate correct password
	if !ValidatePass(password, hash) {
		t.Error("ValidatePass returned false for correct password")
	}

	// Validate incorrect password
	if ValidatePass("wrongPassword", hash) {
		t.Error("ValidatePass returned true for incorrect password")
	}
}

func TestComparePasswordAndHashInvalidHash(t *testing.T) {
	// Test the underlying function directly (which returns error instead of logging Fatal)
	_, err := comparePasswordAndHash("password", "invalid-hash-format")
	if err == nil {
		t.Error("comparePasswordAndHash should return error for invalid hash")
	}
	if err != ErrInvalidHash {
		t.Errorf("comparePasswordAndHash returned %v, want ErrInvalidHash", err)
	}
}

func TestDecodeHash(t *testing.T) {
	// Create a valid hash
	password := "testPassword123!"
	hash := EncryptPass(password)

	// Decode the hash
	p, salt, decodedHash, err := decodeHash(hash)
	if err != nil {
		t.Fatalf("decodeHash returned error: %v", err)
	}

	// Verify params
	if p.memory != 64*1024 {
		t.Errorf("memory = %d, want %d", p.memory, 64*1024)
	}
	if p.iterations != 3 {
		t.Errorf("iterations = %d, want %d", p.iterations, 3)
	}
	if p.parallelism != 2 {
		t.Errorf("parallelism = %d, want %d", p.parallelism, 2)
	}
	if p.saltLength != 16 {
		t.Errorf("saltLength = %d, want %d", p.saltLength, 16)
	}
	if p.keyLength != 32 {
		t.Errorf("keyLength = %d, want %d", p.keyLength, 32)
	}

	// Verify salt and hash are non-empty
	if len(salt) == 0 {
		t.Error("salt is empty")
	}
	if len(decodedHash) == 0 {
		t.Error("decodedHash is empty")
	}
}

func TestDecodeHashInvalidFormat(t *testing.T) {
	_, _, _, err := decodeHash("invalid-hash")
	if err != ErrInvalidHash {
		t.Errorf("decodeHash returned %v, want ErrInvalidHash", err)
	}
}

func TestDecodeHashIncompatibleVersion(t *testing.T) {
	// Create a hash with wrong version
	invalidHash := "$argon2id$v=999$m=65536,t=3,p=4$YWFhYWFhYWFhYWFhYWFhYQ$YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYQ=="

	_, _, _, err := decodeHash(invalidHash)
	if err != ErrIncompatibleVersion {
		t.Errorf("decodeHash returned %v, want ErrIncompatibleVersion", err)
	}
}

func TestGenerateRandomBytes(t *testing.T) {
	// Test various lengths
	lengths := []uint32{16, 32, 64, 128}

	for _, length := range lengths {
		bytes, err := generateRandomBytes(length)
		if err != nil {
			t.Errorf("generateRandomBytes(%d) returned error: %v", length, err)
		}
		if uint32(len(bytes)) != length {
			t.Errorf("generateRandomBytes(%d) returned %d bytes", length, len(bytes))
		}
	}

	// Test that two calls produce different results
	bytes1, _ := generateRandomBytes(32)
	bytes2, _ := generateRandomBytes(32)

	if string(bytes1) == string(bytes2) {
		t.Error("generateRandomBytes produced identical bytes on consecutive calls")
	}
}

func TestGenerateEncryptionKey(t *testing.T) {
	key, err := GenerateEncryptionKey()
	if err != nil {
		t.Fatalf("GenerateEncryptionKey returned error: %v", err)
	}

	// Verify it's valid base64
	decoded, err := base64.StdEncoding.DecodeString(key)
	if err != nil {
		t.Errorf("GenerateEncryptionKey returned invalid base64: %v", err)
	}

	// Verify length (32 bytes = 256 bits)
	if len(decoded) != 32 {
		t.Errorf("GenerateEncryptionKey returned key of length %d, want 32", len(decoded))
	}

	// Verify uniqueness
	key2, _ := GenerateEncryptionKey()
	if key == key2 {
		t.Error("GenerateEncryptionKey produced identical keys on consecutive calls")
	}
}

func TestGetDecodedEncryptionKey(t *testing.T) {
	// Generate and set a valid key
	key, err := GenerateEncryptionKey()
	if err != nil {
		t.Fatalf("GenerateEncryptionKey returned error: %v", err)
	}

	t.Setenv("ENCRYPTION_KEY", key)

	decodedKey, err := GetDecodedEncryptionKey()
	if err != nil {
		t.Fatalf("GetDecodedEncryptionKey returned error: %v", err)
	}

	if len(decodedKey) != 32 {
		t.Errorf("GetDecodedEncryptionKey returned key of length %d, want 32", len(decodedKey))
	}
}

func TestGetDecodedEncryptionKeyMissing(t *testing.T) {
	t.Setenv("ENCRYPTION_KEY", "")

	_, err := GetDecodedEncryptionKey()
	if err == nil {
		t.Error("GetDecodedEncryptionKey should return error when key is missing")
	}
	if !strings.Contains(err.Error(), "not set") {
		t.Errorf("GetDecodedEncryptionKey error = %q, want to contain 'not set'", err)
	}
}

func TestGetDecodedEncryptionKeyInvalidBase64(t *testing.T) {
	t.Setenv("ENCRYPTION_KEY", "not-valid-base64!!!")

	_, err := GetDecodedEncryptionKey()
	if err == nil {
		t.Error("GetDecodedEncryptionKey should return error for invalid base64")
	}
}

func TestGetDecodedEncryptionKeyInvalidLength(t *testing.T) {
	// Create a key that's too short (16 bytes, which is valid for AES-128)
	shortKey := base64.StdEncoding.EncodeToString([]byte("short"))
	t.Setenv("ENCRYPTION_KEY", shortKey)

	_, err := GetDecodedEncryptionKey()
	if err == nil {
		t.Error("GetDecodedEncryptionKey should return error for key with invalid length")
	}
}

func TestEncryptAndDecryptSecret(t *testing.T) {
	// Set up encryption key
	key, err := GenerateEncryptionKey()
	if err != nil {
		t.Fatalf("GenerateEncryptionKey returned error: %v", err)
	}
	t.Setenv("ENCRYPTION_KEY", key)

	// Test various secret lengths
	secrets := []string{
		"short",
		"AWS_SECRET_ACCESS_KEY_WITH_SPECIAL_CHARS_!@#$%",
		"{\"json\": \"data\", \"nested\": {\"deep\": true}}",
		"very long secret that spans multiple blocks and ensures we test the full encryption pipeline with realistic data sizes and edge cases",
	}

	for _, secret := range secrets {
		encrypted, err := EncryptSecret(secret)
		if err != nil {
			t.Errorf("EncryptSecret(%q) returned error: %v", secret[:10], err)
			continue
		}

		// Verify encrypted is different from original
		if encrypted == secret {
			t.Error("EncryptSecret should not return the original secret")
		}

		// Verify encrypted is valid base64
		_, err = base64.StdEncoding.DecodeString(encrypted)
		if err != nil {
			t.Errorf("EncryptSecret returned invalid base64: %v", err)
		}

		// Decrypt and verify
		decrypted, err := DecryptSecret(encrypted)
		if err != nil {
			t.Errorf("DecryptSecret returned error: %v", err)
			continue
		}

		if decrypted != secret {
			t.Errorf("DecryptSecret round-trip failed: got %q, want %q", decrypted, secret)
		}
	}
}

func TestDecryptSecretInvalidBase64(t *testing.T) {
	// Set up encryption key
	key, _ := GenerateEncryptionKey()
	t.Setenv("ENCRYPTION_KEY", key)

	_, err := DecryptSecret("not-valid-base64!!!")
	if err == nil {
		t.Error("DecryptSecret should return error for invalid base64")
	}
}

func TestDecryptSecretCiphertextTooShort(t *testing.T) {
	// Set up encryption key
	key, _ := GenerateEncryptionKey()
	t.Setenv("ENCRYPTION_KEY", key)

	// Create a ciphertext that's too short (less than AES block size = 16 bytes)
	shortCT := base64.StdEncoding.EncodeToString([]byte("short"))
	_, err := DecryptSecret(shortCT)
	if err == nil {
		t.Error("DecryptSecret should return error for short ciphertext")
	}
	if !strings.Contains(err.Error(), "too short") {
		t.Errorf("DecryptSecret error = %q, want to contain 'too short'", err)
	}
}

func TestInitializeEncryptionKeyAlreadySet(t *testing.T) {
	// Set a key first
	key, _ := GenerateEncryptionKey()
	t.Setenv("ENCRYPTION_KEY", key)

	// Initialize should return without error
	err := InitializeEncryptionKey()
	if err != nil {
		t.Errorf("InitializeEncryptionKey returned error when key exists: %v", err)
	}
}

func TestInitializeEncryptionKeyGeneratesNew(t *testing.T) {
	// Ensure no key exists
	t.Setenv("ENCRYPTION_KEY", "")

	// Initialize should generate a new key
	err := InitializeEncryptionKey()
	if err != nil {
		t.Errorf("InitializeEncryptionKey returned error: %v", err)
	}

	// Verify a key was set
	key := os.Getenv("ENCRYPTION_KEY")
	if key == "" {
		t.Error("InitializeEncryptionKey did not set ENCRYPTION_KEY")
	}

	// Verify it's valid
	decoded, err := base64.StdEncoding.DecodeString(key)
	if err != nil {
		t.Errorf("InitializeEncryptionKey set invalid base64 key: %v", err)
	}
	if len(decoded) != 32 {
		t.Errorf("InitializeEncryptionKey set key of length %d, want 32", len(decoded))
	}
}
