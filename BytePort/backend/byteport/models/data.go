package models

import (
	"gorm.io/driver/sqlite"
	_ "gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var DB *gorm.DB

func ConnectDatabase() {
	database, err := gorm.Open(sqlite.Open("../database.db"), &gorm.Config{})

	if err != nil {
		panic("Failed to connect to database!")
	}

	// AutoMigrate models in the correct order
	err = database.AutoMigrate(&User{}, &Project{}, &Instance{}, &GitSecret{})
	if err != nil {
		panic(err)
	}

	DB = database
}
