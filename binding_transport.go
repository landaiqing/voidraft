package main

import (
	"context"
	_ "embed"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"

	"github.com/lxzan/gws"
	"github.com/wailsapp/wails/v3/pkg/application"

	"voidraft/internal/services"
)

//go:embed binding_transport.js
var bindingTransportClientTemplate string

type bindingWebSocketTransport struct {
	gws.BuiltinEventHandler

	logger           *slog.Logger
	messageProcessor *application.MessageProcessor
	server           *http.Server
	jsClient         []byte
	upgrader         *gws.Upgrader

	clients sync.Map
}

type bindingTransportClient struct {
	conn      *gws.Conn
	ctx       context.Context
	cancel    context.CancelFunc
	closeOnce sync.Once
}

type bindingTransportMessage struct {
	ID       string                      `json:"id,omitempty"`
	Type     string                      `json:"type"`
	Request  *application.RuntimeRequest `json:"request,omitempty"`
	Response *bindingTransportResponse   `json:"response,omitempty"`
	Event    *application.CustomEvent    `json:"event,omitempty"`
}

type bindingTransportResponse struct {
	StatusCode int    `json:"statusCode"`
	Data       any    `json:"data,omitempty"`
	Error      string `json:"error,omitempty"`
}

func newBindingTransport() *bindingWebSocketTransport {
	return &bindingWebSocketTransport{
		logger: slog.Default(),
	}
}

func (t *bindingWebSocketTransport) Start(ctx context.Context, processor *application.MessageProcessor) error {
	t.messageProcessor = processor
	t.upgrader = gws.NewUpgrader(t, &gws.ServerOption{
		Recovery: gws.Recovery,
	})

	mux := http.NewServeMux()
	mux.HandleFunc("/wails/ws", t.handleWebSocket)

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return fmt.Errorf("listen websocket transport: %w", err)
	}

	wsURL := "ws://" + listener.Addr().String() + "/wails/ws"
	t.jsClient = []byte(strings.ReplaceAll(
		bindingTransportClientTemplate,
		"__WAILS_WS_URL__",
		strconv.Quote(wsURL),
	))
	t.server = &http.Server{Handler: mux}

	go func() {
		<-ctx.Done()
		if err := t.Stop(); err != nil {
			t.logger.Error("failed to stop binding websocket transport", "error", err)
		}
	}()

	go func() {
		if err := t.server.Serve(listener); err != nil && !errors.Is(err, http.ErrServerClosed) {
			t.logger.Error("binding websocket transport server stopped unexpectedly", "error", err)
		}
	}()

	t.logger.Info("binding websocket transport listening", "url", wsURL)
	return nil
}

func (t *bindingWebSocketTransport) JSClient() []byte {
	return t.jsClient
}

func (t *bindingWebSocketTransport) Stop() error {
	t.clients.Range(func(key, value any) bool {
		client, ok := value.(*bindingTransportClient)
		if ok {
			client.close()
		}
		t.clients.Delete(key)
		return true
	})

	if t.server == nil {
		return nil
	}

	return t.server.Shutdown(context.Background())
}

func (t *bindingWebSocketTransport) DispatchWailsEvent(event *application.CustomEvent) {
	payload, err := json.Marshal(bindingTransportMessage{
		Type:  "event",
		Event: event,
	})
	if err != nil {
		t.logger.Warn("failed to encode websocket event", "event", event.Name, "error", err)
		return
	}

	broadcaster := gws.NewBroadcaster(gws.OpcodeText, payload)
	defer func() {
		_ = broadcaster.Close()
	}()

	t.clients.Range(func(_ any, value any) bool {
		client, ok := value.(*bindingTransportClient)
		if !ok {
			return true
		}

		if err := broadcaster.Broadcast(client.conn); err != nil {
			t.logger.Debug("failed to broadcast websocket event", "event", event.Name, "error", err)
		}

		return true
	})
}

func (t *bindingWebSocketTransport) handleWebSocket(rw http.ResponseWriter, req *http.Request) {
	conn, err := t.upgrader.Upgrade(rw, req)
	if err != nil {
		t.logger.Error("failed to upgrade websocket connection", "error", err)
		return
	}

	go conn.ReadLoop()
}

func (t *bindingWebSocketTransport) OnOpen(socket *gws.Conn) {
	t.clients.Store(socket, newBindingTransportClient(socket))
}

func (t *bindingWebSocketTransport) OnClose(socket *gws.Conn, err error) {
	if client, ok := t.loadClient(socket); ok {
		client.close()
	}
	t.clients.Delete(socket)

	if err != nil && !errors.Is(err, net.ErrClosed) {
		t.logger.Debug("binding websocket closed", "error", err)
	}
}

func (t *bindingWebSocketTransport) OnMessage(socket *gws.Conn, message *gws.Message) {
	defer message.Close()

	body := append([]byte(nil), message.Bytes()...)

	var payload bindingTransportMessage
	if err := json.Unmarshal(body, &payload); err != nil {
		t.logger.Warn("failed to decode websocket request", "error", err)
		return
	}

	if payload.Type != "request" || payload.Request == nil {
		return
	}

	if payload.Request.Args == nil {
		payload.Request.Args = &application.Args{}
	}

	client, ok := t.loadClient(socket)
	if !ok {
		return
	}

	go t.handleRequest(client, payload.ID, payload.Request)
}

func (t *bindingWebSocketTransport) handleRequest(client *bindingTransportClient, id string, req *application.RuntimeRequest) {
	if t.messageProcessor == nil {
		t.sendResponse(client, id, nil, http.StatusServiceUnavailable, errors.New("binding transport not ready"))
		return
	}

	resp, err := t.messageProcessor.HandleRuntimeCallWithIDs(client.ctx, req)
	statusCode := http.StatusOK
	if err != nil {
		statusCode = http.StatusUnprocessableEntity
		if errors.Is(err, services.ErrDocumentRevisionConflict) {
			statusCode = http.StatusConflict
		}
	}

	t.sendResponse(client, id, resp, statusCode, err)
}

func (t *bindingWebSocketTransport) sendResponse(client *bindingTransportClient, id string, data any, statusCode int, err error) {
	response := &bindingTransportResponse{
		StatusCode: statusCode,
		Data:       data,
	}
	if err != nil {
		response.Error = err.Error()
	}

	if err := client.writeJSON(bindingTransportMessage{
		ID:       id,
		Type:     "response",
		Response: response,
	}); err != nil {
		t.logger.Debug("failed to encode websocket response", "id", id, "error", err)
	}
}

func (t *bindingWebSocketTransport) loadClient(socket *gws.Conn) (*bindingTransportClient, bool) {
	value, ok := t.clients.Load(socket)
	if !ok {
		return nil, false
	}

	client, ok := value.(*bindingTransportClient)
	return client, ok
}

func newBindingTransportClient(conn *gws.Conn) *bindingTransportClient {
	ctx, cancel := context.WithCancel(context.Background())
	return &bindingTransportClient{
		conn:   conn,
		ctx:    ctx,
		cancel: cancel,
	}
}

func (c *bindingTransportClient) close() {
	c.closeOnce.Do(func() {
		c.cancel()
		_ = c.conn.WriteClose(1001, nil)
	})
}

func (c *bindingTransportClient) writeJSON(message bindingTransportMessage) error {
	payload, err := json.Marshal(message)
	if err != nil {
		return err
	}

	return c.conn.WriteMessage(gws.OpcodeText, payload)
}
