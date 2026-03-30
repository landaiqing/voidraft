package services

import (
	"log/slog"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/services/dock"
	"github.com/wailsapp/wails/v3/pkg/services/log"
	"github.com/wailsapp/wails/v3/pkg/services/notifications"
)

// ServiceManager coordinates app services.
type ServiceManager struct {
	configService       *ConfigService
	databaseService     *DatabaseService
	documentService     *DocumentService
	mediaHTTPService    *MediaHTTPService
	windowService       *WindowService
	windowSnapService   *WindowSnapService
	migrationService    *MigrationService
	systemService       *SystemService
	hotkeyService       *HotkeyService
	dialogService       *DialogService
	trayService         *TrayService
	keyBindingService   *KeyBindingService
	extensionService    *ExtensionService
	startupService      *StartupService
	selfUpdateService   *SelfUpdateService
	translationService  *TranslationService
	themeService        *ThemeService
	badgeService        *dock.DockService
	notificationService *notifications.NotificationService
	testService         *TestService
	SyncService         *SyncService
	httpClientService   *HttpClientService
	logger              *log.LogService
}

// NewServiceManager creates a new service manager instance.
func NewServiceManager() *ServiceManager {
	logger := log.NewWithConfig(&log.Config{
		LogLevel: slog.LevelDebug,
	})

	badgeService := dock.New()
	notificationService := notifications.New()
	configService := NewConfigService(logger)
	databaseService := NewDatabaseService(configService, logger)
	migrationService := NewMigrationService(databaseService, configService, logger)
	documentService := NewDocumentService(databaseService, logger)
	mediaHTTPService := NewMediaHTTPService(configService, logger)
	windowSnapService := NewWindowSnapService(logger, configService)
	windowService := NewWindowService(logger, documentService, windowSnapService)
	systemService := NewSystemService(logger)
	hotkeyService := NewHotkeyService(configService, logger)
	dialogService := NewDialogService(logger)
	trayService := NewTrayService(logger, configService)
	keyBindingService := NewKeyBindingService(databaseService, logger)
	extensionService := NewExtensionService(databaseService, logger)
	startupService := NewStartupService(configService, logger)
	selfUpdateService := NewSelfUpdateService(configService, badgeService, notificationService, logger)
	translationService := NewTranslationService(logger)
	themeService := NewThemeService(databaseService, logger)
	syncService := NewSyncService(configService, databaseService, logger)
	httpClientService := NewHttpClientService(logger)
	testService := NewTestService(badgeService, notificationService, logger)

	return &ServiceManager{
		configService:       configService,
		databaseService:     databaseService,
		documentService:     documentService,
		mediaHTTPService:    mediaHTTPService,
		windowService:       windowService,
		windowSnapService:   windowSnapService,
		migrationService:    migrationService,
		systemService:       systemService,
		hotkeyService:       hotkeyService,
		dialogService:       dialogService,
		trayService:         trayService,
		keyBindingService:   keyBindingService,
		extensionService:    extensionService,
		startupService:      startupService,
		selfUpdateService:   selfUpdateService,
		translationService:  translationService,
		themeService:        themeService,
		badgeService:        badgeService,
		notificationService: notificationService,
		testService:         testService,
		SyncService:         syncService,
		httpClientService:   httpClientService,
		logger:              logger,
	}
}

// GetServices returns the registered Wails services.
func (sm *ServiceManager) GetServices() []application.Service {
	return []application.Service{
		application.NewService(sm.configService),
		application.NewService(sm.databaseService),
		application.NewService(sm.documentService),
		application.NewServiceWithOptions(sm.mediaHTTPService, application.ServiceOptions{
			Route: mediaServiceRoute,
		}),
		application.NewService(sm.windowService),
		application.NewService(sm.keyBindingService),
		application.NewService(sm.extensionService),
		application.NewService(sm.migrationService),
		application.NewService(sm.systemService),
		application.NewService(sm.hotkeyService),
		application.NewService(sm.dialogService),
		application.NewService(sm.startupService),
		application.NewService(sm.selfUpdateService),
		application.NewService(sm.translationService),
		application.NewService(sm.themeService),
		application.NewService(sm.badgeService),
		application.NewService(sm.notificationService),
		application.NewService(sm.testService),
		application.NewService(sm.SyncService),
		application.NewService(sm.httpClientService),
	}
}

func (sm *ServiceManager) GetHotkeyService() *HotkeyService {
	return sm.hotkeyService
}

func (sm *ServiceManager) GetDialogService() *DialogService {
	return sm.dialogService
}

func (sm *ServiceManager) GetLogger() *log.LogService {
	return sm.logger
}

func (sm *ServiceManager) GetConfigService() *ConfigService {
	return sm.configService
}

func (sm *ServiceManager) GetTrayService() *TrayService {
	return sm.trayService
}

func (sm *ServiceManager) GetKeyBindingService() *KeyBindingService {
	return sm.keyBindingService
}

func (sm *ServiceManager) GetStartupService() *StartupService {
	return sm.startupService
}

func (sm *ServiceManager) GetExtensionService() *ExtensionService {
	return sm.extensionService
}

func (sm *ServiceManager) GetSelfUpdateService() *SelfUpdateService {
	return sm.selfUpdateService
}

func (sm *ServiceManager) GetTranslationService() *TranslationService {
	return sm.translationService
}

func (sm *ServiceManager) GetDatabaseService() *DatabaseService {
	return sm.databaseService
}

func (sm *ServiceManager) GetWindowService() *WindowService {
	return sm.windowService
}

func (sm *ServiceManager) GetDocumentService() *DocumentService {
	return sm.documentService
}

func (sm *ServiceManager) GetThemeService() *ThemeService {
	return sm.themeService
}

func (sm *ServiceManager) GetBadgeService() *dock.DockService {
	return sm.badgeService
}

func (sm *ServiceManager) GetNotificationService() *notifications.NotificationService {
	return sm.notificationService
}

func (sm *ServiceManager) GetSystemService() *SystemService {
	return sm.systemService
}

func (sm *ServiceManager) GetHttpClientService() *HttpClientService {
	return sm.httpClientService
}
