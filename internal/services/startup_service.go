package services

import (
	"github.com/wailsapp/wails/v3/pkg/services/log"
)

// StartupService 开机启动服务
type StartupService struct {
	configService *ConfigService
	logger        *log.Service
	impl          StartupImplementation
	initError     error
}

// StartupImplementation 开机启动实现接口
type StartupImplementation interface {
	SetEnabled(enabled bool) error
	Initialize() error
}

// NewStartupService 创建开机启动服务实例
func NewStartupService(configService *ConfigService, logger *log.Service) *StartupService {
	service := &StartupService{
		configService: configService,
		logger:        logger,
		impl:          newStartupImplementation(logger),
	}

	// 初始化平台特定实现
	service.initError = service.impl.Initialize()

	return service
}

// SetEnabled 设置开机启动状态
func (s *StartupService) SetEnabled(enabled bool) error {
	// 检查初始化是否成功
	if s.initError != nil {
		return s.initError
	}

	// 设置系统开机启动
	if err := s.impl.SetEnabled(enabled); err != nil {
		return err
	}
	return nil
}
