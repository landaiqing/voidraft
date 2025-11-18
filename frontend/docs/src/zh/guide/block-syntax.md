# 块语法与结构

![块语法占位](/img/placeholder-block-flow.png)
> 替换为展示分隔符（`∞∞∞language`）、块内容、语言标签的截图。

## 结构定义
每个块都由 **分隔符 + 内容** 组成：

```
∞∞∞language[-a]\n
<内容>
```

- `language`：`lang-parser/languages.ts` 中的 token，例如 `text`、`javascript`、`python`、`md`、`http`、`math`、`sql`。
- `-a`：可选自动检测后缀，表示忽略显式语言，由 `lang-detect/autodetect.ts` 根据内容猜测。
- 内容允许空行；块之间无需额外空格。

`parser.ts` 会将块解析为：
```ts
{
  language: { name: "javascript", auto: false },
  delimiter: { from, to },
  content: { from, to },
  range: { from, to }
}
```
这些字段供格式化、HTTP 运行、块操作等扩展示例使用。

## 快捷命令
| 命令 | 默认快捷键 | 说明 |
| --- | --- | --- |
| blockAddAfterCurrent | `Ctrl+Enter` | 插入新块（下方） |
| blockAddBeforeCurrent | `Ctrl+Shift+Enter` | 插入新块（上方） |
| blockGotoPrevious/Next | `Alt+↑ / Alt+↓` | 在块之间跳转 |
| blockSelectAll | `Ctrl+Shift+A` | 选中当前块（含分隔符） |
| blockDelete | `Alt+Delete` | 删除整个块 |
| blockMoveUp/Down | `Ctrl+Shift+↑ / Ctrl+Shift+↓` | 重排块顺序 |
| blockFormat | `Ctrl+Shift+F` | 针对当前块执行 Prettier |

## 语言与能力矩阵
| 语言 | 适配特性 |
| --- | --- |
| `text`/`note` | 基础文本，没有特殊扩展 |
| `md` | Markdown 预览、checkbox、高亮 |
| `javascript`/`typescript`/`json` | Prettier 格式化、彩虹括号、折叠、颜色选择 |
| `go`/`rust`/`python`/`java` | 高亮、折叠、自动缩进、语法跳转 |
| `http` | HTTP DSL、变量、响应插入（详见 [HTTP 客户端](/zh/guide/http-client)）|
| `math` | `mathBlock` 运行器，支持 `prev` 引用上一次结果 |
| `sql`/`yaml`/`toml` | 语法高亮、格式化（由 Prettier/插件支持） |

> 若需要不在列表中的语言，可先使用 `text` 块输入，再在工具栏搜索语言名；也可以在 `lang-parser/languages.ts` 中添加条目。

## 自动检测策略
- 当分隔符以 `∞∞∞text-a` 写成时，`AUTO_DETECT_SUFFIX` 生效，`lang-detect` 会基于内容统计 + Levenshtein 距离预测语言。
- 自动结果会写入块状态，但不会覆盖分隔符原文，因此可通过工具栏明确指定。

## 特殊块
### HTTP 块
- 语法位于 `extensions/httpclient/language`，支持 `@var/@json/@form/@multipart` 等指令。
- 运行器会在块尾生成 `### Response`，包含状态码、耗时、headers、body。

### 数学块
- 语言设为 `math`，逐行计算。
- `prev` 变量表示上一行结果，可完成链式运算。
- 结果挂件可点击复制，或显示格式化/定点值。

### Markdown 块
- 工具栏中的 Preview 按钮会调用 `toggleMarkdownPreview`，右侧打开面板。
- 预览状态按文档隔离，不会影响其他文档。

## 分隔符校验
- `parser.ts` 暴露 `isValidDelimiter` 方法，格式错误时分隔符会以红色底纹标记。
- 复制/剪切操作会自动扩选到整个块，确保分隔符完整。

## 维护建议
- 保持每个逻辑主题占用一个块，并用 `md` 块写标题。
- 大量多语言内容时，可用 `text` + 自动检测，待语言确定后再改分隔符。
- 若文档出现“无法解析块”提示，可运行 `格式化文档` 或在命令面板触发“重建语法树”。
