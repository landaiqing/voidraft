package models

// Git备份相关类型定义
type (
	// AuthMethod 定义Git认证方式
	AuthMethod string
)

const (
	// 认证方式
	Token    AuthMethod = "token"
	SSHKey   AuthMethod = "ssh_key"
	UserPass AuthMethod = "user_pass"
)

// GitBackupConfig Git备份配置
type GitBackupConfig struct {
	Enabled        bool       `json:"enabled"`
	RepoURL        string     `json:"repo_url"`
	AuthMethod     AuthMethod `json:"auth_method"`
	Username       string     `json:"username,omitempty"`
	Password       string     `json:"password,omitempty"`
	Token          string     `json:"token,omitempty"`
	SSHKeyPath     string     `json:"ssh_key_path,omitempty"`
	SSHKeyPass     string     `json:"ssh_key_passphrase,omitempty"`
	BackupInterval int        `json:"backup_interval"` // 分钟
	AutoBackup     bool       `json:"auto_backup"`
}
