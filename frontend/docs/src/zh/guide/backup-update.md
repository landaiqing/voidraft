# 备份与更新

![备份更新占位](/img/placeholder-backup.png)
> 替换为备份设置、推送状态、更新提示的截图。

## Git 备份
`BackupService` 将 `dataPath` 转化为 Git 仓库，并提供自动/手动推送。

### 初始化
1. 在设置 > 备份中开启「启用备份」。
2. 填写远程仓库 URL（HTTPS 或 SSH）。
3. 选择认证方式：
   - **Token**：适用于 GitHub/Gitea https 仓库。
   - **SSH Key**：指定私钥路径和 passphrase。
   - **用户名/密码**：适合自建 HTTP 仓库。
4. 点击“测试连接”（按钮在计划中，可先在终端测试）。

### 自动备份
- 勾选 “自动备份” + 设置 `BackupInterval`（分钟）。
- 服务会创建 ticker 定时 `git add -> commit -> push`。
- Commit 消息形如 `Auto backup <timestamp>`，包含 `voidraft.db`, `extensions.json`, `config.json`, `voidraft_data.bin`。

### 手动推送
- 打开工具栏消息中心或设置页点击“立即推送”。
- `backupStore.pushToRemote` 会显示状态气泡（成功/失败提示 3~5 秒）。

### 常见问题
| 提示 | 解决 |
| --- | --- |
| `repository not found` | 检查 Repo URL 与权限，必要时创建空仓库 |
| `authentication required` | 选择正确认证方式，确认 token scope（需 repo 权限） |
| `auto backup stopped` | 查看日志，可能是网络不通或凭据失效；修改配置后服务会自动重启 |

## 自动更新
`SelfUpdateService` 负责检测、下载、应用新版。

### 检查更新
- 启动时若勾选 “自动更新” 会自动检查。
- 也可在设置 > 更新点击 “检查更新” 或在工具栏更新图标处触发。
- 服务优先访问 `primarySource`，失败时回退 `backupSource`。

### 下载与应用
1. 检测到更新后，界面提示版本号与变更信息（从 Release Notes 获取）。
2. 点击 “下载并安装” 后，后台执行下载，完成后提示“准备重启”。
3. 选择 “立即重启” 将调用 `RestartApplication`，自动重新打开上次的文档。
4. 若启用了 “更新前备份”，在下载前会触发一次 Git push。

### 失败处理
| 场景 | 建议 |
| --- | --- |
| 下载失败 | 检查网络/代理，切换至备用源 |
| 校验失败 | 删除 `%LOCALAPPDATA%/voidraft/update-cache` 再重试 |
| 应用后无法启动 | 从 Git 备份回滚数据，下载旧版本安装包覆盖 |

## 发布渠道
- 官方 GitHub Releases：`https://github.com/landaiqing/voidraft/releases`
- 自建 Gitea：`https://git.landaiqing.cn/landaiqing/voidraft`
- 可在设置中替换 Owner/Repo/BaseURL，以指向企业私有镜像。

> 建议将备份仓库设为私有，并在更新前后验证数据完整性。若要接入 S3/OSS 等备份方式，可关注 roadmap 或自行扩展。
