package services

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"voidraft/internal/models/ent"
	"voidraft/internal/models/ent/migrate"
	_ "voidraft/internal/models/ent/runtime"

	"entgo.io/ent/dialect"
	entsql "entgo.io/ent/dialect/sql"
	_ "github.com/mattn/go-sqlite3"
	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/services/log"
)

const (
	dbName       = "voidraft.db"
	maxIdleConns = 10
	maxOpenConns = 100
	connMaxLife  = time.Hour
)

// DatabaseService 数据库服务
type DatabaseService struct {
	configService *ConfigService
	logger        *log.LogService
	Client        *ent.Client
	db            *sql.DB
}

// NewDatabaseService 创建数据库服务
func NewDatabaseService(configService *ConfigService, logger *log.LogService) *DatabaseService {
	if logger == nil {
		logger = log.New()
	}
	return &DatabaseService{
		configService: configService,
		logger:        logger,
	}
}

// ServiceStartup 服务启动
func (s *DatabaseService) ServiceStartup(ctx context.Context, options application.ServiceOptions) error {
	dbPath, err := s.getBasePath()
	if err != nil {
		return fmt.Errorf("get database path error: %w", err)
	}

	if err := os.MkdirAll(filepath.Dir(dbPath), 0755); err != nil {
		return fmt.Errorf("create database directory error: %w", err)
	}

	// _fk=1 启用外键，_journal_mode=WAL 启用 WAL 模式
	dsn := fmt.Sprintf("file:%s?_fk=1&_journal_mode=WAL&_synchronous=NORMAL&_busy_timeout=5000", dbPath)
	s.db, err = sql.Open("sqlite3", dsn)
	if err != nil {
		return fmt.Errorf("open database error: %w", err)
	}

	// 连接池配置
	s.db.SetMaxIdleConns(maxIdleConns)
	s.db.SetMaxOpenConns(maxOpenConns)
	s.db.SetConnMaxLifetime(connMaxLife)

	// 创建 ent 客户端
	drv := entsql.OpenDB(dialect.SQLite, s.db)
	s.Client = ent.NewClient(ent.Driver(drv))

	// 自动迁移
	if err := s.Client.Schema.Create(ctx,
		migrate.WithDropColumn(true),
		migrate.WithDropIndex(true),
	); err != nil {
		return fmt.Errorf("schema migration error: %w", err)
	}

	return nil
}

func (s *DatabaseService) getBasePath() (string, error) {
	config, err := s.configService.GetConfig()
	if err != nil {
		return "", err
	}
	return filepath.Join(config.General.DataPath, dbName), nil
}

// ServiceShutdown 服务关闭
func (s *DatabaseService) ServiceShutdown() error {
	if s.Client != nil {
		if err := s.Client.Close(); err != nil {
			return err
		}
	}
	if s.db != nil {
		return s.db.Close()
	}
	return nil
}
