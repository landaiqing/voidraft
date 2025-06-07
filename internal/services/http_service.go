package services

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/wailsapp/wails/v3/pkg/services/log"
)

// HTTPService HTTP 服务
type HTTPService struct {
	logger    *log.LoggerService
	server    *http.Server
	wsService *WebSocketService
}

// NewHTTPService 创建 HTTP 服务
func NewHTTPService(logger *log.LoggerService, wsService *WebSocketService) *HTTPService {
	if logger == nil {
		logger = log.New()
	}

	return &HTTPService{
		logger:    logger,
		wsService: wsService,
	}
}

// StartServer 启动 HTTP 服务器
func (hs *HTTPService) StartServer(port string) error {
	// 设置 Gin 为发布模式
	gin.SetMode(gin.ReleaseMode)

	// 创建 Gin 路由器
	router := gin.New()

	// 添加中间件
	router.Use(gin.Recovery())
	router.Use(hs.corsMiddleware())

	// 设置路由
	hs.setupRoutes(router)

	// 创建 HTTP 服务器
	hs.server = &http.Server{
		Addr:           ":" + port,
		Handler:        router,
		ReadTimeout:    30 * time.Second,
		WriteTimeout:   30 * time.Second,
		IdleTimeout:    60 * time.Second,
		MaxHeaderBytes: 1 << 20, // 1MB
	}

	hs.logger.Info("HTTP: Starting server", "port", port)

	// 启动服务器
	go func() {
		if err := hs.server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			hs.logger.Error("HTTP: Server failed to start", "error", err)
		}
	}()

	return nil
}

// setupRoutes 设置路由
func (hs *HTTPService) setupRoutes(router *gin.Engine) {
	// WebSocket 端点
	router.GET("/ws/migration", hs.handleWebSocket)

	// API 端点组
	api := router.Group("/api")
	{
		api.GET("/health", hs.handleHealth)
		api.GET("/ws/clients", hs.handleWSClients)
	}
}

// handleWebSocket 处理 WebSocket 连接
func (hs *HTTPService) handleWebSocket(c *gin.Context) {
	if hs.wsService == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "WebSocket service not available"})
		return
	}

	hs.wsService.HandleUpgrade(c.Writer, c.Request)
}

// handleHealth 健康检查端点
func (hs *HTTPService) handleHealth(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":    "ok",
		"timestamp": time.Now().Unix(),
		"service":   "voidraft-http",
	})
}

// handleWSClients 获取 WebSocket 客户端数量
func (hs *HTTPService) handleWSClients(c *gin.Context) {
	if hs.wsService == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "WebSocket service not available"})
		return
	}

	count := hs.wsService.GetConnectedClientsCount()
	c.JSON(http.StatusOK, gin.H{
		"connected_clients": count,
	})
}

// corsMiddleware CORS 中间件
func (hs *HTTPService) corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Accept, Authorization")
		c.Header("Access-Control-Allow-Credentials", "true")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}

// StopServer 停止 HTTP 服务器
func (hs *HTTPService) StopServer() error {
	if hs.server == nil {
		return nil
	}

	hs.logger.Info("HTTP: Stopping server...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	return hs.server.Shutdown(ctx)
}

// ServiceShutdown 服务关闭
func (hs *HTTPService) ServiceShutdown() error {
	hs.logger.Info("HTTP: Service is shutting down...")

	if err := hs.StopServer(); err != nil {
		hs.logger.Error("HTTP: Failed to stop server", "error", err)
		return err
	}

	hs.logger.Info("HTTP: Service shutdown completed")
	return nil
}
