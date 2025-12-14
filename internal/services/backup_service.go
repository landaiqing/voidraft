package services

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/go-git/go-git/v5"
	gitConfig "github.com/go-git/go-git/v5/config"
	"github.com/go-git/go-git/v5/plumbing"
	"github.com/go-git/go-git/v5/plumbing/object"
	"github.com/go-git/go-git/v5/plumbing/transport"
	"github.com/go-git/go-git/v5/plumbing/transport/http"
	"github.com/go-git/go-git/v5/plumbing/transport/ssh"
	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/services/log"

	"voidraft/internal/models"
	"voidraft/internal/models/ent"
	"voidraft/internal/models/ent/document"
	"voidraft/internal/models/ent/extension"
	"voidraft/internal/models/ent/keybinding"
	"voidraft/internal/models/ent/theme"
	"voidraft/internal/models/schema/mixin"
)

const (
	backupDir   = "backup" // Git 仓库目录，JSONL 文件直接放这里
	remoteName  = "origin"
	branchName  = "master"
	maxRetries  = 3
	jsonlSuffix = ".jsonl"

	// 通用字段名
	fieldUUID      = "uuid"
	fieldUpdatedAt = "updated_at"
)

// 定义错误
var (
	ErrNotInitialized = errors.New("backup service not initialized")
	ErrDisabled       = errors.New("backup is disabled")
	ErrPushFailed     = errors.New("push failed after max retries")
)

// BackupService 提供基于Git的备份同步功能
type BackupService struct {
	configService    *ConfigService
	dbService        *DatabaseService
	repository       *git.Repository
	logger           *log.LogService
	isInitialized    bool
	autoBackupTicker *time.Ticker
	autoBackupStop   chan bool
	autoBackupWg     sync.WaitGroup
	mu               sync.Mutex
	cancelObserver   CancelFunc
}

// NewBackupService 创建新的备份服务实例
func NewBackupService(configService *ConfigService, dbService *DatabaseService, logger *log.LogService) *BackupService {
	return &BackupService{
		configService: configService,
		dbService:     dbService,
		logger:        logger,
	}
}

func (s *BackupService) ServiceStartup(ctx context.Context, options application.ServiceOptions) error {
	s.cancelObserver = s.configService.Watch("backup.enabled", s.onBackupConfigChange)
	if err := s.Initialize(); err != nil {
		s.logger.Error("initializing backup service: %v", err)
	}
	return nil
}

func (s *BackupService) onBackupConfigChange(oldValue, newValue interface{}) {
	config, err := s.configService.GetConfig()
	if err != nil {
		return
	}
	_ = s.HandleConfigChange(&config.Backup)
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

	// 仓库地址为空时不初始化（等待用户配置）
	if strings.TrimSpace(config.RepoURL) == "" {
		return nil
	}

	if err := s.initializeRepository(config, repoPath); err != nil {
		return fmt.Errorf("initializing repository: %w", err)
	}

	if err := s.verifyRemoteConnection(config); err != nil {
		return fmt.Errorf("verifying remote connection: %w", err)
	}

	if config.AutoBackup && config.BackupInterval > 0 {
		_ = s.StartAutoBackup()
	}

	s.mu.Lock()
	s.isInitialized = true
	s.mu.Unlock()

	return nil
}

func (s *BackupService) getConfigAndPath() (*models.GitBackupConfig, string, error) {
	appConfig, err := s.configService.GetConfig()
	if err != nil {
		return nil, "", fmt.Errorf("getting app config: %w", err)
	}
	// 返回 backup 目录作为 Git 仓库路径
	repoPath := filepath.Join(appConfig.General.DataPath, backupDir)
	return &appConfig.Backup, repoPath, nil
}

func (s *BackupService) initializeRepository(config *models.GitBackupConfig, repoPath string) error {
	// 确保父目录存在
	if err := os.MkdirAll(repoPath, 0755); err != nil {
		return fmt.Errorf("creating backup directory: %w", err)
	}

	gitPath := filepath.Join(repoPath, ".git")
	if _, err := os.Stat(gitPath); os.IsNotExist(err) {
		repo, err := git.PlainInit(repoPath, false)
		if err != nil {
			return fmt.Errorf("initializing repository: %w", err)
		}
		s.repository = repo

		// 创建 .gitignore
		gitignorePath := filepath.Join(repoPath, ".gitignore")
		if _, err := os.Stat(gitignorePath); os.IsNotExist(err) {
			_ = os.WriteFile(gitignorePath, []byte("*.tmp\n*.log\n"), 0644)
		}
	} else if err != nil {
		return fmt.Errorf("checking repository path: %w", err)
	} else {
		repo, err := git.PlainOpen(repoPath)
		if err != nil {
			return fmt.Errorf("opening repository: %w", err)
		}
		s.repository = repo
	}

	return s.setupRemote(config.RepoURL)
}

