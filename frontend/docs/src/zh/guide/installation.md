# 安装

![安装流程占位](/img/placeholder-settings.png)
> 替换为安装向导或设置页截图，展示关键开关（置顶、数据目录、自动更新等）。

## 系统要求（2025.11）
| 项目 | 最低配置 | 推荐配置 |
| --- | --- | --- |
| 操作系统 | Windows 10 19045 / Windows 11 21H2 | Windows 11 23H2（macOS/Linux 版本开发中） |
| CPU | x86_64 双核 | 4 核以上 |
| 内存 | 4 GB | ≥ 8 GB |
| 磁盘空间 | 200 MB（含 SQLite 数据） | 1 GB 以上以保存附件/备份 |
| 运行环境 | Go 1.21+, Node.js 18+（仅开发者编译时需要） | 同左 + pnpm 8 用于前端 |

## 获取发行版
1. 打开 [GitHub Releases](https://github.com/landaiqing/voidraft/releases) 或自建 Gitea 镜像。
2. 下载 `voidraft-windows-amd64-installer.exe`（安装版）或 `voidraft-portable.zip`（绿色版）。
3. （可选）验证 SHA256：
   ```powershell
   Get-FileHash .\voidraft-windows-amd64-installer.exe -Algorithm SHA256
   ```
4. 双击安装包，按向导完成安装；或解压绿色版至任意目录并创建快捷方式。

## 首次启动流程
1. 启动后将创建数据目录：`%USERPROFILE%\.voidraft\data`（含 `voidraft.db`、`config.json`、`extensions.json`）。
2. 默认会生成 `default` 文档和一段示例块 `∞∞∞text-a`。
3. 若检测到旧版本数据，`ConfigMigrationService` 会自动迁移字段；`DataMigrationService` 确保表结构一致。
4. 首次运行建议立刻打开「设置 > 备份」配置远程 Git 仓库。

## 开发者手动构建
```bash
# 克隆项目
 git clone https://github.com/landaiqing/voidraft.git
 cd voidraft

# 安装前端依赖
 cd frontend
 npm install
 npm run build
 cd ..

# 构建/运行桌面应用
 wails3 dev        # 启动调试
 wails3 package    # 生成安装包（输出位于 bin/）
```
> 若遇到 `wails3` 未找到，请先执行 `go install github.com/wailsapp/wails/v3/cmd/wails3@latest`。

## 数据目录与可执行文件
| 类型 | 默认位置 | 说明 |
| --- | --- | --- |
| 安装目录 | `C:\Program Files\voidraft` | 包含主程序与嵌入式前端资源 |
| 数据目录 | `C:\Users\<you>\.voidraft\data` | 可在设置 > 通用修改 `dataPath`，修改后需重启 |
| 备份仓库 | `dataPath/.git` | `BackupService` 初始化或使用现有仓库 |
| 日志 | `%LOCALAPPDATA%/voidraft/logs/*.log` | 通过 Wails `application.Log` 输出 |

## 常用 CLI 检查
```powershell
# 查看版本
& "C:\Program Files\voidraft\voidraft.exe" --version

# 清理缓存（若前端异常）
Remove-Item "$env:APPDATA\voidraft\Cache" -Recurse -Force
```

## 防火墙与代理
- voidraft 仅在使用 HTTP 客户端、更新检测、REST 翻译器时发起网络请求。
- 若处于企业代理，请在系统代理中放行 `voidraft.exe` 或设置环境变量 `HTTP(S)_PROXY`，HTTP 客户端会继承系统代理。

## 常见安装问题
| 症状 | 处理方案 |
| --- | --- |
| 安装向导被安全策略阻止 | 使用签名哈希进行白名单设置或改用便携版 |
| 启动后白屏 | 删除 `%APPDATA%/voidraft/Cache`，确保显卡驱动支持 WebView2 |
| `wails3 dev` 报错缺少 WebView2 | 安装 [WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) |
| 便携版无法写入 | 检查解压目录是否具有写权限，或在设置内切换 `dataPath` 至可写分区 |

> 继续阅读：[快速开始](/zh/guide/getting-started)
