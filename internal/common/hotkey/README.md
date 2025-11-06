# Hotkey - 跨平台全局热键库

跨平台 Go 语言全局热键库，支持 Windows、Linux (X11) 和 macOS 操作系统。

## ✨ 特性

- **跨平台支持**：Windows、Linux (X11)、macOS 统一 API
- **线程安全**：所有公共 API 使用互斥锁保护
- **标准化错误**：提供统一的错误类型，便于错误处理
- **资源管理**：支持手动和自动（finalizer）资源清理
- **独立实现**：除系统库外无第三方 Go 依赖
- **状态查询**：提供 `IsRegistered()` 和 `IsClosed()` 方法

## 📦 安装

```bash
go get -u voidraft/internal/common/hotkey
```

### 平台特定依赖

#### Linux

需要安装 X11 开发库：

```bash
# Debian/Ubuntu
sudo apt install -y libx11-dev

# CentOS/RHEL
sudo yum install -y libX11-devel

# Arch Linux
sudo pacman -S libx11
```

**无界面环境（云服务器等）**：

```bash
# 安装虚拟显示服务器
sudo apt install -y xvfb

# 启动虚拟显示
Xvfb :99 -screen 0 1024x768x24 > /dev/null 2>&1 &
export DISPLAY=:99.0
```

#### macOS

**GUI 应用**（Wails、Fyne、Cocoa 等）：框架管理主事件循环，直接使用即可。

**CLI 应用**：需要使用 `darwin.Init()` 启动 NSApplication 主事件循环，参见下文"macOS CLI 应用示例"。

#### Windows

无额外依赖，开箱即用。

## 📖 使用指南

### 基本用法

```go
package main

import (
    "fmt"
    "voidraft/internal/common/hotkey"
)

func main() {
    // 创建热键：Ctrl+Shift+S
    hk := hotkey.New([]hotkey.Modifier{hotkey.ModCtrl, hotkey.ModShift}, hotkey.KeyS)
    
    // 注册热键
    if err := hk.Register(); err != nil {
        panic(err)
    }
    defer hk.Close() // 确保资源清理
    
    fmt.Println("热键已注册，按 Ctrl+Shift+S 触发...")
    
    // 监听热键事件
    for {
        select {
        case <-hk.Keydown():
            fmt.Println("热键按下！")
        case <-hk.Keyup():
            fmt.Println("热键释放！")
        }
    }
}
```

### 完整示例：带错误处理

```go
package main

import (
    "errors"
    "fmt"
    "log"
    "os"
    "os/signal"
    "syscall"
    "voidraft/internal/common/hotkey"
)

func main() {
    // 创建热键
    hk := hotkey.New([]hotkey.Modifier{hotkey.ModCtrl, hotkey.ModAlt}, hotkey.KeyQ)
    
    // 注册热键，处理可能的错误
    if err := hk.Register(); err != nil {
        switch {
        case errors.Is(err, hotkey.ErrHotkeyConflict):
            log.Fatal("热键冲突：该组合键已被其他程序占用")
        case errors.Is(err, hotkey.ErrPlatformUnavailable):
            log.Fatal("平台不支持：", err)
        case errors.Is(err, hotkey.ErrAlreadyRegistered):
            log.Fatal("热键已经注册")
        default:
            log.Fatal("注册热键失败：", err)
        }
    }
    defer hk.Close()
    
    fmt.Println("热键 Ctrl+Alt+Q 已注册")
    fmt.Println("按下热键触发，或按 Ctrl+C 退出...")
    
    // 优雅退出
    sigChan := make(chan os.Signal, 1)
    signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
    
    // 事件循环
    for {
        select {
        case <-hk.Keydown():
            fmt.Println("[事件] 热键按下")
            // 执行你的业务逻辑
            
        case <-hk.Keyup():
            fmt.Println("[事件] 热键释放")
            
        case <-sigChan:
            fmt.Println("\n正在退出...")
            return
        }
    }
}
```

### 防抖处理（应用层）

如果热键按住会持续触发，建议在应用层添加防抖：

```go
package main

import (
    "fmt"
    "log"
    "time"
    "voidraft/internal/common/hotkey"
)

func main() {
    hk := hotkey.New([]hotkey.Modifier{hotkey.ModCtrl}, hotkey.KeyD)
    if err := hk.Register(); err != nil {
        log.Fatal(err)
    }
    defer hk.Close()
    
    // 防抖参数
    var lastTrigger time.Time
    debounceInterval := 800 * time.Millisecond // 推荐 800ms
    
    for {
        select {
        case <-hk.Keydown():
            now := time.Now()
            // 检查距离上次触发的时间
            if !lastTrigger.IsZero() && now.Sub(lastTrigger) < debounceInterval {
                fmt.Println("触发被忽略（防抖）")
                continue
            }
            lastTrigger = now
            
            fmt.Println("热键触发！")
            // 执行你的业务逻辑
        }
    }
}
```

