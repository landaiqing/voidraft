# 键盘快捷键

![快捷键占位](/img/placeholder-shortcuts.png)
> 替换为展示快捷键设置界面或常用快捷键速查表的截图。

快捷键定义源自 `internal/models/key_bindings.go`，在设置 > 键位 中可以启用/禁用或改写。下表列出常用组合：

## 块管理
| 功能 | 默认快捷键 | 备注 |
| --- | --- | --- |
| 新建块（下方） | `Ctrl+Enter` | `blockAddAfterCurrent` |
| 新建块（上方） | `Ctrl+Shift+Enter` | `blockAddBeforeCurrent` |
| 跳到上/下一个块 | `Alt+↑ / Alt+↓` | `blockGotoPrevious/Next` |
| 选择当前块 | `Ctrl+Shift+A` | `blockSelectAll` |
| 删除块 | `Alt+Delete` | `blockDelete` |
| 块上移/下移 | `Ctrl+Shift+↑ / Ctrl+Shift+↓` | `blockMoveUp/Down` |
| 复制块 | `Ctrl+C`（块获得焦点） | `blockCopy` |
| 剪切块 | `Ctrl+X` | `blockCut` |
| 粘贴块 | `Ctrl+V` | `blockPaste` |

## 行与文本编辑
| 功能 | 快捷键 |
| --- | --- |
| 行复制（上/下） | `Shift+Alt+↑ / Shift+Alt+↓` |
| 行移动（上/下） | `Alt+↑ / Alt+↓`（在块内部） |
| 插入空行 | `Ctrl+Enter`（块尾后仍可插入） |
| 选择整行 | `Alt+L` |
| 语法级跳转 | `Ctrl+Alt+Left / Ctrl+Alt+Right` |
| 匹配括号 | `Shift+Ctrl+\` |
| 注释/块注释 | `Ctrl+/` / `Shift+Alt+A` |
| Tab 缩进/反向缩进 | `Ctrl+]` / `Ctrl+[` |
| 删除单词（向前/向后） | `Ctrl+Backspace` / `Ctrl+Delete` |

## 搜索与替换
| 功能 | 快捷键 | 描述 |
| --- | --- | --- |
| 打开搜索 | `Ctrl+F` | `showSearch` |
| 打开替换 | `Ctrl+H` | `searchShowReplace` |
| 切换大小写/整词/正则 | `Alt+C / Alt+W / Alt+R` | `searchToggleCase/Word/Regex` |
| 替换全部 | `Alt+Enter` | `searchReplaceAll` |

## Markdown/预览/格式化
| 功能 | 快捷键 |
| --- | --- |
| 格式化块 | `Ctrl+Shift+F` |
| 打开 Markdown 预览 | 工具栏按钮（建议映射到 `Ctrl+Shift+M`） |
| 高亮文本 | `Mod+Shift+H` |

## 窗口与系统
| 功能 | 快捷键 |
| --- | --- |
| 新建窗口 | `Ctrl+Shift+N`（命令面板） |
| 全局显示/隐藏所有窗口 | 默认 `Alt+X`（可在设置 > 通用 > 全局热键中修改） |
| 打开设置 | `Ctrl+,` |
| 切换主题 | `Ctrl+Shift+T`（可自定义） |

## HTTP 客户端
| 功能 | 快捷键 |
| --- | --- |
| 运行请求 | 点击行号旁 Run 或自定义 `Ctrl+Alt+R` |
| 复制响应正文 | `Ctrl+Alt+C`（响应块聚焦时） |

## 翻译工具
| 功能 | 快捷键 |
| --- | --- |
| 显示翻译浮层 | 选中 ≥ `minSelectionLength` 的文本后按 `Ctrl+'`（可自定义） |
| 复制译文 | 在浮层中按 `Ctrl+C` |

## 自定义与导出
1. 打开设置 > 键位，列表会加载来自 `ExtensionService.GetAllKeyBindings()` 的数据。
2. 可单独禁用某个绑定或录入新组合；存储在 `%USERPROFILE%/.voidraft/data/key_bindings.json`。
3. 需要与系统级快捷键冲突时，可勾选“忽略系统修饰键”。

> 建议将以上表格打印贴在工作区，或在文档中保留常用组合，方便新同事查阅。
