package lib

import (
	"fmt"
	"io"
	"net/http"
	"os/exec"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/s3"
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
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("invalid Portfolio API Key or URL. Status code: %d", resp.StatusCode)
	}

	fmt.Println("Portfolio API validated successfully.")
	return nil
}

func ValidateGitRepo(repoURL, authMethod, authKey string) error {
	fmt.Println("Validating Git repository...")
	cmd := exec.Command("git", "ls-remote", repoURL)
	if authMethod == "ssh" {
		cmd.Env = append(cmd.Env, "GIT_SSH_COMMAND=ssh -i "+authKey)
	} else if authMethod == "token" {
		cmd.Env = append(cmd.Env, "GIT_AUTH_TOKEN="+authKey)
	}
	err := cmd.Run()
	if err != nil {
		return fmt.Errorf("failed to check repository: %v", err)
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

	// Test the credentials by calling an AWS service (e.g., S3 ListBuckets)
	svc := s3.New(sess)
	_, err = svc.ListBuckets(&s3.ListBucketsInput{})
	if err != nil {
		return fmt.Errorf("invalid AWS credentials: %v", err)
	}

	fmt.Println("AWS credentials validated successfully.")
	return nil
}