package services

import (
	"context"
	"fmt"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/services/dock"
	"github.com/wailsapp/wails/v3/pkg/services/log"
	"github.com/wailsapp/wails/v3/pkg/services/notifications"
)

// TestService 测试服务 - 仅在开发环境使用
type TestService struct {
	logger              *log.LogService
	badgeService        *dock.DockService
	notificationService *notifications.NotificationService
}

// NewTestService 创建测试服务实例
func NewTestService(badgeService *dock.DockService, notificationService *notifications.NotificationService, logger *log.LogService) *TestService {
	if logger == nil {
		logger = log.New()
	}

	return &TestService{
		logger:              logger,
		badgeService:        badgeService,
		notificationService: notificationService,
	}
}

// ServiceStartup 服务启动时调用
func (ts *TestService) ServiceStartup(ctx context.Context, options application.ServiceOptions) error {
	return nil
}

// TestBadge 测试Badge功能
func (ts *TestService) TestBadge(text string) error {
	if ts.badgeService == nil {
		return fmt.Errorf("badge service not available")
	}

	if text == "" {
		// 如果文本为空，则移除badge
		err := ts.badgeService.RemoveBadge()
		if err != nil {
			ts.logger.Error("Failed to remove badge", "error", err)
			return err
		}
		ts.logger.Info("Badge removed successfully")
		return nil
	}

	// 设置badge
	err := ts.badgeService.SetBadge(text)
	if err != nil {
		ts.logger.Error("Failed to set badge", "text", text, "error", err)
		return err
	}

	ts.logger.Info("Badge set successfully", "text", text)
	return nil
}

// TestNotification 测试通知功能
func (ts *TestService) TestNotification(title, subtitle, body string) error {
	if ts.notificationService == nil {
		return fmt.Errorf("notification service not available")
	}

	// 检查通知授权（macOS需要）
	authorized, err := ts.notificationService.CheckNotificationAuthorization()
	if err != nil {
		ts.logger.Error("Failed to check notification authorization", "error", err)
		return err
	}

	if !authorized {
		authorized, err = ts.notificationService.RequestNotificationAuthorization()
		if err != nil || !authorized {
			ts.logger.Error("Failed to get notification authorization", "error", err)
			return fmt.Errorf("notification authorization denied")
		}
	}

	// 使用默认值如果参数为空
	if title == "" {
		title = "Test Notification"
	}
	if subtitle == "" {
		subtitle = "Testing notification system"
	}
	if body == "" {
		body = "This is a test notification to verify the system is working correctly."
	}

	// 发送测试通知
	err = ts.notificationService.SendNotification(notifications.NotificationOptions{
		ID:       "test_notification",
		Title:    title,
		Subtitle: subtitle,
		Body:     body,
	})

	if err != nil {
		ts.logger.Error("Failed to send test notification", "error", err)
		return err
	}

	ts.logger.Info("Test notification sent successfully", "title", title)
	return nil
}

// TestUpdateNotification 测试更新通知
func (ts *TestService) TestUpdateNotification() error {
	// 设置badge
	if err := ts.TestBadge("●"); err != nil {
		return err
	}

	// 发送更新通知
	return ts.TestNotification(
		"Voidraft Update Available",
		"New version available",
		"New version 1.2.3 available (current: 1.2.0)",
	)
}

// ClearAll 清除所有测试状态
func (ts *TestService) ClearAll() error {
	// 移除badge
	if err := ts.TestBadge(""); err != nil {
		ts.logger.Error("Failed to clear badge during cleanup", "error", err)
	}

	ts.logger.Info("Test states cleared successfully")
	return nil
}
