package models

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

/*
UUID        string     `json:"uuid"`
Owner       string     `json:"owner"`
User        User       `json:"user"`
Name        string     `json:"name"`

RepositoryID string     `json:"repository_id"`
Repository   Repository `json:"repository"`
DeploymentsJSON string              `gorm:"type:jsonb;column:deployments"`
NvmsConfig  NVMS       `json:"nvms_config"`
Readme      string     `json:"readme"`
Description string     `json:"description"`
LastUpdated time.Time  `json:"last_updated"`
Platform    string     `json:"platform"`
AccessURL   string     `json:"access_url"`
Type        string     `json:"type"`
*/
type Project struct {
	gorm.Model
	UUID  string `gorm:"type:text;primaryKey" json:"uuid,omitempty"`
	ID    string `gorm:"type:text;primaryKey;not null" json:"id,omitempty"`
	Owner string `gorm:"type:text;not null;index" json:"owner,omitempty"`
	User  User   `gorm:"foreignKey:Owner;references:UUID" json:"user,omitempty"`
	Name  string `gorm:"type:text;not null" json:"name,omitempty"`

	RepositoryID string     `gorm:"type:text;index" json:"repository_id,omitempty"`
	Repository   Repository `gorm:"foreignKey:RepositoryID;references:ID" json:"repository,omitempty"`

	Readme      string    `gorm:"type:text" json:"readme,omitempty"`
	Description string    `gorm:"type:text" json:"description,omitempty"`
	LastUpdated time.Time `gorm:"autoUpdateTime" json:"last_updated,omitempty"`
	Platform    string    `gorm:"type:text" json:"platform,omitempty"`
	AccessURL   string    `gorm:"type:text" json:"access_url,omitempty"`
	Type        string    `gorm:"type:text" json:"type,omitempty"`

	DeploymentsJSON string              `gorm:"type:jsonb;column:deployments"  `
	deployments     map[string]Instance `json:"-"` // private field, excluded from JSON
}

func (p *Project) GetDeploy() map[string]Instance {
	return p.deployments
}
func (p *Project) SetDeploy(deploy map[string]Instance) {
	p.deployments = deploy
}
func (p *Project) BeforeSave(tx *gorm.DB) error {
	fmt.Println("BeforeSave")
	if p.deployments != nil {
		fmt.Println("Saving deployments: ", p.deployments)
		data, err := json.Marshal(p.deployments)
		if err != nil {
			return err
		}
		p.DeploymentsJSON = string(data)
		fmt.Println("Saving deployments: ", p.DeploymentsJSON)
	}
	if p.UUID == "" {
		fmt.Println("Generating UUID")
		p.UUID = uuid.New().String()
	}
	return nil
}

func (p *Project) AfterFind(tx *gorm.DB) error {
	if p.DeploymentsJSON != "" {
		return json.Unmarshal([]byte(p.DeploymentsJSON), &p.deployments)
	}
	p.deployments = make(map[string]Instance)
	return nil
}
