package services

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/go-git/go-git/v5"
	gitConfig "github.com/go-git/go-git/v5/config"
	"github.com/go-git/go-git/v5/plumbing/object"
	"github.com/go-git/go-git/v5/plumbing/transport"
	"github.com/go-git/go-git/v5/plumbing/transport/http"
	"github.com/go-git/go-git/v5/plumbing/transport/ssh"
	"github.com/wailsapp/wails/v3/pkg/services/log"

	"voidraft/internal/models"

	_ "modernc.org/sqlite"
)

const (
	dbSerializeFile = "voidraft_data.bin"
)

// BackupService 提供基于Git的备份功能
type BackupService struct {
	configService    *ConfigService
	dbService        *DatabaseService
	repository       *git.Repository
	logger           *log.Service
	isInitialized    bool
	autoBackupTicker *time.Ticker
	autoBackupStop   chan bool
}

// NewBackupService 创建新的备份服务实例
func NewBackupService(configService *ConfigService, dbService *DatabaseService, logger *log.Service) *BackupService {
	return &BackupService{
		configService: configService,
		dbService:     dbService,
		logger:        logger,
	}
}

// Initialize 初始化备份服务
func (s *BackupService) Initialize() error {
	config, repoPath, err := s.getConfigAndPath()
	if err != nil {
		return fmt.Errorf("getting backup config: %w", err)
	}

	if !config.Enabled {
		return nil
	}

	// 初始化仓库
	if err := s.initializeRepository(config, repoPath); err != nil {
		return fmt.Errorf("initializing repository: %w", err)
	}

	// 启动自动备份
	if config.AutoBackup && config.BackupInterval > 0 {
		s.StartAutoBackup()
	}

	s.isInitialized = true
	return nil
}

// getConfigAndPath 获取备份配置和仓库路径
func (s *BackupService) getConfigAndPath() (*models.GitBackupConfig, string, error) {
	appConfig, err := s.configService.GetConfig()
	if err != nil {
		return nil, "", fmt.Errorf("getting app config: %w", err)
	}
	return &appConfig.Backup, appConfig.General.DataPath, nil
}

// initializeRepository 初始化或打开Git仓库并设置远程
func (s *BackupService) initializeRepository(config *models.GitBackupConfig, repoPath string) error {

	// 检查本地仓库是否存在
	_, err := os.Stat(filepath.Join(repoPath, ".git"))
	if os.IsNotExist(err) {
		// 仓库不存在，初始化新仓库
		repo, err := git.PlainInit(repoPath, false)
		if err != nil {
			return fmt.Errorf("error initializing repository: %w", err)
		}
		s.repository = repo
	} else if err != nil {
		return fmt.Errorf("error checking repository path: %w", err)
	} else {
		// 仓库已存在，打开现有仓库
		repo, err := git.PlainOpen(repoPath)
		if err != nil {
			return fmt.Errorf("error opening local repository: %w", err)
		}
		s.repository = repo
	}

	// 设置或更新远程仓库
	remote, err := s.repository.Remote("origin")
	if err != nil {
		if errors.Is(err, git.ErrRemoteNotFound) {
			// 远程不存在，添加远程
			_, err = s.repository.CreateRemote(&gitConfig.RemoteConfig{
				Name: "origin",
				URLs: []string{config.RepoURL},
			})
			if err != nil {
				return fmt.Errorf("error creating remote: %w", err)
			}
		} else {
			return fmt.Errorf("error getting remote: %w", err)
		}
	} else {
		// 检查远程URL是否一致，如果不一致则更新
		if len(remote.Config().URLs) > 0 && remote.Config().URLs[0] != config.RepoURL {
			if err := s.repository.DeleteRemote("origin"); err != nil {
				return fmt.Errorf("error deleting remote: %w", err)
			}
			_, err = s.repository.CreateRemote(&gitConfig.RemoteConfig{
				Name: "origin",
				URLs: []string{config.RepoURL},
			})
			if err != nil {
				return fmt.Errorf("error creating new remote: %w", err)
			}
		}
	}

	return nil
}

// getAuthMethod 根据配置获取认证方法
func (s *BackupService) getAuthMethod(config *models.GitBackupConfig) (transport.AuthMethod, error) {
	switch config.AuthMethod {
	case models.Token:
		if config.Token == "" {
			return nil, errors.New("token authentication requires a valid token")
		}
		return &http.BasicAuth{
			Username: "git", // 使用token时，用户名可以是任意值
			Password: config.Token,
		}, nil

	case models.UserPass:
		if config.Username == "" || config.Password == "" {
			return nil, errors.New("username/password authentication requires both username and password")
		}
		return &http.BasicAuth{
			Username: config.Username,
			Password: config.Password,
		}, nil

	case models.SSHKey:
		if config.SSHKeyPath == "" {
			return nil, errors.New("SSH key authentication requires a valid SSH key path")
		}
		publicKeys, err := ssh.NewPublicKeysFromFile("git", config.SSHKeyPath, config.SSHKeyPass)
		if err != nil {
			return nil, fmt.Errorf("error creating SSH public keys: %w", err)
		}
		return publicKeys, nil

	default:
		return nil, fmt.Errorf("unsupported authentication method: %s", config.AuthMethod)
	}
}

