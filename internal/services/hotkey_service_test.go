package services

import (
	"testing"
	"time"
	"voidraft/internal/models"

	"github.com/wailsapp/wails/v3/pkg/services/log"
)

// TestHotkeyServiceCreation 测试服务创建
func TestHotkeyServiceCreation(t *testing.T) {
	logger := log.New()
	configService := &ConfigService{} // Mock

	service := NewHotkeyService(configService, logger)
	if service == nil {
		t.Fatal("Failed to create hotkey service")
	}

	if service.logger == nil {
		t.Error("Logger should not be nil")
	}

	if service.registered.Load() {
		t.Error("Service should not have registered hotkey initially")
	}
}

// TestHotkeyValidation 测试热键验证
func TestHotkeyValidation(t *testing.T) {
	logger := log.New()
	service := NewHotkeyService(&ConfigService{}, logger)

	tests := []struct {
		name  string
		combo *models.HotkeyCombo
		valid bool
	}{
		{
			name:  "Nil combo",
			combo: nil,
			valid: false,
		},
		{
			name: "Empty key",
			combo: &models.HotkeyCombo{
				Ctrl: true,
				Key:  "",
			},
			valid: false,
		},
		{
			name: "No modifiers",
			combo: &models.HotkeyCombo{
				Key: "A",
			},
			valid: false,
		},
		{
			name: "Valid: Ctrl+A",
			combo: &models.HotkeyCombo{
				Ctrl: true,
				Key:  "A",
			},
			valid: true,
		},
		{
			name: "Valid: Ctrl+Shift+F1",
			combo: &models.HotkeyCombo{
				Ctrl:  true,
				Shift: true,
				Key:   "F1",
			},
			valid: true,
		},
		{
			name: "Valid: Alt+Space",
			combo: &models.HotkeyCombo{
				Alt: true,
				Key: "Space",
			},
			valid: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := service.isValidHotkey(tt.combo)
			if result != tt.valid {
				t.Errorf("Expected valid=%v, got %v", tt.valid, result)
			}
		})
	}
}

// TestHotkeyConversion 测试热键转换
func TestHotkeyConversion(t *testing.T) {
	logger := log.New()
	service := NewHotkeyService(&ConfigService{}, logger)

	tests := []struct {
		name    string
		combo   *models.HotkeyCombo
		wantErr bool
	}{
		{
			name: "Valid letter key",
			combo: &models.HotkeyCombo{
				Ctrl: true,
				Key:  "A",
			},
			wantErr: false,
		},
		{
			name: "Valid number key",
			combo: &models.HotkeyCombo{
				Shift: true,
				Key:   "1",
			},
			wantErr: false,
		},
		{
			name: "Valid function key",
			combo: &models.HotkeyCombo{
				Alt: true,
				Key: "F5",
			},
			wantErr: false,
		},
		{
			name: "Invalid key",
			combo: &models.HotkeyCombo{
				Ctrl: true,
				Key:  "InvalidKey",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			key, mods, err := service.convertHotkey(tt.combo)

			if tt.wantErr {
				if err == nil {
					t.Error("Expected error, got nil")
				}
				return
			}

			if err != nil {
				t.Errorf("Unexpected error: %v", err)
				return
			}

			if key == 0 {
				t.Error("Key should not be 0")
			}

			if len(mods) == 0 {
				t.Error("Should have at least one modifier")
			}
		})
	}
}

// TestHotkeyRegisterUnregister 测试注册和注销
func TestHotkeyRegisterUnregister(t *testing.T) {
	logger := log.New()
	service := NewHotkeyService(&ConfigService{}, logger)

	combo := &models.HotkeyCombo{
		Ctrl:  true,
		Shift: true,
		Key:   "F10",
	}

	// 测试注册
	err := service.RegisterHotkey(combo)
	if err != nil {
		t.Logf("Register failed (may be expected in test environment): %v", err)
		return
	}

	if !service.IsRegistered() {
		t.Error("Service should be registered")
	}

	// 验证当前热键
	current := service.GetCurrentHotkey()
	if current == nil {
		t.Error("Current hotkey should not be nil")
	}

	if current.Key != combo.Key {
		t.Errorf("Expected key %s, got %s", combo.Key, current.Key)
	}

	// 测试注销
	err = service.UnregisterHotkey()
	if err != nil {
		t.Fatalf("Unregister failed: %v", err)
	}

	if service.IsRegistered() {
		t.Error("Service should not be registered after unregister")
	}

	current = service.GetCurrentHotkey()
	if current != nil {
		t.Error("Current hotkey should be nil after unregister")
	}
}

