# 主题与外观

![主题占位](/img/placeholder-themes.png)
> 替换为主题切换界面或自定义主题编辑器的截图。

voidraft 的主题由后端 `ThemeService` 管理，存储在 `themes` 表。前端通过 `themeStore` + `createThemeExtension` 应用色板。

## 预设主题
| 名称 | 类型 | 说明 |
| --- | --- | --- |
| default-dark | Dark | 默认暗色，适合低光环境 |
| default-light | Light | 默认亮色 |
| dracula | Dark | 高对比度紫色系 |
| aura | Dark | 柔和霓虹风 |
| github-dark / github-light | Dark/Light | 与 GitHub 主题接近 |
| material-dark / light | Dark/Light | Material Design 色板 |
| one-dark | Dark | VSCode 经典主题 |
| solarized-dark / light | Dark/Light | Solarized 配色 |
| tokyo-night / storm / day | Dark/Light | Tokyo Night 三件套 |

## 自定义主题
1. 打开设置 > 外观，选择「创建主题」。
2. 颜色字段对应 `ThemeColorConfig`，包含 `editor.background`, `editor.foreground`, `gutter`, `selection`, `bracket`, `keyword`, `string`, `comment`, `accent` 等。
3. 保存后立即写入数据库，可通过 `Reset` 按钮恢复为预设值。
4. 前端 `themeExtension` 会向 CodeMirror 注入新的 `EditorView.theme`。

## 动态切换
- 切换主题会立即影响所有已打开的编辑器实例；`updateEditorTheme` 逐个更新 `EditorView`。
- `SystemTheme` 设为 `auto` 时，voidraft 会监听操作系统深浅模式并自动切换到 `default-dark` 或 `default-light`。

## 字体与行高
- 字体配置来自设置 > 编辑，`createFontExtensionFromBackend` 会同步 `fontFamily/fontSize/fontWeight/lineHeight`。
- 可在通用设置中的“滚轮缩放”手势下临时调整字号。

## 小地图/装饰色
- `minimap` 扩展读取主题中的 `accent` 颜色，用于高亮当前视区。
- `textHighlight` 扩展的默认背景色可在扩展设置中配置。

## 截图建议
- 展示暗/亮主题对比。
- 展示主题编辑对话框，标出关键字段。
- 展示自定义主题应用后的编辑器界面。

> 如果希望导入 VSCode `.json` 主题，可将颜色映射到 `ThemeColorConfig` 后写入数据库，或等待官方导入工具上线。
