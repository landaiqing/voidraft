# 设置与配置

![设置占位](/img/placeholder-settings.png)
> 替换为设置页截图，突出通用/编辑/外观/更新/备份等分栏。

所有设置都映射到 `internal/models/config.go`，持久化文件位于 `%USERPROFILE%/.voidraft/data/config.json`。前端 `configStore` 负责与后端 `ConfigService` 同步。

## 通用（General）
| 选项 | 说明 | 后端键 |
| --- | --- | --- |
| 窗口置顶 (`alwaysOnTop`) | 永久置顶主窗口 | `general.alwaysOnTop` |
| 数据目录 (`dataPath`) | SQLite + 备份所在目录，修改后需重启 | `general.dataPath` |
| 系统托盘 (`enableSystemTray`) | 关闭窗口后隐藏到托盘而非退出 | `general.enableSystemTray` |
| 开机自启 (`startAtLogin`) | 调用 `StartupService` 注册 | `general.startAtLogin` |
| 窗口吸附 (`enableWindowSnap`) | `WindowSnapService` 是否启用 | `general.enableWindowSnap` |
| 全局热键 (`enableGlobalHotkey` + `globalHotkey`) | 默认 Alt+X，控制显隐 | `general.globalHotkey` |
| 标签页 (`enableTabs`) | 启用多标签界面 | `general.enableTabs` |
| 加载动画 (`enableLoadingAnimation`) | 切换文档时显示动画 | `general.enableLoadingAnimation` |

## 编辑（Editing）
| 选项 | 说明 |
| --- | --- |
| Font Size/Family/Weight/Line Height | 立即作用于所有编辑器实例 |
| Tab Size/Tab Type/Enable Tab Indent | 映射 `tabExtension` 行为 |
| Auto Save Delay | ms，影响 `editorStore` 自动保存周期 |

## 外观（Appearance）
| 选项 | 说明 |
| --- | --- |
| Language | UI 语言（`zh-CN`/`en-US`） |
| System Theme | 深色/浅色/跟随系统 |
| Current Theme | 选择预设或自定义主题（详见 [主题与外观](/zh/guide/themes)） |

## 更新（Updates）
| 选项 | 说明 |
| --- | --- |
| Auto Update | 启动时自动检查更新 |
| Primary/Backup Source | `github` 或 `gitea`，对应 `UpdatesConfig` |
| Backup Before Update | 下载更新前执行 Git 备份 |
| Update Timeout | HTTP 请求超时 |
| GitHub/Gitea 仓库 | owner/repo/baseURL，可指向自建镜像 |

## 备份（Backup）
| 选项 | 说明 |
| --- | --- |
| Enabled | 开关 Git 备份 |
| Repo URL | 远程仓库地址（HTTPS 或 SSH） |
| Auth Method | `token` / `ssh_key` / `user_pass` |
| Username/Password/Token/SSH Key Path | 根据认证方式填写 |
| Backup Interval | 自动备份间隔（分钟） |
| Auto Backup | 是否按间隔自动推送 |

## 键位（Key Bindings）
- 列表由 `ExtensionService.GetAllKeyBindings()` 提供。可搜索命令 ID 或组合。
- 允许将命令禁用（关闭开关）或录入新组合。
- 更改立即影响所有编辑器实例。

## 扩展（Extensions）
- 显示 `ExtensionSettings` 中的所有扩展。
- 每项可开关并展示 JSON 配置（背景色、最小选区、最小化提示等）。
- 修改后调用 `ExtensionService.UpdateExtensionState` 并通知 `ExtensionManager` 热更新。

## 配置文件备份
- 每次修改配置都会更新 `metadata.lastUpdated`，可用 Git 备份追踪历史。
- 若出现配置损坏，可删除 `config.json`，应用会写入 `NewDefaultAppConfig`。

## 导入/导出（建议）
- 目前可手动复制 `config.json`/`extensions.json`/`key_bindings.json`。
- 计划提供 UI 层面的导入导出按钮，便于跨设备同步。

> 修改高级选项（如 dataPath）后建议重启，以确保后台服务（数据库、备份、窗口吸附等）读取到最新配置。
