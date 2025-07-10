package services

import (
	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/services/log"
)

// DialogService 对话框服务，处理文件选择等对话框操作
type DialogService struct {
	logger *log.Service
	window *application.WebviewWindow // 绑定的窗口
}

// NewDialogService 创建新的对话框服务实例
func NewDialogService(logger *log.Service) *DialogService {
	if logger == nil {
		logger = log.New()
	}

	return &DialogService{
		logger: logger,
		window: nil, // 初始为空，后续通过 SetWindow 设置
	}
}

// SetWindow 设置绑定的窗口
func (ds *DialogService) SetWindow(window *application.WebviewWindow) {
	ds.window = window
}

// SelectDirectory 打开目录选择对话框
func (ds *DialogService) SelectDirectory() (string, error) {
	dialog := application.OpenFileDialog()
	dialog.SetOptions(&application.OpenFileDialogOptions{
		// 目录选择配置
		CanChooseDirectories:    true,  // 允许选择目录
		CanChooseFiles:          false, // 不允许选择文件
		CanCreateDirectories:    true,  // 允许创建新目录
		AllowsMultipleSelection: false, // 单选模式

		// 显示配置
		ShowHiddenFiles:                 false, // 不显示隐藏文件
		HideExtension:                   false, // 不隐藏扩展名
		CanSelectHiddenExtension:        false, // 不允许选择隐藏扩展名
		TreatsFilePackagesAsDirectories: false, // 不将文件包当作目录处理
		AllowsOtherFileTypes:            false, // 不允许其他文件类型

		// 系统配置
		ResolvesAliases: true, // 解析别名/快捷方式

		// 对话框文本配置
		Title:      "Select Directory",
		Message:    "Select the folder where you want to store your app data",
		ButtonText: "Select",

		// 不设置过滤器，因为我们选择目录
		Filters: nil,

		// 不指定默认目录，让系统决定
		Directory: "",

		// 绑定到主窗口
		Window: ds.window,
	})

	path, err := dialog.PromptForSingleSelection()
	if err != nil {
		return "", err
	}
	return path, nil
}
