@echo off
setlocal enabledelayedexpansion

REM Simplified version management script - Windows version
REM Auto-increment patch version from git tags or use custom version

REM Configuration section - Set custom version here if needed
set "CUSTOM_VERSION="
REM Example: set "CUSTOM_VERSION=2.0.0"

set "VERSION_FILE=version.txt"

REM Check if custom version is set
if not "%CUSTOM_VERSION%"=="" (
    echo [INFO] Using custom version: %CUSTOM_VERSION%
    set "VERSION=%CUSTOM_VERSION%"
    goto :save_version
)

REM Check if git is available
git --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Git is not installed or not in PATH
    exit /b 1
)

REM Check if in git repository
git rev-parse --git-dir >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Not in a git repository
    exit /b 1
)

REM Sync remote tags
echo [INFO] Syncing remote tags...
echo [INFO] Deleting local tags...
for /f "delims=" %%i in ('git tag -l') do git tag -d %%i >nul 2>&1

echo [INFO] Fetching remote tags...
git fetch origin --prune >nul 2>&1
if errorlevel 1 (
    echo [WARNING] Failed to fetch from remote, using local tags
) else (
    echo [INFO] Remote tags synced successfully
)

REM Get latest git tag
git describe --abbrev=0 --tags > temp_tag.txt 2>nul
if errorlevel 1 (
    echo [ERROR] No git tags found in repository
    if exist temp_tag.txt del temp_tag.txt
    exit /b 1
)

set /p LATEST_TAG=<temp_tag.txt
del temp_tag.txt

if not defined LATEST_TAG (
    echo [ERROR] Failed to read git tag
    exit /b 1
)

echo [INFO] Latest git tag: %LATEST_TAG%

REM Remove v prefix
set "CLEAN_VERSION=%LATEST_TAG:v=%"

REM Split version number and increment patch
for /f "tokens=1,2,3 delims=." %%a in ("%CLEAN_VERSION%") do (
    set "MAJOR=%%a"
    set "MINOR=%%b"
    set /a "PATCH=%%c+1"
)

set "VERSION=%MAJOR%.%MINOR%.%PATCH%"
echo [INFO] Auto-incremented patch version: %VERSION%

:save_version
REM Output version information
echo [SUCCESS] Version resolved: %VERSION%
echo VERSION=%VERSION%

REM Save to file
echo VERSION=%VERSION% > %VERSION_FILE%

echo [INFO] Version information saved to %VERSION_FILE%