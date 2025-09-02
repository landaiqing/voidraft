# <img src="./frontend/public/appicon.png" alt="voidraft Logo" width="32" height="32" style="vertical-align: middle;"> voidraft

**中文** | [English](README.md)

> *一个专为开发者打造的优雅文本片段记录工具。*

voidraft 是一个现代化的开发者专用文本编辑器，让你能够随时随地记录、整理和管理各种文本片段。无论是临时的代码片段、API 响应、会议笔记，还是日常的待办事项，voidraft 都能为你提供流畅而优雅的编辑体验。

## 核心特性

### 开发者友好

- 多语言代码块支持 - 支持 30+ 种编程语言的语法高亮
- 智能语言检测 - 自动识别代码块语言类型
- 代码格式化 - 内置 Prettier 支持，一键美化代码
- 块状编辑模式 - 将内容分割为独立的代码块，每个块可设置不同语言
- 支持多窗口 - 同时编辑多个文档
- 支持自定义主题 - 自定义编辑器主题

### 现代化界面

- 清新脱俗的设计 - 简洁而不失优雅的用户界面
- 深色/浅色主题 - 适应不同使用场景
- 多语言支持 - 内置国际化功能，支持多种语言切换

### 扩展系统

- 模块化架构 - 基于 CodeMirror 6 的可扩展编辑器
- 丰富的扩展 - 包含多种实用编辑器扩展
  - 彩虹括号匹配
  - VSCode 风格搜索替换
  - 颜色选择器
  - 内置翻译工具
  - 文本高亮
  - 代码折叠
  - 超链接支持
  - 复选框支持
  - 小地图


## 快速开始

### 下载使用

1. 访问发布页面：https://github.com/landaiqing/voidraft/releases
2. 选择适合的版本下载
3. 运行安装程序，开始使用

### 开发环境

```bash
# 克隆项目
git clone https://github.com/landaiqing/voidraft
cd voidraft

# 安装前端依赖
cd frontend
npm install
npm run build
cd ..

# 启动开发服务器
wails3 dev
```

### 生产构建

```bash
# 构建应用
wails3 package
```

构建完成后，可执行文件将生成在 `bin` 目录中。

## 技术架构

### 核心技术

| 层级 | 技术栈 |
|------|--------|
| 桌面框架 | Wails3 |
| 后端语言 | Go 1.21+ |
| 前端框架 | Vue 3 + TypeScript |
| 编辑器核心 | CodeMirror 6 |
| 构建工具 | Vite |
| 数据存储 | SQLite |

## 项目结构

```
voidraft/
├── frontend/              # Vue 3 前端应用
│   ├── src/
│   │   ├── views/editor/  # 编辑器核心视图
│   │   │   ├── extensions/ # 编辑器扩展系统
│   │   │   │   ├── codeblock/    # 代码块支持
│   │   │   │   ├── translator/   # 翻译工具
│   │   │   │   ├── minimap/     # 代码小地图
│   │   │   │   ├── vscodeSearch/ # VSCode风格搜索
│   │   │   │   └── ...           # 更多扩展
│   │   │   └── ...
│   │   ├── components/    # 可复用组件
│   │   ├── stores/       # Pinia 状态管理
│   │   └── utils/         # 工具函数库
│   └── public/            # 静态资源文件
├── internal/             # Go 后端核心
│   ├── services/          # 核心业务服务
│   ├── models/            # 数据模型定义
│   └── events/            # 事件处理机制
└── main.go               # 应用程序入口
```

## 开发路线图

### 平台扩展计划

| 平台 | 状态 | 预期时间 |
|------|------|----------|
| macOS | 计划中 | 后续版本 |
| Linux | 计划中 | 后续版本 |

### 计划添加的功能
- ✅ 自定义主题 - 自定义编辑器主题
- ✅ 多窗口支持 - 支持同时编辑多个文档
- ✅ 数据同步 - 文档云端备份
- [ ] 剪切板增强 - 监听和管理剪切板历史
- [ ] 扩展系统 - 支持自定义插件


## 致谢

> 站在巨人的肩膀上，致敬开源精神

voidraft 的诞生离不开以下优秀的开源项目：

### 特别感谢

- **[Heynote](https://github.com/heyman/heynote/)** - voidraft 是基于 Heynote 概念的功能增强版本
  - 继承了 Heynote 优雅的块状编辑理念
  - 在原有基础上增加了更多实用功能
  - 采用现代化技术栈重新构建
  - 提供更丰富的扩展系统和自定义选项
  - 感谢 Heynote 团队为开发者社区带来的创新思路

### 核心技术栈

| 技术 | 用途 | 链接                                                   |
|------|------|------------------------------------------------------|
| Wails3 | 跨平台桌面应用框架 | [wails.io](https://v3alpha.wails.io/)                |
| Vue.js | 渐进式前端框架 | [vuejs.org](https://vuejs.org/)                      |
| CodeMirror 6 | 现代化代码编辑器 | [codemirror.net](https://codemirror.net/)            |
| Prettier | 代码格式化工具 | [prettier.io](https://prettier.io/)                  |
| TypeScript | 类型安全的 JavaScript | [typescriptlang.org](https://www.typescriptlang.org/) |

## 许可证

本项目采用 [MIT 许可证](LICENSE) 开源。

欢迎 Fork、Star 和贡献代码。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub stars](https://img.shields.io/github/stars/landaiqing/voidraft.svg?style=social&label=Star)](https://github.com/yourusername/voidraft)
[![GitHub forks](https://img.shields.io/github/forks/landaiqing/voidraft.svg?style=social&label=Fork)](https://github.com/yourusername/voidraft)

*Made with ❤️ by landaiqing*
