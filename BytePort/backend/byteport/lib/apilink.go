package lib

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"strings"
	"time"

	"byteport/models"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/awserr"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/s3"
)

const portfolioAllowedHostsEnv = "BYTEPORT_PORTFOLIO_API_ALLOWED_HOSTS"

// ValidatePortfolioAPI validates the provided portfolio API key and endpoint.
func ValidatePortfolioAPI(rootEndpoint, apiKey string) error {
	log.Println("Validating Portfolio API...")
	validationURL, err := portfolioValidationURL(rootEndpoint)
	if err != nil {
		return err
	}

	log.Printf("Portfolio API validation URL: %s\n", validationURL)
	// portfolioValidationURL and ssrfSafePortfolioClient validate the user-configured host, redirects, and resolved dial address.
	// codeql[go/request-forgery]
	req, err := http.NewRequest("GET", validationURL, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %v", err)
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)

	client := ssrfSafePortfolioClient()
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to connect to Portfolio API: %v", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response body: %v", err)
	}
	log.Printf("Portfolio API Response: %s\n", string(body))

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("invalid Portfolio API Key or URL. Status code: %d", resp.StatusCode)
	}

	log.Println("Portfolio API validated successfully.")
	return nil
}

func portfolioValidationURL(rootEndpoint string) (string, error) {
	trimmed := strings.TrimSpace(rootEndpoint)
	if trimmed == "" {
		return "", fmt.Errorf("portfolio API root endpoint is required")
	}

	parsed, err := url.Parse(trimmed)
	if err != nil {
		return "", fmt.Errorf("invalid Portfolio API URL: %v", err)
	}
	if parsed.Scheme != "https" && parsed.Scheme != "http" {
		return "", fmt.Errorf("portfolio API URL must use http or https")
	}
	if parsed.Host == "" {
		return "", fmt.Errorf("portfolio API URL must include a host")
	}
	if parsed.User != nil {
		return "", fmt.Errorf("portfolio API URL must not include credentials")
	}
	if parsed.RawQuery != "" || parsed.Fragment != "" {
		return "", fmt.Errorf("portfolio API URL must not include query strings or fragments")
	}
	if err := validatePortfolioHost(parsed.Hostname()); err != nil {
		return "", err
	}

	parsed.Path = strings.TrimRight(parsed.Path, "/")
	parsed.RawPath = ""
	parsed.RawQuery = ""
	parsed.Fragment = ""
	return parsed.JoinPath("byteport").String(), nil
}

func validatePortfolioHost(host string) error {
	host = strings.TrimSuffix(strings.ToLower(strings.TrimSpace(host)), ".")
	if host == "" {
		return fmt.Errorf("portfolio API URL must include a host")
	}
	if isLocalhostName(host) {
		if allowsPrivatePortfolioHost(host) {
			return nil
		}
		return fmt.Errorf("portfolio API host localhost is not allowed unless explicitly allowlisted")
	}
	if ip := net.ParseIP(host); ip != nil {
		if !isPublicIP(ip) && !allowsPrivatePortfolioHost(host) {
			return fmt.Errorf("portfolio API host must be public unless explicitly allowlisted")
		}
	}
	if allowedHosts := portfolioAllowedHosts(); len(allowedHosts) > 0 {
		for _, allowed := range allowedHosts {
			if hostMatchesAllowedPortfolioHost(host, allowed) {
				return nil
			}
		}
		return fmt.Errorf("portfolio API host %q is not in %s", host, portfolioAllowedHostsEnv)
	}
	return nil
}

func portfolioAllowedHosts() []string {
	raw := os.Getenv(portfolioAllowedHostsEnv)
	if strings.TrimSpace(raw) == "" {
		return nil
	}

	hosts := strings.Split(raw, ",")
	allowed := make([]string, 0, len(hosts))
	for _, host := range hosts {
		normalized := strings.TrimSuffix(strings.ToLower(strings.TrimSpace(host)), ".")
		if normalized != "" {
			allowed = append(allowed, normalized)
		}
	}
	return allowed
}

func hostMatchesAllowedPortfolioHost(host, allowed string) bool {
	switch {
	case strings.HasPrefix(allowed, "*."):
		suffix := strings.TrimPrefix(allowed, "*")
		return strings.HasSuffix(host, suffix) && host != strings.TrimPrefix(suffix, ".")
	case strings.HasPrefix(allowed, "."):
		return strings.HasSuffix(host, allowed) && host != strings.TrimPrefix(allowed, ".")
	default:
		return host == allowed
	}
}

func allowsPrivatePortfolioHost(host string) bool {
	for _, allowed := range portfolioAllowedHosts() {
		if !strings.HasPrefix(allowed, "*.") && !strings.HasPrefix(allowed, ".") && host == allowed {
			return true
		}
	}
	return false
}

func ssrfSafePortfolioClient() *http.Client {
	dialer := &net.Dialer{Timeout: 10 * time.Second}
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.DialContext = func(ctx context.Context, network, address string) (net.Conn, error) {
		host, port, err := net.SplitHostPort(address)
		if err != nil {
			return nil, fmt.Errorf("invalid Portfolio API address: %v", err)
		}
		dialAddress, err := validatedPortfolioDialAddress(ctx, host, port)
		if err != nil {
			return nil, err
		}
		return dialer.DialContext(ctx, network, dialAddress)
	}

	return &http.Client{
		Timeout:   15 * time.Second,
		Transport: transport,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if err := validatePortfolioHost(req.URL.Hostname()); err != nil {
				return err
			}
			return nil
		},
	}
}

