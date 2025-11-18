# 界面总览

![界面截图占位](/img/placeholder-main-ui.png)
> 替换为包含顶部工具栏、块区域、右侧小地图、底部状态栏的完整截图。

voidraft 的主窗口由四个区域组成：

| 区域 | 位置 | 作用 | 相关代码 |
| --- | --- | --- | --- |
| 工具栏 | 顶部浮层 | 文档切换、块语言选择、格式化、Markdown 预览、窗口置顶、更新提示、进入设置 | `frontend/src/components/toolbar/Toolbar.vue` |
| 编辑器主体 | 中央 | CodeMirror 6 视图，承载块编辑、HTTP 运行器、翻译按钮等 | `frontend/src/views/editor/Editor.vue` + `extensions` |
| 导航辅助 | 右侧 | 小地图、滚动条、块徽标、HTTP 运行按钮 | `extensions/minimap`, `codeblock/decorations.ts` |
| 底部状态 | 左下角 | 行数、字符数、选区统计、文档脏状态 | `editorStore.documentStats` |

## 工具栏详解
| 项 | 说明 | 快捷入口 |
| --- | --- | --- |
| 文档切换器 | 展开后列出全部文档，支持搜索、创建、在新窗口打开 | 同步 `DocumentService.ListAllDocumentsMeta` |
| 块语言下拉 | 当前块语言，列表取自 `lang-parser/languages.ts`，支持搜索 | 鼠标选择或输入语言 token |
| Pin（窗口置顶） | 临时 / 永久置顶切换，调用 `SystemService.SetWindowOnTop` 与 `config.general.alwaysOnTop` | Alt+Space（自定义） |
| Format / Preview | 对当前块执行 Prettier 或打开 Markdown 预览 | `Ctrl+Shift+F` / 工具栏按钮 |
| 更新提示 | 轮询 `SelfUpdateService`，有更新时显示小点，可直接“检查/下载/重启” | 设置 > 更新 |
| 设置入口 | 跳转到 Vue Router 的 `/settings` 页面 | `Ctrl+,` |

## 多文档视图
- **标签页（可选）**：在设置 > 通用中启用“标签页模式”，`tabStore` 将当前文档加入 tab bar，支持拖拽、批量关闭。
- **多窗口**：以文档列表右键「在新窗口中打开」或命令面板为入口。`WindowService` 会根据文档 ID 命名窗口，`WindowSnapService` 自动吸附。
- **系统托盘**：关闭窗口时默认最小化到托盘，可在托盘图标中重新唤醒或彻底退出。

## 面板与浮层
- **Markdown 预览**：针对选中的 Markdown 块，面板会贴在右侧，支持实时滚动同步、关闭动画。
- **HTTP 响应**：运行后在块底部自动插入 `### Response`，可展开查看头部/体/耗时。
- **翻译浮层**：选中文本后自动出现按钮，点击后显示结果卡片，附带复制、语种切换。

## 快捷状态
- **底部统计**：
  - `Ln`：当前块内行号。
  - `Ch`：字符数。
  - `Sel`：选区字符数。
- **右上角加载动画**：当编辑器实例加载或切换文档时显示，遵循 `enableLoadingAnimation` 设置。

## 建议截图
1. 默认深色主题 + 多块示例。
2. 打开 Markdown 预览 + 小地图。
3. 展示 HTTP 块运行按钮与响应卡片。
4. 展示标签页或多窗口。
