# Clang Format WASM Plugin

这是一个基于 clang-format WebAssembly 的 Prettier 插件，支持格式化 C/C++/C#/Java/Protobuf 代码。

## 目录结构

```
clang/
├── src/                        # 源码目录
│   ├── scripts/                # 构建和工具脚本
│   │   ├── build.sh           # 主构建脚本
│   │   ├── gen_patch.sh       # 补丁生成脚本
│   │   └── cli.patch          # CLI 修改补丁
│   ├── *.cc                   # C++ 源文件
│   ├── *.h                    # C++ 头文件
│   ├── CMakeLists.txt         # CMake 构建配置
│   ├── package.json           # NPM 包配置
│   ├── clang-format.d.ts      # TypeScript 类型定义
│   ├── template.js            # JavaScript 模板
│   └── clang-format-diff.py   # Python 差异工具
├── *.js                       # 编译后的 JavaScript 文件
├── *.wasm                     # 编译后的 WebAssembly 文件
├── *.cjs                      # CommonJS 格式的 CLI 工具
├── git-clang-format           # Git 集成工具
└── index.ts                   # 插件入口文件
```

## 构建说明

### 前提条件

- Install LLVM and Clang (version 18 or later)
- Install CMake (version 3.27 or later)
- Install Ninja (version 1.11 or later)

### 构建步骤

1. Clone this repository

2. 进入源码目录：
   ```bash
   cd src
   ```

3. 运行构建脚本：
   ```bash
   ./scripts/build.sh
   ```

构建脚本会：
- 创建 `build` 目录并编译源码
- 将编译结果复制到上级目录（插件目录）
- 生成 WebAssembly 文件和 JavaScript 绑定
- 复制必要的工具和类型定义文件

### 输出文件

构建完成后，插件目录下会包含：
- `clang-format.wasm` - WebAssembly 库文件
- `clang-format.js` - JavaScript 绑定文件
- `clang-format-cli.cjs` - CLI 工具
- `clang-format-cli.wasm` - CLI WebAssembly 文件
- `git-clang-format` - Git 集成工具
- `clang-format-diff.py` - 差异工具

## 开发说明

### 修改源码

- C++ 源文件位于 `src/` 目录下
- 修改后运行 `./scripts/build.sh` 重新构建
- 类型定义文件 `src/clang-format.d.ts` 需要与实际 API 保持同步

### 生成补丁

如果修改了 CLI 相关代码，可以使用：
```bash
./scripts/gen_patch.sh
```

生成补丁文件 `scripts/cli.patch`。

## 使用说明

插件会自动加载编译后的 WebAssembly 文件，支持以下语言：
- C/C++
- Objective-C/C++
- C#
- Java
- Protocol Buffer

支持的 clang-format 样式：
- LLVM
- Google
- Chromium
- Mozilla
- WebKit
- Microsoft
- GNU
- 自定义样式