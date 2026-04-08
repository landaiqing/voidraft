package services

import (
	"net/url"
	"strings"
)

const (
	inlineImageMediaTagPrefix = "<∞img;"
	inlineImageMediaTagSuffix = "∞>"
	managedMediaRoutePrefix   = "media/"
	managedImagePathPrefix    = "images/"
)

type MediaReferenceKind string

const (
	MediaReferenceKindImage MediaReferenceKind = "image"
)

type MediaReference struct {
	Kind    MediaReferenceKind
	AssetID string
	Path    string
}

func (r MediaReference) key() string {
	if r.AssetID != "" {
		return string(r.Kind) + ":asset:" + r.AssetID
	}
	if r.Path != "" {
		return string(r.Kind) + ":path:" + r.Path
	}
	return ""
}

type mediaReferenceParser interface {
	Visit(content string, visitor func(MediaReference) bool)
}

type MediaReferenceService struct {
	parsers []mediaReferenceParser
}

func NewMediaReferenceService() *MediaReferenceService {
	return &MediaReferenceService{
		parsers: []mediaReferenceParser{
			inlineImageMediaReferenceParser{},
		},
	}
}

func (s *MediaReferenceService) DiffRemovedReferences(previousContent string, nextContent string) []MediaReference {
	if strings.TrimSpace(previousContent) == "" {
		return nil
	}

	previousRefs := s.CollectReferences(previousContent)
	if len(previousRefs) == 0 {
		return nil
	}

	nextRefs := s.CollectReferences(nextContent)
	removed := make([]MediaReference, 0, len(previousRefs))
	for key, ref := range previousRefs {
		if _, exists := nextRefs[key]; exists {
			continue
		}
		removed = append(removed, ref)
	}
	return removed
}

func (s *MediaReferenceService) CollectReferences(content string) map[string]MediaReference {
	refs := make(map[string]MediaReference)
	s.VisitReferences(content, func(ref MediaReference) bool {
		if key := ref.key(); key != "" {
			refs[key] = ref
		}
		return false
	})
	return refs
}

func (s *MediaReferenceService) VisitReferences(content string, visitor func(MediaReference) bool) {
	if strings.TrimSpace(content) == "" || visitor == nil {
		return
	}

	for _, parser := range s.parsers {
		parser.Visit(content, visitor)
	}
}

type inlineImageMediaReferenceParser struct{}

func (inlineImageMediaReferenceParser) Visit(content string, visitor func(MediaReference) bool) {
	if strings.TrimSpace(content) == "" || visitor == nil {
		return
	}

	searchFrom := 0
	for {
		startOffset := strings.Index(content[searchFrom:], inlineImageMediaTagPrefix)
		if startOffset < 0 {
			return
		}

		start := searchFrom + startOffset + len(inlineImageMediaTagPrefix)
		endOffset := strings.Index(content[start:], inlineImageMediaTagSuffix)
		if endOffset < 0 {
			return
		}

		end := start + endOffset
		if visitor(parseInlineImageMediaReference(content[start:end])) {
			return
		}
		searchFrom = end + len(inlineImageMediaTagSuffix)
	}
}

func parseInlineImageMediaReference(tagBody string) MediaReference {
	ref := MediaReference{Kind: MediaReferenceKindImage}
	for _, part := range strings.Split(tagBody, ";") {
		if part == "" {
			continue
		}

		key, value, found := strings.Cut(part, "=")
		if !found {
			continue
		}

		switch strings.TrimSpace(key) {
		case "asset":
			ref.AssetID = strings.TrimSpace(value)
		case "file":
			ref.Path = normalizeManagedImageReferencePath(value)
		}
	}

	return ref
}

func normalizeManagedImageReferencePath(value string) string {
	clean := strings.TrimSpace(value)
	if clean == "" {
		return ""
	}

	if parsed, err := url.Parse(clean); err == nil && parsed.Path != "" {
		clean = parsed.Path
	}

	clean = strings.SplitN(clean, "#", 2)[0]
	clean = strings.SplitN(clean, "?", 2)[0]
	clean = strings.TrimPrefix(strings.ReplaceAll(clean, `\`, "/"), "/")
	if strings.HasPrefix(clean, managedMediaRoutePrefix) {
		clean = strings.TrimPrefix(clean, managedMediaRoutePrefix)
	}
	if !strings.HasPrefix(clean, managedImagePathPrefix) {
		return ""
	}
	return clean
}
