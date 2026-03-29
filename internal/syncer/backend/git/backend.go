package git

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"
	"voidraft/internal/syncer/backend"

	"github.com/go-git/go-git/v5"
	gitconfig "github.com/go-git/go-git/v5/config"
	"github.com/go-git/go-git/v5/plumbing"
	"github.com/go-git/go-git/v5/plumbing/object"
)

const defaultGitIgnore = "*.tmp\n*.log\n"

// Config 描述 Git 后端配置。
type Config struct {
	RepoPath    string
	RepoURL     string
	Branch      string
	RemoteName  string
	AuthorName  string
	AuthorEmail string
	Auth        AuthConfig
}

// Backend 提供基于 Git 的后端实现。
type Backend struct {
	config     Config
	repository *git.Repository
}

// New 创建新的 Git 后端实例。
func New(config Config) (*Backend, error) {
	normalized, err := normalizeConfig(config)
	if err != nil {
		return nil, err
	}
	return &Backend{config: normalized}, nil
}

// Verify 校验本地仓库和远端连接是否可用。
func (b *Backend) Verify(ctx context.Context) error {
	_ = ctx

	if err := b.ensureRepository(); err != nil {
		return err
	}

	auth, err := authMethod(b.config.Auth)
	if err != nil {
		return err
	}

	remote, err := b.repository.Remote(b.config.RemoteName)
	if err != nil {
		return err
	}

	_, err = remote.List(&git.ListOptions{Auth: auth})
	if err == nil {
		return nil
	}
	if isEmptyRemoteError(err) {
		return nil
	}
	return err
}

// DownloadLatest 拉取远端最新快照并导出到目标目录。
func (b *Backend) DownloadLatest(ctx context.Context, dst string) (backend.RemoteState, error) {
	_ = ctx

	if err := b.ensureRepository(); err != nil {
		return backend.RemoteState{}, err
	}

	if err := recreateDir(dst); err != nil {
		return backend.RemoteState{}, err
	}

	remoteState, err := b.fetchRemoteState()
	if err != nil {
		return backend.RemoteState{}, err
	}
	if !remoteState.Exists {
		return remoteState, nil
	}

	if err := b.exportRemoteTree(remoteState.Revision, dst); err != nil {
		return backend.RemoteState{}, err
	}

	return remoteState, nil
}

// Upload 将本地快照目录发布到远端 Git 仓库。
func (b *Backend) Upload(ctx context.Context, src string, options backend.PublishOptions) (backend.RemoteState, error) {
	_ = ctx

	if err := b.ensureRepository(); err != nil {
		return backend.RemoteState{}, err
	}

	remoteState, err := b.fetchRemoteState()
	if err != nil {
		return backend.RemoteState{}, err
	}
	if options.ExpectedRevision != "" && remoteState.Exists && remoteState.Revision != options.ExpectedRevision {
		return backend.RemoteState{}, backend.ErrRevisionConflict
	}

	if err := b.prepareBranch(remoteState); err != nil {
		return backend.RemoteState{}, err
	}
	if err := syncDir(src, b.config.RepoPath); err != nil {
		return backend.RemoteState{}, err
	}

	worktree, err := b.repository.Worktree()
	if err != nil {
		return backend.RemoteState{}, err
	}

	changed, err := stageAll(worktree)
	if err != nil {
		return backend.RemoteState{}, err
	}
	if !changed {
		return b.currentLocalState()
	}

	if _, err := worktree.Commit(options.Message, &git.CommitOptions{
		Author: &object.Signature{
			Name:  b.config.AuthorName,
			Email: b.config.AuthorEmail,
			When:  time.Now(),
		},
	}); err != nil {
		return backend.RemoteState{}, err
	}

	auth, err := authMethod(b.config.Auth)
	if err != nil {
		return backend.RemoteState{}, err
	}

	branchRef := plumbing.NewBranchReferenceName(b.config.Branch)
	remoteRef := plumbing.NewRemoteReferenceName(b.config.RemoteName, b.config.Branch)
	err = b.repository.Push(&git.PushOptions{
		RemoteName: b.config.RemoteName,
		Auth:       auth,
		RefSpecs: []gitconfig.RefSpec{
			gitconfig.RefSpec(fmt.Sprintf("%s:%s", branchRef, remoteRef)),
		},
	})
	if err != nil && !errors.Is(err, git.NoErrAlreadyUpToDate) {
		if errors.Is(err, git.ErrNonFastForwardUpdate) {
			return backend.RemoteState{}, backend.ErrRevisionConflict
		}
		return backend.RemoteState{}, err
	}

	return b.currentLocalState()
}

// Close 关闭后端。
func (b *Backend) Close() error {
	return nil
}

