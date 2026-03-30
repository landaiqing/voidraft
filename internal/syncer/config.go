package syncer

import (
	"errors"
	"fmt"
	"strings"
	"time"
)

const (
	// DefaultRemoteName is the default Git remote name.
	DefaultRemoteName = "origin"
	// DefaultHeadKey is the default snapshot head filename.
	DefaultHeadKey = "head.json"
)

const (
	// TargetKindGit identifies the Git sync target.
	TargetKindGit = "git"
	// TargetKindLocalFS identifies the local snapshot sync target.
	TargetKindLocalFS = "localfs"
)

// Config describes the sync runtime configuration.
type Config struct {
	Targets []TargetConfig
}

// TargetConfig describes one sync target.
type TargetConfig struct {
	Kind     string
	Enabled  bool
	Schedule ScheduleConfig
	Git      *GitTargetConfig
	LocalFS  *LocalFSTargetConfig
}

// ScheduleConfig describes the auto-sync scheduler settings.
type ScheduleConfig struct {
	AutoSync bool
	Interval time.Duration
}

// GitTargetConfig describes the Git sync target configuration.
type GitTargetConfig struct {
	RepoPath    string
	RepoURL     string
	Branch      string
	RemoteName  string
	AuthorName  string
	AuthorEmail string
	Auth        GitAuthConfig
}

// GitAuthConfig describes the Git auth configuration.
type GitAuthConfig struct {
	Method         string
	Username       string
	Password       string
	Token          string
	SSHKeyPath     string
	SSHKeyPassword string
}

// LocalFSTargetConfig describes the local snapshot store configuration.
type LocalFSTargetConfig struct {
	Namespace string
	HeadKey   string
	RootPath  string
}

// Normalize returns a normalized copy of the sync configuration.
func (c Config) Normalize() Config {
	if len(c.Targets) == 0 {
		return Config{}
	}

	targets := make([]TargetConfig, 0, len(c.Targets))
	for _, target := range c.Targets {
		targets = append(targets, target.Normalize())
	}

	return Config{Targets: targets}
}

// Target returns the config for the given target kind.
func (c Config) Target(targetKind string) (TargetConfig, error) {
	for _, target := range c.Targets {
		if target.Kind == targetKind {
			return target, nil
		}
	}
	return TargetConfig{}, fmt.Errorf("%w: %s", ErrTargetNotFound, targetKind)
}

// Normalize returns a normalized copy of the target config.
func (t TargetConfig) Normalize() TargetConfig {
	target := t
	if target.Kind == "" {
		target.Kind = TargetKindGit
	}
	if target.Schedule.Interval < 0 {
		target.Schedule.Interval = 0
	}
	if target.Kind == TargetKindGit && target.Git != nil {
		gitConfig := *target.Git
		if strings.TrimSpace(gitConfig.RemoteName) == "" {
			gitConfig.RemoteName = DefaultRemoteName
		}
		target.Git = &gitConfig
	}
	if target.Kind == TargetKindLocalFS && target.LocalFS != nil {
		storeConfig := *target.LocalFS
		if strings.TrimSpace(storeConfig.Namespace) == "" {
			storeConfig.Namespace = target.Kind
		}
		if strings.TrimSpace(storeConfig.HeadKey) == "" {
			storeConfig.HeadKey = DefaultHeadKey
		}
		target.LocalFS = &storeConfig
	}
	return target
}

// Validate validates the target configuration.
func (t TargetConfig) Validate() error {
	switch t.Kind {
	case TargetKindGit:
		if t.Git == nil {
			return errors.New("git target config is required")
		}
		if strings.TrimSpace(t.Git.RepoPath) == "" {
			return errors.New("git repo path is required")
		}
	case TargetKindLocalFS:
		if t.LocalFS == nil {
			return errors.New("localfs target config is required")
		}
		if strings.TrimSpace(t.LocalFS.RootPath) == "" {
			return errors.New("localfs root path is required")
		}
	default:
		return fmt.Errorf("%w: %s", ErrUnsupportedBackend, t.Kind)
	}
	return nil
}

// Ready reports whether the target can run a sync now.
func (t TargetConfig) Ready() bool {
	if !t.Enabled {
		return false
	}

	switch t.Kind {
	case TargetKindGit:
		if t.Git == nil {
			return false
		}
		return strings.TrimSpace(t.Git.RepoPath) != "" && strings.TrimSpace(t.Git.RepoURL) != ""
	case TargetKindLocalFS:
		if t.LocalFS == nil {
			return false
		}
		return strings.TrimSpace(t.LocalFS.RootPath) != ""
	default:
		return false
	}
}
