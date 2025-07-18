package services

import (
	"voidraft/internal/models"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/services/log"
)

// ServiceManager 服务管理器，负责协调各个服务
type ServiceManager struct {
	configService      *ConfigService
	databaseService    *DatabaseService
	documentService    *DocumentService
	windowService      *WindowService
	migrationService   *MigrationService
	systemService      *SystemService
	hotkeyService      *HotkeyService
	dialogService      *DialogService
	trayService        *TrayService
	keyBindingService  *KeyBindingService
	extensionService   *ExtensionService
	startupService     *StartupService
	selfUpdateService  *SelfUpdateService
	translationService *TranslationService
	BackupService      *BackupService
	logger             *log.Service
}

// NewServiceManager 创建新的服务管理器实例
func NewServiceManager() *ServiceManager {
	// 初始化日志服务
	logger := log.New()

	// 初始化配置服务
	configService := NewConfigService(logger)

	// 初始化数据库服务
	databaseService := NewDatabaseService(configService, logger)

	// 初始化迁移服务
	migrationService := NewMigrationService(logger)

	// 初始化文档服务
	documentService := NewDocumentService(databaseService, logger)

	// 初始化窗口服务
	windowService := NewWindowService(logger, documentService)

	// 初始化系统服务
	systemService := NewSystemService(logger)

	// 初始化热键服务
	hotkeyService := NewHotkeyService(configService, logger)

	// 初始化对话服务
	dialogService := NewDialogService(logger)

	// 初始化托盘服务
	trayService := NewTrayService(logger, configService)

	// 初始化快捷键服务
	keyBindingService := NewKeyBindingService(databaseService, logger)

	// 初始化扩展服务
	extensionService := NewExtensionService(databaseService, logger)

	// 初始化开机启动服务
	startupService := NewStartupService(configService, logger)

	// 初始化自我更新服务
	selfUpdateService, err := NewSelfUpdateService(configService, logger)
	if err != nil {
		panic(err)
	}

	// 初始化翻译服务
	translationService := NewTranslationService(logger)

	// 初始化备份服务
	backupService := NewBackupService(configService, databaseService, logger)

	// 使用新的配置通知系统设置热键配置变更监听
	err = configService.SetHotkeyChangeCallback(func(enable bool, hotkey *models.HotkeyCombo) error {
		return hotkeyService.UpdateHotkey(enable, hotkey)
	})
	if err != nil {
		panic(err)
	}

	// 设置数据路径变更监听，处理配置重置和路径变更
	err = configService.SetDataPathChangeCallback(func() error {
		return databaseService.OnDataPathChanged()
	})
	if err != nil {
		panic(err)
	}

	// 设置备份配置变更监听，处理备份配置变更
	err = configService.SetBackupConfigChangeCallback(func(config *models.GitBackupConfig) error {
		return backupService.HandleConfigChange(config)
	})
	if err != nil {
		panic(err)
	}

	return &ServiceManager{
		configService:      configService,
		databaseService:    databaseService,
		documentService:    documentService,
		windowService:      windowService,
		migrationService:   migrationService,
		systemService:      systemService,
		hotkeyService:      hotkeyService,
		dialogService:      dialogService,
		trayService:        trayService,
		keyBindingService:  keyBindingService,
		extensionService:   extensionService,
		startupService:     startupService,
		selfUpdateService:  selfUpdateService,
		translationService: translationService,
		BackupService:      backupService,
		logger:             logger,
	}
}

// GetServices 获取所有wails服务列表
func (sm *ServiceManager) GetServices() []application.Service {
	services := []application.Service{
		application.NewService(sm.configService),
		application.NewService(sm.databaseService),
		application.NewService(sm.documentService),
		application.NewService(sm.windowService),
		application.NewService(sm.keyBindingService),
		application.NewService(sm.extensionService),
		application.NewService(sm.migrationService),
		application.NewService(sm.systemService),
		application.NewService(sm.hotkeyService),
		application.NewService(sm.dialogService),
		application.NewService(sm.trayService),
		application.NewService(sm.startupService),
		application.NewService(sm.selfUpdateService),
		application.NewService(sm.translationService),
		application.NewService(sm.BackupService),
	}
	return services
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
func (sm *ServiceManager) GetLogger() *log.Service {
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

// GetKeyBindingService 获取快捷键服务实例
func (sm *ServiceManager) GetKeyBindingService() *KeyBindingService {
	return sm.keyBindingService
}

// GetStartupService 获取开机启动服务实例
func (sm *ServiceManager) GetStartupService() *StartupService {
	return sm.startupService
}

// GetExtensionService 获取扩展服务实例
func (sm *ServiceManager) GetExtensionService() *ExtensionService {
	return sm.extensionService
}

// GetSelfUpdateService 获取自我更新服务实例
func (sm *ServiceManager) GetSelfUpdateService() *SelfUpdateService {
	return sm.selfUpdateService
}

// GetTranslationService 获取翻译服务实例
func (sm *ServiceManager) GetTranslationService() *TranslationService {
	return sm.translationService
}

// GetDatabaseService 获取数据库服务实例
func (sm *ServiceManager) GetDatabaseService() *DatabaseService {
	return sm.databaseService
}

// GetWindowService 获取窗口服务实例
func (sm *ServiceManager) GetWindowService() *WindowService {
	return sm.windowService
}

// GetDocumentService 获取文档服务实例
func (sm *ServiceManager) GetDocumentService() *DocumentService {
	return sm.documentService
}
