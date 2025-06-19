package services

import (
	"voidraft/internal/models"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/services/log"
)

// ServiceManager 服务管理器，负责协调各个服务
type ServiceManager struct {
	configService    *ConfigService
	documentService  *DocumentService
	migrationService *MigrationService
	systemService    *SystemService
	hotkeyService    *HotkeyService
	dialogService    *DialogService
	trayService      *TrayService
	logger           *log.LoggerService
}

// NewServiceManager 创建新的服务管理器实例
func NewServiceManager() *ServiceManager {
	// 初始化日志服务
	logger := log.New()

	// 初始化配置服务 - 使用固定配置（当前目录下的 config/config.yaml）
	configService := NewConfigService(logger)

	// 初始化迁移服务
	migrationService := NewMigrationService(logger)

	// 初始化文档服务
	documentService := NewDocumentService(configService, logger)

	// 初始化系统服务
	systemService := NewSystemService(logger)

	// 初始化热键服务
	hotkeyService := NewHotkeyService(configService, logger)

	// 初始化对话服务
	dialogService := NewDialogService(logger)

	// 初始化托盘服务
	trayService := NewTrayService(logger, configService)

	// 使用新的配置通知系统设置热键配置变更监听
	err := configService.SetHotkeyChangeCallback(func(enable bool, hotkey *models.HotkeyCombo) error {
		return hotkeyService.UpdateHotkey(enable, hotkey)
	})
	if err != nil {
		logger.Error("Failed to set hotkey change callback", "error", err)
		panic(err)
	}

	// 设置数据路径变更监听，处理配置重置和路径变更
	err = configService.SetDataPathChangeCallback(func(oldPath, newPath string) error {
		return documentService.OnDataPathChanged(oldPath, newPath)
	})
	if err != nil {
		logger.Error("Failed to set data path change callback", "error", err)
		panic(err)
	}

	// 初始化文档服务
	err = documentService.Initialize()
	if err != nil {
		logger.Error("Failed to initialize document service", "error", err)
		panic(err)
	}

	return &ServiceManager{
		configService:    configService,
		documentService:  documentService,
		migrationService: migrationService,
		systemService:    systemService,
		hotkeyService:    hotkeyService,
		dialogService:    dialogService,
		trayService:      trayService,
		logger:           logger,
	}
}

// GetServices 获取所有wails服务列表
func (sm *ServiceManager) GetServices() []application.Service {
	return []application.Service{
		application.NewService(sm.configService),
		application.NewService(sm.documentService),
		application.NewService(sm.migrationService),
		application.NewService(sm.systemService),
		application.NewService(sm.hotkeyService),
		application.NewService(sm.dialogService),
		application.NewService(sm.trayService),
	}
}

// GetHotkeyService 获取热键服务实例
func (sm *ServiceManager) GetHotkeyService() *HotkeyService {
	return sm.hotkeyService
}

// GetDialogService 获取对话框服务实例
func (sm *ServiceManager) GetDialogService() *DialogService {
	return sm.dialogService
}

// GetLogger 获取日志服务实例
func (sm *ServiceManager) GetLogger() *log.LoggerService {
	return sm.logger
}

// GetConfigService 获取配置服务实例
func (sm *ServiceManager) GetConfigService() *ConfigService {
	return sm.configService
}

// GetTrayService 获取托盘服务实例
func (sm *ServiceManager) GetTrayService() *TrayService {
	return sm.trayService
}