func (s *BackupService) setupRemote(repoURL string) error {
	remote, err := s.repository.Remote(remoteName)
	if errors.Is(err, git.ErrRemoteNotFound) {
		_, err = s.repository.CreateRemote(&gitConfig.RemoteConfig{
			Name: remoteName,
			URLs: []string{repoURL},
		})
		return err
	}
	if err != nil {
		return err
	}

	if len(remote.Config().URLs) > 0 && remote.Config().URLs[0] != repoURL {
		if err := s.repository.DeleteRemote(remoteName); err != nil {
			return err
		}
		_, err = s.repository.CreateRemote(&gitConfig.RemoteConfig{
			Name: remoteName,
			URLs: []string{repoURL},
		})
		return err
	}
	return nil
}

func (s *BackupService) verifyRemoteConnection(config *models.GitBackupConfig) error {
	auth, err := s.getAuthMethod(config)
	if err != nil {
		return err
	}

	remote, err := s.repository.Remote(remoteName)
	if err != nil {
		return err
	}

	// 验证能否连接远程仓库，空仓库返回空列表是正常的
	_, err = remote.List(&git.ListOptions{Auth: auth})
	if err != nil {
		// 空仓库或无引用是允许的（第一次同步场景）
		if strings.Contains(err.Error(), "empty") || strings.Contains(err.Error(), "no reference") {
			return nil
		}
		return err
	}
	return nil
}

func (s *BackupService) getAuthMethod(config *models.GitBackupConfig) (transport.AuthMethod, error) {
	switch config.AuthMethod {
	case models.Token:
		if config.Token == "" {
			return nil, errors.New("token required")
		}
		return &http.BasicAuth{Username: "git", Password: config.Token}, nil

	case models.UserPass:
		if config.Username == "" || config.Password == "" {
			return nil, errors.New("username and password required")
		}
		return &http.BasicAuth{Username: config.Username, Password: config.Password}, nil

	case models.SSHKey:
		if config.SSHKeyPath == "" {
			return nil, errors.New("SSH key path required")
		}
		return ssh.NewPublicKeysFromFile("git", config.SSHKeyPath, config.SSHKeyPass)

	default:
		return nil, fmt.Errorf("unsupported auth method: %s", config.AuthMethod)
	}
}

