import { ref, onUnmounted, reactive, computed, watch, nextTick } from 'vue';

// 基础WebSocket消息接口
interface WebSocketMessage<T = any> {
  type: string;
  data: T;
}

// 迁移进度接口（与后端保持一致）
interface MigrationProgress {
  status: 'migrating' | 'completed' | 'failed';
  progress: number; // 0-100
  error?: string;
}

// 连接状态枚举
enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error'
}

// WebSocket配置选项
interface WebSocketOptions {
  url?: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  debug?: boolean;
  autoConnect?: boolean;
  protocols?: string | string[];
  heartbeat?: {
    enabled: boolean;
    interval: number;
    message: string;
  };
}

// 消息处理器类型
type MessageHandler<T = any> = (data: T) => void;

// 事件处理器映射
interface EventHandlers {
  [messageType: string]: MessageHandler[];
}

// 连接事件类型
type ConnectionEventType = 'connect' | 'disconnect' | 'error' | 'reconnect';
type ConnectionEventHandler = (event?: Event | CloseEvent | ErrorEvent) => void;

export function useWebSocket(options: WebSocketOptions = {}) {
  const {
    url = 'ws://localhost:8899/ws/migration',
    reconnectInterval = 3000,
    maxReconnectAttempts = 10,
    debug = false,
    autoConnect = true,
    protocols,
    heartbeat = { enabled: false, interval: 30000, message: 'ping' }
  } = options;

  // === 状态管理 ===
  const connectionState = ref<ConnectionState>(ConnectionState.DISCONNECTED);
  const connectionError = ref<string | null>(null);
  const reconnectAttempts = ref(0);
  const lastMessage = ref<WebSocketMessage | null>(null);
  const messageHistory = ref<WebSocketMessage[]>([]);

  // 迁移进度状态（保持向后兼容）
  const migrationProgress = reactive<MigrationProgress>({
    status: 'completed',
    progress: 0
  });

  // === 计算属性 ===
  const isConnected = computed(() => connectionState.value === ConnectionState.CONNECTED);
  const isConnecting = computed(() => 
    connectionState.value === ConnectionState.CONNECTING || 
    connectionState.value === ConnectionState.RECONNECTING
  );
  const canReconnect = computed(() => reconnectAttempts.value < maxReconnectAttempts);

  // === 内部状态 ===
  let ws: WebSocket | null = null;
  let reconnectTimer: number | null = null;
  let heartbeatTimer: number | null = null;
  let isManualDisconnect = false;

  // 事件处理器
  const eventHandlers: EventHandlers = {};
  const connectionEventHandlers: Map<ConnectionEventType, ConnectionEventHandler[]> = new Map();

  // === 工具函数 ===
  const log = (level: 'info' | 'warn' | 'error', message: string, ...args: any[]) => {
    if (debug) {
      console[level](`[WebSocket] ${message}`, ...args);
    }
  };

  const clearTimers = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  };

  const updateConnectionState = (newState: ConnectionState, error?: string) => {
    connectionState.value = newState;
    connectionError.value = error || null;
    log('info', `Connection state changed to: ${newState}`, error);
  };

  // === 事件系统 ===
  const on = <T = any>(messageType: string, handler: MessageHandler<T>) => {
    if (!eventHandlers[messageType]) {
      eventHandlers[messageType] = [];
    }
    eventHandlers[messageType].push(handler as MessageHandler);

    // 返回取消订阅函数
    return () => off(messageType, handler);
  };

  const off = <T = any>(messageType: string, handler: MessageHandler<T>) => {
    if (eventHandlers[messageType]) {
      const index = eventHandlers[messageType].indexOf(handler as MessageHandler);
      if (index > -1) {
        eventHandlers[messageType].splice(index, 1);
      }
    }
  };

  const onConnection = (eventType: ConnectionEventType, handler: ConnectionEventHandler) => {
    if (!connectionEventHandlers.has(eventType)) {
      connectionEventHandlers.set(eventType, []);
    }
    connectionEventHandlers.get(eventType)!.push(handler);

    return () => offConnection(eventType, handler);
  };

  const offConnection = (eventType: ConnectionEventType, handler: ConnectionEventHandler) => {
    const handlers = connectionEventHandlers.get(eventType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  };

  const emit = (eventType: ConnectionEventType, event?: Event | CloseEvent | ErrorEvent) => {
    const handlers = connectionEventHandlers.get(eventType);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(event);
        } catch (error) {
          log('error', `Error in ${eventType} event handler:`, error);
        }
      });
    }
  };

  // === 消息处理 ===
  const handleMessage = (event: MessageEvent) => {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);
      log('info', 'Received message:', message);

      // 更新消息历史
      lastMessage.value = message;
      messageHistory.value.push(message);
      
      // 限制历史记录长度
      if (messageHistory.value.length > 100) {
        messageHistory.value.shift();
      }

      // 特殊处理迁移进度消息（保持向后兼容）
      if (message.type === 'migration_progress') {
        Object.assign(migrationProgress, message.data);
      }

      // 触发注册的处理器
      const handlers = eventHandlers[message.type];
      if (handlers) {
        handlers.forEach(handler => {
          try {
            handler(message.data);
          } catch (error) {
            log('error', `Error in message handler for ${message.type}:`, error);
          }
        });
      }
    } catch (error) {
      log('error', 'Failed to parse message:', error, event.data);
    }
  };

  // === 心跳机制 ===
  const startHeartbeat = () => {
    if (!heartbeat.enabled || heartbeatTimer) return;

    heartbeatTimer = window.setInterval(() => {
      if (isConnected.value) {
        send(heartbeat.message);
      }
    }, heartbeat.interval);
  };

  const stopHeartbeat = () => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  };

  // === 连接管理 ===
  const connect = async (): Promise<void> => {
    if (isConnecting.value || isConnected.value) {
      log('warn', 'Already connecting or connected');
      return;
    }

    updateConnectionState(ConnectionState.CONNECTING);
    isManualDisconnect = false;

    try {
      log('info', 'Connecting to:', url);
      
      ws = new WebSocket(url, protocols);

      // 连接超时处理
      const connectTimeout = setTimeout(() => {
        if (ws && ws.readyState === WebSocket.CONNECTING) {
          ws.close();
          updateConnectionState(ConnectionState.ERROR, 'Connection timeout');
        }
      }, 10000);

      ws.onopen = () => {
        clearTimeout(connectTimeout);
        log('info', 'Connected successfully');
        updateConnectionState(ConnectionState.CONNECTED);
        reconnectAttempts.value = 0;
        clearTimers();
        startHeartbeat();
        emit('connect');
      };

      ws.onmessage = handleMessage;

      ws.onclose = (event) => {
        clearTimeout(connectTimeout);
        stopHeartbeat();
        log('info', 'Connection closed:', event.code, event.reason);
        
        const wasConnected = connectionState.value === ConnectionState.CONNECTED;
        updateConnectionState(ConnectionState.DISCONNECTED);
        ws = null;

        emit('disconnect', event);

        // 自动重连逻辑
        if (!isManualDisconnect && event.code !== 1000 && canReconnect.value) {
          scheduleReconnect();
        } else if (reconnectAttempts.value >= maxReconnectAttempts) {
          updateConnectionState(ConnectionState.ERROR, 'Max reconnection attempts reached');
        }
      };

      ws.onerror = (event) => {
        clearTimeout(connectTimeout);
        log('error', 'Connection error:', event);
        updateConnectionState(ConnectionState.ERROR, 'WebSocket connection error');
        emit('error', event);
      };

    } catch (error) {
      log('error', 'Failed to create WebSocket:', error);
      updateConnectionState(ConnectionState.ERROR, 'Failed to create WebSocket connection');
    }
  };

  const disconnect = (code: number = 1000, reason: string = 'Manual disconnect') => {
    isManualDisconnect = true;
    clearTimers();
    stopHeartbeat();
    
    if (ws) {
      log('info', 'Disconnecting manually');
      ws.close(code, reason);
    }
    
    updateConnectionState(ConnectionState.DISCONNECTED);
  };

  const scheduleReconnect = () => {
    if (!canReconnect.value || isManualDisconnect) return;

    clearTimers();
    reconnectAttempts.value++;
    updateConnectionState(ConnectionState.RECONNECTING, 
      `Reconnecting... (${reconnectAttempts.value}/${maxReconnectAttempts})`);
    
    log('info', `Scheduling reconnect attempt ${reconnectAttempts.value}/${maxReconnectAttempts} in ${reconnectInterval}ms`);
    
    reconnectTimer = window.setTimeout(() => {
      connect();
    }, reconnectInterval);

    emit('reconnect');
  };

  const reconnect = () => {
    disconnect();
    reconnectAttempts.value = 0;
    nextTick(() => {
      connect();
    });
  };

  // === 消息发送 ===
  const send = (message: any): boolean => {
    if (!isConnected.value || !ws) {
      log('warn', 'Cannot send message: not connected');
      return false;
    }

      try {
        const data = typeof message === 'string' ? message : JSON.stringify(message);
        ws.send(data);
      log('info', 'Sent message:', data);
      return true;
      } catch (error) {
      log('error', 'Failed to send message:', error);
      return false;
    }
  };

  const sendMessage = <T = any>(type: string, data?: T): boolean => {
    return send({ type, data });
  };

  // === 状态查询 ===
  const getConnectionInfo = () => ({
    state: connectionState.value,
    error: connectionError.value,
    reconnectAttempts: reconnectAttempts.value,
    maxReconnectAttempts,
    canReconnect: canReconnect.value,
    url,
    readyState: ws?.readyState,
    protocol: ws?.protocol,
    extensions: ws?.extensions
  });

  // === 初始化 ===
  if (autoConnect) {
    nextTick(() => {
    connect();
    });
  }

  // === 清理 ===
  onUnmounted(() => {
    disconnect();
  });

  // 监听连接状态变化，用于调试
  if (debug) {
    watch(connectionState, (newState, oldState) => {
      log('info', `State transition: ${oldState} -> ${newState}`);
    });
  }

  return {
    // === 状态（只读） ===
    connectionState: computed(() => connectionState.value),
    isConnected,
    isConnecting,
    connectionError: computed(() => connectionError.value),
    reconnectAttempts: computed(() => reconnectAttempts.value),
    canReconnect,
    lastMessage: computed(() => lastMessage.value),
    messageHistory: computed(() => messageHistory.value),
    
    // === 向后兼容的状态 ===
    migrationProgress,
    
    // === 连接控制 ===
    connect,
    disconnect,
    reconnect,
    
    // === 消息发送 ===
    send,
    sendMessage,
    
    // === 事件系统 ===
    on,
    off,
    onConnection,
    offConnection,
    
    // === 工具方法 ===
    getConnectionInfo,
    clearHistory: () => {
      messageHistory.value = [];
      lastMessage.value = null;
    }
  };
}

// 导出类型
export type { WebSocketMessage, MigrationProgress, WebSocketOptions, MessageHandler, ConnectionEventType };
export { ConnectionState }; 