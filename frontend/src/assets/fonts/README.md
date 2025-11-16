# 字体压缩工具使用指南

## 📖 简介

`font_compressor.py` 是一个通用的字体压缩工具，可以：
- ✅ 将 TTF、OTF、WOFF 字体文件转换为 WOFF2 格式
- ✅ 支持相对路径和绝对路径
- ✅ 自动生成 CSS 字体定义文件
- ✅ 智能识别字体字重和样式
- ✅ 批量处理整个目录（包括子目录）

## 🚀 前置要求

安装 Python 依赖包：

```bash
pip install fonttools brotli
```

## 📝 使用方法

### 基础用法

```bash
# 进入 fonts 目录
cd frontend/src/assets/fonts

# 交互式模式处理当前目录
python font_compressor.py

# 处理相对路径的 Monocraft 目录
python font_compressor.py Monocraft

# 处理相对路径并指定压缩级别
python font_compressor.py Monocraft -l basic
```

### 生成 CSS 文件

```bash
# 压缩 Monocraft 字体并生成 CSS 文件
python font_compressor.py Monocraft -l basic -c ../styles/monocraft_fonts.css

# 压缩 Hack 字体并生成 CSS
python font_compressor.py Hack -l basic -c ../styles/hack_fonts_new.css

# 压缩 OpenSans 字体并生成 CSS
python font_compressor.py OpenSans -l medium -c ../styles/opensans_fonts.css
```

### 高级用法

```bash
# 使用绝对路径
python font_compressor.py E:\Go_WorkSpace\voidraft\frontend\src\assets\fonts\Monocraft -l basic -c monocraft.css

# 不同压缩级别
python font_compressor.py Monocraft -l basic      # 基础压缩，保留所有功能
python font_compressor.py Monocraft -l medium     # 中等压缩，平衡大小和功能
python font_compressor.py Monocraft -l aggressive # 激进压缩，最小文件
```

## ⚙️ 命令行参数

| 参数 | 说明 | 示例 |
|------|------|------|
| `directory` | 字体目录（相对/绝对路径） | `Monocraft` 或 `/path/to/fonts` |
| `-l, --level` | 压缩级别 (basic/medium/aggressive) | `-l basic` |
| `-c, --css` | CSS 输出文件路径 | `-c monocraft.css` |
| `--version` | 显示版本信息 | `--version` |
| `-h, --help` | 显示帮助信息 | `-h` |

## 📊 压缩级别说明

### basic（基础） - 推荐
- 保留大部分字体功能
- 适合网页使用
- 压缩率约 30-40%

### medium（中等）
- 移除一些不常用的功能
- 平衡文件大小和功能
- 压缩率约 40-50%

### aggressive（激进）
- 最大程度减小文件大小
- 可能影响高级排版功能
- 压缩率约 50-60%

## 📁 输出结果

### 字体文件
压缩后的 `.woff2` 文件会保存在原文件相同的目录下，例如：
- `Monocraft/ttf/Monocraft-Bold.ttf` → `Monocraft/ttf/Monocraft-Bold.woff2`
- `Hack/hack-regular.ttf` → `Hack/hack-regular.woff2`

### CSS 文件
生成的 CSS 文件会包含：
- 自动识别的字体家族名称
- 正确的字重和样式设置
- 使用相对路径的字体引用
- 按字重排序的 `@font-face` 定义

生成的 CSS 示例：

```css
/* 自动生成的字体文件 */
/* 由 font_compressor.py 生成 */

/* Monocraft 字体家族 */

/* Monocraft Light */
@font-face {
  font-family: 'Monocraft';
  src: url('../fonts/Monocraft/ttf/Monocraft-Light.woff2') format('woff2');
  font-weight: 300;
  font-style: normal;
  font-display: swap;
}

/* Monocraft Bold */
@font-face {
  font-family: 'Monocraft';
  src: url('../fonts/Monocraft/ttf/Monocraft-Bold.woff2') format('woff2');
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}
```

## 🎯 实际使用示例

### 示例 1: 压缩 Monocraft 字体

```bash
cd frontend/src/assets/fonts
python font_compressor.py Monocraft -l basic -c ../styles/monocraft_fonts.css
```

这将：
1. 扫描 `Monocraft/ttf` 和 `Monocraft/otf` 目录
2. 将所有字体文件转换为 WOFF2
3. 在 `frontend/src/assets/styles/monocraft_fonts.css` 生成 CSS 文件

### 示例 2: 批量处理多个字体目录

```bash
cd frontend/src/assets/fonts

# 压缩 Monocraft
python font_compressor.py Monocraft -l basic -c ../styles/monocraft_fonts.css

# 压缩 OpenSans
python font_compressor.py OpenSans -l basic -c ../styles/opensans_fonts.css

# 压缩 Hack（已有 CSS，只需生成新版本对比）
python font_compressor.py Hack -l basic -c ../styles/hack_fonts_new.css
```

## 🔍 字体信息自动识别

工具会自动从文件名识别：
- **字重**：Thin(100), Light(300), Regular(400), Medium(500), SemiBold(600), Bold(700), Black(900)
- **样式**：normal, italic
- **字体家族**：自动去除字重和样式后缀

支持的命名格式：
- `FontName-Bold.ttf`
- `FontName_Bold.otf`
- `FontName-BoldItalic.ttf`
- `FontName_SemiBold_Italic.woff`


## 📞 获取帮助

```bash
python font_compressor.py --help
```