// normalizeConfig 填充 Git 后端配置默认值。
func normalizeConfig(config Config) (Config, error) {
	normalized := config
	if strings.TrimSpace(normalized.RepoPath) == "" {
		return Config{}, errors.New("git repo path is required")
	}
	if strings.TrimSpace(normalized.Branch) == "" {
		normalized.Branch = "master"
	}
	if strings.TrimSpace(normalized.RemoteName) == "" {
		normalized.RemoteName = "origin"
	}
	if strings.TrimSpace(normalized.AuthorName) == "" {
		normalized.AuthorName = "voidraft"
	}
	if strings.TrimSpace(normalized.AuthorEmail) == "" {
		normalized.AuthorEmail = "sync@voidraft.app"
	}
	return normalized, nil
}

// ensureRepository 确保本地 Git 仓库存在且远端配置正确。
func (b *Backend) ensureRepository() error {
	if b.repository != nil {
		return b.ensureRemote()
	}

	if err := os.MkdirAll(b.config.RepoPath, 0755); err != nil {
		return fmt.Errorf("create git repo dir: %w", err)
	}

	gitPath := filepath.Join(b.config.RepoPath, ".git")
	if _, err := os.Stat(gitPath); os.IsNotExist(err) {
		repository, initErr := git.PlainInit(b.config.RepoPath, false)
		if initErr != nil {
			return fmt.Errorf("init git repo: %w", initErr)
		}
		b.repository = repository
		if err := ensureGitIgnore(b.config.RepoPath); err != nil {
			return err
		}
		return b.ensureRemote()
	} else if err != nil {
		return fmt.Errorf("stat git repo: %w", err)
	}

	repository, err := git.PlainOpen(b.config.RepoPath)
	if err != nil {
		return fmt.Errorf("open git repo: %w", err)
	}
	b.repository = repository
	if err := ensureGitIgnore(b.config.RepoPath); err != nil {
		return err
	}
	return b.ensureRemote()
}

// ensureRemote 确保远端配置与当前目标一致。
func (b *Backend) ensureRemote() error {
	if strings.TrimSpace(b.config.RepoURL) == "" {
		return nil
	}

	remote, err := b.repository.Remote(b.config.RemoteName)
	if errors.Is(err, git.ErrRemoteNotFound) {
		_, err = b.repository.CreateRemote(&gitconfig.RemoteConfig{
			Name: b.config.RemoteName,
			URLs: []string{b.config.RepoURL},
		})
		return err
	}
	if err != nil {
		return err
	}

	if len(remote.Config().URLs) > 0 && remote.Config().URLs[0] == b.config.RepoURL {
		return nil
	}

	if err := b.repository.DeleteRemote(b.config.RemoteName); err != nil {
		return err
	}
	_, err = b.repository.CreateRemote(&gitconfig.RemoteConfig{
		Name: b.config.RemoteName,
		URLs: []string{b.config.RepoURL},
	})
	return err
}

// fetchRemoteState 拉取远端分支并返回最新状态。
func (b *Backend) fetchRemoteState() (backend.RemoteState, error) {
	auth, err := authMethod(b.config.Auth)
	if err != nil {
		return backend.RemoteState{}, err
	}

	err = b.repository.Fetch(&git.FetchOptions{
		RemoteName: b.config.RemoteName,
		Auth:       auth,
		Force:      true,
	})
	if err != nil && !errors.Is(err, git.NoErrAlreadyUpToDate) {
		if isEmptyRemoteError(err) || isMissingRemoteRefError(err) {
			return backend.RemoteState{}, nil
		}
		return backend.RemoteState{}, err
	}

	ref, err := b.repository.Reference(plumbing.NewRemoteReferenceName(b.config.RemoteName, b.config.Branch), true)
	if err != nil {
		if errors.Is(err, plumbing.ErrReferenceNotFound) {
			return backend.RemoteState{}, nil
		}
		return backend.RemoteState{}, err
	}

	return backend.RemoteState{
		Exists:   true,
		Revision: ref.Hash().String(),
	}, nil
}

// exportRemoteTree 将指定提交的树内容导出为普通文件。
func (b *Backend) exportRemoteTree(revision string, dst string) error {
	commit, err := b.repository.CommitObject(plumbing.NewHash(revision))
	if err != nil {
		return err
	}

	tree, err := commit.Tree()
	if err != nil {
		return err
	}

	return tree.Files().ForEach(func(file *object.File) error {
		targetPath := filepath.Join(dst, filepath.FromSlash(file.Name))
		if err := os.MkdirAll(filepath.Dir(targetPath), 0755); err != nil {
			return err
		}

		reader, err := file.Reader()
		if err != nil {
			return err
		}
		defer reader.Close()

		writer, err := os.Create(targetPath)
		if err != nil {
			return err
		}
		defer writer.Close()

		_, err = io.Copy(writer, reader)
		return err
	})
}

