#!/bin/bash

# 配置区域 - 如需自定义版本，请在此处设置
CUSTOM_VERSION=""
# 示例: CUSTOM_VERSION="2.0.0"

VERSION_FILE="version.txt"

# 检查是否设置了自定义版本
if [ -n "$CUSTOM_VERSION" ]; then
    echo "[INFO] Using custom version: $CUSTOM_VERSION"
    VERSION="$CUSTOM_VERSION"
else
    # 检查git是否可用
    if ! command -v git &> /dev/null; then
        echo "[ERROR] Git is not installed or not in PATH"
        exit 1
    elif ! git rev-parse --git-dir &> /dev/null; then
        echo "[ERROR] Not in a git repository"
        exit 1
    else
        # 获取最新的git标签
        LATEST_TAG=$(git describe --abbrev=0 --tags 2>/dev/null)
        
        if [ -z "$LATEST_TAG" ]; then
            echo "[ERROR] No git tags found in repository"
            exit 1
        else
            echo "[INFO] Latest git tag: $LATEST_TAG"
            
            # 移除v前缀
            CLEAN_VERSION=${LATEST_TAG#v}
            
            # 分割版本号并递增patch版本
            IFS='.' read -r MAJOR MINOR PATCH <<< "$CLEAN_VERSION"
            PATCH=$((PATCH + 1))
            
            VERSION="$MAJOR.$MINOR.$PATCH"
            echo "[INFO] Auto-incremented patch version: $VERSION"
        fi
    fi
fi

# 输出版本信息
echo "VERSION=$VERSION"

# 保存到文件供其他脚本使用
echo "VERSION=$VERSION" > "$VERSION_FILE"

echo "[INFO] Version information saved to $VERSION_FILE"