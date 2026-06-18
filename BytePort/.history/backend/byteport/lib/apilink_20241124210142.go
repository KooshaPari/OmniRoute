package lib

import "fmt"


func ValidatePortfolioAPI(rootEndpoint, apiKey string) error{
	return nil
}
func ValidateGitRepo(repoURL, authMethod, authKey, targetDirectory string) error{
	return nil
}
func ValidateOpenAICredentials(apiToken string) error{
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



    return nil
}