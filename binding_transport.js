const wsURL = __WAILS_WS_URL__;
const reconnectDelay = 2000;
const connectAttemptTimeout = 3000;
const connectRetryWindow = 10000;
const requestTimeout = 30000;

function generateID() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function resolveWindowName(windowName) {
  if (windowName) {
    return windowName;
  }

  return new URLSearchParams(window.location.search).get("windowName") || "";
}

function resolveClientID() {
  return window._wails?.clientId || "";
}

function sleep(delay) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, delay);
  });
}

function toError(error, fallbackMessage) {
  if (error instanceof Error) {
    return error;
  }

  return new Error(fallbackMessage);
}

class WebSocketTransport {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.connectPromise = null;
    this.pendingRequests = new Map();
    this.reconnectTimer = null;
    this.closed = false;
  }

  async connect() {
    if (this.closed) {
      throw new Error("WebSocket transport is closed");
    }

    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    if (this.connectPromise) {
      return this.connectPromise;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    const connectPromise = this.connectWithRetry();
    this.connectPromise = connectPromise;

    try {
      await connectPromise;
    } finally {
      if (this.connectPromise === connectPromise) {
        this.connectPromise = null;
      }
    }
  }

  async connectWithRetry() {
    const deadline = Date.now() + connectRetryWindow;
    let lastError = new Error("WebSocket transport connection failed");

    while (!this.closed) {
      try {
        await this.openOnce();
        return;
      } catch (error) {
        lastError = toError(error, "WebSocket transport connection failed");
        if (Date.now() >= deadline) {
          break;
        }

        await sleep(200);
      }
    }

    throw lastError;
  }

  openOnce() {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.url);
      let opened = false;
      let settled = false;

      const finish = (callback) => {
        if (settled) {
          return;
        }

        settled = true;
        callback();
      };

      const timeout = window.setTimeout(() => {
        finish(() => {
          try {
            ws.close();
          } catch {
            // Ignore close errors after connect timeout.
          }

          reject(
            new Error(
              `WebSocket transport connection timed out after ${connectAttemptTimeout}ms`,
            ),
          );
        });
      }, connectAttemptTimeout);

      ws.onopen = () => {
        finish(() => {
          window.clearTimeout(timeout);
          this.ws = ws;
          opened = true;
          resolve();
        });
      };

      ws.onmessage = async (event) => {
        const payload =
          typeof event.data === "string" ? event.data : await event.data.text();
        this.handleMessage(payload);
      };

      ws.onerror = () => {
        if (!opened) {
          finish(() => {
            window.clearTimeout(timeout);
            reject(new Error("WebSocket transport connection failed"));
          });
        }
      };

      ws.onclose = () => {
        const isCurrentSocket = this.ws === ws;
        if (isCurrentSocket) {
          this.ws = null;
        }

        if (!opened) {
          finish(() => {
            window.clearTimeout(timeout);
            reject(
              new Error("WebSocket transport connection closed before opening"),
            );
          });
          return;
        }

        if (!isCurrentSocket) {
          return;
        }

        this.rejectPendingRequests(new Error("WebSocket connection closed"));
        this.scheduleReconnect();
      };
    });
  }

  async call(objectID, method, windowName, args) {
    await this.connect();

    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket transport is not connected");
    }

    return new Promise((resolve, reject) => {
      const id = generateID();
      const timeout = window.setTimeout(() => {
        if (!this.pendingRequests.has(id)) {
          return;
        }

        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout (${requestTimeout}ms)`));
      }, requestTimeout);

      this.pendingRequests.set(id, { resolve, reject, timeout });

      try {
        ws.send(
          JSON.stringify({
            id,
            type: "request",
            request: {
              object: objectID,
              method,
              args: args ?? undefined,
              webviewWindowName: resolveWindowName(windowName) || undefined,
              clientId: resolveClientID() || undefined,
            },
          }),
        );
      } catch (error) {
        this.pendingRequests.delete(id);
        window.clearTimeout(timeout);
        reject(toError(error, "WebSocket send failed"));
      }
    });
  }

  handleMessage(raw) {
    let message;

    try {
      message = JSON.parse(raw);
    } catch (error) {
      console.error(
        "[bindingTransport] Failed to parse websocket message",
        error,
      );
      return;
    }

    if (message.type === "event") {
      window._wails?.dispatchWailsEvent?.(message.event);
      return;
    }

    if (message.type !== "response" || !message.id) {
      return;
    }

    const pending = this.pendingRequests.get(message.id);
    if (!pending) {
      return;
    }

    this.pendingRequests.delete(message.id);
    window.clearTimeout(pending.timeout);

    if (
      message.response?.statusCode >= 200 &&
      message.response.statusCode < 300
    ) {
      pending.resolve(message.response.data);
      return;
    }

    pending.reject(
      new Error(message.response?.error || "WebSocket runtime call failed"),
    );
  }

  rejectPendingRequests(error) {
    this.pendingRequests.forEach((pending) => {
      window.clearTimeout(pending.timeout);
      pending.reject(error);
    });
    this.pendingRequests.clear();
  }

  scheduleReconnect() {
    if (
      this.closed ||
      this.reconnectTimer ||
      this.connectPromise ||
      this.ws?.readyState === WebSocket.OPEN
    ) {
      return;
    }

    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect().catch(() => {
        this.scheduleReconnect();
      });
    }, reconnectDelay);
  }

  close() {
    this.closed = true;

    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    const ws = this.ws;
    this.ws = null;

    if (ws && ws.readyState < WebSocket.CLOSING) {
      ws.close();
    }

    this.rejectPendingRequests(new Error("WebSocket transport closed"));
  }
}

const transport = new WebSocketTransport(wsURL);

window.addEventListener(
  "beforeunload",
  () => {
    transport.close();
  },
  { once: true },
);

void transport.connect().catch(() => {
  // The next runtime call will retry the connection.
});

export default transport;
