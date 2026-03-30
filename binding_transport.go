package main

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"sync"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"
	"github.com/wailsapp/wails/v3/pkg/application"

	"voidraft/internal/services"
)

const bindingWebSocketPath = "/wails/ws-bindings"

type hybridBindingTransport struct {
	httpTransport    *application.HTTPTransport
	messageProcessor *application.MessageProcessor
	logger           *slog.Logger
	ctx              context.Context

	connections sync.Map
}

type hybridBindingMessage struct {
	ID       string                 `json:"id"`
	Type     string                 `json:"type"`
	Request  *hybridBindingRequest  `json:"request,omitempty"`
	Response *hybridBindingResponse `json:"response,omitempty"`
}

type hybridBindingRequest struct {
	Object     int             `json:"object"`
	Method     int             `json:"method"`
	Args       json.RawMessage `json:"args,omitempty"`
	WindowName string          `json:"windowName,omitempty"`
	ClientID   string          `json:"clientId,omitempty"`
}

type hybridBindingResponse struct {
	StatusCode int    `json:"statusCode"`
	Data       any    `json:"data,omitempty"`
	Error      string `json:"error,omitempty"`
}

func newHybridBindingTransport() *hybridBindingTransport {
	return &hybridBindingTransport{
		httpTransport: application.NewHTTPTransport(application.HTTPTransportWithLogger(slog.Default())),
		logger:        slog.Default(),
	}
}

func (t *hybridBindingTransport) Start(ctx context.Context, processor *application.MessageProcessor) error {
	t.ctx = ctx
	t.messageProcessor = processor
	return t.httpTransport.Start(ctx, processor)
}

func (t *hybridBindingTransport) JSClient() []byte {
	return nil
}

func (t *hybridBindingTransport) Stop() error {
	t.connections.Range(func(key, _ any) bool {
		if conn, ok := key.(*websocket.Conn); ok {
			_ = conn.Close(websocket.StatusGoingAway, "application shutting down")
		}
		t.connections.Delete(key)
		return true
	})
	return t.httpTransport.Stop()
}

func (t *hybridBindingTransport) Handler() func(next http.Handler) http.Handler {
	httpHandler := t.httpTransport.Handler()
	return func(next http.Handler) http.Handler {
		runtimeHandler := httpHandler(next)
		return http.HandlerFunc(func(rw http.ResponseWriter, req *http.Request) {
			if req.URL.Path == bindingWebSocketPath {
				t.handleBindingWebSocket(rw, req)
				return
			}
			runtimeHandler.ServeHTTP(rw, req)
		})
	}
}

func (t *hybridBindingTransport) handleBindingWebSocket(rw http.ResponseWriter, req *http.Request) {
	if t.messageProcessor == nil {
		http.Error(rw, "binding transport not ready", http.StatusServiceUnavailable)
		return
	}

	conn, err := websocket.Accept(rw, req, nil)
	if err != nil {
		t.logger.Error("failed to accept binding websocket", "error", err)
		return
	}
	conn.SetReadLimit(64 << 20)
	t.connections.Store(conn, struct{}{})

	baseCtx := t.ctx
	if baseCtx == nil {
		baseCtx = req.Context()
	}

	connCtx, cancel := context.WithCancel(baseCtx)
	outgoing := make(chan hybridBindingMessage, 16)

	go t.writeBindingMessages(connCtx, conn, outgoing, cancel)
	t.readBindingMessages(connCtx, conn, outgoing)

	cancel()
	t.connections.Delete(conn)
	_ = conn.Close(websocket.StatusNormalClosure, "")
}

func (t *hybridBindingTransport) writeBindingMessages(ctx context.Context, conn *websocket.Conn, outgoing <-chan hybridBindingMessage, cancel context.CancelFunc) {
	defer cancel()

	for {
		select {
		case <-ctx.Done():
			return
		case message, ok := <-outgoing:
			if !ok {
				return
			}

			if err := wsjson.Write(ctx, conn, message); err != nil {
				t.logger.Error("failed to write binding websocket message", "error", err)
				return
			}
		}
	}
}

func (t *hybridBindingTransport) readBindingMessages(ctx context.Context, conn *websocket.Conn, outgoing chan<- hybridBindingMessage) {
	for {
		var message hybridBindingMessage
		if err := wsjson.Read(ctx, conn, &message); err != nil {
			if websocket.CloseStatus(err) != -1 && websocket.CloseStatus(err) != websocket.StatusNormalClosure {
				t.logger.Debug("binding websocket closed", "status", websocket.CloseStatus(err))
			}
			return
		}
		if message.Type != "request" || message.Request == nil {
			continue
		}

		go t.processBindingMessage(ctx, outgoing, message)
	}
}

func (t *hybridBindingTransport) processBindingMessage(ctx context.Context, outgoing chan<- hybridBindingMessage, message hybridBindingMessage) {
	if t.messageProcessor == nil {
		t.respondBindingError(ctx, outgoing, message.ID, http.StatusServiceUnavailable, errors.New("binding transport not ready"))
		return
	}

	args := &application.Args{}
	if len(message.Request.Args) > 0 {
		if err := args.UnmarshalJSON(message.Request.Args); err != nil {
			t.respondBindingError(ctx, outgoing, message.ID, http.StatusUnprocessableEntity, err)
			return
		}
	}

	resp, err := t.messageProcessor.HandleRuntimeCallWithIDs(ctx, &application.RuntimeRequest{
		Object:            message.Request.Object,
		Method:            message.Request.Method,
		Args:              args,
		WebviewWindowName: message.Request.WindowName,
		ClientID:          message.Request.ClientID,
	})
	if err != nil {
		statusCode := http.StatusUnprocessableEntity
		if errors.Is(err, services.ErrDocumentRevisionConflict) {
			statusCode = http.StatusConflict
		}
		t.respondBindingError(ctx, outgoing, message.ID, statusCode, err)
		return
	}

	select {
	case <-ctx.Done():
	case outgoing <- hybridBindingMessage{
		ID:   message.ID,
		Type: "response",
		Response: &hybridBindingResponse{
			StatusCode: http.StatusOK,
			Data:       resp,
		},
	}:
	}
}

func (t *hybridBindingTransport) respondBindingError(ctx context.Context, outgoing chan<- hybridBindingMessage, id string, statusCode int, err error) {
	select {
	case <-ctx.Done():
	case outgoing <- hybridBindingMessage{
		ID:   id,
		Type: "response",
		Response: &hybridBindingResponse{
			StatusCode: statusCode,
			Error:      err.Error(),
		},
	}:
	}
}
