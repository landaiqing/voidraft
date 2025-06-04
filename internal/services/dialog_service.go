package services

import (
	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/services/log"
)

// DialogService 对话框服务，处理文件选择等对话框操作
type DialogService struct {
	logger *log.LoggerService
}

// NewDialogService 创建新的对话框服务实例
func NewDialogService(logger *log.LoggerService) *DialogService {
	if logger == nil {
		logger = log.New()
	}

	return &DialogService{
		logger: logger,
	}
}

// SelectDirectory 打开目录选择对话框
func (ds *DialogService) SelectDirectory() (string, error) {
	dialog := application.OpenFileDialogWithOptions(&application.OpenFileDialogOptions{
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
		Title:      "选择数据存储目录",
		Message:    "请选择用于存储应用数据的文件夹",
		ButtonText: "选择",

		// 不设置过滤器，因为我们选择目录
		Filters: nil,

		// 不指定默认目录，让系统决定
		Directory: "",

		// 不绑定到特定窗口，使用默认行为
		Window: nil,
	})

	path, err := dialog.PromptForSingleSelection()
	if err != nil {
		ds.logger.Error("Failed to select directory", "error", err)
		return "", err
	}

	ds.logger.Info("Directory selected", "path", path)
	return path, nil
}
