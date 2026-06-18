package models

import "time"

/*
	A Basic NVMS IAC Config to run say FixIt (Svelte/Gin) we'd need 2 running services for our system to function, actually, ideally 3. Our frontend hosted on an open public port, our backend similarly, and our postgres privately. We want to host all of this on a single microvm instance wherever compute is needed,

and moreover this configuration needs to be such that any other program with the same file structure and build commands could theoretically be deployed on aws via this file, as such this config also needs to directly map to the aws services we need so that each application is fully configured on deploy.

Fixit is a todolist app built on svelte, gin, and a sqlite DB (postgres in byteport)
This is a basic crud app with a minimal ui letting us statically build it, and our backend does not require persistence, which is left to our postgres instance.
As such if we wanted to deploy we would need a firecracker mvm, and a postgres instance alone, with network and security configs declaring our connections between them and end users.

firecracker actions are assumed to be handled by byteport,
(there is the question of when to prefer more mvms when services require more compute or isolation etc, this may be created as an extra spec)

# This is very much a WIP configuration

As a result we would need to provide the following in our config, a header with mostly identifying/descriptive info, a declaration of each service with its path build com and port, as well as env vars.
After this your AWSConfig declaring needed services outside of mvms, and the netsec config.
*/
type BuildPack struct {
	ID              string            `gorm:"primaryKey;type:uuid" yaml:"NAME"`
	DetectFiles     []string          `gorm:"serializer:json" yaml:"DETECT_FILES,omitempty"`
	Packages        []string          `gorm:"serializer:json" yaml:"PACKAGES"`
	PreBuild        []string          `gorm:"serializer:json" yaml:"PRE_BUILD"`
	Build           []string          `gorm:"serializer:json" yaml:"BUILD"`
	Start           string            `gorm:"type:text" yaml:"START"`
	RuntimeVersions map[string]string `gorm:"serializer:json" yaml:"RUNTIME_VERSIONS,omitempty"`
	EnvVars         map[string]string `gorm:"serializer:json" yaml:"ENV_VARS"`
}

type NVMS struct {
	ID          string    `gorm:"primaryKey;type:uuid"`
	Name        string    `gorm:"type:text;not null" yaml:"NAME"`
	Description string    `gorm:"type:text" yaml:"DESCRIPTION"`
	Services    []Service `gorm:"serializer:json" yaml:"SERVICES"`
}

type Service struct {
	ID          string            `gorm:"primaryKey;type:uuid"`
	Name        string            `gorm:"type:text;not null" yaml:"NAME"`
	Path        string            `gorm:"type:text;not null" yaml:"PATH"`
	Port        int               `gorm:"type:integer;not null" yaml:"PORT"`
	Build       []string          `gorm:"serializer:json" yaml:"BUILD,omitempty"`
	Env         map[string]string `gorm:"serializer:json" yaml:"ENV,omitempty"`
	BuildPackID string            `gorm:"type:uuid;index" yaml:"-"`
	BuildPack   *BuildPack        `gorm:"foreignKey:BuildPackID" yaml:"BUILDPACK,omitempty"`
	Runtime     string            `gorm:"type:text" yaml:"RUNTIME,omitempty"`
}

type AWSConfig struct {
	ID       string             `gorm:"primaryKey;type:uuid"`
	Region   string             `gorm:"type:text;not null"`
	Services []AWSServiceConfig `gorm:"serializer:json"`
}

type AWSServiceConfig struct {
	ID         string `gorm:"primaryKey;type:uuid"`
	Type       string `gorm:"type:text;not null"`
	Engine     string `gorm:"type:text"`
	Mode       string `gorm:"type:text"`
	Replicas   int    `gorm:"type:integer"`
	Size       string `gorm:"type:text"`
	Name       string `gorm:"type:text"`
	Partitions int    `gorm:"type:integer"`
}

type AWSResource struct {
	InstanceID string    `gorm:"primaryKey;type:uuid"`
	Type       string    `gorm:"type:text;not null;index" json:"type"`
	Name       string    `gorm:"type:text;not null" json:"name"`
	ARN        string    `gorm:"type:text" json:"arn"`
	Status     string    `gorm:"type:text" json:"status"`
	Region     string    `gorm:"type:text" json:"region"`
	Service    string    `gorm:"type:text;index" json:"service"`
	CreatedAt  time.Time `gorm:"autoCreateTime"`
	UpdatedAt  time.Time `gorm:"autoUpdateTime"`
}

type AWSResourceAssociation struct {
	ResourceID string `json:"resource_id"`
	Type       string `json:"type"` // e.g., "attachment", "dependency"
	Role       string `json:"role"` // e.g., "target", "source"
}
