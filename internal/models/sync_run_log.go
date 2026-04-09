package models

// SyncRunTriggerType 描述同步触发来源。
type SyncRunTriggerType string

const (
	// SyncRunTriggerManual 表示手动触发。
	SyncRunTriggerManual SyncRunTriggerType = "manual"
	// SyncRunTriggerAuto 表示自动同步触发。
	SyncRunTriggerAuto SyncRunTriggerType = "auto"
)

// SyncRunStatus 描述同步执行结果。
type SyncRunStatus string

const (
	// SyncRunStatusSuccess 表示同步成功。
	SyncRunStatusSuccess SyncRunStatus = "success"
	// SyncRunStatusFailed 表示同步失败。
	SyncRunStatusFailed SyncRunStatus = "failed"
)

// SyncRunChanges 描述一次同步的合并变更统计。
type SyncRunChanges struct {
	Added   int `json:"added"`
	Updated int `json:"updated"`
	Deleted int `json:"deleted"`
}

// SyncRunFlow 描述一次同步的数据流向。
type SyncRunFlow struct {
	Pulled bool `json:"pulled"`
	Pushed bool `json:"pushed"`
}

// SyncRunErrorDetail 描述失败详情。
type SyncRunErrorDetail struct {
	Stage     string `json:"stage"`
	Message   string `json:"message"`
	Retryable bool   `json:"retryable"`
}

// SyncRunPaths 描述排障相关路径信息。
type SyncRunPaths struct {
	DataPath string `json:"data_path,omitempty"`
	RepoPath string `json:"repo_path,omitempty"`
}

// SyncRunDetails 描述一次同步的详细信息。
type SyncRunDetails struct {
	Attempt     int                 `json:"attempt"`
	MaxAttempts int                 `json:"max_attempts"`
	Changes     SyncRunChanges      `json:"changes"`
	Flow        SyncRunFlow         `json:"flow"`
	Error       *SyncRunErrorDetail `json:"error,omitempty"`
	Paths       SyncRunPaths        `json:"paths"`
}

// SyncRunRecord 描述前端展示所需的一条同步记录。
type SyncRunRecord struct {
	ID          int                `json:"id"`
	TargetType  SyncTarget         `json:"target_type"`
	TargetPath  string             `json:"target_path"`
	Branch      string             `json:"branch"`
	TriggerType SyncRunTriggerType `json:"trigger_type"`
	Status      SyncRunStatus      `json:"status"`
	StartedAt   string             `json:"started_at"`
	FinishedAt  string             `json:"finished_at"`
	Details     SyncRunDetails     `json:"details"`
}
