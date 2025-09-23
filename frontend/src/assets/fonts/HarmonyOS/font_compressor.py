#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
鸿蒙字体压缩工具
使用 fonttools 库压缩 TTF 字体文件，减小文件大小
"""

import os
import sys
import subprocess
import shutil
from pathlib import Path
from typing import List, Tuple

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

def find_font_files(directory: str) -> List[str]:
    """查找目录中的所有字体文件"""
    font_extensions = ['.ttf', '.otf', '.woff', '.woff2']
    font_files = []
    
    for root, dirs, files in os.walk(directory):
        for file in files:
            if any(file.lower().endswith(ext) for ext in font_extensions):
                font_files.append(os.path.join(root, file))
    
    return font_files

def compress_fonts_batch(font_directory: str, compression_level: str = "basic"):
    """
    批量压缩字体文件
    
    Args:
        font_directory: 字体文件目录
        compression_level: 压缩级别
    """
    if not os.path.exists(font_directory):
        print(f"错误: 目录 {font_directory} 不存在")
        return
    
    # 查找所有字体文件
    font_files = find_font_files(font_directory)
    
    if not font_files:
        print("未找到字体文件")
        return
    
    print(f"找到 {len(font_files)} 个字体文件")
    print(f"压缩级别: {compression_level}")
    print(f"压缩后的文件将与源文件放在同一目录，扩展名为 .woff2")
    print("-" * 60)
    
    total_original_size = 0
    total_compressed_size = 0
    successful_compressions = 0
    
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
                
                # 计算压缩率
                compression_ratio = (1 - compressed_size / original_size) * 100
                
                print(f"  ✓ 成功: {format_file_size(original_size)} → {format_file_size(compressed_size)} "
                      f"(压缩 {compression_ratio:.1f}%)")
            else:
                print(f"  ✗ 失败: 输出文件未生成")
        else:
            print(f"  ✗ 失败: 压缩过程出错")
        
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

def main():
    """主函数"""
    print("鸿蒙字体压缩工具")
    print("=" * 60)
    
    # 检查依赖
    if not check_dependencies():
        return
    
    # 获取当前脚本所在目录
    current_dir = os.path.dirname(os.path.abspath(__file__))
    
    # 设置默认字体目录
    font_directory = current_dir
    
    print(f"字体目录: {font_directory}")
    
    # 让用户选择压缩级别
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
    compress_fonts_batch(font_directory, compression_level=compression_level)

if __name__ == "__main__":
    main()