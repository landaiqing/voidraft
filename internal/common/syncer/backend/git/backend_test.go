package git

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"
	"voidraft/internal/common/syncer/backend"

	gogit "github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing"
)

// TestVerifyAllowsMissingConfiguredBranch verifies empty remotes do not fail verification.
func TestVerifyAllowsMissingConfiguredBranch(t *testing.T) {
	rootDir := t.TempDir()
	remotePath := filepath.Join(rootDir, "remote.git")
	repoPath := filepath.Join(rootDir, "repo")

	if _, err := gogit.PlainInit(remotePath, true); err != nil {
		t.Fatalf("init remote repo: %v", err)
	}

	backendInstance, err := New(Config{
		RepoPath:    repoPath,
		RepoURL:     remotePath,
		Branch:      "develop",
		RemoteName:  "origin",
		AuthorName:  "voidraft",
		AuthorEmail: "sync@voidraft.app",
	})
	if err != nil {
		t.Fatalf("new backend: %v", err)
	}

	if err := backendInstance.Verify(context.Background()); err != nil {
		t.Fatalf("verify: %v", err)
	}
}

// TestUploadPushesToConfiguredBranch verifies sync publishes to the configured refs/heads/<branch>.
func TestUploadPushesToConfiguredBranch(t *testing.T) {
	rootDir := t.TempDir()
	remotePath := filepath.Join(rootDir, "remote.git")
	repoPath := filepath.Join(rootDir, "repo")
	stagePath := filepath.Join(rootDir, "stage")
	const branch = "develop"

	if _, err := gogit.PlainInit(remotePath, true); err != nil {
		t.Fatalf("init remote repo: %v", err)
	}
	if err := os.MkdirAll(stagePath, 0755); err != nil {
		t.Fatalf("create stage dir: %v", err)
	}
	if err := os.WriteFile(filepath.Join(stagePath, "manifest.json"), []byte("{\"version\":1}\n"), 0644); err != nil {
		t.Fatalf("write stage manifest: %v", err)
	}

	backendInstance, err := New(Config{
		RepoPath:    repoPath,
		RepoURL:     remotePath,
		Branch:      branch,
		RemoteName:  "origin",
		AuthorName:  "voidraft",
		AuthorEmail: "sync@voidraft.app",
	})
	if err != nil {
		t.Fatalf("new backend: %v", err)
	}

	if _, err := backendInstance.Upload(context.Background(), stagePath, backend.PublishOptions{
		Message: "initial sync",
	}); err != nil {
		t.Fatalf("upload: %v", err)
	}

	remoteRepo, err := gogit.PlainOpen(remotePath)
	if err != nil {
		t.Fatalf("open remote repo: %v", err)
	}

	ref, err := remoteRepo.Reference(plumbing.NewBranchReferenceName(branch), true)
	if err != nil {
		t.Fatalf("read remote branch ref: %v", err)
	}
	if ref.Hash().IsZero() {
		t.Fatal("remote branch ref hash is zero")
	}

	if _, err := remoteRepo.Reference(plumbing.NewRemoteReferenceName("origin", branch), true); err == nil {
		t.Fatal("unexpected remote-tracking ref created on remote repository")
	} else if !errors.Is(err, plumbing.ErrReferenceNotFound) {
		t.Fatalf("read remote-tracking ref: %v", err)
	}
}
