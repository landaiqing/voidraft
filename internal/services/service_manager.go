package services

import (
	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/services/log"
)

// ServiceManager 服务管理器，负责协调各个服务
type ServiceManager struct {
	configService *ConfigService
	logger        *log.LoggerService
}

// NewServiceManager 创建新的服务管理器实例
func NewServiceManager() *ServiceManager {
	// 初始化日志服务
	logger := log.New()

	// 初始化配置服务
	configService := NewConfigService(ConfigOption{
		Logger:          logger,
		PathProvider:    nil,
		AutoSaveEnabled: true,
	})

	return &ServiceManager{
		configService: configService,
		logger:        logger,
	}
}

// GetServices 获取所有wails服务列表
func (sm *ServiceManager) GetServices() []application.Service {
	return []application.Service{
		application.NewService(sm.configService),
	}
}

// GetConfigService 获取配置服务实例
func (sm *ServiceManager) GetConfigService() *ConfigService {
	return sm.configService
}
