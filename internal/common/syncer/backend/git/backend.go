package git

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
	"voidraft/internal/common/syncer/backend"

	"github.com/go-git/go-git/v5"
	gitconfig "github.com/go-git/go-git/v5/config"
	"github.com/go-git/go-git/v5/plumbing"
	"github.com/go-git/go-git/v5/plumbing/object"
)

const defaultGitIgnore = "*.tmp\n*.log\n"

const (
	fallbackMainBranch   = "main"
	fallbackMasterBranch = "master"
)

// Config describes the Git backend configuration.
type Config struct {
	RepoPath    string
	RepoURL     string
	Branch      string
	RemoteName  string
	AuthorName  string
	AuthorEmail string
	Auth        AuthConfig
}

// Backend implements the snapshot backend over Git.
type Backend struct {
	config     Config
	repository *git.Repository
	resolved   string
}

// New creates a new Git backend.
func New(config Config) (*Backend, error) {
	normalized, err := normalizeConfig(config)
	if err != nil {
		return nil, err
	}
	return &Backend{config: normalized}, nil
}

// Verify validates repository access and resolves the effective branch.
func (b *Backend) Verify(ctx context.Context) error {
	if err := b.ensureRepository(); err != nil {
		return err
	}

	_, err := b.resolveBranch(ctx)
	return err
}

// ResolvedBranch returns the effective branch used by the backend.
func (b *Backend) ResolvedBranch() string {
	if b.resolved != "" {
		return b.resolved
	}
	return strings.TrimSpace(b.config.Branch)
}

