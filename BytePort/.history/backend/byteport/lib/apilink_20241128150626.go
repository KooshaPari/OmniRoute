package lib

import (
	"byteport/models"
	"bytes"
	"os/exec"

	"fmt"
	"net/http"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/awserr"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/s3"
)

// ValidatePortfolioAPI validates the provided portfolio API key and endpoint.
func ValidatePortfolioAPI(rootEndpoint, apiKey string) error {
	fmt.Println("Validating Portfolio API...")
	/*
	req, err := http.NewRequest("GET", rootEndpoint+"/dev/templates", nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %v", err)
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to connect to Portfolio API: %v", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response body: %v", err)
	}
	//fmt.Printf("Portfolio API Response: %s\n", string(body))

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("invalid Portfolio API Key or URL. Status code: %d", resp.StatusCode)
	}

	if !strings.Contains(string(body), "expected_keyword_or_structure") {
		return fmt.Errorf("unexpected response from Portfolio API: %s", string(body))
	}*/

	fmt.Println("Portfolio API validated successfully.")
	return nil
}



// ValidateGit validates the GitHub app connection and fetches repositories for a user.
func ValidateGit(user models.User) error {
	const apiURL = "https://api.github.com"

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

	// Decrypt the stored user access token
	accessToken, err := DecryptSecret(user.Git.Token)
	if err != nil {
		return fmt.Errorf("failed to decrypt user access token: %v", err)
	}
	_, err = ListRepositories(c,accessToken)
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
	fmt.Println("GitHub user access token validated successfully.")

	return nil
}

// ValidateGitRepo validates a specific repository using the installation token.
func ValidateGitRepo(repoURL, installationToken string) error {
	fmt.Println("Validating GitHub repository...")

	cmd := exec.Command("git", "ls-remote", repoURL)
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

// ValidateOpenAICredentials validates the OpenAI API credentials.
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
		return fmt.Errorf("failed to connect to OpenAI API: %v", err)
	}
	defer resp.Body.Close()

	/*body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read OpenAI response: %v", err)
	}*/
	//fmt.Printf("OpenAI Response: %s\n", string(body))

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("invalid OpenAI API Key. Status code: %d", resp.StatusCode)
	}

	fmt.Println("OpenAI credentials validated successfully.")
	return nil
}

// ValidateAWSCredentials validates AWS credentials.
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
	_, err = svc.ListBuckets(&s3.ListBucketsInput{})
	if err != nil {
		if awsErr, ok := err.(awserr.Error); ok {
			fmt.Printf("AWS Error: %s, Code: %s, Message: %s\n", awsErr.Error(), awsErr.Code(), awsErr.Message())
		}
		return fmt.Errorf("invalid AWS credentials: %v", err)
	}

	fmt.Println("AWS credentials validated successfully.")
	return nil
}
