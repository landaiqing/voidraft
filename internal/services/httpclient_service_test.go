package services

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/wailsapp/wails/v3/pkg/services/log"
)

func TestHttpClientService_SetRequestBody(t *testing.T) {
	logger := log.New()
	service := NewHttpClientService(logger)

	tests := []struct {
		name        string
		request     *HttpRequest
		expectError bool
		errorMsg    string
	}{
		{
			name: "JSON 请求",
			request: &HttpRequest{
				Method:   "POST",
				URL:      "https://api.example.com/json",
				BodyType: "json",
				Body: map[string]interface{}{
					"name": "张三",
					"age":  25,
				},
			},
			expectError: false,
		},
		{
			name: "XML 请求 - 正确格式",
			request: &HttpRequest{
				Method:   "POST",
				URL:      "https://api.example.com/xml",
				BodyType: "xml",
				Body: map[string]interface{}{
					"xml": "<user><name>张三</name></user>",
				},
			},
			expectError: false,
		},
		{
			name: "XML 请求 - 缺少 xml 字段",
			request: &HttpRequest{
				Method:   "POST",
				URL:      "https://api.example.com/xml",
				BodyType: "xml",
				Body: map[string]interface{}{
					"data": "<user><name>张三</name></user>",
				},
			},
			expectError: true,
			errorMsg:    "xml body type requires 'xml' field",
		},
		{
			name: "HTML 请求 - 正确格式",
			request: &HttpRequest{
				Method:   "POST",
				URL:      "https://api.example.com/html",
				BodyType: "html",
				Body: map[string]interface{}{
					"html": "<div><h1>标题</h1></div>",
				},
			},
			expectError: false,
		},
		{
			name: "JavaScript 请求 - 正确格式",
			request: &HttpRequest{
				Method:   "POST",
				URL:      "https://api.example.com/js",
				BodyType: "javascript",
				Body: map[string]interface{}{
					"javascript": "function hello() { return 'world'; }",
				},
			},
			expectError: false,
		},
		{
			name: "Binary 请求 - 正确格式",
			request: &HttpRequest{
				Method:   "POST",
				URL:      "https://api.example.com/upload",
				BodyType: "binary",
				Body: map[string]interface{}{
					"binary": "@file C:/test.bin",
				},
			},
			expectError: false,
		},
		{
			name: "Binary 请求 - 错误格式（缺少 @file）",
			request: &HttpRequest{
				Method:   "POST",
				URL:      "https://api.example.com/upload",
				BodyType: "binary",
				Body: map[string]interface{}{
					"binary": "C:/test.bin",
				},
			},
			expectError: true,
			errorMsg:    "binary body requires '@file path/to/file' format",
		},
		{
			name: "Params 请求",
			request: &HttpRequest{
				Method:   "GET",
				URL:      "https://api.example.com/users",
				BodyType: "params",
				Body: map[string]interface{}{
					"page":  1,
					"size":  20,
					"query": "test",
				},
			},
			expectError: false,
		},
		{
			name: "FormData 请求",
			request: &HttpRequest{
				Method:   "POST",
				URL:      "https://api.example.com/form",
				BodyType: "formdata",
				Body: map[string]interface{}{
					"username": "admin",
					"password": "123456",
				},
			},
			expectError: false,
		},
		{
			name: "UrlEncoded 请求",
			request: &HttpRequest{
				Method:   "POST",
				URL:      "https://api.example.com/login",
				BodyType: "urlencoded",
				Body: map[string]interface{}{
					"username": "admin",
					"password": "123456",
				},
			},
			expectError: false,
		},
		{
			name: "Text 请求",
			request: &HttpRequest{
				Method:   "POST",
				URL:      "https://api.example.com/text",
				BodyType: "text",
				Body:     "纯文本内容",
			},
			expectError: false,
		},
		{
			name: "不支持的 Body 类型",
			request: &HttpRequest{
				Method:   "POST",
				URL:      "https://api.example.com/unknown",
				BodyType: "unknown",
				Body:     "test",
			},
			expectError: true,
			errorMsg:    "unsupported body type: unknown",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := service.client.R().SetContext(context.Background())
			err := service.setRequestBody(req, tt.request)

			if tt.expectError {
				assert.Error(t, err)
				if tt.errorMsg != "" {
					assert.Contains(t, err.Error(), tt.errorMsg)
				}
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestHttpClientService_FormatBytes(t *testing.T) {
	logger := log.New()
	service := NewHttpClientService(logger)

	tests := []struct {
		name     string
		bytes    int64
		expected string
	}{
		{"负数", -1, "0 B"},
		{"零字节", 0, "0 B"},
		{"小于1KB", 500, "500 B"},
		{"1KB", 1024, "1.0 KB"},
		{"1MB", 1024 * 1024, "1.0 MB"},
		{"1.5MB", 1024*1024 + 512*1024, "1.5 MB"},
		{"1GB", 1024 * 1024 * 1024, "1.0 GB"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := service.formatBytes(tt.bytes)
			assert.Equal(t, tt.expected, result)
		})
	}
}
