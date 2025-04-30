package services

import (
	"github.com/wailsapp/wails/v3/pkg/application"
	"voidraft/internal/services/config"
)

// ServiceManager 服务管理器，负责协调各个服务
type ServiceManager struct {
	configService *config.ConfigService
}

// NewServiceManager 创建新的服务管理器实例
func NewServiceManager() *ServiceManager {
	// 初始化配置服务
	configService := config.NewConfigService()

	return &ServiceManager{
		configService: configService,
	}
}

// GetServices 获取所有wails服务列表
func (sm *ServiceManager) GetServices() []application.Service {
	return []application.Service{
		application.NewService(sm.configService),
	}
}

// GetConfigService 获取配置服务实例
func (sm *ServiceManager) GetConfigService() *config.ConfigService {
	return sm.configService
}
