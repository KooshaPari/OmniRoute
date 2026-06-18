package lib


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
        Credentials: credentials.NewStaticCredentials(accessKeyID, secretAccessKey, ""),
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
}*/