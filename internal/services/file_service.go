package services

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sync"
)

// FileService 提供原子化文件操作
type FileService struct {
	mutex sync.Mutex
}

// NewFileService 创建新的文件服务实例
func NewFileService() *FileService {
	return &FileService{}
}

// EnsureDir 确保目录存在，如不存在则创建
func (fs *FileService) EnsureDir(dirPath string) error {
	fs.mutex.Lock()
	defer fs.mutex.Unlock()

	return fs.ensureDirNoLock(dirPath)
}

// ensureDirNoLock 无锁版本的EnsureDir，仅供内部使用
func (fs *FileService) ensureDirNoLock(dirPath string) error {
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

// SaveJSON 原子化保存JSON数据到文件
func (fs *FileService) SaveJSON(filePath string, data interface{}) error {
	fs.mutex.Lock()
	defer fs.mutex.Unlock()

	log.Printf("SaveJSON: Saving to file: %s", filePath)

	// 确保目录存在 - 使用无锁版本以避免死锁
	dir := filepath.Dir(filePath)
	if err := fs.ensureDirNoLock(dir); err != nil {
		log.Printf("SaveJSON: Failed to create directory: %v", err)
		return fmt.Errorf("failed to create directory: %w", err)
	}

	// 将数据编码为JSON
	jsonData, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		log.Printf("SaveJSON: Failed to encode JSON: %v", err)
		return fmt.Errorf("failed to encode JSON: %w", err)
	}

	// 先写入临时文件
	tempFile := filePath + ".tmp"
	log.Printf("SaveJSON: Writing to temporary file: %s", tempFile)
	if err := os.WriteFile(tempFile, jsonData, 0644); err != nil {
		log.Printf("SaveJSON: Failed to write temporary file: %v", err)
		return fmt.Errorf("failed to write temporary file: %w", err)
	}

	// 原子替换原文件
	log.Printf("SaveJSON: Replacing original file with temporary file")
	if err := os.Rename(tempFile, filePath); err != nil {
		os.Remove(tempFile) // 清理临时文件
		log.Printf("SaveJSON: Failed to replace file: %v", err)
		return fmt.Errorf("failed to replace file: %w", err)
	}

	log.Printf("SaveJSON: File saved successfully: %s", filePath)
	return nil
}

// LoadJSON 从文件加载JSON数据
func (fs *FileService) LoadJSON(filePath string, target interface{}) error {
	fs.mutex.Lock()
	defer fs.mutex.Unlock()

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
	fs.mutex.Lock()
	defer fs.mutex.Unlock()

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
