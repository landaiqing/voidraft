package syncer

// Logger 描述同步模块需要的最小日志接口。
type Logger interface {
	Debug(message string, args ...interface{})
	Info(message string, args ...interface{})
	Warning(message string, args ...interface{})
	Error(message string, args ...interface{})
}

// SyncResult 描述一次同步的结果。
type SyncResult struct {
	TargetID       string
	LocalChanged   bool
	RemoteChanged  bool
	AppliedToLocal bool
	Published      bool
	ConflictCount  int
	Revision       string
}