// Sync 执行完整的同步流程：导出 -> commit -> pull -> 解决冲突 -> push -> 导入
func (s *BackupService) Sync() error {
	config, repoPath, err := s.getConfigAndPath()
	if err != nil {
		return err
	}

	if !config.Enabled {
		return ErrDisabled
	}

	// 检查仓库地址是否配置
	if strings.TrimSpace(config.RepoURL) == "" {
		return errors.New("repository URL is not configured")
	}

	// 如果未初始化，尝试初始化
	s.mu.Lock()
	initialized := s.isInitialized
	s.mu.Unlock()

	if !initialized {
		if err := s.Initialize(); err != nil {
			return fmt.Errorf("initializing backup service: %w", err)
		}
		s.mu.Lock()
		initialized = s.isInitialized
		s.mu.Unlock()
		if !initialized {
			return ErrNotInitialized
		}
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	ctx := context.Background()

	auth, err := s.getAuthMethod(config)
	if err != nil {
		return err
	}

	// 1. 拉取远程更新到本地工作区
	if err := s.fetchAndMergeRemote(auth, repoPath); err != nil {
		s.logger.Warning("fetch remote: %v", err)
	}

	// 2. 先将远程 JSONL 导入本地数据库（用 updated_at 解决记录级冲突）
	if err := s.importAll(ctx, repoPath); err != nil {
		s.logger.Warning("importing remote data: %v", err)
	}

	// 3. 导出合并后的本地数据库到 JSONL
	if err := s.exportAll(ctx, repoPath); err != nil {
		return fmt.Errorf("exporting data: %w", err)
	}

	// 4. 提交更改
	if _, err := s.commitChanges(); err != nil {
		return fmt.Errorf("committing changes: %w", err)
	}

	// 5. 推送到远程（带重试）
	if err := s.pushWithRetry(auth, repoPath); err != nil {
		return fmt.Errorf("pushing: %w", err)
	}

	return nil
}

// exportAll 导出所有表到 JSONL 文件
func (s *BackupService) exportAll(ctx context.Context, dataPath string) error {
	// 使用 SkipSoftDelete 获取所有数据（包括已删除的）
	ctx = mixin.SkipSoftDelete(ctx)
	client := s.dbService.Client

	// 定义导出任务
	exports := []struct {
		name string
		fn   func() error
	}{
		{"documents", func() error {
			docs, err := client.Document.Query().Order(document.ByUUID()).All(ctx)
			if err != nil {
				return err
			}
			return writeJSONLFile(filepath.Join(dataPath, "documents"+jsonlSuffix), docs)
		}},
		{"extensions", func() error {
			items, err := client.Extension.Query().Order(extension.ByUUID()).All(ctx)
			if err != nil {
				return err
			}
			return writeJSONLFile(filepath.Join(dataPath, "extensions"+jsonlSuffix), items)
		}},
		{"keybindings", func() error {
			items, err := client.KeyBinding.Query().Order(keybinding.ByUUID()).All(ctx)
			if err != nil {
				return err
			}
			return writeJSONLFile(filepath.Join(dataPath, "keybindings"+jsonlSuffix), items)
		}},
		{"themes", func() error {
			items, err := client.Theme.Query().Order(theme.ByUUID()).All(ctx)
			if err != nil {
				return err
			}
			return writeJSONLFile(filepath.Join(dataPath, "themes"+jsonlSuffix), items)
		}},
	}

	for _, export := range exports {
		if err := export.fn(); err != nil {
			return fmt.Errorf("exporting %s: %w", export.name, err)
		}
	}

	return nil
}

// writeJSONLFile 使用泛型写入 JSONL 文件
func writeJSONLFile[T any](filePath string, items []T) error {
	file, err := os.Create(filePath)
	if err != nil {
		return err
	}
	defer file.Close()

	writer := bufio.NewWriter(file)
	defer writer.Flush()

	for _, item := range items {
		data, err := json.Marshal(item)
		if err != nil {
			return err
		}
		if _, err := writer.Write(data); err != nil {
			return err
		}
		if err := writer.WriteByte('\n'); err != nil {
			return err
		}
	}

	return nil
}

func (s *BackupService) commitChanges() (bool, error) {
	w, err := s.repository.Worktree()
	if err != nil {
		return false, err
	}

	// 添加所有变更
	if err := w.AddGlob("*.jsonl"); err != nil {
		// 如果没有文件匹配，不是错误
		if !strings.Contains(err.Error(), "no matches found") {
			return false, err
		}
	}

	status, err := w.Status()
	if err != nil {
		return false, err
	}

	if status.IsClean() {
		return false, nil
	}

	_, err = w.Commit(fmt.Sprintf("Backup %s", time.Now().Format("2006-01-02 15:04:05")), &git.CommitOptions{
		Author: &object.Signature{
			Name:  "voidraft",
			Email: "backup@voidraft.app",
			When:  time.Now(),
		},
	})
	if err != nil {
		return false, err
	}

	return true, nil
}

// fetchAndMergeRemote 拉取远程更新并合并
func (s *BackupService) fetchAndMergeRemote(auth transport.AuthMethod, dataPath string) error {
	// 检查本地是否有 HEAD（是否有任何 commit）
	head, err := s.repository.Head()
	hasLocalCommits := err == nil && head != nil

	// 先 fetch 远程
	err = s.repository.Fetch(&git.FetchOptions{
		RemoteName: remoteName,
		Auth:       auth,
	})
	if err != nil && !errors.Is(err, git.NoErrAlreadyUpToDate) {
		// 远程分支不存在是正常的（首次推送）
		if strings.Contains(err.Error(), "couldn't find remote ref") {
			return nil
		}
		return fmt.Errorf("fetching: %w", err)
	}

	// 获取远程分支引用
	remoteRef, err := s.repository.Reference(plumbing.NewRemoteReferenceName(remoteName, branchName), true)
	if err != nil {
		// 远程分支不存在，正常情况
		return nil
	}

	// 如果本地没有 commit，直接 checkout 远程分支
	if !hasLocalCommits {
		w, err := s.repository.Worktree()
		if err != nil {
			return err
		}

		// 创建本地分支指向远程
		err = w.Checkout(&git.CheckoutOptions{
			Hash:   remoteRef.Hash(),
			Branch: plumbing.NewBranchReferenceName(branchName),
			Create: true,
			Force:  true,
		})
		if err != nil {
			return fmt.Errorf("checkout remote: %w", err)
		}
		return nil
	}

	// 本地有 commit，尝试 pull 合并
	w, err := s.repository.Worktree()
	if err != nil {
		return err
	}

	err = w.Pull(&git.PullOptions{
		RemoteName:    remoteName,
		ReferenceName: plumbing.NewBranchReferenceName(branchName),
		Auth:          auth,
	})

	if err == nil || errors.Is(err, git.NoErrAlreadyUpToDate) {
		return nil
	}

	// 处理合并冲突
	if errors.Is(err, git.ErrNonFastForwardUpdate) ||
		strings.Contains(err.Error(), "conflict") ||
		strings.Contains(err.Error(), "merge") {
		return s.resolveConflicts(dataPath)
	}

	// 远程分支不存在（首次推送）
	if strings.Contains(err.Error(), "reference not found") ||
		strings.Contains(err.Error(), "couldn't find remote ref") {
		return nil
	}

	return err
}

// pushWithRetry 推送到远程，带重试逻辑
func (s *BackupService) pushWithRetry(auth transport.AuthMethod, dataPath string) error {
	for i := 0; i < maxRetries; i++ {
		err := s.repository.Push(&git.PushOptions{
			RemoteName: remoteName,
			Auth:       auth,
		})

		switch {
		case err == nil, errors.Is(err, git.NoErrAlreadyUpToDate):
			return nil

		case errors.Is(err, git.ErrNonFastForwardUpdate):
			// 非快进更新，需要先拉取合并
			if mergeErr := s.fetchAndMergeRemote(auth, dataPath); mergeErr != nil {
				return fmt.Errorf("merge before push: %w", mergeErr)
			}
			_, _ = s.commitChanges()
			continue

		default:
			return err
		}
	}

	return ErrPushFailed
}

// resolveConflicts 解决 JSONL 文件中的冲突（Last Write Wins）
func (s *BackupService) resolveConflicts(dataPath string) error {
	files, err := filepath.Glob(filepath.Join(dataPath, "*.jsonl"))
	if err != nil {
		return err
	}

	for _, file := range files {
		content, err := os.ReadFile(file)
		if err != nil {
			continue
		}

		// 检查是否有冲突标记
		if !strings.Contains(string(content), "<<<<<<<") {
			continue
		}

		resolved, err := s.resolveJSONLConflict(string(content))
		if err != nil {
			return fmt.Errorf("resolving conflict in %s: %w", file, err)
		}

		if err := os.WriteFile(file, []byte(resolved), 0644); err != nil {
			return err
		}
	}

	// 提交解决后的冲突
	w, err := s.repository.Worktree()
	if err != nil {
		return err
	}

	if err := w.AddGlob("*.jsonl"); err != nil {
		return err
	}

	_, err = w.Commit("Auto-resolve sync conflicts", &git.CommitOptions{
		Author: &object.Signature{
			Name:  "voidraft",
			Email: "backup@voidraft.app",
			When:  time.Now(),
		},
	})

	return err
}

// resolveJSONLConflict 解析并解决 JSONL 文件中的 Git 冲突
func (s *BackupService) resolveJSONLConflict(content string) (string, error) {
	lines := strings.Split(content, "\n")
	var result []string

	var localLines, remoteLines []string
	inConflict := false
	isLocal := true

	for _, line := range lines {
		if strings.HasPrefix(line, "<<<<<<<") {
			inConflict = true
			isLocal = true
			localLines = nil
			remoteLines = nil
			continue
		}
		if strings.HasPrefix(line, "=======") {
			isLocal = false
			continue
		}
		if strings.HasPrefix(line, ">>>>>>>") {
			// 解决这个冲突块
			resolved := s.mergeConflictBlock(localLines, remoteLines)
			result = append(result, resolved...)
			inConflict = false
			continue
		}

		if inConflict {
			if isLocal {
				if line != "" {
					localLines = append(localLines, line)
				}
			} else {
				if line != "" {
					remoteLines = append(remoteLines, line)
				}
			}
		} else {
			result = append(result, line)
		}
	}

	return strings.Join(result, "\n"), nil
}

// mergeConflictBlock 合并冲突块，使用 Last Write Wins 策略
func (s *BackupService) mergeConflictBlock(localLines, remoteLines []string) []string {
	// 解析本地和远程的记录
	localRecords := s.parseRecords(localLines)
	remoteRecords := s.parseRecords(remoteLines)

	// 合并：按 UUID 索引，updated_at 更新的记录获胜
	merged := make(map[string]map[string]interface{})
	mergedOrder := []string{}

	// 先添加本地记录
	for _, record := range localRecords {
		uuid, ok := record[fieldUUID].(string)
		if !ok {
			continue
		}
		merged[uuid] = record
		mergedOrder = append(mergedOrder, uuid)
	}

	// 合并远程记录
	for _, record := range remoteRecords {
		uuid, ok := record[fieldUUID].(string)
		if !ok {
			continue
		}

		existing, exists := merged[uuid]
		if !exists {
			merged[uuid] = record
			mergedOrder = append(mergedOrder, uuid)
		} else {
			// 比较 updated_at，更新的获胜
			localTime := s.parseTime(existing[fieldUpdatedAt])
			remoteTime := s.parseTime(record[fieldUpdatedAt])
			if remoteTime.After(localTime) {
				merged[uuid] = record
			}
		}
	}

	// 转回 JSON 行
	var result []string
	for _, uuid := range mergedOrder {
		if record, ok := merged[uuid]; ok {
			data, _ := json.Marshal(record)
			result = append(result, string(data))
			delete(merged, uuid) // 避免重复
		}
	}

	return result
}

func (s *BackupService) parseRecords(lines []string) []map[string]interface{} {
	var records []map[string]interface{}
	for _, line := range lines {
		var record map[string]interface{}
		if err := json.Unmarshal([]byte(line), &record); err == nil {
			records = append(records, record)
		}
	}
	return records
}

func (s *BackupService) parseTime(v interface{}) time.Time {
	if str, ok := v.(string); ok {
		t, _ := time.Parse(time.RFC3339, str)
		return t
	}
	return time.Time{}
}

// importAll 从 JSONL 文件导入数据到数据库
func (s *BackupService) importAll(ctx context.Context, dataPath string) error {
	client := s.dbService.Client

	// 定义导入任务
	imports := []struct {
		name string
		fn   func() error
	}{
		{"documents", func() error { return s.importDocuments(ctx, client, dataPath) }},
		{"extensions", func() error { return s.importExtensions(ctx, client, dataPath) }},
		{"keybindings", func() error { return s.importKeyBindings(ctx, client, dataPath) }},
		{"themes", func() error { return s.importThemes(ctx, client, dataPath) }},
	}

	for _, imp := range imports {
		if err := imp.fn(); err != nil {
			s.logger.Error("importing %s: %v", imp.name, err)
		}
	}

	return nil
}

func (s *BackupService) importDocuments(ctx context.Context, client *ent.Client, dataPath string) error {
	filePath := filepath.Join(dataPath, "documents.jsonl")
	records, err := s.readJSONL(filePath)
	if err != nil {
		return err
	}

	// 跳过软删除过滤和自动更新时间
	importCtx := mixin.SkipAutoUpdate(mixin.SkipSoftDelete(ctx))

	for _, record := range records {
		uuid, _ := record[document.FieldUUID].(string)
		if uuid == "" {
			continue
		}

		// 查找现有记录
		found, err := client.Document.Query().
			Where(document.UUIDEQ(uuid)).
			First(importCtx)

		remoteTime := s.parseTime(record[document.FieldUpdatedAt])

		if err != nil || found == nil {
			// 新记录，创建
			if err := s.createDocument(importCtx, client, record); err != nil {
				s.logger.Error("creating document: %v", err)
			}
		} else {
			// 比较时间，更新的获胜
			localTime, _ := time.Parse(time.RFC3339, found.UpdatedAt)
			if remoteTime.After(localTime) {
				if err := s.updateDocument(importCtx, client, found.ID, record); err != nil {
					s.logger.Error("updating document: %v", err)
				}
			}
		}
	}

	return nil
}

func (s *BackupService) createDocument(ctx context.Context, client *ent.Client, record map[string]interface{}) error {
	builder := client.Document.Create()
	if v, ok := record[document.FieldUUID].(string); ok {
		builder.SetUUID(v)
	}
	if v, ok := record[document.FieldTitle].(string); ok {
		builder.SetTitle(v)
	}
	if v, ok := record[document.FieldContent].(string); ok {
		builder.SetContent(v)
	}
	if v, ok := record[document.FieldLocked].(bool); ok {
		builder.SetLocked(v)
	}
	if v, ok := record[document.FieldCreatedAt].(string); ok {
		builder.SetCreatedAt(v)
	}
	if v, ok := record[document.FieldUpdatedAt].(string); ok {
		builder.SetUpdatedAt(v)
	}
	if v, ok := record[document.FieldDeletedAt].(string); ok {
		builder.SetDeletedAt(v)
	}
	return builder.Exec(ctx)
}

func (s *BackupService) updateDocument(ctx context.Context, client *ent.Client, id int, record map[string]interface{}) error {
	builder := client.Document.UpdateOneID(id)
	if v, ok := record[document.FieldTitle].(string); ok {
		builder.SetTitle(v)
	}
	if v, ok := record[document.FieldContent].(string); ok {
		builder.SetContent(v)
	}
	if v, ok := record[document.FieldLocked].(bool); ok {
		builder.SetLocked(v)
	}
	if v, ok := record[document.FieldUpdatedAt].(string); ok {
		builder.SetUpdatedAt(v)
	}
	if v, ok := record[document.FieldDeletedAt].(string); ok {
		builder.SetDeletedAt(v)
	} else {
		builder.ClearDeletedAt()
	}
	return builder.Exec(ctx)
}

func (s *BackupService) importExtensions(ctx context.Context, client *ent.Client, dataPath string) error {
	filePath := filepath.Join(dataPath, "extensions.jsonl")
	records, err := s.readJSONL(filePath)
	if err != nil {
		return err
	}

	importCtx := mixin.SkipAutoUpdate(mixin.SkipSoftDelete(ctx))

	for _, record := range records {
		uuid, _ := record[extension.FieldUUID].(string)
		if uuid == "" {
			continue
		}

		found, err := client.Extension.Query().
			Where(extension.UUIDEQ(uuid)).
			First(importCtx)

		remoteTime := s.parseTime(record[extension.FieldUpdatedAt])

		if err != nil || found == nil {
			if err := s.createExtension(importCtx, client, record); err != nil {
				s.logger.Error("creating extension: %v", err)
			}
		} else {
			localTime, _ := time.Parse(time.RFC3339, found.UpdatedAt)
			if remoteTime.After(localTime) {
				if err := s.updateExtension(importCtx, client, found.ID, record); err != nil {
					s.logger.Error("updating extension: %v", err)
				}
			}
		}
	}

	return nil
}

func (s *BackupService) createExtension(ctx context.Context, client *ent.Client, record map[string]interface{}) error {
	builder := client.Extension.Create()
	if v, ok := record[extension.FieldUUID].(string); ok {
		builder.SetUUID(v)
	}
	if v, ok := record[extension.FieldKey].(string); ok {
		builder.SetKey(v)
	}
	if v, ok := record[extension.FieldEnabled].(bool); ok {
		builder.SetEnabled(v)
	}
	if v, ok := record[extension.FieldConfig].(map[string]interface{}); ok {
		builder.SetConfig(v)
	}
	if v, ok := record[extension.FieldCreatedAt].(string); ok {
		builder.SetCreatedAt(v)
	}
	if v, ok := record[extension.FieldUpdatedAt].(string); ok {
		builder.SetUpdatedAt(v)
	}
	if v, ok := record[extension.FieldDeletedAt].(string); ok {
		builder.SetDeletedAt(v)
	}
	return builder.Exec(ctx)
}

func (s *BackupService) updateExtension(ctx context.Context, client *ent.Client, id int, record map[string]interface{}) error {
	builder := client.Extension.UpdateOneID(id)
	if v, ok := record[extension.FieldKey].(string); ok {
		builder.SetKey(v)
	}
	if v, ok := record[extension.FieldEnabled].(bool); ok {
		builder.SetEnabled(v)
	}
	if v, ok := record[extension.FieldConfig].(map[string]interface{}); ok {
		builder.SetConfig(v)
	}
	if v, ok := record[extension.FieldUpdatedAt].(string); ok {
		builder.SetUpdatedAt(v)
	}
	if v, ok := record[extension.FieldDeletedAt].(string); ok {
		builder.SetDeletedAt(v)
	} else {
		builder.ClearDeletedAt()
	}
	return builder.Exec(ctx)
}

func (s *BackupService) importKeyBindings(ctx context.Context, client *ent.Client, dataPath string) error {
	filePath := filepath.Join(dataPath, "keybindings.jsonl")
	records, err := s.readJSONL(filePath)
	if err != nil {
		return err
	}

	importCtx := mixin.SkipAutoUpdate(mixin.SkipSoftDelete(ctx))

	for _, record := range records {
		uuid, _ := record[keybinding.FieldUUID].(string)
		if uuid == "" {
			continue
		}

		found, err := client.KeyBinding.Query().
			Where(keybinding.UUIDEQ(uuid)).
			First(importCtx)

		remoteTime := s.parseTime(record[keybinding.FieldUpdatedAt])

		if err != nil || found == nil {
			if err := s.createKeyBinding(importCtx, client, record); err != nil {
				s.logger.Error("creating keybinding: %v", err)
			}
		} else {
			localTime, _ := time.Parse(time.RFC3339, found.UpdatedAt)
			if remoteTime.After(localTime) {
				if err := s.updateKeyBinding(importCtx, client, found.ID, record); err != nil {
					s.logger.Error("updating keybinding: %v", err)
				}
			}
		}
	}

	return nil
}

func (s *BackupService) createKeyBinding(ctx context.Context, client *ent.Client, record map[string]interface{}) error {
	builder := client.KeyBinding.Create()
	if v, ok := record[keybinding.FieldUUID].(string); ok {
		builder.SetUUID(v)
	}
	if v, ok := record[keybinding.FieldKey].(string); ok {
		builder.SetKey(v)
	}
	if v, ok := record[keybinding.FieldCommand].(string); ok {
		builder.SetCommand(v)
	}
	if v, ok := record[keybinding.FieldExtension].(string); ok {
		builder.SetExtension(v)
	}
	if v, ok := record[keybinding.FieldEnabled].(bool); ok {
		builder.SetEnabled(v)
	}
	if v, ok := record[keybinding.FieldCreatedAt].(string); ok {
		builder.SetCreatedAt(v)
	}
	if v, ok := record[keybinding.FieldUpdatedAt].(string); ok {
		builder.SetUpdatedAt(v)
	}
	if v, ok := record[keybinding.FieldDeletedAt].(string); ok {
		builder.SetDeletedAt(v)
	}
	return builder.Exec(ctx)
}

func (s *BackupService) updateKeyBinding(ctx context.Context, client *ent.Client, id int, record map[string]interface{}) error {
	builder := client.KeyBinding.UpdateOneID(id)
	if v, ok := record[keybinding.FieldKey].(string); ok {
		builder.SetKey(v)
	}
	if v, ok := record[keybinding.FieldCommand].(string); ok {
		builder.SetCommand(v)
	}
	if v, ok := record[keybinding.FieldExtension].(string); ok {
		builder.SetExtension(v)
	}
	if v, ok := record[keybinding.FieldEnabled].(bool); ok {
		builder.SetEnabled(v)
	}
	if v, ok := record[keybinding.FieldUpdatedAt].(string); ok {
		builder.SetUpdatedAt(v)
	}
	if v, ok := record[keybinding.FieldDeletedAt].(string); ok {
		builder.SetDeletedAt(v)
	} else {
		builder.ClearDeletedAt()
	}
	return builder.Exec(ctx)
}

func (s *BackupService) importThemes(ctx context.Context, client *ent.Client, dataPath string) error {
	filePath := filepath.Join(dataPath, "themes.jsonl")
	records, err := s.readJSONL(filePath)
	if err != nil {
		return err
	}

	importCtx := mixin.SkipAutoUpdate(mixin.SkipSoftDelete(ctx))

	for _, record := range records {
		uuid, _ := record[theme.FieldUUID].(string)
		if uuid == "" {
			continue
		}

		found, err := client.Theme.Query().
			Where(theme.UUIDEQ(uuid)).
			First(importCtx)

		remoteTime := s.parseTime(record[theme.FieldUpdatedAt])

		if err != nil || found == nil {
			if err := s.createTheme(importCtx, client, record); err != nil {
				s.logger.Error("creating theme: %v", err)
			}
		} else {
			localTime, _ := time.Parse(time.RFC3339, found.UpdatedAt)
			if remoteTime.After(localTime) {
				if err := s.updateTheme(importCtx, client, found.ID, record); err != nil {
					s.logger.Error("updating theme: %v", err)
				}
			}
		}
	}

	return nil
}

func (s *BackupService) createTheme(ctx context.Context, client *ent.Client, record map[string]interface{}) error {
	builder := client.Theme.Create()
	if v, ok := record[theme.FieldUUID].(string); ok {
		builder.SetUUID(v)
	}
	if v, ok := record[theme.FieldKey].(string); ok {
		builder.SetKey(v)
	}
	if v, ok := record[theme.FieldType].(string); ok {
		builder.SetType(theme.Type(v))
	}
	if v, ok := record[theme.FieldColors].(map[string]interface{}); ok {
		builder.SetColors(v)
	}
	if v, ok := record[theme.FieldCreatedAt].(string); ok {
		builder.SetCreatedAt(v)
	}
	if v, ok := record[theme.FieldUpdatedAt].(string); ok {
		builder.SetUpdatedAt(v)
	}
	if v, ok := record[theme.FieldDeletedAt].(string); ok {
		builder.SetDeletedAt(v)
	}
	return builder.Exec(ctx)
}

func (s *BackupService) updateTheme(ctx context.Context, client *ent.Client, id int, record map[string]interface{}) error {
	builder := client.Theme.UpdateOneID(id)
	if v, ok := record[theme.FieldKey].(string); ok {
		builder.SetKey(v)
	}
	if v, ok := record[theme.FieldType].(string); ok {
		builder.SetType(theme.Type(v))
	}
	if v, ok := record[theme.FieldColors].(map[string]interface{}); ok {
		builder.SetColors(v)
	}
	if v, ok := record[theme.FieldUpdatedAt].(string); ok {
		builder.SetUpdatedAt(v)
	}
	if v, ok := record[theme.FieldDeletedAt].(string); ok {
		builder.SetDeletedAt(v)
	} else {
		builder.ClearDeletedAt()
	}
	return builder.Exec(ctx)
}

func (s *BackupService) readJSONL(filePath string) ([]map[string]interface{}, error) {
	file, err := os.Open(filePath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}
	defer file.Close()

	var records []map[string]interface{}
	scanner := bufio.NewScanner(file)
	// 增加 buffer 大小以处理大行
	scanner.Buffer(make([]byte, 1024*1024), 1024*1024)

	for scanner.Scan() {
		line := scanner.Text()
		if line == "" {
			continue
		}
		var record map[string]interface{}
		if err := json.Unmarshal([]byte(line), &record); err == nil {
			records = append(records, record)
		}
	}

	return records, scanner.Err()
}

// StartAutoBackup 启动自动备份
func (s *BackupService) StartAutoBackup() error {
	config, _, err := s.getConfigAndPath()
	if err != nil {
		return err
	}

	if !config.AutoBackup || config.BackupInterval <= 0 {
		return nil
	}

	s.StopAutoBackup()

	s.autoBackupTicker = time.NewTicker(time.Duration(config.BackupInterval) * time.Minute)
	s.autoBackupStop = make(chan bool)

	s.autoBackupWg.Add(1)
	go func() {
		defer s.autoBackupWg.Done()
		for {
			select {
			case <-s.autoBackupTicker.C:
				if err := s.Sync(); err != nil {
					s.logger.Error("auto backup failed: %v", err)
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
	// 先停止 ticker
	if s.autoBackupTicker != nil {
		s.autoBackupTicker.Stop()
		s.autoBackupTicker = nil
	}

	// 安全关闭 channel（只关闭一次）
	if s.autoBackupStop != nil {
		select {
		case <-s.autoBackupStop:
			// channel 已关闭，不做任何事
		default:
			close(s.autoBackupStop)
		}
		s.autoBackupWg.Wait()
		s.autoBackupStop = nil
	}
}

// Reinitialize 重新初始化
func (s *BackupService) Reinitialize() error {
	s.StopAutoBackup()

	s.mu.Lock()
	s.isInitialized = false
	s.mu.Unlock()

	return s.Initialize()
}

// HandleConfigChange 处理配置变更
func (s *BackupService) HandleConfigChange(config *models.GitBackupConfig) error {
	s.mu.Lock()
	initialized := s.isInitialized
	s.mu.Unlock()

	if !config.Enabled {
		s.StopAutoBackup()
		s.mu.Lock()
		s.isInitialized = false
		s.mu.Unlock()
		return nil
	}

	if initialized {
		return s.Reinitialize()
	}

	return s.Initialize()
}

// ServiceShutdown 服务关闭
func (s *BackupService) ServiceShutdown() {
	if s.cancelObserver != nil {
		s.cancelObserver()
	}
	s.StopAutoBackup()
}
