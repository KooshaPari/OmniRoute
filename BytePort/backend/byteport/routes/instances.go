package routes

import (
	"byteport/models"
	"net/http"

	"github.com/gin-gonic/gin"
)

func GetInstances(c *gin.Context) {
	var instances []models.Instance
	models.DB.Find(&instances).Where("owner = ?", c.MustGet("user").(models.User).UUID)
	c.JSON(http.StatusOK, instances)
}
