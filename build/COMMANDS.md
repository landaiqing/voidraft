# Wails 3 命令参考表

本文档列出了 Voidraft 项目中使用的所有 Wails 3 命令和参数。

## 📋 命令总览

| 类别 | 命令 | 用途 |
|------|------|------|
| 生成工具 | `wails3 generate` | 生成项目所需的各种资源文件 |
| 打包工具 | `wails3 tool package` | 使用 nfpm 打包应用程序 |
| 任务执行 | `wails3 task` | 执行 Taskfile.yml 中定义的任务 |

---

## 🔧 详细命令参数

### 1. `wails3 generate bindings`
**生成 TypeScript 绑定文件**

| 参数 | 说明 | 示例值 |
|------|------|--------|
| `-f` | 构建标志 | `''` (空字符串) |
| `-clean` | 清理旧绑定 | `true` |
| `-ts` | 生成 TypeScript | 无需值 |

**使用位置：** `build/Taskfile.yml:53`

**完整命令：**
```bash
wails3 generate bindings -f '' -clean=true -ts
```

---

### 2. `wails3 generate icons`
**从单个图片生成多平台图标**

| 参数 | 说明 | 示例值 |
|------|------|--------|
| `-input` | 输入图片路径 | `appicon.png` |
| `-macfilename` | macOS 图标输出路径 | `darwin/icons.icns` |
| `-windowsfilename` | Windows 图标输出路径 | `windows/icons.ico` |

**使用位置：** `build/Taskfile.yml:64`

**完整命令：**
```bash
wails3 generate icons \
  -input appicon.png \
  -macfilename darwin/icons.icns \
  -windowsfilename windows/icons.ico
```

---

### 3. `wails3 generate syso`
**生成 Windows .syso 资源文件**

| 参数 | 说明 | 示例值 |
|------|------|--------|
| `-arch` | 目标架构 | `amd64` / `arm64` |
| `-icon` | 图标文件 | `windows/icon.ico` |
| `-manifest` | 清单文件 | `windows/wails.exe.manifest` |
| `-info` | 应用信息 JSON | `windows/info.json` |
| `-out` | 输出文件路径 | `../wails_windows_amd64.syso` |

**使用位置：** `build/windows/Taskfile.yml:42`

**完整命令：**
```bash
wails3 generate syso \
  -arch amd64 \
  -icon windows/icon.ico \
  -manifest windows/wails.exe.manifest \
  -info windows/info.json \
  -out ../wails_windows_amd64.syso
```

---

### 4. `wails3 generate webview2bootstrapper`
**生成 Windows WebView2 引导程序**

| 参数 | 说明 | 示例值 |
|------|------|--------|
| `-dir` | 输出目录 | `build/windows/nsis` |

**使用位置：** `build/windows/Taskfile.yml:55`

**完整命令：**
```bash
wails3 generate webview2bootstrapper -dir "build/windows/nsis"
```

**说明：** 下载 Microsoft Edge WebView2 运行时安装程序，用于 NSIS 打包。

---

### 5. `wails3 generate .desktop`
**生成 Linux .desktop 桌面文件**

| 参数 | 说明 | 示例值 |
|------|------|--------|
| `-name` | 应用名称 | `voidraft` |
| `-exec` | 可执行文件名 | `voidraft` |
| `-icon` | 图标名称 | `appicon` |
| `-outputfile` | 输出文件路径 | `build/linux/voidraft.desktop` |
| `-categories` | 应用分类 | `Development;` |

**使用位置：** `build/linux/Taskfile.yml:107`

**完整命令：**
```bash
wails3 generate .desktop \
  -name "voidraft" \
  -exec "voidraft" \
  -icon "appicon" \
  -outputfile build/linux/voidraft.desktop \
  -categories "Development;"
```

---

### 6. `wails3 generate appimage`
**生成 Linux AppImage 包**

| 参数 | 说明 | 示例值 |
|------|------|--------|
| `-binary` | 二进制文件名 | `voidraft` |
| `-icon` | 图标文件路径 | `../../appicon.png` |
| `-desktopfile` | .desktop 文件路径 | `../voidraft.desktop` |
| `-outputdir` | 输出目录 | `../../../bin` |
| `-builddir` | 构建临时目录 | `build/linux/appimage/build` |

**使用位置：** `build/linux/Taskfile.yml:49`

**完整命令：**
```bash
wails3 generate appimage \
  -binary voidraft \
  -icon ../../appicon.png \
  -desktopfile ../voidraft.desktop \
  -outputdir ../../../bin \
  -builddir build/linux/appimage/build
```

**说明：** 自动下载 linuxdeploy 工具并创建 AppImage。

---

