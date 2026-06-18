package lib

import (
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/awserr"
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

func ValidateGit(apiURL, authMethod, authKey string) error {
	fmt.Println("Validating Git cloud connection...")

	var req *http.Request
	var err error

	if authMethod == "token" {
		req, err = http.NewRequest("GET", apiURL+"/user", nil)
		if err != nil {
			return fmt.Errorf("failed to create request: %v", err)
		}
		req.Header.Set("Authorization", "Bearer "+authKey)
	} else if authMethod == "ssh" {
		// SSH validation might involve executing a git command.
		// This example assumes API-based validation for simplicity.
		return fmt.Errorf("SSH method is not supported for API-based validation")
	} else {
		return fmt.Errorf("unsupported auth method: %s", authMethod)
	}
	
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to connect to Git cloud: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to validate Git cloud connection. Status code: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response body: %v", err)
	}

	fmt.Printf("Git Cloud Response: %s\n", string(body))
	fmt.Println("Git cloud connection validated successfully.")
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