// prepareBranch 将本地分支重置到远端最新版本。
func (b *Backend) prepareBranch(remoteState backend.RemoteState) error {
	branchRef := plumbing.NewBranchReferenceName(b.config.Branch)
	if remoteState.Exists {
		if err := b.repository.Storer.SetReference(plumbing.NewHashReference(branchRef, plumbing.NewHash(remoteState.Revision))); err != nil {
			return err
		}
	}
	if err := b.repository.Storer.SetReference(plumbing.NewSymbolicReference(plumbing.HEAD, branchRef)); err != nil {
		return err
	}

	if !remoteState.Exists {
		return nil
	}

	worktree, err := b.repository.Worktree()
	if err != nil {
		return err
	}
	return worktree.Checkout(&git.CheckoutOptions{
		Branch: branchRef,
		Force:  true,
	})
}

// currentLocalState 返回当前本地 HEAD 状态。
func (b *Backend) currentLocalState() (backend.RemoteState, error) {
	head, err := b.repository.Head()
	if err != nil {
		if errors.Is(err, plumbing.ErrReferenceNotFound) {
			return backend.RemoteState{}, nil
		}
		return backend.RemoteState{}, err
	}
	return backend.RemoteState{
		Exists:   true,
		Revision: head.Hash().String(),
	}, nil
}

// ensureGitIgnore 保证仓库目录中存在默认 .gitignore。
func ensureGitIgnore(repoPath string) error {
	gitIgnorePath := filepath.Join(repoPath, ".gitignore")
	if _, err := os.Stat(gitIgnorePath); err == nil {
		return nil
	} else if !os.IsNotExist(err) {
		return err
	}
	return os.WriteFile(gitIgnorePath, []byte(defaultGitIgnore), 0644)
}

// recreateDir 清空并重建目录。
func recreateDir(dir string) error {
	if err := os.RemoveAll(dir); err != nil {
		return err
	}
	return os.MkdirAll(dir, 0755)
}

// syncDir 将源目录内容同步到目标目录。
func syncDir(src string, dst string) error {
	sourceEntries, err := os.ReadDir(src)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(dst, 0755); err != nil {
		return err
	}

	sourceIndex := make(map[string]os.DirEntry, len(sourceEntries))
	for _, entry := range sourceEntries {
		sourceIndex[entry.Name()] = entry
		srcPath := filepath.Join(src, entry.Name())
		dstPath := filepath.Join(dst, entry.Name())

		if entry.IsDir() {
			if err := syncDir(srcPath, dstPath); err != nil {
				return err
			}
			continue
		}

		if err := copyFile(srcPath, dstPath); err != nil {
			return err
		}
	}

	targetEntries, err := os.ReadDir(dst)
	if err != nil {
		return err
	}

	for _, entry := range targetEntries {
		if entry.Name() == ".git" || entry.Name() == ".gitignore" {
			continue
		}
		if _, exists := sourceIndex[entry.Name()]; exists {
			continue
		}
		if err := os.RemoveAll(filepath.Join(dst, entry.Name())); err != nil {
			return err
		}
	}

	return nil
}

// copyFile 复制单个文件并保留权限位。
func copyFile(src string, dst string) error {
	sourceFile, err := os.Open(src)
	if err != nil {
		return err
	}
	defer sourceFile.Close()

	info, err := sourceFile.Stat()
	if err != nil {
		return err
	}

	if err := os.MkdirAll(filepath.Dir(dst), 0755); err != nil {
		return err
	}

	targetFile, err := os.OpenFile(dst, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, info.Mode().Perm())
	if err != nil {
		return err
	}
	defer targetFile.Close()

	_, err = io.Copy(targetFile, sourceFile)
	return err
}

// stageAll 将工作区所有变化加入索引。
func stageAll(worktree *git.Worktree) (bool, error) {
	status, err := worktree.Status()
	if err != nil {
		return false, err
	}

	for path, fileStatus := range status {
		switch fileStatus.Worktree {
		case git.Untracked, git.Modified, git.Added, git.Copied, git.Renamed:
			if _, err := worktree.Add(path); err != nil {
				return false, err
			}
		case git.Deleted:
			if _, err := worktree.Remove(path); err != nil && !os.IsNotExist(err) {
				return false, err
			}
		}
		if fileStatus.Staging == git.Deleted && fileStatus.Worktree == git.Unmodified {
			if _, err := worktree.Remove(path); err != nil && !os.IsNotExist(err) {
				return false, err
			}
		}
	}

	status, err = worktree.Status()
	if err != nil {
		return false, err
	}
	return !status.IsClean(), nil
}

// isEmptyRemoteError 判断错误是否表示远端仓库为空。
func isEmptyRemoteError(err error) bool {
	if err == nil {
		return false
	}
	message := err.Error()
	return strings.Contains(message, "empty") || strings.Contains(message, "no reference")
}

// isMissingRemoteRefError 判断错误是否表示远端分支不存在。
func isMissingRemoteRefError(err error) bool {
	if err == nil {
		return false
	}
	message := err.Error()
	return strings.Contains(message, "reference not found") || strings.Contains(message, "couldn't find remote ref")
}
