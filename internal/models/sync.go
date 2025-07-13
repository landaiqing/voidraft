package models

import "time"

// AuthMethod 定义Git认证方式
type AuthMethod string

const (
	Token    AuthMethod = "token"     // 个人访问令牌
	SSHKey   AuthMethod = "ssh_key"   // SSH密钥
	UserPass AuthMethod = "user_pass" // 用户名密码
)

// SyncStrategy 定义同步策略
type SyncStrategy string

const (
	// LocalFirst 本地优先：如有冲突，保留本地修改
	LocalFirst SyncStrategy = "local_first"
	// RemoteFirst 远程优先：如有冲突，采用远程版本
	RemoteFirst SyncStrategy = "remote_first"
)

// GitSyncConfig 保存Git同步的配置信息
type GitSyncConfig struct {
	Enabled          bool         `json:"enabled"`
	RepoURL          string       `json:"repo_url"`
	Branch           string       `json:"branch"`
	AuthMethod       AuthMethod   `json:"auth_method"`
	Username         string       `json:"username,omitempty"`
	Password         string       `json:"password,omitempty"`
	Token            string       `json:"token,omitempty"`
	SSHKeyPath       string       `json:"ssh_key_path,omitempty"`
	SSHKeyPassphrase string       `json:"ssh_key_passphrase,omitempty"`
	SyncInterval     int          `json:"sync_interval"` // 同步间隔（分钟）
	LastSyncTime     time.Time    `json:"last_sync_time"`
	AutoSync         bool         `json:"auto_sync"` // 是否启用自动同步
	LocalRepoPath    string       `json:"local_repo_path"`
	SyncStrategy     SyncStrategy `json:"sync_strategy"` // 合并冲突策略
	FilesToSync      []string     `json:"files_to_sync"` // 要同步的文件列表，默认为数据库文件
}

// GitSyncStatus 保存同步状态信息
type GitSyncStatus struct {
	IsSyncing      bool      `json:"is_syncing"`
	LastSyncTime   time.Time `json:"last_sync_time"`
	LastSyncStatus string    `json:"last_sync_status"` // success, failed, conflict
	LastErrorMsg   string    `json:"last_error_msg,omitempty"`
	LastCommitID   string    `json:"last_commit_id,omitempty"`
	RemoteCommitID string    `json:"remote_commit_id,omitempty"`
	CommitAhead    int       `json:"commit_ahead"`  // 本地领先远程的提交数
	CommitBehind   int       `json:"commit_behind"` // 本地落后远程的提交数
}

// SyncLogEntry 记录每次同步操作的日志
type SyncLogEntry struct {
	ID           int64     `json:"id"`
	Timestamp    time.Time `json:"timestamp"`
	Action       string    `json:"action"` // push, pull, reset
	Status       string    `json:"status"` // success, failed
	Message      string    `json:"message,omitempty"`
	ChangedFiles int       `json:"changed_files"`
}
