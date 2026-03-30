package git

import (
	"testing"

	"github.com/go-git/go-git/v5/plumbing"
)

// TestResolveBranchNamePrefersRemoteHead verifies symbolic HEAD wins first.
func TestResolveBranchNamePrefersRemoteHead(t *testing.T) {
	refs := []*plumbing.Reference{
		plumbing.NewSymbolicReference(plumbing.HEAD, plumbing.NewBranchReferenceName("main")),
		plumbing.NewHashReference(plumbing.NewBranchReferenceName("main"), plumbing.NewHash("1111111111111111111111111111111111111111")),
		plumbing.NewHashReference(plumbing.NewBranchReferenceName("master"), plumbing.NewHash("2222222222222222222222222222222222222222")),
	}

	if got := resolveBranchName(refs); got != "main" {
		t.Fatalf("expected main, got %s", got)
	}
}

// TestResolveBranchNameFallsBackToMain verifies main beats master when HEAD is unavailable.
func TestResolveBranchNameFallsBackToMain(t *testing.T) {
	refs := []*plumbing.Reference{
		plumbing.NewHashReference(plumbing.NewBranchReferenceName("master"), plumbing.NewHash("1111111111111111111111111111111111111111")),
		plumbing.NewHashReference(plumbing.NewBranchReferenceName("main"), plumbing.NewHash("2222222222222222222222222222222222222222")),
	}

	if got := resolveBranchName(refs); got != "main" {
		t.Fatalf("expected main, got %s", got)
	}
}

// TestResolveBranchNameUsesHeadHash verifies HEAD hash matching can recover the default branch.
func TestResolveBranchNameUsesHeadHash(t *testing.T) {
	headHash := plumbing.NewHash("3333333333333333333333333333333333333333")
	refs := []*plumbing.Reference{
		plumbing.NewHashReference(plumbing.HEAD, headHash),
		plumbing.NewHashReference(plumbing.NewBranchReferenceName("develop"), headHash),
		plumbing.NewHashReference(plumbing.NewBranchReferenceName("main"), plumbing.NewHash("4444444444444444444444444444444444444444")),
	}

	if got := resolveBranchName(refs); got != "develop" {
		t.Fatalf("expected develop, got %s", got)
	}
}
