package services

import (
	"encoding/json"
	"net/http"
	"sync"

	"github.com/lxzan/gws"
	"github.com/wailsapp/wails/v3/pkg/services/log"
)

// WebSocketService WebSocket 服务
type WebSocketService struct {
	logger    *log.LoggerService
	upgrader  *gws.Upgrader
	clients   map[*gws.Conn]bool
	clientsMu sync.RWMutex
}

// NewWebSocketService 创建 WebSocket 服务
func NewWebSocketService(logger *log.LoggerService) *WebSocketService {
	if logger == nil {
		logger = log.New()
	}

	ws := &WebSocketService{
		logger:  logger,
		clients: make(map[*gws.Conn]bool),
	}

	// 创建 WebSocket 升级器
	ws.upgrader = gws.NewUpgrader(&WebSocketHandler{service: ws}, &gws.ServerOption{
		ParallelEnabled:   true,
		Recovery:          gws.Recovery,
		PermessageDeflate: gws.PermessageDeflate{Enabled: true},
	})

	return ws
}

// WebSocketHandler WebSocket 事件处理器
type WebSocketHandler struct {
	service *WebSocketService
}

// OnOpen 连接建立时调用
func (h *WebSocketHandler) OnOpen(socket *gws.Conn) {
	h.service.logger.Info("WebSocket: Client connected")

	h.service.clientsMu.Lock()
	h.service.clients[socket] = true
	h.service.clientsMu.Unlock()
}

// OnClose 连接关闭时调用
func (h *WebSocketHandler) OnClose(socket *gws.Conn, err error) {
	h.service.logger.Info("WebSocket: Client disconnected", "error", err)

	h.service.clientsMu.Lock()
	delete(h.service.clients, socket)
	h.service.clientsMu.Unlock()
}

// OnPing 收到 Ping 时调用
func (h *WebSocketHandler) OnPing(socket *gws.Conn, payload []byte) {
	_ = socket.WritePong(nil)
}

// OnPong 收到 Pong 时调用
func (h *WebSocketHandler) OnPong(socket *gws.Conn, payload []byte) {
	// Do nothing
}

// OnMessage 收到消息时调用
func (h *WebSocketHandler) OnMessage(socket *gws.Conn, message *gws.Message) {
	defer message.Close()

	h.service.logger.Debug("WebSocket: Received message", "message", string(message.Bytes()))

}

// HandleUpgrade 处理 WebSocket 升级请求
func (ws *WebSocketService) HandleUpgrade(w http.ResponseWriter, r *http.Request) {
	socket, err := ws.upgrader.Upgrade(w, r)
	if err != nil {
		ws.logger.Error("WebSocket: Failed to upgrade connection", "error", err)
		return
	}

	// 启动读取循环（必须在 goroutine 中运行以防止阻塞）
	go func() {
		socket.ReadLoop()
	}()
}

// BroadcastMessage 广播消息给所有连接的客户端
func (ws *WebSocketService) BroadcastMessage(messageType string, data interface{}) {
	message := map[string]interface{}{
		"type": messageType,
		"data": data,
	}

	jsonData, err := json.Marshal(message)
	if err != nil {
		ws.logger.Error("WebSocket: Failed to marshal message", "error", err)
		return
	}

	ws.clientsMu.RLock()
	clients := make([]*gws.Conn, 0, len(ws.clients))
	for client := range ws.clients {
		clients = append(clients, client)
	}
	ws.clientsMu.RUnlock()

	// 使用广播器进行高效广播
	broadcaster := gws.NewBroadcaster(gws.OpcodeText, jsonData)
	defer broadcaster.Close()

	for _, client := range clients {
		if err := broadcaster.Broadcast(client); err != nil {
			ws.logger.Error("WebSocket: Failed to broadcast to client", "error", err)
			// 清理失效的连接
			ws.clientsMu.Lock()
			delete(ws.clients, client)
			ws.clientsMu.Unlock()
		}
	}

	ws.logger.Debug("WebSocket: Broadcasted message", "type", messageType, "clients", len(clients))
}

// BroadcastMigrationProgress 广播迁移进度
func (ws *WebSocketService) BroadcastMigrationProgress(progress MigrationProgress) {
	ws.BroadcastMessage("migration_progress", progress)
}

// GetConnectedClientsCount 获取连接的客户端数量
func (ws *WebSocketService) GetConnectedClientsCount() int {
	ws.clientsMu.RLock()
	defer ws.clientsMu.RUnlock()
	return len(ws.clients)
}

// ServiceShutdown 服务关闭
func (ws *WebSocketService) ServiceShutdown() error {
	ws.logger.Info("WebSocket: Service is shutting down...")

	// 关闭所有客户端连接
	ws.clientsMu.Lock()
	for client := range ws.clients {
		_ = client.WriteClose(1000, []byte("Server shutting down"))
	}
	ws.clients = make(map[*gws.Conn]bool)
	ws.clientsMu.Unlock()

	ws.logger.Info("WebSocket: Service shutdown completed")
	return nil
}
