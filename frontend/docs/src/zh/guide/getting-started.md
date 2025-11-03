# 快速开始

学习使用 voidraft 的基础知识并创建你的第一个文档。

## 编辑器界面

当你打开 voidraft 时，你将看到：

- **主编辑器**：编写和编辑的中心区域
- **工具栏**：快速访问常用操作
- **状态栏**：显示当前块的语言和其他信息

## 创建代码块

voidraft 使用基于块的编辑系统。每个块可以有不同的语言：

1. 按 `Ctrl+Enter` 创建新块
2. 输入 `∞∞∞` 后跟语言名称（例如 `∞∞∞javascript`）
3. 在该块中开始编码

### 支持的语言

voidraft 支持 30+ 种编程语言，包括：
- JavaScript、TypeScript
- Python、Go、Rust
- HTML、CSS、Sass
- SQL、YAML、JSON
- 以及更多...

## 基本操作

### 导航

- `Ctrl+Up/Down`：在块之间移动
- `Ctrl+Home/End`：跳转到第一个/最后一个块
- `Ctrl+F`：在文档中搜索

### 编辑

- `Ctrl+D`：复制当前行
- `Ctrl+/`：切换注释
- `Alt+Up/Down`：向上/向下移动行
- `Ctrl+Shift+F`：格式化代码（如果语言支持 Prettier）

### 块管理

- `Ctrl+Enter`：创建新块
- `Ctrl+Shift+Enter`：在上方创建块
- `Alt+Delete`：删除当前块

## 使用 HTTP 客户端

voidraft 包含用于测试 API 的内置 HTTP 客户端：

1. 创建一个 HTTP 语言的块
2. 编写你的 HTTP 请求：

```http
POST "https://api.example.com/users" {
  content-type: "application/json"
  
  @json {
    name: "张三",
    email: "zhangsan@example.com"
  }
}
```

3. 点击运行按钮执行请求
4. 内联查看响应

## 多窗口支持

同时处理多个文档：

1. 转到 `文件 > 新建窗口`（或 `Ctrl+Shift+N`）
2. 每个窗口都是独立的
3. 更改会自动保存

## 自定义主题

个性化你的编辑器：

1. 打开设置（`Ctrl+,`）
2. 转到外观
3. 选择主题或创建自己的主题
4. 根据你的偏好自定义颜色

## 键盘快捷键

学习基本快捷键：

| 操作 | 快捷键 |
|-----|--------|
| 新建窗口 | `Ctrl+Shift+N` |
| 搜索 | `Ctrl+F` |
| 替换 | `Ctrl+H` |
| 格式化代码 | `Ctrl+Shift+F` |
| 切换主题 | `Ctrl+Shift+T` |
| 命令面板 | `Ctrl+Shift+P` |

## 下一步

现在你已经了解了基础知识：

- 详细探索[功能特性](/zh/guide/features)

