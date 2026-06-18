package lib

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os/exec"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/awserr"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/s3"
	"github.com/golang-jwt/jwt"
)

func ValidatePortfolioAPI(rootEndpoint, apiKey string) error {
	fmt.Println("Validating Portfolio API...")
	req, err := http.NewRequest("GET", rootEndpoint+"/dev/templates", nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %v", err)
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil || resp.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to validate portfolio API: %v", err)
	}
	body, err := io.ReadAll(resp.Body)
if err != nil {
    return fmt.Errorf("failed to read response body: %v", err)
}
fmt.Printf("Portfolio API Response: %s\n", body)
if !strings.Contains(string(body), "expected_keyword_or_structure") {
    return fmt.Errorf("unexpected response from Portfolio API: %s", string(body))
}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("invalid Portfolio API Key or URL. Status code: %d", resp.StatusCode)
	}

	fmt.Println("Portfolio API validated successfully.")
	return nil
}

func GenerateJWT(appID string, privateKey []byte) (string, error) {
	// Create JWT claims
	claims := jwt.MapClaims{
		"iat": time.Now().Unix(),
		"exp": time.Now().Add(10 * time.Minute).Unix(), // GitHub JWTs are valid for 10 minutes
		"iss": appID,
	}

	// Parse private key
	privateKeyParsed, err := jwt.ParseRSAPrivateKeyFromPEM(privateKey)
	if err != nil {
		return "", fmt.Errorf("failed to parse private key: %v", err)
	}

	// Create and sign the JWT
	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	return token.SignedString(privateKeyParsed)
}

func GetInstallationToken(apiURL, jwtToken, installationID string) (string, error) {
	// GitHub API to generate installation token
	url := fmt.Sprintf("%s/app/installations/%s/access_tokens", apiURL, installationID)
	req, err := http.NewRequest("POST", url, nil)
	if err != nil {
		return "", fmt.Errorf("failed to create request: %v", err)
	}

	req.Header.Set("Authorization", "Bearer "+jwtToken)
	req.Header.Set("Accept", "application/vnd.github.v3+json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to connect to GitHub API: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		return "", fmt.Errorf("failed to get installation token: status code %d", resp.StatusCode)
	}

	// Parse the response to get the token
	var response struct {
		Token string `json:"token"`
	}
	err = json.NewDecoder(resp.Body).Decode(&response)
	if err != nil {
		return "", fmt.Errorf("failed to parse installation token response: %v", err)
	}

	return response.Token, nil
}

func ValidateGit(appID string, privateKey []byte, installationID string) error {
	fmt.Println("Validating GitHub App connection...")

	jwtToken, err := GenerateJWT(appID, privateKey)
	if err != nil {
		return fmt.Errorf("failed to generate JWT: %v", err)
	}

	installationToken, err := GetInstallationToken(apiURL, jwtToken, installationID)
	if err != nil {
		return fmt.Errorf("failed to get installation token: %v", err)
	}

	url := fmt.Sprintf("%s/installation/repositories", apiURL)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %v", err)
	}
	req.Header.Set("Authorization", "Bearer "+installationToken)
	req.Header.Set("Accept", "application/vnd.github.v3+json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to connect to GitHub API: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to fetch repositories: status code %d", resp.StatusCode)
	}

	// Parse the response to list repositories
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response body: %v", err)
	}

	// Debugging: Print repository list (JSON response)
	fmt.Printf("GitHub Repositories Response: %s\n", string(body))
	fmt.Println("GitHub App connection validated successfully.")
	return nil
}
func ValidateGitRepo(repoURL, installationToken string) error {
	fmt.Println("Validating GitHub repository...")

	cmd := exec.Command("git", "ls-remote", repoURL)

	// Use the installation token for authentication
	cmd.Env = append(cmd.Env, "GIT_ASKPASS=echo "+installationToken)

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()
	fmt.Printf("Git Command: git ls-remote %s\n", repoURL)
	fmt.Printf("Stdout: %s\n", stdout.String())
	fmt.Printf("Stderr: %s\n", stderr.String())

	if err != nil {
		return fmt.Errorf("failed to validate Git repository: %v. Stderr: %s", err, stderr.String())
	}

	fmt.Println("Git repository validated successfully.")
	return nil
}
func ValidateOpenAICredentials(apiToken string) error {
	fmt.Println("Validating OpenAI credentials...")
	req, err := http.NewRequest("GET", "https://api.openai.com/v1/models", nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %v", err)
	}
	req.Header.Set("Authorization", "Bearer "+apiToken)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to validate OpenAI key: %v", err)
	}
	body, err := io.ReadAll(resp.Body)
if err != nil {
    return fmt.Errorf("failed to read OpenAI response: %v", err)
}
fmt.Printf("OpenAI Response: %s\n", string(body))
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("invalid OpenAI API Key. Status code: %d", resp.StatusCode)
	}

	fmt.Println("OpenAI credentials validated successfully.")
	return nil
}

func ValidateAWSCredentials(accessKey, secretKey string) error {
	fmt.Println("Validating AWS credentials...")
	sess, err := session.NewSession(&aws.Config{
		Credentials: credentials.NewStaticCredentials(accessKey, secretKey, ""),
		Region:      aws.String("us-east-1"), // Default region for validation
	})
	if err != nil {
		return fmt.Errorf("failed to create session: %v", err)
	}

	svc := s3.New(sess)
out, err := svc.ListBuckets(&s3.ListBucketsInput{})
if err != nil {
    awsErr, ok := err.(awserr.Error)
    if ok {
        fmt.Printf("AWS Error: %s, Code: %s, Message: %s\n", awsErr.Error(), awsErr.Code(), awsErr.Message())
    }
    return fmt.Errorf("invalid AWS credentials: %v", err)
}	
fmt.Println("Out: ", out)
	fmt.Println("AWS credentials validated successfully.")
	return nil
}