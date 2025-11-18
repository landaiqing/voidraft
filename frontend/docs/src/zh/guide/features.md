# 功能特性

![扩展能力占位](/img/placeholder-extensions.png)
> 替换为展示彩虹括号、小地图、搜索工具条等扩展组合的截图。

## 1. 编辑体验
### 块状编辑全流程
- `∞∞∞language[-a]` 语法由 `codeblock/lang-parser` 解析，支持自动检测、分隔符校验、块范围缓存。
- `blockState` 暴露 API（`getActiveBlock/getFirstBlock/getLastBlock`），供格式化、重排、复制、HTTP 执行等插件共享。
- `mathBlock` 可在块尾展示计算结果，点击可复制；`CURRENCIES_LOADED` 注解在汇率更新时刷新缓存。

### 语言支持
- 内建 30+ 语言模版（`lang-parser/languages.ts`），覆盖 JS/TS/HTML/CSS/Go/Rust/Python/SQL/YAML/HTTP/Markdown/Plain/Text/Math。
- 语言切换下拉实时更新分隔符；支持自定义别名（例如 `∞∞∞shell`）。

### 语法高亮与主题
- `rainbowBracket`、`fold`、`hyperlink`、`colorSelector` 等扩展组合提供接近 VSCode 的体验。
- `ThemeService` 预置 12+ 暗/亮主题，可在设置中克隆、修改 JSON 色板，并立即生效。

### 文本统计与滚轮缩放
- `statsExtension` 实时统计行数、字符数和选区，展示在状态栏。
- `wheelZoomExtension` 让 `Ctrl + 鼠标滚轮` 调整字体大小，同时同步 `configStore`。

## 2. 高效工具箱
### VSCode 式搜索替换
- `extensions/vscodeSearch` 提供悬浮面板，支持大小写/整词/正则、向上/向下跳转、批量替换。
- 对应快捷键：`Ctrl+F`、`Ctrl+H`、`Alt+Enter`（替换全部）。

### Markdown 预览
- `panelStore` 为每个文档维护预览状态，保证不同文档互不影响。
- 选中 Markdown 块后点击工具栏预览按钮即可在右侧展开实时渲染面板。

### HTTP 客户端
- Request DSL + 运行器在 [专章](/zh/guide/http-client) 详细说明。
- 支持变量、响应插入、多种请求体、定制 header、复制 cURL。

### 翻译助手
- `translator` 扩展监听选区，符合长度阈值后显示按钮；由 `TranslationService` 调用 Bing/Google/Youdao/DeepL/TartuNLP。
- 支持语种缓存、复制译文、切换译文方向。

### 颜色与高亮
- `colorSelector` 识别 `#fff/rgba/hsl`、打开取色器；`textHighlight` 用 `Mod+Shift+H` 标记重要行。

## 3. 复杂布局能力
### 多窗口
- `WindowService` 允许为任意文档创建独立 WebView，URL 自动携带 `?documentId=`。
- `WindowSnapService` 根据主窗口位置吸附子窗口（上下左右+四角），并缓存尺寸、位置。
- 支持全局热键（默认 `Alt+X`）一键显示或隐藏所有窗口。

### 标签页
- `tabStore` 通过 `enableTabs` 控制；支持拖拽排序、关闭其他/左侧/右侧标签。
- 与多窗口互斥：当文档被新窗口接管后会从标签栏移除，避免重复。

### 系统托盘与置顶
- `TrayService` 控制关闭时隐藏到托盘或直接退出。
- 工具栏提供图钉按钮，可即时切换 `AlwaysOnTop`（支持临时置顶和永久置顶）。

## 4. 数据守护
### SQLite + 自动迁移
- `DatabaseService` 启动时执行 PRAGMA + 表结构校验，缺失字段自动 `ALTER TABLE`。
- 默认生成 `documents/extensions/key_bindings/themes` 等表，支持软删除与锁定。

### Git 备份
- `BackupService` 将 `dataPath` 初始化为 Git 仓库，支持 Token/SSHKey/用户名密码三种方式。
- 自动任务按分钟运行（`BackupInterval`），包括 add/commit/push；也可从 UI 触发一次性 push。

### 配置快照
- 所有设置存于 `config.json`，包含 `metadata.version/lastUpdated`，方便手工回滚。
- `ConfigService.Watch` 为窗口吸附、托盘、热键等服务提供实时响应。

### 自动更新
- `SelfUpdateService` 先检查主源（Gitea），失败再回退到 GitHub；下载完成后可一键「重启并更新」。
- 更新前可选自动触发 Git 备份（`backupBeforeUpdate`）。

## 5. 自动化与集成
- **启动时动作**：可开启开机自启（`StartupService`）、默认最小化至托盘。
- **HTTP 运行挂钩**：`response-inserter` 可在响应块尾部插入 `// @timestamp` 等自定义标记。
- **Math/汇率**：`mathBlock` 可引用上一次结果 (`prev`)，配合 `CURRENCIES_LOADED` 注解支撑货币换算。
- **系统信息**：`SystemService` 暴露内存、GC、Goroutine 数量，可在调试面板查看。

## 6. 可配置的快捷键
- 详见 [键盘快捷键](/zh/guide/keyboard-shortcuts)。默认绑定定义在 `internal/models/key_bindings.go`，前端设置页可逐项修改、禁用。

## 7. 文档 & 帮助
- 文档站以 VitePress 构建（`frontend/docs`），内置中英双语导航，可一键部署到 GitHub Pages。
- `README` 与本文档同步介绍核心功能；建议将常用工作流截图补充到每个「图片占位」中。
