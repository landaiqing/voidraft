package syncer

import (
	"errors"
	"fmt"
	"strings"
	"time"
)

const (
	// DefaultBranch 是默认 Git 分支名。
	DefaultBranch = "master"
	// DefaultRemoteName 是默认 Git 远端名。
	DefaultRemoteName = "origin"
	// DefaultHeadKey 是默认同步头文件名。
	DefaultHeadKey = "head.json"
)

const (
	// TargetKindGit 表示 Git 同步目标。
	TargetKindGit = "git"
	// TargetKindLocalFS 表示本地文件系统同步目标。
	TargetKindLocalFS = "localfs"
)

// Config 描述整个同步系统的运行配置。
type Config struct {
	Targets []TargetConfig
}

// TargetConfig 描述单个同步目标的配置。
type TargetConfig struct {
	Kind     string
	Enabled  bool
	Schedule ScheduleConfig
	Git      *GitTargetConfig
	LocalFS  *LocalFSTargetConfig
}

// ScheduleConfig 描述自动同步调度配置。
type ScheduleConfig struct {
	AutoSync bool
	Interval time.Duration
}

// GitTargetConfig 描述 Git 同步目标配置。
type GitTargetConfig struct {
	RepoPath    string
	RepoURL     string
	Branch      string
	RemoteName  string
	AuthorName  string
	AuthorEmail string
	Auth        GitAuthConfig
}

// GitAuthConfig 描述 Git 鉴权配置。
type GitAuthConfig struct {
	Method         string
	Username       string
	Password       string
	Token          string
	SSHKeyPath     string
	SSHKeyPassword string
}

// LocalFSTargetConfig 描述本地文件系统同步目标配置。
type LocalFSTargetConfig struct {
	Namespace string
	HeadKey   string
	RootPath  string
}

// Normalize 返回带默认值的配置副本。
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

// Target 返回指定 kind 的目标配置。
func (c Config) Target(targetKind string) (TargetConfig, error) {
	for _, target := range c.Targets {
		if target.Kind == targetKind {
			return target, nil
		}
	}
	return TargetConfig{}, fmt.Errorf("%w: %s", ErrTargetNotFound, targetKind)
}

// Normalize 返回带默认值的目标配置副本。
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
		if strings.TrimSpace(gitConfig.Branch) == "" {
			gitConfig.Branch = DefaultBranch
		}
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

// Validate 校验目标配置。
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

// Ready 判断目标是否具备执行同步的必要信息。
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
