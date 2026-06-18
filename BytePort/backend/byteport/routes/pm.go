package routes

import (
	"byteport/models"
	"fmt"
)

func addNewProject(project models.Project) error {
	fmt.Println("Adding project to db: ", project)
	result := models.DB.Create(&project)
	return result.Error

}
func removeProject(project models.Project) error {
	fmt.Println("Removing Project From DB: ", project)
	result := models.DB.Delete(&project)
	return result.Error

}