// DownloadLatest downloads the latest snapshot and expands it to dst.
func (b *Backend) DownloadLatest(ctx context.Context, dst string) (backend.RemoteState, error) {
	if err := b.ensureRepository(); err != nil {
		return backend.RemoteState{}, err
	}

	if err := recreateDir(dst); err != nil {
		return backend.RemoteState{}, err
	}

	remoteState, err := b.fetchRemoteState(ctx)
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

// Upload publishes the staged snapshot directory to the remote Git repo.
func (b *Backend) Upload(ctx context.Context, src string, options backend.PublishOptions) (backend.RemoteState, error) {
	if err := b.ensureRepository(); err != nil {
		return backend.RemoteState{}, err
	}

	branch, err := b.resolveBranch(ctx)
	if err != nil {
		return backend.RemoteState{}, err
	}

	remoteState, err := b.fetchRemoteState(ctx)
	if err != nil {
		return backend.RemoteState{}, err
	}
	if options.ExpectedRevision != "" && remoteState.Exists && remoteState.Revision != options.ExpectedRevision {
		return backend.RemoteState{}, backend.ErrRevisionConflict
	}

	if err := b.prepareBranch(branch, remoteState); err != nil {
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

	branchRef := plumbing.NewBranchReferenceName(branch)
	remoteRef := plumbing.NewRemoteReferenceName(b.config.RemoteName, branch)
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

// Close closes the backend.
func (b *Backend) Close() error {
	return nil
}

// normalizeConfig fills default Git backend values.
func normalizeConfig(config Config) (Config, error) {
	normalized := config
	if strings.TrimSpace(normalized.RepoPath) == "" {
		return Config{}, errors.New("git repo path is required")
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

// ensureRepository ensures the local Git repository exists and matches config.
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

// ensureRemote ensures the remote config matches the current target.
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

// fetchRemoteState fetches the latest state for the effective branch.
func (b *Backend) fetchRemoteState(ctx context.Context) (backend.RemoteState, error) {
	branch, err := b.resolveBranch(ctx)
	if err != nil {
		return backend.RemoteState{}, err
	}

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

	ref, err := b.repository.Reference(plumbing.NewRemoteReferenceName(b.config.RemoteName, branch), true)
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

// exportRemoteTree exports the given commit tree as regular files.
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

// prepareBranch moves the local checkout to the effective branch head.
func (b *Backend) prepareBranch(branch string, remoteState backend.RemoteState) error {
	branchRef := plumbing.NewBranchReferenceName(branch)
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

// currentLocalState returns the current local HEAD state.
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

// resolveBranch picks the effective branch for the current sync session.
func (b *Backend) resolveBranch(ctx context.Context) (string, error) {
	if branch := strings.TrimSpace(b.config.Branch); branch != "" {
		b.resolved = branch
		return branch, nil
	}
	if b.resolved != "" {
		return b.resolved, nil
	}

	auth, err := authMethod(b.config.Auth)
	if err != nil {
		return "", err
	}

	remote, err := b.repository.Remote(b.config.RemoteName)
	if err != nil {
		return "", err
	}

	if ctx == nil {
		ctx = context.Background()
	}

	refs, err := remote.ListContext(ctx, &git.ListOptions{Auth: auth})
	if err != nil {
		if isEmptyRemoteError(err) {
			b.resolved = fallbackMainBranch
			return b.resolved, nil
		}
		return "", err
	}

	b.resolved = resolveBranchName(refs)
	return b.resolved, nil
}

// resolveBranchName infers the best branch from remote refs.
func resolveBranchName(refs []*plumbing.Reference) string {
	branches := make(map[string]*plumbing.Reference)
	var headHash plumbing.Hash
	var hasHeadHash bool

	for _, ref := range refs {
		if ref == nil {
			continue
		}

		switch {
		case ref.Name() == plumbing.HEAD:
			if ref.Type() == plumbing.SymbolicReference && ref.Target().IsBranch() {
				return ref.Target().Short()
			}
			if ref.Type() == plumbing.HashReference {
				headHash = ref.Hash()
				hasHeadHash = true
			}
		case ref.Name().IsBranch():
			branches[ref.Name().Short()] = ref
		}
	}

	if hasHeadHash {
		matches := make([]string, 0, len(branches))
		for name, ref := range branches {
			if ref.Hash() == headHash {
				matches = append(matches, name)
			}
		}
		sort.Strings(matches)
		if len(matches) == 1 {
			return matches[0]
		}
		for _, candidate := range []string{fallbackMainBranch, fallbackMasterBranch} {
			for _, match := range matches {
				if match == candidate {
					return candidate
				}
			}
		}
		if len(matches) > 0 {
			return matches[0]
		}
	}

	for _, candidate := range []string{fallbackMainBranch, fallbackMasterBranch} {
		if _, ok := branches[candidate]; ok {
			return candidate
		}
	}

	names := make([]string, 0, len(branches))
	for name := range branches {
		names = append(names, name)
	}
	sort.Strings(names)
	if len(names) > 0 {
		return names[0]
	}

	return fallbackMainBranch
}

// ensureGitIgnore makes sure the repository contains the default .gitignore.
func ensureGitIgnore(repoPath string) error {
	gitIgnorePath := filepath.Join(repoPath, ".gitignore")
	if _, err := os.Stat(gitIgnorePath); err == nil {
		return nil
	} else if !os.IsNotExist(err) {
		return err
	}
	return os.WriteFile(gitIgnorePath, []byte(defaultGitIgnore), 0644)
}

// recreateDir recreates a directory from scratch.
func recreateDir(dir string) error {
	if err := os.RemoveAll(dir); err != nil {
		return err
	}
	return os.MkdirAll(dir, 0755)
}

// syncDir syncs the source directory into the target directory.
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

// copyFile copies one file while preserving permissions.
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

// stageAll stages all worktree changes.
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

// isEmptyRemoteError reports whether the error means the remote is empty.
func isEmptyRemoteError(err error) bool {
	if err == nil {
		return false
	}
	message := err.Error()
	return strings.Contains(message, "empty") || strings.Contains(message, "no reference")
}

// isMissingRemoteRefError reports whether the error means a remote branch is missing.
func isMissingRemoteRefError(err error) bool {
	if err == nil {
		return false
	}
	message := err.Error()
	return strings.Contains(message, "reference not found") || strings.Contains(message, "couldn't find remote ref")
}