// serializeDatabase 序列化数据库到文件
func (s *BackupService) serializeDatabase(repoPath string) error {
	if s.dbService == nil || s.dbService.db == nil {
		return errors.New("database service not available")
	}

	// 获取数据库路径
	dbPath, err := s.dbService.getDatabasePath()
	if err != nil {
		return fmt.Errorf("getting database path: %w", err)
	}

	// 关闭数据库连接以确保所有更改都写入磁盘
	if err := s.dbService.ServiceShutdown(); err != nil {
		s.logger.Error("Failed to close database connection", "error", err)
	}

	// 直接复制数据库文件到序列化文件
	dbData, err := os.ReadFile(dbPath)
	if err != nil {
		return fmt.Errorf("reading database file: %w", err)
	}

	binFilePath := filepath.Join(repoPath, dbSerializeFile)
	if err := os.WriteFile(binFilePath, dbData, 0644); err != nil {
		return fmt.Errorf("writing serialized database to file: %w", err)
	}

	// 重新初始化数据库服务
	if err := s.dbService.initDatabase(); err != nil {
		return fmt.Errorf("reinitializing database: %w", err)
	}

	return nil
}

// PushToRemote 推送本地更改到远程仓库
func (s *BackupService) PushToRemote() error {
	if !s.isInitialized {
		return errors.New("backup service not initialized")
	}

	config, repoPath, err := s.getConfigAndPath()
	if err != nil {
		return fmt.Errorf("getting backup config: %w", err)
	}

	if !config.Enabled {
		return errors.New("backup is disabled")
	}

	// 数据库序列化文件的路径
	binFilePath := filepath.Join(repoPath, dbSerializeFile)

	// 函数返回前都删除临时文件
	defer func() {
		if _, err := os.Stat(binFilePath); err == nil {
			os.Remove(binFilePath)
		}
	}()

	// 序列化数据库
	if err := s.serializeDatabase(repoPath); err != nil {
		return fmt.Errorf("serializing database: %w", err)
	}

	// 获取工作树
	w, err := s.repository.Worktree()
	if err != nil {
		return fmt.Errorf("getting worktree: %w", err)
	}

	// 添加序列化的数据库文件
	if _, err := w.Add(dbSerializeFile); err != nil {
		return fmt.Errorf("adding serialized database file: %w", err)
	}

	// 检查是否有变化需要提交
	status, err := w.Status()
	if err != nil {
		return fmt.Errorf("getting worktree status: %w", err)
	}

	// 如果没有变化，直接返回
	if status.IsClean() {
		return errors.New("no changes to backup")
	}

	// 创建提交
	_, err = w.Commit(fmt.Sprintf("Backup %s", time.Now().Format("2006-01-02 15:04:05")), &git.CommitOptions{
		Author: &object.Signature{
			Name:  "VoidRaft",
			Email: "backup@voidraft.app",
			When:  time.Now(),
		},
	})
	if err != nil {
		if strings.Contains(err.Error(), "cannot create empty commit") {
			return errors.New("no changes to backup")
		}
		return fmt.Errorf("creating commit: %w", err)
	}

	// 获取认证方法并推送到远程
	auth, err := s.getAuthMethod(config)
	if err != nil {
		return fmt.Errorf("getting auth method: %w", err)
	}

	// 推送到远程仓库
	if err := s.repository.Push(&git.PushOptions{
		RemoteName: "origin",
		Auth:       auth,
	}); err != nil && !errors.Is(err, git.NoErrAlreadyUpToDate) {
		// 忽略一些常见的非错误情况
		if strings.Contains(err.Error(), "clean working tree") ||
			strings.Contains(err.Error(), "already up-to-date") ||
			strings.Contains(err.Error(), " clean working tree") ||
			strings.Contains(err.Error(), "reference not found") {
			// 更新最后推送时间
			return errors.New("no changes to backup")
		}
		return fmt.Errorf("push failed: %w", err)
	}

	return nil
}

// StartAutoBackup 启动自动备份定时器
func (s *BackupService) StartAutoBackup() error {
	config, _, err := s.getConfigAndPath()
	if err != nil {
		return fmt.Errorf("getting backup config: %w", err)
	}

	if !config.AutoBackup || config.BackupInterval <= 0 {
		return nil
	}

	s.StopAutoBackup()

	// 将秒转换为分钟
	s.autoBackupTicker = time.NewTicker(time.Duration(config.BackupInterval) * time.Minute)
	s.autoBackupStop = make(chan bool)

	go func() {
		for {
			select {
			case <-s.autoBackupTicker.C:
				// 执行推送操作
				if err := s.PushToRemote(); err != nil {
					s.logger.Error("Auto backup failed", "error", err)
				}
			case <-s.autoBackupStop:
				return
			}
		}
	}()

	return nil
}

// StopAutoBackup 停止自动备份
func (s *BackupService) StopAutoBackup() {
	if s.autoBackupTicker != nil {
		s.autoBackupTicker.Stop()
		s.autoBackupTicker = nil
	}

	if s.autoBackupStop != nil {
		close(s.autoBackupStop)
		s.autoBackupStop = nil
	}
}

// Reinitialize 重新初始化备份服务，用于响应配置变更
func (s *BackupService) Reinitialize() error {
	// 停止自动备份
	s.StopAutoBackup()

	// 重新设置标志
	s.isInitialized = false

	// 重新初始化
	return s.Initialize()
}

// HandleConfigChange 处理备份配置变更
func (s *BackupService) HandleConfigChange(config *models.GitBackupConfig) error {

	// 如果备份功能禁用，只需停止自动备份
	if !config.Enabled {
		s.StopAutoBackup()
		s.isInitialized = false
		return nil
	}

	// 如果服务已初始化，重新初始化以应用新配置
	if s.isInitialized {
		return s.Reinitialize()
	}

	// 如果服务未初始化但已启用，则初始化
	if config.Enabled && !s.isInitialized {
		return s.Initialize()
	}

	return nil
}

// ServiceShutdown 服务关闭时的清理工作
func (s *BackupService) ServiceShutdown() {
	s.StopAutoBackup()
}
