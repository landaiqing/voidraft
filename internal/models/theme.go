package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
)

// ThemeType 主题类型枚举
type ThemeType string

const (
	ThemeTypeDark  ThemeType = "dark"
	ThemeTypeLight ThemeType = "light"
)

// ThemeColorConfig 使用与前端 ThemeColors 相同的结构，存储任意主题键值
type ThemeColorConfig map[string]interface{}

// Value 实现 driver.Valuer 接口，用于将 ThemeColorConfig 存储到数据库
func (tc ThemeColorConfig) Value() (driver.Value, error) {
	if tc == nil {
		return json.Marshal(map[string]interface{}{})
	}
	return json.Marshal(tc)
}

// Scan 实现 sql.Scanner 接口，用于从数据库读取 ThemeColorConfig
func (tc *ThemeColorConfig) Scan(value interface{}) error {
	if value == nil {
		*tc = ThemeColorConfig{}
		return nil
	}

	var bytes []byte
	switch v := value.(type) {
	case []byte:
		bytes = v
	case string:
		bytes = []byte(v)
	default:
		return fmt.Errorf("cannot scan %T into ThemeColorConfig", value)
	}

	var data map[string]interface{}
	if err := json.Unmarshal(bytes, &data); err != nil {
		return err
	}

	*tc = data
	return nil
}

// Theme 主题数据库模型
type Theme struct {
	ID        int              `db:"id" json:"id"`
	Name      string           `db:"name" json:"name"`
	Type      ThemeType        `db:"type" json:"type"`
	Colors    ThemeColorConfig `db:"colors" json:"colors"`
	IsDefault bool             `db:"is_default" json:"isDefault"`
	CreatedAt string           `db:"created_at" json:"createdAt"`
	UpdatedAt string           `db:"updated_at" json:"updatedAt"`
}
