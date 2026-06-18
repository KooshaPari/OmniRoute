package lib

import (
	"encoding/base64"
	"strings"
	"testing"
)

func FuzzPortfolioValidationURL(f *testing.F) {
	f.Setenv(portfolioAllowedHostsEnv, "localhost,127.0.0.1,[::1],example.com")
	for _, seed := range []string{
		"https://example.com",
		"https://example.com/",
		"https://example.com/api",
		"http://localhost:3000",
		"https://user:pass@example.com",
		"ftp://example.com",
		"https://example.com?token=value",
		"https://example.com/#fragment",
		"",
	} {
		f.Add(seed)
	}

	f.Fuzz(func(t *testing.T, endpoint string) {
		_, _ = portfolioValidationURL(endpoint)
	})
}

func FuzzEncryptDecryptSecret(f *testing.F) {
	f.Setenv("ENCRYPTION_KEY", base64.StdEncoding.EncodeToString([]byte("0123456789abcdef0123456789abcdef")))
	for _, seed := range []string{
		"",
		"short",
		"AWS_SECRET_ACCESS_KEY_WITH_SPECIAL_CHARS_!@#$%",
		`{"json":"data","nested":{"deep":true}}`,
		strings.Repeat("long-secret-", 32),
	} {
		f.Add(seed)
	}

	f.Fuzz(func(t *testing.T, secret string) {
		if len(secret) > 4096 {
			t.Skip("keep fuzz cases bounded for routine CI runs")
		}

		encrypted, err := EncryptSecret(secret)
		if err != nil {
			t.Fatalf("EncryptSecret returned error: %v", err)
		}
		decrypted, err := DecryptSecret(encrypted)
		if err != nil {
			t.Fatalf("DecryptSecret returned error: %v", err)
		}
		if decrypted != secret {
			t.Fatalf("DecryptSecret mismatch: got %q, want %q", decrypted, secret)
		}
	})
}