### 动态修改热键

```go
// 注销旧热键
if err := hk.Unregister(); err != nil {
    log.Printf("注销失败：%v", err)
}

// 修改热键组合
hk = hotkey.New([]hotkey.Modifier{hotkey.ModCtrl}, hotkey.KeyF1)

// 重新注册
if err := hk.Register(); err != nil {
    log.Printf("注册失败：%v", err)
}

// 重要：重新获取通道引用！
keydownChan := hk.Keydown()
keyupChan := hk.Keyup()
```

### 状态检查

```go
// 检查热键是否已注册
if hk.IsRegistered() {
    fmt.Println("热键已注册")
}

// 检查热键是否已关闭
if hk.IsClosed() {
    fmt.Println("热键已关闭，无法再使用")
}
```

### 资源管理最佳实践

```go
func registerHotkey() error {
    hk := hotkey.New([]hotkey.Modifier{hotkey.ModCtrl}, hotkey.KeyH)
    
    // 使用 defer 确保资源释放
    defer hk.Close()
    
    if err := hk.Register(); err != nil {
        return err
    }
    
    // ... 使用热键 ...
    
    return nil
}

// Close() 是幂等的，多次调用是安全的
hk.Close()
hk.Close() // 不会 panic
```

## 🔑 支持的修饰键

### 所有平台通用

```go
hotkey.ModCtrl   // Ctrl 键
hotkey.ModShift  // Shift 键
hotkey.ModAlt    // Alt 键（Linux: 通常映射到 Mod1）
```

### Linux 额外支持

```go
hotkey.Mod1  // 通常是 Alt
hotkey.Mod2  // 通常是 Num Lock
hotkey.Mod3  // (较少使用)
hotkey.Mod4  // 通常是 Super/Windows 键
hotkey.Mod5  // (较少使用)
```

### 组合使用

```go
// Ctrl+Shift+Alt+S
hk := hotkey.New(
    []hotkey.Modifier{hotkey.ModCtrl, hotkey.ModShift, hotkey.ModAlt},
    hotkey.KeyS,
)
```

## ⌨️ 支持的按键

### 字母键

```go
hotkey.KeyA - hotkey.KeyZ  // A-Z
```

### 数字键

```go
hotkey.Key0 - hotkey.Key9  // 0-9
```

### 功能键

```go
hotkey.KeyF1 - hotkey.KeyF20  // F1-F20
```

### 特殊键

```go
hotkey.KeySpace    // 空格
hotkey.KeyReturn   // 回车
hotkey.KeyEscape   // ESC
hotkey.KeyDelete   // Delete
hotkey.KeyTab      // Tab
hotkey.KeyLeft     // 左箭头
hotkey.KeyRight    // 右箭头
hotkey.KeyUp       // 上箭头
hotkey.KeyDown     // 下箭头
```

### 自定义键码

如果需要的键未预定义，可以直接使用键码：

```go
// 使用自定义键码 0x15
hk := hotkey.New([]hotkey.Modifier{hotkey.ModCtrl}, hotkey.Key(0x15))
```

## ⚠️ 错误类型

```go
// 检查特定错误类型
if errors.Is(err, hotkey.ErrAlreadyRegistered) {
    // 热键已经注册
}

if errors.Is(err, hotkey.ErrNotRegistered) {
    // 热键未注册
}

if errors.Is(err, hotkey.ErrClosed) {
    // 热键已关闭，无法再使用
}

if errors.Is(err, hotkey.ErrHotkeyConflict) {
    // 热键冲突，已被其他程序占用
}

if errors.Is(err, hotkey.ErrPlatformUnavailable) {
    // 平台不可用（如 Linux 无 X11）
}

if errors.Is(err, hotkey.ErrFailedToRegister) {
    // 注册失败（其他原因）
}

if errors.Is(err, hotkey.ErrFailedToUnregister) {
    // 注销失败
}
```

## 🎯 平台特定注意事项

### Linux

#### 1. AutoRepeat 行为

Linux 的 X11 会在按键持续按下时重复发送 `KeyPress` 事件。如果你的应用对此敏感，需要做防抖处理：

