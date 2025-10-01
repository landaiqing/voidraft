/**
 * 操作信息接口
 */
interface OperationInfo {
  controller: AbortController;
  createdAt: number;
  timeout?: number;
  timeoutId?: NodeJS.Timeout;
}

/**
 * 异步操作管理器
 * 用于管理异步操作的竞态条件，确保只有最新的操作有效
 * 支持操作超时和自动清理机制
 * 
 * @template T 操作上下文的类型
 */
export class AsyncManager<T = any> {
  private operationSequence = 0;
  private pendingOperations = new Map<number, OperationInfo>();
  private currentContext: T | null = null;
  private defaultTimeout: number;

  /**
   * 创建异步操作管理器
   * 
   * @param defaultTimeout 默认超时时间（毫秒），0表示不设置超时
   */
  constructor(defaultTimeout: number = 0) {
    this.defaultTimeout = defaultTimeout;
  }

  /**
   * 生成新的操作ID
   * 
   * @returns 新的操作ID
   */
  getNextOperationId(): number {
    return ++this.operationSequence;
  }

  /**
   * 开始新的操作
   * 
   * @param context 操作上下文
   * @param options 操作选项
   * @returns 操作ID和AbortController
   */
  startOperation(
    context: T, 
    options?: { 
      excludeId?: number; 
      timeout?: number; 
    }
  ): { operationId: number; abortController: AbortController } {
    const operationId = this.getNextOperationId();
    const abortController = new AbortController();
    const timeout = options?.timeout ?? this.defaultTimeout;

    // 取消之前的操作
    this.cancelPreviousOperations(options?.excludeId);

    // 创建操作信息
    const operationInfo: OperationInfo = {
      controller: abortController,
      createdAt: Date.now(),
      timeout: timeout > 0 ? timeout : undefined
    };

    // 设置超时处理
    if (timeout > 0) {
      operationInfo.timeoutId = setTimeout(() => {
        this.cancelOperation(operationId, 'timeout');
      }, timeout);
    }

    // 设置当前上下文和操作
    this.currentContext = context;
    this.pendingOperations.set(operationId, operationInfo);

    return { operationId, abortController };
  }

  /**
   * 检查操作是否仍然有效
   * 
   * @param operationId 操作ID
   * @param context 操作上下文
   * @returns 操作是否有效
   */
  isOperationValid(operationId: number, context?: T): boolean {
    const operationInfo = this.pendingOperations.get(operationId);
    const contextValid = context === undefined || this.currentContext === context;
    
    return (
      operationInfo !== undefined &&
      !operationInfo.controller.signal.aborted &&
      contextValid
    );
  }

  /**
   * 完成操作
   * 
   * @param operationId 操作ID
   */
  completeOperation(operationId: number): void {
    const operationInfo = this.pendingOperations.get(operationId);
    if (operationInfo) {
      // 清理超时定时器
      if (operationInfo.timeoutId) {
        clearTimeout(operationInfo.timeoutId);
      }
      this.pendingOperations.delete(operationId);
    }
  }

  /**
   * 取消指定操作
   * 
   * @param operationId 操作ID
   * @param reason 取消原因
   */
  cancelOperation(operationId: number, reason?: string): void {
    const operationInfo = this.pendingOperations.get(operationId);
    if (operationInfo) {
      // 清理超时定时器
      if (operationInfo.timeoutId) {
        clearTimeout(operationInfo.timeoutId);
      }
      // 取消操作
      operationInfo.controller.abort(reason);
      this.pendingOperations.delete(operationId);
    }
  }

  /**
   * 取消之前的操作（修复并发bug）
   * 
   * @param excludeId 要排除的操作ID（不取消该操作）
   */
  cancelPreviousOperations(excludeId?: number): void {
    // 创建要取消的操作ID数组，避免在遍历时修改Map
    const operationIdsToCancel: number[] = [];
    
    for (const [operationId] of this.pendingOperations) {
      if (excludeId === undefined || operationId !== excludeId) {
        operationIdsToCancel.push(operationId);
      }
    }
    
    // 批量取消操作
    for (const operationId of operationIdsToCancel) {
      this.cancelOperation(operationId, 'superseded');
    }
  }

  /**
   * 取消所有操作
   */
  cancelAllOperations(): void {
    // 创建要取消的操作ID数组，避免在遍历时修改Map
    const operationIdsToCancel = Array.from(this.pendingOperations.keys());
    
    // 批量取消操作
    for (const operationId of operationIdsToCancel) {
      this.cancelOperation(operationId, 'cancelled');
    }
    this.currentContext = null;
  }

  /**
   * 清理过期操作（手动清理超时操作）
   * 
   * @param maxAge 最大存活时间（毫秒）
   * @returns 清理的操作数量
   */
  cleanupExpiredOperations(maxAge: number): number {
    const now = Date.now();
    const expiredOperationIds: number[] = [];
    
    for (const [operationId, operationInfo] of this.pendingOperations) {
      if (now - operationInfo.createdAt > maxAge) {
        expiredOperationIds.push(operationId);
      }
    }
    
    // 批量取消过期操作
    for (const operationId of expiredOperationIds) {
      this.cancelOperation(operationId, 'expired');
    }
    
    return expiredOperationIds.length;
  }

  /**
   * 获取操作统计信息
   * 
   * @returns 操作统计信息
   */
  getOperationStats(): {
    total: number;
    withTimeout: number;
    averageAge: number;
    oldestAge: number;
  } {
    const now = Date.now();
    let withTimeout = 0;
    let totalAge = 0;
    let oldestAge = 0;
    
    for (const operationInfo of this.pendingOperations.values()) {
      const age = now - operationInfo.createdAt;
      totalAge += age;
      oldestAge = Math.max(oldestAge, age);
      
      if (operationInfo.timeout) {
        withTimeout++;
      }
    }
    
    return {
      total: this.pendingOperations.size,
      withTimeout,
      averageAge: this.pendingOperations.size > 0 ? totalAge / this.pendingOperations.size : 0,
      oldestAge
    };
  }

  /**
   * 获取当前上下文
   * 
   * @returns 当前上下文
   */
  getCurrentContext(): T | null {
    return this.currentContext;
  }

  /**
   * 设置当前上下文
   * 
   * @param context 新的上下文
   */
  setCurrentContext(context: T | null): void {
    this.currentContext = context;
  }

  /**
   * 获取待处理操作数量
   * 
   * @returns 待处理操作数量
   */
  get pendingCount(): number {
    return this.pendingOperations.size;
  }

  /**
   * 检查是否有待处理的操作
   * 
   * @returns 是否有待处理的操作
   */
  hasPendingOperations(): boolean {
    return this.pendingOperations.size > 0;
  }
}