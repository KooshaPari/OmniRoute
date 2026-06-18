package models

type Owner struct {
	ID        uint   `gorm:"primary_key" json:"id"`
	Login     string `gorm:"not null" json:"login"`
	NodeID    string `gorm:"not null" json:"node_id"`
	AvatarURL string `gorm:"not null" json:"avatar_url"`
	HTMLURL   string `gorm:"not null" json:"html_url"`
	Type      string `gorm:"not null" json:"type"`
	SiteAdmin bool   `gorm:"not null" json:"site_admin"`
}

type Permissions struct {
	Admin    bool `gorm:"not null" json:"admin"`
	Maintain bool `gorm:"not null" json:"maintain"`
	Push     bool `gorm:"not null" json:"push"`
	Triage   bool `gorm:"not null" json:"triage"`
	Pull     bool `gorm:"not null" json:"pull"`
}

type Repository struct {
	ID                       uint        `gorm:"primary_key" json:"id"`
	NodeID                   string      `gorm:"not null" json:"node_id"`
	Name                     string      `gorm:"not null" json:"name"`
	FullName                 string      `gorm:"not null" json:"full_name"`
	Private                  bool        `gorm:"not null" json:"private"`
	OwnerID                  uint        `gorm:"not null" json:"owner_id"`
	Owner                    Owner       `gorm:"foreignkey:OwnerID" json:"owner"`
	HTMLURL                  string      `gorm:"not null" json:"html_url"`
	Description              string      `gorm:"null" json:"description"`
	Fork                     bool        `gorm:"not null" json:"fork"`
	CreatedAt                string      `gorm:"not null" json:"created_at"`
	UpdatedAt                string      `gorm:"not null" json:"updated_at"`
	PushedAt                 string      `gorm:"not null" json:"pushed_at"`
	SSHURL                   string      `gorm:"not null" json:"ssh_url"`
	CloneURL                 string      `gorm:"not null" json:"clone_url"`
	SVNURL                   string      `gorm:"not null" json:"svn_url"`
	Homepage                 string      `gorm:"null" json:"homepage"`
	Size                     uint        `gorm:"not null" json:"size"`
	StargazersCount          uint        `gorm:"not null" json:"stargazers_count"`
	WatchersCount            uint        `gorm:"not null" json:"watchers_count"`
	Language                 string      `gorm:"null" json:"language"`
	HasIssues                bool        `gorm:"not null" json:"has_issues"`
	HasProjects              bool        `gorm:"not null" json:"has_projects"`
	HasDownloads             bool        `gorm:"not null" json:"has_downloads"`
	HasWiki                  bool        `gorm:"not null" json:"has_wiki"`
	HasPages                 bool        `gorm:"not null" json:"has_pages"`
	HasDiscussions           bool        `gorm:"not null" json:"has_discussions"`
	ForksCount               uint        `gorm:"not null" json:"forks_count"`
	MirrorURL                string      `gorm:"null" json:"mirror_url"`
	Archived                 bool        `gorm:"not null" json:"archived"`
	ArchiveURL               string      `gorm:"null" json:"archive_url"`
	Disabled                 bool        `gorm:"not null" json:"disabled"`
	OpenIssuesCount          uint        `gorm:"not null" json:"open_issues_count"`
	License                  string      `gorm:"null" json:"license"`
	AllowForking             bool        `gorm:"not null" json:"allow_forking"`
	IsTemplate               bool        `gorm:"not null" json:"is_template"`
	WebCommitSignoffRequired bool        `gorm:"not null" json:"web_commit_signoff_required"`
	Topics                   []string    `gorm:"-" json:"topics"`
	Visibility               string      `gorm:"not null" json:"visibility"`
	Forks                    uint        `gorm:"not null" json:"forks"`
	OpenIssues               uint        `gorm:"not null" json:"open_issues"`
	Watchers                 uint        `gorm:"not null" json:"watchers"`
	DefaultBranch            string      `gorm:"not null" json:"default_branch"`
	Permissions              Permissions `gorm:"embedded" json:"permissions"`
}
