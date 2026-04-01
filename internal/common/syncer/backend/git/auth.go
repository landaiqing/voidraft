package git

import (
	"errors"
	"fmt"

	"github.com/go-git/go-git/v5/plumbing/transport"
	"github.com/go-git/go-git/v5/plumbing/transport/http"
	"github.com/go-git/go-git/v5/plumbing/transport/ssh"
)

// AuthConfig 描述 Git 鉴权方式。
type AuthConfig struct {
	Method         string
	Username       string
	Password       string
	Token          string
	SSHKeyPath     string
	SSHKeyPassword string
}

const (
	// AuthMethodToken 使用 Token 鉴权。
	AuthMethodToken = "token"
	// AuthMethodSSHKey 使用 SSH Key 鉴权。
	AuthMethodSSHKey = "ssh_key"
	// AuthMethodUserPass 使用用户名密码鉴权。
	AuthMethodUserPass = "user_pass"
)

// authMethod 根据配置构造 go-git 鉴权实例。
func authMethod(config AuthConfig) (transport.AuthMethod, error) {
	switch config.Method {
	case AuthMethodToken:
		if config.Token == "" {
			return nil, errors.New("git token is required")
		}
		return &http.BasicAuth{
			Username: "git",
			Password: config.Token,
		}, nil
	case AuthMethodUserPass:
		if config.Username == "" || config.Password == "" {
			return nil, errors.New("git username and password are required")
		}
		return &http.BasicAuth{
			Username: config.Username,
			Password: config.Password,
		}, nil
	case AuthMethodSSHKey:
		if config.SSHKeyPath == "" {
			return nil, errors.New("git ssh key path is required")
		}
		return ssh.NewPublicKeysFromFile("git", config.SSHKeyPath, config.SSHKeyPassword)
	case "":
		return nil, nil
	default:
		return nil, fmt.Errorf("unsupported git auth method: %s", config.Method)
	}
}
