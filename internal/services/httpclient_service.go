package services

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/wailsapp/wails/v3/pkg/services/log"
	"resty.dev/v3"
)

// HttpClientService HTTP客户端服务
type HttpClientService struct {
	logger *log.LogService
	client *resty.Client
}

// HttpRequest HTTP请求结构
type HttpRequest struct {
	Method   string            `json:"method"`
	URL      string            `json:"url"`
	Headers  map[string]string `json:"headers"`
	BodyType string            `json:"bodyType,omitempty"` // json, formdata, urlencoded, text, params, xml, html, javascript, binary
	Body     interface{}       `json:"body,omitempty"`
}

// HttpResponse HTTP响应结构
type HttpResponse struct {
	Status      string      `json:"status"`      // 使用resp.Status()返回完整状态如"200 OK"
	Time        int64       `json:"time"`        // 响应时间（毫秒）
	RequestSize string      `json:"requestSize"` // 请求大小
	Body        interface{} `json:"body"`
	Headers     http.Header `json:"headers"`
	Timestamp   time.Time   `json:"timestamp"`
	Error       interface{} `json:"error,omitempty"`
}

// NewHttpClientService 创建新的HTTP客户端服务实例
func NewHttpClientService(logger *log.LogService) *HttpClientService {
	client := resty.New().
		SetTimeout(30 * time.Second).
		SetRetryCount(0).
		EnableTrace().
		SetHeaders(map[string]string{
			"Access-Control-Allow-Origin":      "*",
			"Access-Control-Allow-Methods":     "*",
			"Access-Control-Allow-Headers":     "*",
			"Access-Control-Allow-Credentials": "true",
		})

	return &HttpClientService{
		logger: logger,
		client: client,
	}
}

// ExecuteRequest 执行HTTP请求
func (hcs *HttpClientService) ExecuteRequest(ctx context.Context, request *HttpRequest) (*HttpResponse, error) {
	// 创建请求
	req := hcs.client.R().SetContext(ctx)

	// 设置请求头
	if request.Headers != nil {
		req.SetHeaders(request.Headers)
	}

	// 设置请求体
	if err := hcs.setRequestBody(req, request); err != nil {
		return nil, fmt.Errorf("set request body failed: %w", err)
	}

	// 执行请求
	resp, err := req.Execute(strings.ToUpper(request.Method), request.URL)

	// 构建响应对象
	return hcs.buildResponse(resp, err)
}

