package services

import (
	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/services/log"
)

// ServiceManager 服务管理器，负责协调各个服务
type ServiceManager struct {
	configService   *ConfigService
	documentService *DocumentService
	logger          *log.LoggerService
}

// NewServiceManager 创建新的服务管理器实例
func NewServiceManager() *ServiceManager {
	// 初始化日志服务
	logger := log.New()

	// 初始化配置服务
	configService := NewConfigService(ConfigOption{
		Logger:       logger,
		PathProvider: nil,
	})

	// 初始化文档服务
	documentService := NewDocumentService(configService, logger)

	// 初始化文档服务
	err := documentService.Initialize()
	if err != nil {
		logger.Error("Failed to initialize document service", "error", err)
		panic(err)
	}

	return &ServiceManager{
		configService:   configService,
		documentService: documentService,
		logger:          logger,
	}
}

// GetServices 获取所有wails服务列表
func (sm *ServiceManager) GetServices() []application.Service {
	return []application.Service{
		application.NewService(sm.configService),
		application.NewService(sm.documentService),
	}
}
