package services

import "testing"

func TestMediaReferenceServiceCollectReferencesNormalizesManagedMediaPath(t *testing.T) {
	service := NewMediaReferenceService()
	content := `x <∞img;id=a;asset=asset-1;file=/media/images/2026/04/08/test.png?v=123#frag;w=10;h=20∞> y`

	refs := service.CollectReferences(content)
	ref, exists := refs["image:asset:asset-1"]
	if !exists {
		t.Fatal("expected asset reference to be collected")
	}
	if ref.Path != "images/2026/04/08/test.png" {
		t.Fatalf("expected normalized path, got %q", ref.Path)
	}
}

func TestMediaReferenceServiceDiffRemovedReferencesIgnoresFileVersionChangesWhenAssetIsStable(t *testing.T) {
	service := NewMediaReferenceService()
	previous := `<∞img;id=a;asset=asset-1;file=/media/images/2026/04/08/test.png?v=123;w=10;h=20∞>`
	next := `<∞img;id=a;asset=asset-1;file=/media/images/2026/04/08/test.png?v=456;w=10;h=20∞>`

	removed := service.DiffRemovedReferences(previous, next)
	if len(removed) != 0 {
		t.Fatalf("expected no removed references, got %d", len(removed))
	}
}
