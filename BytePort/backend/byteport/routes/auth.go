package routes

import (
	"byteport/lib"
	"byteport/models"
	"fmt"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func setAuthCookie(c *gin.Context, token string) {
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie("authToken", token, 3600, "/", c.GetHeader("Host"), true, true)
}

func Authenticate(c *gin.Context) {
	// extract token from cookie

	token, err := c.Cookie("authToken")
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// validate token and get user
	user, err := lib.AuthenticateRequest(token)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	c.Set("user", *user)

	c.JSON(http.StatusOK, gin.H{
		"message": "Success",
		"User":    user,
	})
}
func LinkHandler(c *gin.Context) {
	// Retrieve the authenticated user object
	user := c.MustGet("user").(models.User)
	fmt.Println("Linking with Github: ", user)

	lib.LinkWithGithub(c, user)
	fmt.Println("Validating Details")

}
func Login(c *gin.Context) {
	var req models.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user models.User
	if err := models.DB.Where("email = ?", req.Email).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "Failed, user not found"})
		return
	}

	if lib.ValidatePass(req.Password, user.Password) {
		// set cookie
		token, err := lib.GenerateToken(user)
		if err != nil {
			log.Printf("Error generating token: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate authentication token."})
			return
		}
		setAuthCookie(c, token)
		user.Password = ""
		c.JSON(http.StatusOK, gin.H{
			"message": "Success",
			"user":    user,
		})
	} else {
		fmt.Println("Invalid Credentials.")
		c.JSON(http.StatusUnauthorized, gin.H{
			"message": "Failed, invalid credentials",
		})
	}
}
func Signup(c *gin.Context) {
	var req models.SignupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	hash := lib.EncryptPass(req.Password)

	// Check for pre-existing user
	var existingUser models.User
	if err := models.DB.Where("email = ?", req.Email).First(&existingUser).Error; err == nil {
		// User already exists
		c.JSON(http.StatusConflict, gin.H{
			"message": "Failed, User Already Exists",
		})
		return
	}

	newUser := models.User{
		UUID:     uuid.NewString(),
		Name:     req.Name,
		Email:    req.Email,
		Password: string(hash),
	}

	// Create the new user
	if err := models.DB.Create(&newUser).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"message": "Failed to create user",
			"error":   err.Error(),
		})
		return
	}

	newUser.Password = ""
	token, err := lib.GenerateToken(newUser)
	if err != nil {
		log.Printf("Error generating token: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate authentication token."})
		return
	}
	setAuthCookie(c, token)

	c.JSON(http.StatusCreated, newUser)
}

func UpdateLink(c *gin.Context) {
	user := c.MustGet("user").(models.User)

	if user.LLMConfig.Provider == "" {
		user.LLMConfig = models.LLM{
			Provider:  "openai",
			Providers: make(map[string]models.AIProvider),
		}
	}
	if user.LLMConfig.Providers == nil {
		user.LLMConfig.Providers = make(map[string]models.AIProvider)
	}
	decryptedOAI := "err"
	var err error
	if !(user.LLMConfig.Provider == "local") {
		decryptedOAI, err = lib.DecryptSecret(user.LLMConfig.Providers[user.LLMConfig.Provider].APIKey)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decrypt OAI"})
			return
		}
	}
	decryptedAWSAccess, err := lib.DecryptSecret(user.AwsCreds.AccessKeyID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decrypt AWS Access"})
		return
	}
	decryptedAWSSecret, err := lib.DecryptSecret(user.AwsCreds.SecretAccessKey)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decrypt AWS Secret"})
		return
	}
	decryptedPortfolioURL, err := lib.DecryptSecret(user.Portfolio.RootEndpoint)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decrypt Portfolio URL"})
		return
	}
	decryptedPortfolioKey, err := lib.DecryptSecret(user.Portfolio.APIKey)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decrypt Portfolio Key "})
		return
	}
	user.AwsCreds = models.AwsCreds{
		AccessKeyID:     decryptedAWSAccess,
		SecretAccessKey: decryptedAWSSecret,
	}
	user.Portfolio = models.Portfolio{
		RootEndpoint: decryptedPortfolioURL,
		APIKey:       decryptedPortfolioKey,
	}
	provider := user.LLMConfig.Providers[user.LLMConfig.Provider]
	provider.APIKey = decryptedOAI
	user.LLMConfig.Providers[user.LLMConfig.Provider] = provider
	// return new user obj
	user.Password = ""
	c.JSON(http.StatusOK, user)

}
func UpdateUser(c *gin.Context) {
	user := c.MustGet("user").(models.User)
	var req models.User
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Name != "" {
		user.Name = req.Name
	}
	if req.Email != "" {
		user.Email = req.Email
	}
	if req.Password != "" {
		hash := lib.EncryptPass(req.Password)
		user.Password = string(hash)
	}
	if err := models.DB.Save(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"message": "Failed to update user",
			"error":   err.Error(),
		})
		return
	}
	user.Password = ""
	c.JSON(http.StatusOK, user)

}
