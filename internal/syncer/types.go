package syncer

// Logger describes the minimal logger used by the sync module.
type Logger interface {
	Debug(message string, args ...interface{})
	Info(message string, args ...interface{})
	Warning(message string, args ...interface{})
	Error(message string, args ...interface{})
}

// SyncResult describes one sync execution result.
type SyncResult struct {
	TargetID       string
	LocalChanged   bool
	RemoteChanged  bool
	AppliedToLocal bool
	Published      bool
}
