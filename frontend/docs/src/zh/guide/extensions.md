# 扩展与插件

![扩展占位](/img/placeholder-extensions.png)
> 替换为展示扩展设置面板或功能合集（小地图、搜索、翻译）的截图。

voidraft 的扩展系统由 `internal/models/extensions.go` + 前端 `ExtensionManager` 驱动。扩展配置存储在 `%USERPROFILE%/.voidraft/data/extensions.json`，可在设置页面勾选启用或调整参数。

## 核心扩展
| 扩展 ID | 功能 | 关键文件 |
| --- | --- | --- |
| `editor` | 基础 CodeMirror 行为、光标保护、滚轮缩放 | `frontend/src/views/editor/basic/*` |
| `codeblock` | 块解析、拖拽、复制、格式化、数学、HTTP DSL | `extensions/codeblock` |
| `vscodeSearch` | VSCode 风格搜索替换面板 | `extensions/vscodeSearch` |
| `markdownPreview` | Markdown 实时预览 | `extensions/markdownPreview` |

## 编辑增强
- **Rainbow Brackets (`rainbowBrackets`)**：彩虹色括号匹配。
- **Fold (`fold`)**：代码折叠/展开，支持 `Ctrl+Alt+[`/`]`。
- **Hyperlink (`hyperlink`)**：识别 URL/邮箱，`Ctrl+Click` 打开。
- **Color Selector (`colorSelector`)**：悬浮配色器，支持 HEX/RGB/HSL。
- **Checkbox (`checkbox`)**：Markdown 任务列表交互式勾选。
- **Text Highlight (`textHighlight`)**：`Mod+Shift+H` 快速标记重点，可自定义颜色/透明度。

## 工具扩展
- **Translator (`translator`)**：选区翻译；配置项包括默认翻译器、最短/最长字符数。后端集成 Bing/Google/Youdao/DeepL/TartuNLP。
- **Minimap (`minimap`)**：右侧迷你地图，支持悬浮/常驻、显示字符/块，突出当前选区。
- **Search (`search`)**：补充 VSCode 风格搜索，暴露命令给快捷键系统。
- **HTTP Client (`httpclient`)**：DSL + 运行器，详见 [HTTP 客户端](/zh/guide/http-client)。

## 未来扩展（欢迎参与）
- Vim / Emacs 键位层（正在计划）。
- 自定义命令面板（Command Palette）。
- 代码片段/模板库扩展。
- AI 助手（文生代码/注释）。

## 开发者指南概述
1. **注册扩展**：在 `extensionManager.registerFactory` 中添加自定义扩展工厂。
2. **配置项**：在 `extensions.json` 中声明默认配置，并在设置面板暴露 UI（Vue 组件）。
3. **热更新**：调用 `manager.updateExtensionImmediate(id, enabled, config)` 实时切换，无需刷新窗口。
4. **后端交互**：通过 `ExtensionService.UpdateExtensionState` 将配置写入 SQLite。

> 如果需要编写自用扩展，可 fork 项目在 `frontend/src/views/editor/extensions` 中添加文件，再通过 PR 贡献给社区。
