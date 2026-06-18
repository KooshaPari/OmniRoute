package routes

import (
	"byteport/models"
	"net/http"

	"github.com/gin-gonic/gin"
)

func GetProjects(c *gin.Context) {
	var projects []models.Project
	models.DB.Find(&projects).Where("owner = ?", c.MustGet("user").(models.User).UUID)
	for _, project := range projects {
		err := project.AfterFind(models.DB)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		}
	}

	c.JSON(http.StatusOK, projects)
}