```go
var lastTrigger time.Time
debounceInterval := 500 * time.Millisecond

for {
    select {
    case <-hk.Keydown():
        now := time.Now()
        if now.Sub(lastTrigger) < debounceInterval {
            continue // 忽略重复触发
        }
        lastTrigger = now
        
        // 处理热键事件
        fmt.Println("热键触发！")
    }
}
```

#### 2. 键位映射差异

不同的 Linux 发行版和桌面环境可能有不同的键位映射。建议：

- 使用标准的 `ModCtrl`、`ModShift`、`ModAlt`
- 避免依赖 `Mod2`、`Mod3`、`Mod5`（映射不一致）
- `Mod4` 通常是 Super/Windows 键，但也可能不同

#### 3. Wayland 支持

当前版本仅支持 X11。在 Wayland 环境下：

- 需要运行在 XWayland 兼容层
- 或设置 `GDK_BACKEND=x11` 环境变量
- 原生 Wayland 支持正在开发中

#### 4. Display 连接复用

本库已优化 Linux 实现，在热键注册期间保持 X11 Display 连接：

```
注册时：    XOpenDisplay → XGrabKey → 保持连接
事件循环：  使用相同连接 → XNextEvent
注销时：    XUngrabKey → XCloseDisplay
```

这大幅降低了资源开销和延迟。

### Windows

#### 1. 热键按下事件

Windows 使用 `RegisterHotKey` API 注册系统级热键，通过 `WM_HOTKEY` 消息接收按键事件。

**实现细节**：
- 使用 `PeekMessageW` (Unicode) 轮询消息队列
- 10ms 轮询间隔，CPU 占用约 0.3-0.5%
- `isKeyDown` 状态标志防止重复触发
- 按下事件延迟通常 < 10ms

#### 2. 热键释放事件

Windows `RegisterHotKey` API 不提供键释放通知，本库使用 `GetAsyncKeyState` 轮询检测：

```go
// 检测键释放（每 10ms 检查一次）
if isKeyDown && GetAsyncKeyState(key) == 0 {
    keyupIn <- struct{}{}
    isKeyDown = false
}
```

**特性**：
- 释放检测延迟：通常 10-20ms
- 仅在按键按下后激活检测
- 依赖于 `GetAsyncKeyState` 的精度

#### 3. 持续按住行为

Windows 在持续按住热键时会重复发送 `WM_HOTKEY` 消息。本库通过 `isKeyDown` 标志防止同一次按住重复触发 Keydown 事件。

如果需要防止快速连续按键，建议在应用层添加防抖：

```go
var lastTrigger time.Time
debounceInterval := 100 * time.Millisecond

for {
    <-hk.Keydown()
    now := time.Now()
    if now.Sub(lastTrigger) < debounceInterval {
        continue  // 忽略
    }
    lastTrigger = now
    // 处理事件...
}
```

#### 4. 系统保留热键

某些热键被 Windows 系统保留，无法注册：

- `Win+L`：锁定屏幕
- `Ctrl+Alt+Del`：安全选项
- `Alt+Tab`：切换窗口
- `Alt+F4`：关闭窗口
- `Win+D`：显示桌面

尝试注册这些热键会返回 `ErrFailedToRegister`。

#### 5. 热键冲突

如果热键已被其他应用注册，`RegisterHotKey` 会失败。常见冲突来源：

- 游戏快捷键
- 输入法快捷键
- 快捷键管理工具（AutoHotkey 等）
- 其他全局热键应用

返回错误为 `ErrFailedToRegister`（Windows 不区分冲突和其他失败）。

#### 6. 线程模型

- 热键注册和消息循环运行在同一个 OS 线程上
- 使用 `runtime.LockOSThread()` 确保线程亲和性
- 不要求是主线程（与 macOS 不同）
- `ph.funcs` channel 用于在事件循环线程中执行注册/注销操作

---

### macOS

#### 1. 主事件循环要求

macOS 的 Carbon 事件 API 通过 GCD（Grand Central Dispatch）调度到主队列执行。

**GUI 应用（Wails、Cocoa 等）**：
- ✅ 框架已自动管理主事件循环
- ✅ 热键功能开箱即用，无需额外配置

**纯 CLI 应用**：
- ⚠️ 需要手动启动 macOS 运行循环
- 参见下文"macOS 纯 CLI 应用示例"

#### 2. 权限问题

macOS 可能需要辅助功能权限。如果热键无法注册，请检查：

