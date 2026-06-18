package lib

import (
	"context"
	"net"
	"strings"
	"testing"
)

func TestPortfolioValidationURLBuildsBytePortEndpoint(t *testing.T) {
	t.Setenv(portfolioAllowedHostsEnv, "")

	got, err := portfolioValidationURL(" https://portfolio.example.com/api/ ")
	if err != nil {
		t.Fatalf("portfolioValidationURL returned error: %v", err)
	}

	want := "https://portfolio.example.com/api/byteport"
	if got != want {
		t.Fatalf("portfolioValidationURL = %q, want %q", got, want)
	}
}

func TestPortfolioValidationURLRejectsUnsafeInputs(t *testing.T) {
	t.Setenv(portfolioAllowedHostsEnv, "")

	tests := []struct {
		name     string
		endpoint string
		wantErr  string
	}{
		{
			name:     "missing scheme",
			endpoint: "portfolio.example.com",
			wantErr:  "must use http or https",
		},
		{
			name:     "unsupported scheme",
			endpoint: "file:///etc/passwd",
			wantErr:  "must use http or https",
		},
		{
			name:     "localhost",
			endpoint: "http://localhost:5180",
			wantErr:  "localhost is not allowed",
		},
		{
			name:     "loopback IP",
			endpoint: "http://127.0.0.1:5180",
			wantErr:  "must be public",
		},
		{
			name:     "private IP",
			endpoint: "http://10.0.0.5",
			wantErr:  "must be public",
		},
		{
			name:     "link-local metadata IP",
			endpoint: "http://169.254.169.254/latest/meta-data",
			wantErr:  "must be public",
		},
		{
			name:     "credentials",
			endpoint: "https://user:pass@portfolio.example.com",
			wantErr:  "must not include credentials",
		},
		{
			name:     "query",
			endpoint: "https://portfolio.example.com?next=http://127.0.0.1",
			wantErr:  "must not include query strings",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := portfolioValidationURL(tt.endpoint)
			if err == nil {
				t.Fatal("portfolioValidationURL returned nil error")
			}
			if !strings.Contains(err.Error(), tt.wantErr) {
				t.Fatalf("portfolioValidationURL error = %q, want substring %q", err, tt.wantErr)
			}
		})
	}
}

func TestPortfolioValidationURLAppliesHostAllowlist(t *testing.T) {
	t.Setenv(portfolioAllowedHostsEnv, "portfolio.example.com,*.customer.example.com")

	tests := []struct {
		name      string
		endpoint  string
		wantError bool
	}{
		{
			name:     "exact host",
			endpoint: "https://portfolio.example.com",
		},
		{
			name:     "wildcard subdomain",
			endpoint: "https://team.customer.example.com",
		},
		{
			name:      "wildcard root excluded",
			endpoint:  "https://customer.example.com",
			wantError: true,
		},
		{
			name:      "unlisted host",
			endpoint:  "https://attacker.example.net",
			wantError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := portfolioValidationURL(tt.endpoint)
			if tt.wantError && err == nil {
				t.Fatal("portfolioValidationURL returned nil error")
			}
			if !tt.wantError && err != nil {
				t.Fatalf("portfolioValidationURL returned error: %v", err)
			}
		})
	}
}

func TestPortfolioValidationURLAllowsExplicitDevLoopbackHost(t *testing.T) {
	t.Setenv(portfolioAllowedHostsEnv, "localhost")

	got, err := portfolioValidationURL("http://localhost:5180")
	if err != nil {
		t.Fatalf("portfolioValidationURL returned error: %v", err)
	}

	want := "http://localhost:5180/byteport"
	if got != want {
		t.Fatalf("portfolioValidationURL = %q, want %q", got, want)
	}
}

func TestValidatedPortfolioDialAddressPinsPublicIP(t *testing.T) {
	t.Setenv(portfolioAllowedHostsEnv, "")
	publicIP := net.IPv4(8, 8, 8, 8).String()

	got, err := validatedPortfolioDialAddress(context.Background(), publicIP, "443")
	if err != nil {
		t.Fatalf("validatedPortfolioDialAddress returned error: %v", err)
	}

	want := net.JoinHostPort(publicIP, "443")
	if got != want {
		t.Fatalf("validatedPortfolioDialAddress = %q, want %q", got, want)
	}
}

func TestValidatedPortfolioDialAddressRejectsPrivateIP(t *testing.T) {
	t.Setenv(portfolioAllowedHostsEnv, "")
	privateIP := net.IPv4(127, 0, 0, 1).String()

	_, err := validatedPortfolioDialAddress(context.Background(), privateIP, "8080")
	if err == nil {
		t.Fatal("validatedPortfolioDialAddress returned nil error")
	}
	if !strings.Contains(err.Error(), "non-public address") {
		t.Fatalf("validatedPortfolioDialAddress error = %q, want non-public address", err)
	}
}