func validatedPortfolioDialAddress(ctx context.Context, host, port string) (string, error) {
	normalizedHost := strings.TrimSuffix(strings.ToLower(host), ".")
	ips, err := net.DefaultResolver.LookupIP(ctx, "ip", normalizedHost)
	if err != nil {
		return "", fmt.Errorf("failed to resolve Portfolio API host: %v", err)
	}
	if len(ips) == 0 {
		return "", fmt.Errorf("portfolio API host resolved to no addresses")
	}

	privateHostAllowed := allowsPrivatePortfolioHost(normalizedHost)
	for _, ip := range ips {
		if !isPublicIP(ip) && !privateHostAllowed {
			return "", fmt.Errorf("portfolio API host resolved to a non-public address")
		}
	}

	return net.JoinHostPort(ips[0].String(), port), nil
}

func isPublicIP(ip net.IP) bool {
	return !(ip.IsLoopback() ||
		ip.IsPrivate() ||
		ip.IsLinkLocalUnicast() ||
		ip.IsLinkLocalMulticast() ||
		ip.IsMulticast() ||
		ip.IsUnspecified())
}

func isLocalhostName(host string) bool {
	return host == "localhost" || strings.HasSuffix(host, ".localhost")
}

// ValidateGit validates the GitHub app connection and fetches repositories for a user.
func ValidateGit(user models.User) error {
	// Fetch Git secrets from the database linked to the user
	var gitSecrets models.GitSecret
	result := models.DB.First(&gitSecrets)
	if result.Error != nil {
		return fmt.Errorf("failed to retrieve Git secrets for user: %v", result.Error)
	}

	// Ensure the user has already linked GitHub
	if user.Git.Token == "" {
		return fmt.Errorf("GitHub is not linked for user. Access token is missing.")
	}
	log.Printf("Token: [REDACTED]\n")

	// Decrypt the stored user access token
	accessToken, err := DecryptSecret(user.Git.Token)
	if err != nil {
		return fmt.Errorf("failed to decrypt user access token: %v", err)
	}
	log.Println("Validating GitHub user access token...")
	_, err = ListRepositories(accessToken)
	if err != nil {
		return fmt.Errorf("failed to list repositories: %v", err)
	}
	// Parse the response to list repositories
	/*body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response body: %v", err)
	}*/

	// Log the list of repositories (debugging purposes)
	//fmt.Printf("GitHub Repositories Response for User %d: %s\n", user.UUID, string(body))
	log.Println("GitHub user access token validated successfully.")

	return nil
}

// ValidateGitRepo validates a specific repository using the installation token.
func ValidateGitRepo(repoURL, installationToken string) error {
	log.Println("Validating GitHub repository...")

	cmd := exec.Command("git", "ls-remote", repoURL)
	cmd.Env = append(cmd.Env, "GIT_ASKPASS=echo "+installationToken)

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()
	log.Printf("Git Command: git ls-remote %s\n", repoURL)
	log.Printf("Stdout: %s\n", stdout.String())
	log.Printf("Stderr: %s\n", stderr.String())

	if err != nil {
		return fmt.Errorf("failed to validate Git repository: %v. Stderr: %s", err, stderr.String())
	}

	log.Println("Git repository validated successfully.")
	return nil
}

// ValidateOpenAICredentials validates the OpenAI API credentials.
func ValidateOpenAICredentials(apiToken string) error {
	log.Println("Validating OpenAI credentials...")
	req, err := http.NewRequest("GET", "https://api.openai.com/v1/models", nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %v", err)
	}
	req.Header.Set("Authorization", "Bearer "+apiToken)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to connect to OpenAI API: %v", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read OpenAI response: %v", err)
	}
	log.Printf("OpenAI Response: %s\n", string(body))

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("invalid OpenAI API Key. Status code: %d", resp.StatusCode)
	}

	log.Println("OpenAI credentials validated successfully.")
	return nil
}

// ValidateAWSCredentials validates AWS credentials.
func ValidateAWSCredentials(accessKey, secretKey string) error {
	log.Println("Validating AWS credentials...")
	sess, err := session.NewSession(&aws.Config{
		Credentials: credentials.NewStaticCredentials(accessKey, secretKey, ""),
		Region:      aws.String("us-east-1"), // Default region for validation
	})
	if err != nil {
		return fmt.Errorf("failed to create session: %v", err)
	}

	svc := s3.New(sess)
	_, err = svc.ListBuckets(&s3.ListBucketsInput{})
	if err != nil {
		if awsErr, ok := err.(awserr.Error); ok {
			log.Printf("AWS Error: %s, Code: %s, Message: %s\n", awsErr.Error(), awsErr.Code(), awsErr.Message())
		}
		return fmt.Errorf("invalid AWS credentials: %v", err)
	}

	log.Println("AWS credentials validated successfully.")
	return nil
}