```
系统偏好设置 → 安全性与隐私 → 隐私 → 辅助功能
```

将你的应用添加到允许列表。

#### 3. Carbon vs Cocoa

当前实现使用 Carbon API（稳定且兼容性好）。未来版本可能会迁移到更现代的 Cocoa API。

#### 4. macOS 纯 CLI 应用示例

如果你的应用**不是 GUI 应用**，需要启动主事件循环。

**最简单的方法：使用 darwin.Init()（推荐）**

```go
//go:build darwin

package main

import (
    "fmt"
    "voidraft/internal/common/hotkey"
    "voidraft/internal/common/hotkey/darwin"
)

func main() {
    // 使用 darwin.Init 启动主事件循环
    darwin.Init(run)
}

func run() {
    hk := hotkey.New([]hotkey.Modifier{hotkey.ModCmd, hotkey.ModShift}, hotkey.KeyA)
    if err := hk.Register(); err != nil {
        fmt.Printf("注册失败: %v\n", err)
        return
    }
    defer hk.Close()
    
    fmt.Println("热键已注册: Cmd+Shift+A")
    
    for {
        <-hk.Keydown()
        fmt.Println("热键触发！")
    }
}
```

**高级用法：使用 darwin.Call() 在主线程执行操作**

```go
darwin.Init(func() {
    hk := hotkey.New(...)
    hk.Register()
    
    for {
        <-hk.Keydown()
        // 在主线程执行 macOS API 调用
        darwin.Call(func() {
            // 例如调用 Cocoa/AppKit API
            fmt.Println("这段代码在主线程执行")
        })
    }
})
```

**注意**：
- GUI 应用无需调用 `darwin.Init()`，框架已处理
- `darwin.Call()` 用于需要主线程的特定 macOS API
- 热键注册本身已通过 `dispatch_get_main_queue()` 自动调度到主线程

## 🔬 架构设计

### 目录结构

```
internal/common/hotkey/
├── hotkey.go              # 统一的公共 API
├── hotkey_windows.go      # Windows 平台适配器
├── hotkey_darwin.go       # macOS 平台适配器
├── hotkey_linux.go        # Linux 平台适配器
├── hotkey_nocgo.go        # 非 CGO 平台占位符
├── windows/
│   ├── hotkey.go          # Windows 核心实现
│   └── mainthread.go      # Windows 线程管理
├── darwin/
│   ├── hotkey.go          # macOS 核心实现
│   ├── hotkey.m           # Objective-C/Carbon 代码
│   └── mainthread.go      # macOS 线程管理
└── linux/
    ├── hotkey.go          # Linux 核心实现
    ├── hotkey.c           # X11 C 代码
    └── mainthread.go      # Linux 线程管理
```

### 设计原则

1. **平台隔离**：每个平台的实现完全独立，通过构建标签分离
2. **统一接口**：所有平台提供相同的 Go API
3. **资源安全**：自动资源管理，防止泄漏
4. **并发安全**：所有公共方法都是线程安全的
5. **错误透明**：标准化错误类型，便于处理

### 事件流程

```
用户按键
    ↓
操作系统捕获
    ↓
平台特定 API（Win32/X11/Carbon）
    ↓
C/Objective-C 回调
    ↓
Go channel（类型转换）
    ↓
用户应用代码
```

### 并发模型

```
主 Goroutine              事件 Goroutine            转换 Goroutine
    │                          │                          │
Register() ────启动──────→ eventLoop()                    │
    │                          │                          │
    │                      等待 OS 事件                    │
    │                          │                          │
    │                          ├────发送────→ 类型转换      │
    │                          │              │            │
    │                          │              └─→ Keydown()/Keyup()
    │                          │                          │
Unregister() ──停止信号──→ 退出循环                       │
    │                          │                          │
    └──────等待清理─────────────┴──────────────────────────┘
```

## 📊 性能特性

### 资源占用

- **内存**：每个热键约 1-2 KB（包括 goroutines、channels、CGO handles）
- **Goroutines**：每个热键 3 个
  - 1 个事件循环 goroutine
  - 2 个通道转换 goroutine (interface{} → Event)
- **CPU**：
  - **Windows**：10ms 轮询，约 0.3-0.5% CPU（单核，空闲时）
  - **Linux**：事件驱动 (`XNextEvent` 阻塞)，几乎无 CPU 占用
  - **macOS**：事件驱动 (GCD 调度)，几乎无 CPU 占用
- **线程**：
  - 每个热键 1 个 OS 线程（通过 `runtime.LockOSThread()` 锁定）

