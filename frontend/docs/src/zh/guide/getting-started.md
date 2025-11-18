# 快速开始

![块结构流程占位](/img/placeholder-block-flow.png)
> 替换为展示块分隔符、语言标签、内容的截图，帮助读者直观理解 `∞∞∞language` 结构。

## 5 分钟上手流程
1. **启动应用**：等待加载动画结束，默认会打开 `default` 文档。
2. **新建文档**：点击工具栏的文档列表按钮，输入标题后创建；也可在设置里开启标签页，以便同时挂载多个文档。
3. **创建首个块**：
   - 在空白处输入 `∞∞∞javascript` 并回车。
   - 输入代码或文本，`CodeBlockExtension` 会自动匹配语法高亮。
4. **格式化与预览**：
   - 选中块后点击工具栏的「Format」或使用 `Ctrl+Shift+F`。
   - 如果块语言是 `md`，可点击「Preview」按钮开启 Markdown 侧栏。
5. **运行 HTTP 请求**：创建 `∞∞∞http` 块，填写请求，再点击行号旁的 Run 按钮即可获取响应。
6. **打开第二窗口**：在文档列表中右键文档 -> “在新窗口中打开”。`WindowService` 会创建无边框窗口并自动贴靠主窗口。

## 界面导览
- **主编辑区**：CodeMirror 视图，支持鼠标滚轮 + `Ctrl` 缩放（`wheelZoomExtension`）。
- **右侧小地图**：`extensions/minimap` 提供鸟瞰和选区同步。
- **底部状态**：`editorStore.documentStats` 实时展示行数/字符/选区。
- **工具栏**（`Toolbar.vue`）：包含文档切换、块语言下拉、窗口置顶、格式化、Markdown 预览、更新提示、进入设置等。

## 块的基本操作
| 操作 | 快捷键 | 说明 |
| --- | --- | --- |
| 新建块（下方） | `Ctrl+Enter` | 在当前块后插入 `∞∞∞text-a` 分隔符 |
| 新建块（上方） | `Ctrl+Shift+Enter` | 在当前块前插入 |
| 跳到上/下一个块 | `Alt+Up / Alt+Down` | 通过 `blockGotoPrevious/Next` 命令 |
| 删除块 | `Alt+Delete` | 仅删除块内容，不影响其他块 |
| 块排序 | `Ctrl+Shift+↑/↓` | `moveLines` 结合块范围移动 |
| 复制块 | `Ctrl+C`（光标在块上即可） | `copyPaste.ts` 自动扩展选区至整个块 |

## 自动语言与格式化
- 当分隔符写成 `∞∞∞text-a` 时，会触发语言自动检测（`lang-detect/autodetect.ts`），常用于粘贴未知代码。
- `formatCode.ts` 调用 Prettier，自动选择 parser；若语言不支持，会提示不可格式化。
- 块语言可在工具栏下拉中修改，列表由 `lang-parser/languages.ts` 提供。

## Markdown / 待办
1. 使用 `∞∞∞md` 分隔符。
2. 在块内写 Markdown，点击工具栏预览按钮。
3. 勾选/取消 Checkbox（`extensions/checkbox`）即可同步更新文本。

## 翻译与文本标注
- 选中文本后会浮现翻译入口（`translator` 扩展），点击即可在块内查看结果、复制、切换目标语言。
- `textHighlight` 扩展提供 `Mod+Shift+H` 高亮当前选区，颜色可在扩展设置中调整。

## HTTP 客户端概览
```http
∞∞∞http
@var {
  baseUrl: "https://api.example.com",
  token: "{{secrets.token}}"
}

POST "{{baseUrl}}/users" {
  authorization: "Bearer {{token}}"
  content-type: "application/json"

  @json {
    name: "voidraft",
    role: "developer"
  }
}
```
- `parser/request-parser.ts` 会将变量与请求体解析为结构化对象。
- 点击 gutter Run 获取响应，`response-inserter.ts` 会将结果写入 `### Response` 区块。

## 自动保存与版本安全
- `editorStore` 为每个文档维护 `autoSaveTimer`，默认 2000 ms，可在设置 > 编辑 调整。
- `documentStates` 记录每个文档的光标位置，切换文档或重启应用都会恢复。
- 若开启 Git 备份，可在工具栏或设置中查看最近一次 `push` 是否成功。

## 最佳实践
- 使用 Markdown 块为每组代码加标题/注释，便于导航。
- 重要文档启用“锁定”以避免被删除（文档右键菜单）。
- 多窗口 + 吸附用于常驻参考资料，标签页用于在一个窗口内快速切换。
- 善用「窗口置顶」图钉，让 voidraft 叠放在 VSCode/浏览器之上。

接下来：
- [界面总览](/zh/guide/ui-overview)
- [块语法与结构](/zh/guide/block-syntax)
