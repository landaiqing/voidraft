package syncer

import "errors"

var (
	// ErrTargetNotFound 表示目标不存在。
	ErrTargetNotFound = errors.New("sync target not found")
	// ErrTargetDisabled 表示目标未启用。
	ErrTargetDisabled = errors.New("sync target is disabled")
	// ErrTargetNotReady 表示目标缺少必要配置。
	ErrTargetNotReady = errors.New("sync target is not ready")
	// ErrUnsupportedBackend 表示后端类型未实现。
	ErrUnsupportedBackend = errors.New("sync backend is not supported")
	// ErrUnsupportedDriver 表示后端驱动未实现。
	ErrUnsupportedDriver = errors.New("sync driver is not supported")
)