### 延迟

**按下事件 (Keydown)**：
- Windows: < 10ms（取决于轮询间隔）
- Linux: < 10ms（X11 事件延迟）
- macOS: < 5ms（Carbon 事件延迟）

**释放事件 (Keyup)**：
- Windows: 10-20ms（`GetAsyncKeyState` 轮询检测）
- Linux: < 15ms（X11 KeyRelease 事件）
- macOS: < 10ms（Carbon 事件延迟）

### 使用建议

1. **资源管理**：
   - 使用 `defer hk.Close()` 确保资源释放
   - 不需要时及时调用 `Unregister()` 或 `Close()`
   - 避免频繁创建/销毁热键对象

2. **事件处理**：
   - 热键事件处理应快速返回，避免阻塞 channel
   - 复杂逻辑应在新 goroutine 中处理
   - 考虑应用层防抖（特别是 Linux AutoRepeat）

3. **错误处理**：
   - 始终检查 `Register()` 返回的错误
   - 使用 `errors.Is()` 判断错误类型
   - 处理热键冲突场景（提供备用方案或用户提示）

4. **平台差异**：
   - Windows Keyup 事件有轻微延迟（正常现象）
   - Linux 可能需要防抖处理 AutoRepeat
   - macOS CLI 应用需要启动主事件循环

## 🐛 故障排查

### Linux: "Failed to initialize the X11 display"

**问题**：无法连接到 X11 显示服务器

**解决方案**：
```bash
# 检查 DISPLAY 环境变量
echo $DISPLAY

# 如果为空，设置它
export DISPLAY=:0

# 或使用虚拟显示
Xvfb :99 -screen 0 1024x768x24 &
export DISPLAY=:99
```

### macOS: 热键不触发

**问题**：注册成功但热键无响应

**解决方案**：
1. 检查辅助功能权限（见上文）
2. 如果是纯 CLI 应用，确保启动了主运行循环（见上文示例）
3. 检查其他应用是否占用了该热键

### Windows: ErrFailedToRegister

**问题**：热键注册失败

**可能原因**：
1. 热键已被其他应用占用（AutoHotkey、游戏、输入法等）
2. 尝试注册系统保留热键（Win+L、Ctrl+Alt+Del 等）
3. 热键 ID 冲突（极少见）

**解决方案**：
1. 检查任务管理器，关闭可能冲突的应用
2. 使用不同的热键组合
3. 在应用中提供热键自定义功能，让用户选择可用组合
4. 提供友好的错误提示，说明热键被占用

**调试方法**：
```go
if err := hk.Register(); err != nil {
    if errors.Is(err, hotkey.ErrFailedToRegister) {
        log.Printf("热键注册失败: %v", err)
        log.Printf("提示：该热键可能已被其他应用使用")
        // 尝试备用热键...
    }
}
```

### Windows: Keyup 事件延迟

**问题**：释放事件比预期晚 10-20ms

**原因**：Windows API 限制，`RegisterHotKey` 不提供释放通知，需要轮询检测。

**这是正常行为**：
- 10ms 轮询间隔导致的固有延迟
- 对大多数应用场景影响很小
- 如果需要精确的释放时机，考虑使用底层键盘钩子（复杂度更高）

### 所有平台: Keyup 事件丢失

**问题**：只收到 Keydown，没有 Keyup

**可能原因**：
1. 在接收 Keyup 前调用了 `Unregister()`
2. 通道缓冲区满（不太可能，使用了无缓冲通道）
3. Windows 上正常（有轻微延迟）

**解决方案**：
```go
// 确保在处理完事件后再注销
for {
    select {
    case <-hk.Keydown():
        // 处理...
    case <-hk.Keyup():
        // 处理...
        // 现在可以安全注销
        hk.Unregister()
        return
    }
}
```

## 🤝 贡献

欢迎贡献！请遵循以下原则：

1. **保持简洁**：不要过度优化
2. **平台一致**：确保 API 在所有平台表现一致
3. **测试充分**：在所有支持的平台测试
4. **文档完善**：更新相关文档

## 📄 许可证

本项目是 Voidraft 的一部分，遵循项目主许可证。

## 🙏 致谢

本库的设计和实现参考了多个开源项目的经验：

- `golang.design/x/hotkey` - 基础架构设计
- `github.com/robotn/gohook` - 跨平台事件处理思路

特别感谢所有为跨平台 Go 开发做出贡献的开发者们！

---

**如有问题或建议，欢迎提交 Issue！** 🚀

