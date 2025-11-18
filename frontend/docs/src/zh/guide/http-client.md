# HTTP 客户端

![HTTP 客户端占位](/img/placeholder-http.png)
> 替换为 HTTP 块 + 响应卡片的截图。

voidraft 将 HTTP 测试写成块（`∞∞∞http`），语法与 JetBrains Http Client 类似。解析与执行由 `frontend/src/views/editor/extensions/httpclient` 完成。

## 基本语法
```http
∞∞∞http
GET "https://api.example.com/users" {
  accept: "application/json"
}
```
- 方法 + URL 必须用双引号包裹。
- Header 以 `key: "value"` 格式编写。
- 请求体使用内联指令（见下文）。

## 变量与环境
```http
@var {
  baseUrl: "https://api.example.com",
  token: "{{secrets.token}}"
}

GET "{{baseUrl}}/users" {
  authorization: "Bearer {{token}}"
}
```
- `@var` 块使用 JSON 语法。
- 变量在任意请求中以 `{{name}}` 引用。
- `variable-resolver.ts` 支持嵌套、默认值、外部 secrets 映射。

## 请求体助手
| 指令 | 示例 | 说明 |
| --- | --- | --- |
| `@json` | `@json { "name": "voidraft" }` | 自动 `content-type: application/json` 并格式化 |
| `@form` | `@form { username: "demo" }` | 转为 `application/x-www-form-urlencoded` |
| `@multipart` | `@multipart { file: @"C:\tmp\a.txt" }` | 读取文件、多段表单 |
| `@text` | `@text <raw body>` | 自由文本 |

## 运行与响应
1. 将光标置于 HTTP 块内。
2. 点击行号左侧的 Run（三角形图标），或按下自定义快捷键。
3. 运行结果会插入到块尾的 `### Response` 中，包含：
   - 状态行 + 响应时间 + 体积。
   - Headers（可折叠）。
   - 响应体（自动格式化 JSON / XML / HTML / Text）。
   - 复制、另存为、再次发送等快捷按钮。

## 多请求文档
- 每个 `∞∞∞http` 块被视为独立请求。
- `request-parser.ts` 会解析同一块内的多个请求（以 `###` 分隔）。
- 使用 Markdown 块写注释或分组标题。

## 变量注入顺序
1. 块内 `@var`。
2. 文档级变量（计划中）。
3. 环境变量（`EnvironmentService` 预留）。

## 调试技巧
- 运行器会在控制台打印完整请求信息，可通过 `wails3 dev` 查看。
- 如果响应过大，可右键响应块选择“折叠正文”或“导出到文件”。
- 网络错误会在响应卡片顶部以红条展示，内容来自 `HttpClientService`。
- 需要代理时确保系统代理已设置，voidraft 会自动继承。

## 与其他功能配合
- 运行结果可直接与 Markdown/代码块混排，形成 API 使用手册。
- 配合 Git 备份可版本化 API 调试记录。
- 可将响应复制到其他块（例如 JSON → Prettier 之后用于 mock）。

> 欢迎在 Issue 中提交你希望支持的额外 DSL 指令（例如 GraphQL、WebSocket、gRPC）。