// TestHotkeyUpdate 测试更新热键
func TestHotkeyUpdate(t *testing.T) {
	logger := log.New()
	service := NewHotkeyService(&ConfigService{}, logger)

	combo1 := &models.HotkeyCombo{
		Ctrl: true,
		Key:  "F11",
	}

	// 启用热键
	err := service.UpdateHotkey(true, combo1)
	if err != nil {
		t.Logf("Update (enable) failed: %v", err)
		return
	}
	defer service.UnregisterHotkey()

	if !service.IsRegistered() {
		t.Error("Should be registered after enable")
	}

	// 禁用热键
	err = service.UpdateHotkey(false, combo1)
	if err != nil {
		t.Fatalf("Update (disable) failed: %v", err)
	}

	if service.IsRegistered() {
		t.Error("Should not be registered after disable")
	}
}

// TestHotkeyDoubleRegister 测试重复注册
func TestHotkeyDoubleRegister(t *testing.T) {
	logger := log.New()
	service := NewHotkeyService(&ConfigService{}, logger)

	combo := &models.HotkeyCombo{
		Ctrl: true,
		Alt:  true,
		Key:  "F12",
	}

	err := service.RegisterHotkey(combo)
	if err != nil {
		t.Skip("First registration failed")
	}
	defer service.UnregisterHotkey()

	// 第二次注册应该先取消第一次注册，然后重新注册
	combo2 := &models.HotkeyCombo{
		Shift: true,
		Key:   "F12",
	}

	err = service.RegisterHotkey(combo2)
	if err != nil {
		t.Logf("Second registration failed: %v", err)
	}

	// 验证当前热键是新的
	current := service.GetCurrentHotkey()
	if current != nil && current.Shift != combo2.Shift {
		t.Error("Should have updated to new hotkey")
	}
}

// TestHotkeyConcurrentAccess 测试并发访问
func TestHotkeyConcurrentAccess(t *testing.T) {
	logger := log.New()
	service := NewHotkeyService(&ConfigService{}, logger)

	combo := &models.HotkeyCombo{
		Ctrl: true,
		Key:  "G",
	}

	const goroutines = 10
	done := make(chan bool, goroutines)

	// 并发读取
	for i := 0; i < goroutines; i++ {
		go func() {
			for j := 0; j < 100; j++ {
				_ = service.IsRegistered()
				_ = service.GetCurrentHotkey()
				time.Sleep(time.Millisecond)
			}
			done <- true
		}()
	}

	// 主协程进行注册/注销操作
	go func() {
		for i := 0; i < 5; i++ {
			service.RegisterHotkey(combo)
			time.Sleep(50 * time.Millisecond)
			service.UnregisterHotkey()
			time.Sleep(50 * time.Millisecond)
		}
	}()

	// 等待所有 goroutine 完成
	for i := 0; i < goroutines; i++ {
		<-done
	}

	t.Log("Concurrent access test completed without panics")
}

// TestHotkeyServiceShutdown 测试服务关闭
func TestHotkeyServiceShutdown(t *testing.T) {
	logger := log.New()
	service := NewHotkeyService(&ConfigService{}, logger)

	combo := &models.HotkeyCombo{
		Ctrl:  true,
		Shift: true,
		Key:   "H",
	}

	err := service.RegisterHotkey(combo)
	if err != nil {
		t.Skip("Registration failed")
	}

	// 测试 ServiceShutdown
	err = service.ServiceShutdown()
	if err != nil {
		t.Fatalf("ServiceShutdown failed: %v", err)
	}

	if service.IsRegistered() {
		t.Error("Should not be registered after shutdown")
	}
}

// BenchmarkHotkeyRegistration 基准测试：热键注册
func BenchmarkHotkeyRegistration(b *testing.B) {
	logger := log.New()
	service := NewHotkeyService(&ConfigService{}, logger)

	combo := &models.HotkeyCombo{
		Ctrl: true,
		Key:  "B",
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		service.RegisterHotkey(combo)
		service.UnregisterHotkey()
	}
}

// BenchmarkHotkeyConversion 基准测试：热键转换
func BenchmarkHotkeyConversion(b *testing.B) {
	logger := log.New()
	service := NewHotkeyService(&ConfigService{}, logger)

	combo := &models.HotkeyCombo{
		Ctrl:  true,
		Shift: true,
		Alt:   true,
		Key:   "F5",
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		service.convertHotkey(combo)
	}
}