### 7. `wails3 tool package` (deb)
**创建 Debian/Ubuntu .deb 包**

| 参数 | 说明 | 示例值 |
|------|------|--------|
| `-name` | 包名称 | `voidraft` |
| `-format` | 包格式 | `deb` |
| `-config` | nfpm 配置文件 | `./build/linux/nfpm/nfpm.yaml` |
| `-out` | 输出目录 | `./bin` |

**使用位置：** `build/linux/Taskfile.yml:90`

**完整命令：**
```bash
wails3 tool package \
  -name voidraft \
  -format deb \
  -config ./build/linux/nfpm/nfpm.yaml \
  -out ./bin
```

---

### 8. `wails3 tool package` (rpm)
**创建 RedHat/CentOS/Fedora .rpm 包**

| 参数 | 说明 | 示例值 |
|------|------|--------|
| `-name` | 包名称 | `voidraft` |
| `-format` | 包格式 | `rpm` |
| `-config` | nfpm 配置文件 | `./build/linux/nfpm/nfpm.yaml` |
| `-out` | 输出目录 | `./bin` |

**使用位置：** `build/linux/Taskfile.yml:95`

**完整命令：**
```bash
wails3 tool package \
  -name voidraft \
  -format rpm \
  -config ./build/linux/nfpm/nfpm.yaml \
  -out ./bin
```

---

### 9. `wails3 tool package` (archlinux)
**创建 Arch Linux .pkg.tar.zst 包**

| 参数 | 说明 | 示例值 |
|------|------|--------|
| `-name` | 包名称 | `voidraft` |
| `-format` | 包格式 | `archlinux` |
| `-config` | nfpm 配置文件 | `./build/linux/nfpm/nfpm.yaml` |
| `-out` | 输出目录 | `./bin` |

**使用位置：** `build/linux/Taskfile.yml:100`

**完整命令：**
```bash
wails3 tool package \
  -name voidraft \
  -format archlinux \
  -config ./build/linux/nfpm/nfpm.yaml \
  -out ./bin
```

---

### 10. `wails3 task`
**执行 Taskfile.yml 中定义的任务**

| 参数 | 说明 | 示例值 |
|------|------|--------|
| `[taskname]` | 任务名称 | `build`, `package`, `run` |
| `[VAR=value]` | 变量赋值 | `PRODUCTION=true`, `ARCH=amd64` |

**常用任务：**

| 任务 | 说明 | 命令 |
|------|------|------|
| `build` | 构建应用 | `wails3 task build PRODUCTION=true` |
| `package` | 打包应用 | `wails3 task package` |
| `run` | 运行应用 | `wails3 task run` |

**使用位置：** `build/config.yml`

---

## 📊 平台对应命令表

| 平台 | 主要命令 | 产物 |
|------|----------|------|
| **Windows** | `generate syso`<br>`generate webview2bootstrapper` | `.syso` 资源文件<br>NSIS 安装程序 |
| **Linux** | `generate .desktop`<br>`generate appimage`<br>`tool package -format deb/rpm/archlinux` | `.desktop` 文件<br>`.AppImage`<br>`.deb` / `.rpm` / `.pkg.tar.zst` |
| **macOS** | `generate icons` | `.icns` 图标<br>`.app` 应用包 |
| **通用** | `generate bindings`<br>`generate icons` | TypeScript 绑定<br>多平台图标 |

---

## 🚀 快速参考

### 完整构建流程

```bash
# 1. 生成绑定和图标
wails3 task common:generate:bindings
wails3 task common:generate:icons

# 2. 构建前端
cd frontend
npm install
npm run build
cd ..

# 3. 构建应用（各平台）
cd build/windows  && wails3 task build PRODUCTION=true  # Windows
cd build/linux    && wails3 task build PRODUCTION=true  # Linux
cd build/darwin   && wails3 task build PRODUCTION=true  # macOS

# 4. 打包应用（各平台）
cd build/windows  && wails3 task package  # NSIS 安装程序
cd build/linux    && wails3 task package  # AppImage + deb + rpm + archlinux
cd build/darwin   && wails3 task package  # .app bundle
```

---

## 📝 注意事项

1. **变量传递：** Task 命令支持通过 `VAR=value` 格式传递变量
2. **路径问题：** 相对路径基于 Taskfile.yml 所在目录
3. **依赖顺序：** 某些任务有依赖关系（通过 `deps:` 定义）
4. **环境变量：** 使用 `env:` 定义的环境变量会自动设置

---

## 🔗 相关文档

- [Wails 3 官方文档](https://v3alpha.wails.io/)
- [Taskfile 语法](https://taskfile.dev/)
- [nfpm 打包工具](https://nfpm.goreleaser.com/)

