package services

import (
	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/services/log"
	"voidraft/internal/common/helper"
	"voidraft/internal/models"
)

type TrayService struct {
	logger        *log.LogService
	configService *ConfigService
	windowHelper  *helper.WindowHelper
	menu          *application.Menu
	mainItem      *application.MenuItem
	quitItem      *application.MenuItem
	languageWatch helper.CancelFunc
}

func NewTrayService(logger *log.LogService, configService *ConfigService) *TrayService {
	return &TrayService{
		logger:        logger,
		configService: configService,
		windowHelper:  helper.NewWindowHelper(),
	}
}

func (ts *TrayService) BindMenu(menu *application.Menu) {
	ts.menu = menu
	ts.mainItem = menu.Add("")
	ts.mainItem.OnClick(func(_ *application.Context) {
		ts.ShowWindow()
	})

	menu.AddSeparator()

	ts.quitItem = menu.Add("")
	ts.quitItem.OnClick(func(_ *application.Context) {
		application.Get().Quit()
	})

	ts.applyMenuTexts(ts.currentLanguage())

	if ts.languageWatch != nil {
		ts.languageWatch()
	}

	ts.languageWatch = ts.configService.Watch("appearance.language", func(_, newValue interface{}) {
		ts.applyMenuTexts(ts.resolveLanguage(newValue))
	})
}

func (ts *TrayService) applyMenuTexts(language models.LanguageType) {
	if ts.menu == nil || ts.mainItem == nil || ts.quitItem == nil {
		return
	}

	mainLabel := "Main window"
	quitLabel := "Quit"

	if language == models.LangZhCN {
		mainLabel = "\u4E3B\u7A97\u53E3"
		quitLabel = "\u9000\u51FA"
	}

	ts.mainItem.SetLabel(mainLabel)
	ts.quitItem.SetLabel(quitLabel)
	ts.menu.Update()
}

func (ts *TrayService) currentLanguage() models.LanguageType {
	return ts.resolveLanguage(ts.configService.Get("appearance.language"))
}

func (ts *TrayService) resolveLanguage(value interface{}) models.LanguageType {
	switch language := value.(type) {
	case models.LanguageType:
		if language == models.LangZhCN {
			return models.LangZhCN
		}
	case string:
		if models.LanguageType(language) == models.LangZhCN {
			return models.LangZhCN
		}
	}

	return models.LangEnUS
}

func (ts *TrayService) ShouldMinimizeToTray() bool {
	config, err := ts.configService.GetConfig()
	if err != nil {
		return true
	}

	return config.General.EnableSystemTray
}

func (ts *TrayService) HandleWindowClose() {
	if ts.ShouldMinimizeToTray() {
		ts.windowHelper.HideMainWindow()
		return
	}

	application.Get().Quit()
}

func (ts *TrayService) HandleWindowMinimize() {
	if ts.ShouldMinimizeToTray() {
		ts.windowHelper.HideMainWindow()
	}
}

func (ts *TrayService) ShowWindow() {
	ts.windowHelper.FocusMainWindow()
}

func (ts *TrayService) MinimizeButtonClicked() {
	ts.windowHelper.MinimiseMainWindow()
}

func (ts *TrayService) AutoShowHide() {
	ts.windowHelper.AutoShowMainWindow()
}