// setRequestBody 设置请求体
func (hcs *HttpClientService) setRequestBody(req *resty.Request, request *HttpRequest) error {
	if request.Body == nil {
		return nil
	}

	switch strings.ToLower(request.BodyType) {
	case "json":
		req.SetHeader("Content-Type", "application/json")
		req.SetBody(request.Body)

	case "formdata":
		if formData, ok := request.Body.(map[string]interface{}); ok {
			for key, value := range formData {
				valueStr := fmt.Sprintf("%v", value)
				// 检查是否是文件类型，使用 @file 关键词
				if strings.HasPrefix(valueStr, "@file ") {
					// 提取文件路径（去掉 @file 前缀）
					filePath := strings.TrimSpace(strings.TrimPrefix(valueStr, "@file "))
					req.SetFile(key, filePath)
				} else {
					// 普通表单字段
					req.SetFormData(map[string]string{key: valueStr})
				}
			}
		}

	case "urlencoded":
		req.SetHeader("Content-Type", "application/x-www-form-urlencoded")
		if formData, ok := request.Body.(map[string]interface{}); ok {
			values := url.Values{}
			for key, value := range formData {
				values.Set(key, fmt.Sprintf("%v", value))
			}
			req.SetBody(values.Encode())
		}

	case "text":
		req.SetHeader("Content-Type", "text/plain")
		req.SetBody(fmt.Sprintf("%v", request.Body))

	case "params":
		// URL 参数：添加到查询字符串中
		if params, ok := request.Body.(map[string]interface{}); ok {
			for key, value := range params {
				req.SetQueryParam(key, fmt.Sprintf("%v", value))
			}
		}

	case "xml":
		// XML 格式：从 Body 中提取 xml 字段
		req.SetHeader("Content-Type", "application/xml")
		if bodyMap, ok := request.Body.(map[string]interface{}); ok {
			if xmlContent, exists := bodyMap["xml"]; exists {
				req.SetBody(fmt.Sprintf("%v", xmlContent))
			} else {
				return fmt.Errorf("xml body type requires 'xml' field")
			}
		} else {
			return fmt.Errorf("xml body must be an object with 'xml' field")
		}

	case "html":
		// HTML 格式：从 Body 中提取 html 字段
		req.SetHeader("Content-Type", "text/html")
		if bodyMap, ok := request.Body.(map[string]interface{}); ok {
			if htmlContent, exists := bodyMap["html"]; exists {
				req.SetBody(fmt.Sprintf("%v", htmlContent))
			} else {
				return fmt.Errorf("html body type requires 'html' field")
			}
		} else {
			return fmt.Errorf("html body must be an object with 'html' field")
		}

	case "javascript":
		// JavaScript 格式：从 Body 中提取 javascript 字段
		req.SetHeader("Content-Type", "application/javascript")
		if bodyMap, ok := request.Body.(map[string]interface{}); ok {
			if jsContent, exists := bodyMap["javascript"]; exists {
				req.SetBody(fmt.Sprintf("%v", jsContent))
			} else {
				return fmt.Errorf("javascript body type requires 'javascript' field")
			}
		} else {
			return fmt.Errorf("javascript body must be an object with 'javascript' field")
		}

	case "binary":
		// Binary 格式：从 Body 中提取 binary 字段（文件路径）
		req.SetHeader("Content-Type", "application/octet-stream")
		if bodyMap, ok := request.Body.(map[string]interface{}); ok {
			if binaryContent, exists := bodyMap["binary"]; exists {
				binaryStr := fmt.Sprintf("%v", binaryContent)
				// 检查是否是文件类型，使用 @file 关键词
				if strings.HasPrefix(binaryStr, "@file ") {
					// 提取文件路径（去掉 @file 前缀）
					filePath := strings.TrimSpace(strings.TrimPrefix(binaryStr, "@file "))
					req.SetFile("file", filePath)
				} else {
					return fmt.Errorf("binary body requires '@file path/to/file' format")
				}
			} else {
				return fmt.Errorf("binary body type requires 'binary' field")
			}
		} else {
			return fmt.Errorf("binary body must be an object with 'binary' field")
		}

	default:
		return fmt.Errorf("unsupported body type: %s", request.BodyType)
	}

	return nil
}

// buildResponse 构建响应对象
func (hcs *HttpClientService) buildResponse(resp *resty.Response, err error) (*HttpResponse, error) {
	httpResp := &HttpResponse{
		Timestamp: time.Now(),
	}

	// 如果有错误，设置错误状态并返回
	if err != nil {
		httpResp.Status = "Request Failed"
		httpResp.Error = err.Error()
		return httpResp, nil
	}

	// 设置基本响应信息
	httpResp.Status = resp.Status()
	httpResp.Time = resp.Duration().Milliseconds()
	httpResp.RequestSize = hcs.formatBytes(resp.Size())

	if errorData := resp.Error(); errorData != nil {
		httpResp.Error = errorData
	}

	// 设置响应头
	httpResp.Headers = resp.Header()
	httpResp.Body = resp.String()

	return httpResp, nil
}

// formatBytes 格式化字节大小
func (hcs *HttpClientService) formatBytes(bytes int64) string {
	if bytes < 0 {
		return "0 B"
	}

	const unit = 1024
	if bytes < unit {
		return fmt.Sprintf("%d B", bytes)
	}

	div, exp := int64(unit), 0
	for n := bytes / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}

	return fmt.Sprintf("%.1f %cB", float64(bytes)/float64(div), "KMGTPE"[exp])
}
