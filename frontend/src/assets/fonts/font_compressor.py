#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
通用字体压缩工具
使用 fonttools 库将字体文件转换为 WOFF2 格式，减小文件大小
支持 TTF、OTF、WOFF 等格式的字体文件
"""

import os
import sys
import subprocess
import shutil
import argparse
import re
from pathlib import Path
from typing import List, Tuple, Dict, Optional

def check_dependencies():
    """检查必要的依赖是否已安装"""
    missing_packages = []
    
    # 检查 fonttools
    try:
        import fontTools
    except ImportError:
        missing_packages.append('fonttools')
    
    # 检查 brotli
    try:
        import brotli
    except ImportError:
        missing_packages.append('brotli')
    
    # 检查 pyftsubset 命令是否可用
    try:
        result = subprocess.run(['pyftsubset', '--help'], capture_output=True, text=True)
        if result.returncode != 0:
            missing_packages.append('fonttools[subset]')
    except FileNotFoundError:
        if 'fonttools' not in missing_packages:
            missing_packages.append('fonttools[subset]')
    
    if missing_packages:
        print(f"缺少必要的依赖包: {', '.join(missing_packages)}")
        print("请运行以下命令安装:")
        print(f"pip install {' '.join(missing_packages)}")
        return False
    
    return True

def get_file_size(file_path: str) -> int:
    """获取文件大小（字节）"""
    return os.path.getsize(file_path)

def format_file_size(size_bytes: int) -> str:
    """格式化文件大小显示"""
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.2f} KB"
    else:
        return f"{size_bytes / (1024 * 1024):.2f} MB"

def compress_font(input_path: str, output_path: str, compression_level: str = "basic") -> bool:
    """
    压缩单个字体文件
    
    Args:
        input_path: 输入字体文件路径
        output_path: 输出字体文件路径
        compression_level: 压缩级别 ("basic", "medium", "aggressive")
    
    Returns:
        bool: 压缩是否成功
    """
    try:
        # 基础压缩参数
        base_args = [
            "pyftsubset", input_path,
            "--output-file=" + output_path,
            "--flavor=woff2",  # 输出为 WOFF2 格式，压缩率更高
            "--with-zopfli",   # 使用 Zopfli 算法进一步压缩
        ]
        
        # 根据压缩级别设置不同的参数
        if compression_level == "basic":
            # 基础压缩：保留常用字符和功能
            args = base_args + [
                "--unicodes=U+0020-007F,U+00A0-00FF,U+2000-206F,U+2070-209F,U+20A0-20CF",  # 基本拉丁字符、标点符号等
                "--layout-features=*",  # 保留所有布局特性
                "--glyph-names",        # 保留字形名称
                "--symbol-cmap",        # 保留符号映射
                "--legacy-cmap",        # 保留传统字符映射
                "--notdef-glyph",       # 保留 .notdef 字形
                "--recommended-glyphs", # 保留推荐字形
                "--name-IDs=*",         # 保留所有名称ID
                "--name-legacy",        # 保留传统名称
            ]
        elif compression_level == "medium":
            # 中等压缩：移除一些不常用的功能
            args = base_args + [
                "--unicodes=U+0020-007F,U+00A0-00FF,U+2000-206F",  # 减少字符范围
                "--layout-features=kern,liga,clig",  # 只保留关键布局特性
                "--no-glyph-names",     # 移除字形名称
                "--notdef-glyph",
                "--name-IDs=1,2,3,4,5,6",  # 只保留基本名称ID
            ]
        else:  # aggressive
            # 激进压缩：最大程度减小文件大小
            args = base_args + [
                "--unicodes=U+0020-007F",  # 只保留基本ASCII字符
                "--no-layout-features",     # 移除所有布局特性
                "--no-glyph-names",        # 移除字形名称
                "--no-symbol-cmap",        # 移除符号映射
                "--no-legacy-cmap",        # 移除传统映射
                "--notdef-glyph",
                "--name-IDs=1,2",          # 只保留最基本的名称
                "--desubroutinize",        # 去子程序化（可能减小CFF字体大小）
            ]
        
        # 执行压缩命令
        result = subprocess.run(args, capture_output=True, text=True)
        
        if result.returncode == 0:
            return True
        else:
            print(f"压缩失败: {result.stderr}")
            return False
            
    except Exception as e:
        print(f"压缩过程中出现错误: {str(e)}")
        return False

def find_font_files(directory: str, exclude_woff2: bool = False) -> List[str]:
    """查找目录中的所有字体文件"""
    if exclude_woff2:
        font_extensions = ['.ttf', '.otf', '.woff']
    else:
        font_extensions = ['.ttf', '.otf', '.woff', '.woff2']
    font_files = []
    
    for root, dirs, files in os.walk(directory):
        for file in files:
            if any(file.lower().endswith(ext) for ext in font_extensions):
                font_files.append(os.path.join(root, file))
    
    return font_files

def parse_font_info(filename: str) -> Dict[str, any]:
    """
    从字体文件名解析字体信息（字重、样式等）
    
    Args:
        filename: 字体文件名（不含路径）
    
    Returns:
        包含字体信息的字典
    """
    # 移除扩展名
    name_without_ext = os.path.splitext(filename)[0]
    
    # 字重映射
    weight_mapping = {
        'thin': (100, 'Thin'),
        'extralight': (200, 'ExtraLight'),
        'light': (300, 'Light'),
        'regular': (400, 'Regular'),
        'normal': (400, 'Regular'),
        'medium': (500, 'Medium'),
        'semibold': (600, 'SemiBold'),
        'bold': (700, 'Bold'),
        'extrabold': (800, 'ExtraBold'),
        'black': (900, 'Black'),
        'heavy': (900, 'Heavy'),
    }
    
    # 默认值
    font_weight = 400
    font_style = 'normal'
    weight_name = 'Regular'
    
    # 检查是否为斜体
    if re.search(r'italic', name_without_ext, re.IGNORECASE):
        font_style = 'italic'
    
    # 检查字重
    name_lower = name_without_ext.lower()
    for weight_key, (weight_value, weight_label) in weight_mapping.items():
        if weight_key in name_lower:
            font_weight = weight_value
            weight_name = weight_label
            break
    
    # 提取字体家族名称（移除字重和样式后缀）
    family_name = name_without_ext
    for weight_key, (_, weight_label) in weight_mapping.items():
        family_name = re.sub(r'[-_]?' + weight_label, '', family_name, flags=re.IGNORECASE)
    family_name = re.sub(r'[-_]?italic', '', family_name, flags=re.IGNORECASE)
    family_name = family_name.strip('-_')
    
    return {
        'family': family_name,
        'weight': font_weight,
        'style': font_style,
        'weight_name': weight_name,
        'full_name': name_without_ext
    }

def generate_css(font_files: List[str], output_css_path: str, css_base_path: str):
    """
    生成CSS字体文件
    
    Args:
        font_files: 字体文件路径列表（woff2文件）
        output_css_path: 输出CSS文件路径
        css_base_path: CSS文件相对于字体文件的基础路径
    """
    # 按字体家族分组
    font_groups: Dict[str, List[Dict]] = {}
    
    for font_file in font_files:
        if not font_file.endswith('.woff2'):
            continue
            
        filename = os.path.basename(font_file)
        font_info = parse_font_info(filename)
        
        # 计算相对路径
        font_dir = os.path.dirname(font_file)
        css_dir = os.path.dirname(output_css_path)
        
        try:
            # 计算从CSS文件到字体文件的相对路径
            rel_path = os.path.relpath(font_file, css_dir)
            # 统一使用正斜杠（适用于Web）
            rel_path = rel_path.replace('\\', '/')
        except ValueError:
            # 如果在不同驱动器上，使用绝对路径
            rel_path = font_file.replace('\\', '/')
        
        font_info['path'] = rel_path
        
        family = font_info['family']
        if family not in font_groups:
            font_groups[family] = []
        font_groups[family].append(font_info)
    
    # 生成CSS内容
    css_lines = ['/* 自动生成的字体文件 */', '/* 由 font_compressor.py 生成 */', '']
    
    for family, fonts in sorted(font_groups.items()):
        css_lines.append(f'/* {family} 字体家族 */')
        css_lines.append('')
        
        # 按字重排序
        fonts.sort(key=lambda x: (x['weight'], x['style']))
        
        for font in fonts:
            css_lines.append(f"/* {family} {font['weight_name']}{' Italic' if font['style'] == 'italic' else ''} */")
            css_lines.append('@font-face {')
            css_lines.append(f"  font-family: '{family}';")
            css_lines.append(f"  src: url('{font['path']}') format('woff2');")
            css_lines.append(f"  font-weight: {font['weight']};")
            css_lines.append(f"  font-style: {font['style']};")
            css_lines.append('  font-display: swap;')
            css_lines.append('}')
            css_lines.append('')
    
    # 写入CSS文件
    with open(output_css_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(css_lines))
    
    print(f"[OK] CSS文件已生成: {output_css_path}")
    print(f"  包含 {sum(len(fonts) for fonts in font_groups.values())} 个字体定义")
    print(f"  字体家族: {', '.join(sorted(font_groups.keys()))}")

def compress_fonts_batch(font_directory: str, compression_level: str = "basic") -> List[str]:
    """
    批量压缩字体文件
    
    Args:
        font_directory: 字体文件目录
        compression_level: 压缩级别
    
    Returns:
        生成的woff2文件路径列表
    """
    if not os.path.exists(font_directory):
        print(f"错误: 目录 {font_directory} 不存在")
        return []
    
    # 查找所有字体文件（排除已经是woff2的）
    font_files = find_font_files(font_directory, exclude_woff2=True)
    
    if not font_files:
        print("未找到字体文件")
        return []
    
    print(f"找到 {len(font_files)} 个字体文件")
    print(f"压缩级别: {compression_level}")
    print(f"压缩后的文件将与源文件放在同一目录，扩展名为 .woff2")
    print("-" * 60)
    
    total_original_size = 0
    total_compressed_size = 0
    successful_compressions = 0
    generated_woff2_files = []
    
    for i, font_file in enumerate(font_files, 1):
        print(f"[{i}/{len(font_files)}] 处理: {os.path.basename(font_file)}")
        
        # 获取原始文件大小
        original_size = get_file_size(font_file)
        total_original_size += original_size
        
        # 生成输出文件名（保持原文件名，只改变扩展名）
        file_dir = os.path.dirname(font_file)
        base_name = os.path.splitext(os.path.basename(font_file))[0]
        output_file = os.path.join(file_dir, f"{base_name}.woff2")
        
        # 压缩字体
        if compress_font(font_file, output_file, compression_level):
            if os.path.exists(output_file):
                compressed_size = get_file_size(output_file)
                total_compressed_size += compressed_size
                successful_compressions += 1
                generated_woff2_files.append(output_file)
                
                # 计算压缩率
                compression_ratio = (1 - compressed_size / original_size) * 100
                
                print(f"  [OK] 成功: {format_file_size(original_size)} -> {format_file_size(compressed_size)} "
                      f"(压缩 {compression_ratio:.1f}%)")
            else:
                print(f"  [失败] 输出文件未生成")
        else:
            print(f"  [失败] 压缩过程出错")
        
        print()
    
    # 显示总结
    print("=" * 60)
    print("压缩完成!")
    print(f"成功压缩: {successful_compressions}/{len(font_files)} 个文件")
    
    if successful_compressions > 0:
        total_compression_ratio = (1 - total_compressed_size / total_original_size) * 100
        print(f"总大小: {format_file_size(total_original_size)} → {format_file_size(total_compressed_size)}")
        print(f"总压缩率: {total_compression_ratio:.1f}%")
        print(f"节省空间: {format_file_size(total_original_size - total_compressed_size)}")
    
    return generated_woff2_files

def main():
    """主函数"""
    # 解析命令行参数
    parser = argparse.ArgumentParser(
        description='通用字体压缩工具 - 将字体文件转换为 WOFF2 格式并生成CSS',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
使用示例:
  %(prog)s                                          # 交互式模式，处理当前目录
  %(prog)s Monocraft                                # 处理相对路径目录
  %(prog)s Monocraft -l basic                       # 使用基础压缩级别
  %(prog)s Monocraft -l basic -c monocraft.css      # 压缩并生成CSS文件
  %(prog)s /path/to/fonts -l medium -c fonts.css    # 使用绝对路径
  
压缩级别说明:
  basic      - 基础压缩：保留大部分功能，适合网页使用
  medium     - 中等压缩：平衡文件大小和功能
  aggressive - 激进压缩：最小文件大小，可能影响显示效果

CSS生成说明:
  使用 -c/--css 选项生成CSS文件，自动使用相对路径引用字体文件
        '''
    )
    
    parser.add_argument(
        'directory',
        nargs='?',
        default=None,
        help='字体文件目录路径（支持相对/绝对路径，默认为当前脚本所在目录）'
    )
    
    parser.add_argument(
        '-l', '--level',
        choices=['basic', 'medium', 'aggressive'],
        default=None,
        help='压缩级别：basic（基础）、medium（中等）、aggressive（激进）'
    )
    
    parser.add_argument(
        '-c', '--css',
        default=None,
        help='生成CSS文件路径（相对于脚本位置或绝对路径）'
    )
    
    parser.add_argument(
        '--version',
        action='version',
        version='%(prog)s 2.0'
    )
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("通用字体压缩工具 v2.0")
    print("=" * 60)
    
    # 检查依赖
    if not check_dependencies():
        return
    
    # 获取脚本所在目录
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    # 确定字体目录
    if args.directory:
        # 支持相对路径和绝对路径
        if os.path.isabs(args.directory):
            font_directory = args.directory
        else:
            font_directory = os.path.join(script_dir, args.directory)
        font_directory = os.path.abspath(font_directory)
    else:
        # 默认使用当前脚本所在目录
        font_directory = script_dir
    
    # 检查目录是否存在
    if not os.path.exists(font_directory):
        print(f"\n错误: 目录不存在: {font_directory}")
        sys.exit(1)
    
    print(f"\n字体目录: {font_directory}")
    
    # 确定压缩级别
    compression_level = args.level
    
    if compression_level is None:
        # 交互式选择压缩级别
        print("\n请选择压缩级别:")
        print("1. 基础压缩 (保留大部分功能，适合网页使用)")
        print("2. 中等压缩 (平衡文件大小和功能)")
        print("3. 激进压缩 (最小文件大小，可能影响显示效果)")
        
        while True:
            choice = input("\n请输入选择 (1-3): ").strip()
            if choice == "1":
                compression_level = "basic"
                break
            elif choice == "2":
                compression_level = "medium"
                break
            elif choice == "3":
                compression_level = "aggressive"
                break
            else:
                print("无效选择，请输入 1、2 或 3")
    
    # 开始批量压缩
    print()
    generated_files = compress_fonts_batch(font_directory, compression_level=compression_level)
    
    # 生成CSS文件
    if args.css and generated_files:
        print()
        print("=" * 60)
        print("生成CSS文件...")
        print("=" * 60)
        
        # 确定CSS输出路径
        if os.path.isabs(args.css):
            css_path = args.css
        else:
            css_path = os.path.join(script_dir, args.css)
        css_path = os.path.abspath(css_path)
        
        # 确保输出目录存在
        css_dir = os.path.dirname(css_path)
        if css_dir and not os.path.exists(css_dir):
            os.makedirs(css_dir)
        
        # 生成CSS
        generate_css(generated_files, css_path, script_dir)
    elif args.css and not generated_files:
        print("\n警告: 没有成功生成WOFF2文件，跳过CSS生成")
    
    print()
    print("=" * 60)
    print("全部完成!")
    print("=" * 60)

if __name__ == "__main__":
    main()