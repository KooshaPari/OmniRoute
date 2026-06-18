package lib

import (
	"fmt"
	"net/http"
	"os/exec"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/session"
)


func ValidatePortfolioAPI(rootEndpoint, apiKey string) error{
	req, err := http.NewRequest("GET", rootEndpoint+"/dev/templates", nil)
    if err != nil {
        return fmt.Errorf("failed to create request: %v", err)
    }
    req.Header.Set("Authorization", "Bearer "+apiKey)

    client := &http.Client{}
    resp, err := client.Do(req)
    if err != nil {
        return fmt.Errorf("failed to validate portfolio API: %v", err)
    }
    defer resp.Body.Close()

    if resp.StatusCode != http.StatusOK {
        return fmt.Errorf("invalid Portfolio API Key or URL")
    }

    return nil
}
func ValidateGitRepo(repoURL, authMethod, authKey, targetDirectory string) error{
	cmd := exec.Command("git", "clone", repoURL, targetDirectory)
    if authMethod == "ssh" {
        cmd.Env = append(cmd.Env, "GIT_SSH_COMMAND=ssh -i "+authKey)
    }
	else if authMethod == "token" {
		cmd.Env = append(cmd.Env, "GIT_AUTH_TOKEN="+authKey)
	}
    err := cmd.Run()
    if err != nil {
        return fmt.Errorf("failed to clone repository: %v", err)
    }
    return nil
}
func ValidateOpenAICredentials(apiToken string) error{
	req, err := http.NewRequest("GET", "https://api.openai.com/v1/models", nil)
    if err != nil {
        return fmt.Errorf("failed to create request: %v", err)
    }
    req.Header.Set("Authorization", "Bearer "+apiKey)

    client := &http.Client{}
    resp, err := client.Do(req)
    if err != nil {
        return fmt.Errorf("failed to validate OpenAI key: %v", err)
    }
    defer resp.Body.Close()

    if resp.StatusCode != http.StatusOK {
        return fmt.Errorf("invalid OpenAI API Key")
    }

    return nil
}
func ValidateAWSCredentials(accessKey, secretKey string) error{
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

    return nil

    return nil
}