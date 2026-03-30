import {clientId, objectNames, setTransport, type RuntimeTransport} from '@wailsio/runtime';

const runtimeURL = window.location.origin + '/wails/runtime';
const bindingWebSocketPath = '/wails/ws-bindings';

interface WebSocketRequestPayload {
  object: number;
  method: number;
  args?: any;
  windowName?: string;
  clientId: string;
}

interface WebSocketEnvelope {
  id: string;
  type: 'request' | 'response';
  request?: WebSocketRequestPayload;
  response?: {
    statusCode: number;
    data?: any;
    error?: string;
  };
}

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  timeoutId: number;
}

class BindingWebSocketTransport {
  private socket: WebSocket | null = null;
  private connectPromise: Promise<void> | null = null;
  private pendingRequests = new Map<string, PendingRequest>();
  private readonly requestTimeout = 30000;

  async call(objectID: number, method: number, windowName: string, args: any): Promise<any> {
    await this.ensureConnected();

    return new Promise((resolve, reject) => {
      const id = this.generateID();
      const timeoutId = window.setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Binding request timed out after ${this.requestTimeout}ms`));
      }, this.requestTimeout);

      this.pendingRequests.set(id, {resolve, reject, timeoutId});

      const message: WebSocketEnvelope = {
        id,
        type: 'request',
        request: {
          object: objectID,
          method,
          args: args ?? undefined,
          windowName: this.resolveWindowName(windowName),
          clientId
        }
      };

      this.socket?.send(JSON.stringify(message));
    });
  }

  private async ensureConnected(): Promise<void> {
    if (this.socket?.readyState === WebSocket.OPEN) {
      return;
    }
    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.connectPromise = new Promise<void>((resolve, reject) => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const socket = new WebSocket(`${protocol}//${window.location.host}${bindingWebSocketPath}`);

      socket.onopen = () => {
        this.socket = socket;
        this.connectPromise = null;
        resolve();
      };

      socket.onmessage = async (event) => {
        const rawData = typeof event.data === 'string' ? event.data : await event.data.text();
        this.handleMessage(rawData);
      };

      socket.onerror = () => {
        if (this.connectPromise) {
          this.connectPromise = null;
          reject(new Error('Binding WebSocket connection failed'));
        }
      };

      socket.onclose = () => {
        this.socket = null;
        this.connectPromise = null;
        this.failPendingRequests(new Error('Binding WebSocket connection closed'));
      };
    });

    return this.connectPromise;
  }

  private handleMessage(rawData: string) {
    const message = JSON.parse(rawData) as WebSocketEnvelope;
    if (message.type !== 'response' || !message.response) {
      return;
    }

    const pending = this.pendingRequests.get(message.id);
    if (!pending) {
      return;
    }

    this.pendingRequests.delete(message.id);
    window.clearTimeout(pending.timeoutId);

    if (message.response.statusCode >= 200 && message.response.statusCode < 300) {
      pending.resolve(message.response.data);
      return;
    }

    pending.reject(new Error(message.response.error || 'Binding request failed'));
  }

  private failPendingRequests(error: Error) {
    this.pendingRequests.forEach((pending) => {
      window.clearTimeout(pending.timeoutId);
      pending.reject(error);
    });
    this.pendingRequests.clear();
  }

  private resolveWindowName(windowName: string): string {
    if (windowName) {
      return windowName;
    }

    const documentId = new URLSearchParams(window.location.search).get('documentId');
    return documentId || '';
  }

  private generateID(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

class HybridTransport implements RuntimeTransport {
  private readonly bindingTransport = new BindingWebSocketTransport();

  async call(objectID: number, method: number, windowName: string, args: any): Promise<any> {
    if (objectID === objectNames.Call || objectID === objectNames.CancelCall) {
      return this.bindingTransport.call(objectID, method, windowName, args);
    }

    return this.callHTTP(objectID, method, windowName, args);
  }

  private async callHTTP(objectID: number, method: number, windowName: string, args: any): Promise<any> {
    const body: { object: number; method: number; args?: any } = {
      object: objectID,
      method
    };
    if (args !== null && args !== undefined) {
      body.args = args;
    }

    const headers: Record<string, string> = {
      'x-wails-client-id': clientId,
      'Content-Type': 'application/json'
    };
    if (windowName) {
      headers['x-wails-window-name'] = windowName;
    }

    const response = await fetch(runtimeURL, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const isJSON = response.headers.get('Content-Type')?.includes('application/json');
    return isJSON ? response.json() : response.text();
  }
}

export function setupHybridTransport() {
  setTransport(new HybridTransport());
}
