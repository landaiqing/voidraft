package services

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"
)

// FileService 提供文件操作
type FileService struct{}

// NewFileService 创建新的文件服务实例
func NewFileService() *FileService {
	return &FileService{}
}

// EnsureDir 确保目录存在，如不存在则创建
func (fs *FileService) EnsureDir(dirPath string) error {
	log.Printf("EnsureDir: Checking directory: %s", dirPath)

	if _, err := os.Stat(dirPath); os.IsNotExist(err) {
		log.Printf("EnsureDir: Directory does not exist, creating: %s", dirPath)
		err := os.MkdirAll(dirPath, 0755)
		if err != nil {
			log.Printf("EnsureDir: Failed to create directory: %v", err)
			return err
		}
		log.Printf("EnsureDir: Directory created successfully: %s", dirPath)
	} else {
		log.Printf("EnsureDir: Directory already exists: %s", dirPath)
	}
	return nil
}

// GetFileModTime 获取文件的修改时间
func (fs *FileService) GetFileModTime(filePath string) (time.Time, error) {
	log.Printf("GetFileModTime: Getting modification time for file: %s", filePath)

	fileInfo, err := os.Stat(filePath)
	if err != nil {
		if os.IsNotExist(err) {
			log.Printf("GetFileModTime: File does not exist: %s", filePath)
			return time.Time{}, fmt.Errorf("file does not exist: %w", err)
		}
		log.Printf("GetFileModTime: Failed to get file info: %v", err)
		return time.Time{}, fmt.Errorf("failed to get file info: %w", err)
	}

	modTime := fileInfo.ModTime()
	log.Printf("GetFileModTime: File modification time: %s", modTime.Format(time.RFC3339))
	return modTime, nil
}

// SaveJSONWithCheck 保存JSON数据到文件，带并发检查
// expectedModTime是期望的文件修改时间，如果为零值则不检查
// onConflict是冲突处理函数，如果文件已被修改且此函数不为nil，则调用此函数合并数据
func (fs *FileService) SaveJSONWithCheck(filePath string, data interface{}, expectedModTime time.Time, onConflict func(existingData []byte) (interface{}, error)) error {
	log.Printf("SaveJSONWithCheck: Saving to file with concurrency check: %s", filePath)

	// 检查文件是否存在且已被修改
	if !expectedModTime.IsZero() && fs.FileExists(filePath) {
		currentModTime, err := fs.GetFileModTime(filePath)
		if err == nil {
			// 如果文件修改时间与预期不符，说明文件已被其他进程修改
			if !currentModTime.Equal(expectedModTime) {
				log.Printf("SaveJSONWithCheck: File has been modified since last read. Expected: %s, Current: %s",
					expectedModTime.Format(time.RFC3339), currentModTime.Format(time.RFC3339))

				// 如果提供了冲突处理函数，尝试解决冲突
				if onConflict != nil {
					log.Printf("SaveJSONWithCheck: Attempting to resolve conflict")

					// 读取当前文件内容
					existingData, err := os.ReadFile(filePath)
					if err != nil {
						log.Printf("SaveJSONWithCheck: Failed to read existing file: %v", err)
						return fmt.Errorf("failed to read existing file for conflict resolution: %w", err)
					}

					// 调用冲突处理函数合并数据
					mergedData, err := onConflict(existingData)
					if err != nil {
						log.Printf("SaveJSONWithCheck: Conflict resolution failed: %v", err)
						return fmt.Errorf("conflict resolution failed: %w", err)
					}

					// 使用合并后的数据继续保存
					data = mergedData
					log.Printf("SaveJSONWithCheck: Conflict resolved, proceeding with merged data")
				} else {
					// 没有提供冲突处理函数，返回错误
					return fmt.Errorf("concurrent modification detected")
				}
			}
		} else {
			log.Printf("SaveJSONWithCheck: Could not check file modification time: %v", err)
			// 继续执行，不中断操作
		}
	}

	// 确保目录存在
	dir := filepath.Dir(filePath)
	if err := fs.EnsureDir(dir); err != nil {
		log.Printf("SaveJSONWithCheck: Failed to create directory: %v", err)
		return fmt.Errorf("failed to create directory: %w", err)
	}

	// 将数据编码为JSON
	jsonData, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		log.Printf("SaveJSONWithCheck: Failed to encode JSON: %v", err)
		return fmt.Errorf("failed to encode JSON: %w", err)
	}

	// 先写入临时文件
	tempFile := filePath + ".tmp"
	log.Printf("SaveJSONWithCheck: Writing to temporary file: %s", tempFile)
	if err := os.WriteFile(tempFile, jsonData, 0644); err != nil {
		log.Printf("SaveJSONWithCheck: Failed to write temporary file: %v", err)
		return fmt.Errorf("failed to write temporary file: %w", err)
	}

	// 原子替换原文件
	log.Printf("SaveJSONWithCheck: Replacing original file with temporary file")
	if err := os.Rename(tempFile, filePath); err != nil {
		os.Remove(tempFile) // 清理临时文件
		log.Printf("SaveJSONWithCheck: Failed to replace file: %v", err)
		return fmt.Errorf("failed to replace file: %w", err)
	}

	log.Printf("SaveJSONWithCheck: File saved successfully: %s", filePath)
	return nil
}

// SaveJSON 保存JSON数据到文件
func (fs *FileService) SaveJSON(filePath string, data interface{}) error {
	// 调用带并发检查的版本，但不提供冲突解决函数（保持原有行为）
	return fs.SaveJSONWithCheck(filePath, data, time.Time{}, nil)
}

// LoadJSON 从文件加载JSON数据
func (fs *FileService) LoadJSON(filePath string, target interface{}) error {
	log.Printf("LoadJSON: Loading from file: %s", filePath)

	// 检查文件是否存在
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		log.Printf("LoadJSON: File does not exist: %s", filePath)
		return fmt.Errorf("file does not exist: %w", err)
	}

	// 读取文件内容
	data, err := os.ReadFile(filePath)
	if err != nil {
		log.Printf("LoadJSON: Failed to read file: %v", err)
		return fmt.Errorf("failed to read file: %w", err)
	}

	// 解析JSON数据
	if err := json.Unmarshal(data, target); err != nil {
		log.Printf("LoadJSON: Failed to parse JSON: %v", err)
		return fmt.Errorf("failed to parse JSON: %w", err)
	}

	log.Printf("LoadJSON: File loaded successfully: %s", filePath)
	return nil
}

// FileExists 检查文件是否存在
func (fs *FileService) FileExists(filePath string) bool {
	_, err := os.Stat(filePath)
	exists := !os.IsNotExist(err)
	log.Printf("FileExists: Checking if file exists: %s, exists: %v", filePath, exists)
	return exists
}

// DeleteFile 删除文件
func (fs *FileService) DeleteFile(filePath string) error {
	log.Printf("DeleteFile: Deleting file: %s", filePath)

	if !fs.FileExists(filePath) {
		log.Printf("DeleteFile: File does not exist, nothing to delete: %s", filePath)
		return nil // 文件不存在视为删除成功
	}

	err := os.Remove(filePath)
	if err != nil {
		log.Printf("DeleteFile: Failed to delete file: %v", err)
	} else {
		log.Printf("DeleteFile: File deleted successfully: %s", filePath)
	}
	return err
}
