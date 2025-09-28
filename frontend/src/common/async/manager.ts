import {
    OperationStatus,
    OperationInfo,
    AsyncOperationManagerConfig,
    OperationCallbacks,
    OperationExecutor,
    OperationResult
} from './types';

/**
 * 异步操作管理器
 * 
 * 用于控制异步操作的竞态条件，确保操作的正确性和一致性。
 * 该管理器提供了操作的生命周期管理、并发控制、超时处理等功能。
 * 
 * @class AsyncOperationManager
 * @author VoidRaft Team
 * @since 1.0.0
 * 
 * @example
 * ```typescript
 * import { AsyncOperationManager } from './manager';
 * 
 * const manager = new AsyncOperationManager({
 *   timeout: 30000,
 *   maxConcurrent: 5,
 *   debug: true
 * });
 * 
 * // 执行异步操作
 * const result = await manager.executeOperation(
 *   'document-123',
 *   async (signal, operationId) => {
 *     // 执行实际的异步操作
 *     return await saveDocument(documentData);
 *   },
 *   'save-document'
 * );
 * ```
 */
export class AsyncOperationManager {
    /** 
     * 操作序列号生成器
     * @private
     * @type {number}
     */
    private operationSequence = 0;
    
    /** 
     * 待处理操作映射表
     * @private
     * @type {Map<number, OperationInfo>}
     */
    private pendingOperations = new Map<number, OperationInfo>();
    
    /** 
     * 当前资源操作映射表
     * 记录每个资源当前正在执行的操作ID
     * @private
     * @type {Map<string | number, number>}
     */
    private currentResourceOperation = new Map<string | number, number>();
    
    /** 
     * 管理器配置
     * @private
     * @type {Required<AsyncOperationManagerConfig>}
     */
    private config: Required<AsyncOperationManagerConfig>;
    
    /** 
     * 操作回调函数集合
     * @private
     * @type {OperationCallbacks}
     */
    private callbacks: OperationCallbacks;

    /**
     * 创建异步操作管理器实例
     * 
     * @param {AsyncOperationManagerConfig} config - 管理器配置选项
     * @param {OperationCallbacks} callbacks - 操作生命周期回调函数
     * 
     * @example
     * ```typescript
     * const manager = new AsyncOperationManager(
     *   {
     *     timeout: 30000,
     *     autoCleanup: true,
     *     maxConcurrent: 10,
     *     debug: false
     *   },
     *   {
     *     onStart: (op) => console.log(`Operation ${op.id} started`),
     *     onComplete: (op) => console.log(`Operation ${op.id} completed`),
     *     onError: (op, err) => console.error(`Operation ${op.id} failed:`, err)
     *   }
     * );
     * ```
     */
    constructor(
        config: AsyncOperationManagerConfig = {},
        callbacks: OperationCallbacks = {}
    ) {
        this.config = {
            timeout: 0,
            autoCleanup: true,
            maxConcurrent: 0,
            debug: false,
            ...config
        };
        this.callbacks = callbacks;
    }

    /**
     * 生成新的操作ID
     * 
     * @private
     * @returns {number} 新的操作ID
     */
    private getNextOperationId(): number {
        return ++this.operationSequence;
    }

    /**
     * 记录调试日志
     * 
     * 仅在调试模式下输出日志信息。
     * 
     * @private
     * @param {string} message - 日志消息
     * @param {...any} args - 额外的日志参数
     */
    private log(message: string, ...args: any[]): void {
        if (this.config.debug) {
            console.log(`[AsyncOperationManager] ${message}`, ...args);
        }
    }

    /**
     * 创建操作信息对象
     * 
     * @private
     * @param {string | number} resourceId - 资源ID
     * @param {string} [type] - 操作类型标识
     * @returns {OperationInfo} 新创建的操作信息
     */
    private createOperation(
        resourceId: string | number,
        type?: string
    ): OperationInfo {
        const operation: OperationInfo = {
            id: this.getNextOperationId(),
            resourceId,
            status: OperationStatus.PENDING,
            abortController: new AbortController(),
            createdAt: Date.now(),
            type
        };

        this.log(`Created operation ${operation.id} for resource ${resourceId}`, operation);
        return operation;
    }

    /**
     * 清理已完成的操作
     * 
     * 自动从内存中移除已完成、已取消或失败的操作，释放内存资源。
     * 仅在启用自动清理配置时执行。
     * 
     * @private
     */
    private cleanupCompletedOperations(): void {
        if (!this.config.autoCleanup) return;

        const completedStatuses = [
            OperationStatus.COMPLETED,
            OperationStatus.CANCELLED,
            OperationStatus.FAILED
        ];

        for (const [id, operation] of this.pendingOperations.entries()) {
            if (completedStatuses.includes(operation.status)) {
                this.pendingOperations.delete(id);
                this.log(`Cleaned up operation ${id}`);
            }
        }
    }

    /**
     * 取消指定资源的所有操作
     * 
     * 取消指定资源上正在运行的所有操作，可以排除指定的操作ID。
     * 这对于防止竞态条件非常有用，确保同一资源上只有最新的操作在执行。
     * 
     * @public
     * @param {string | number} resourceId - 要取消操作的资源ID
     * @param {number} [excludeOperationId] - 要排除的操作ID（不会被取消）
     * 
     * @example
     * ```typescript
     * // 取消文档 'doc-123' 上的所有操作，除了操作 456
     * manager.cancelResourceOperations('doc-123', 456);
     * ```
     */
    public cancelResourceOperations(
        resourceId: string | number,
        excludeOperationId?: number
    ): void {
        this.log(`Cancelling operations for resource ${resourceId}, exclude: ${excludeOperationId}`);

        for (const [id, operation] of this.pendingOperations.entries()) {
            if (
                operation.resourceId === resourceId &&
                id !== excludeOperationId &&
                operation.status === OperationStatus.RUNNING
            ) {
                this.cancelOperation(id);
            }
        }
    }

    /**
     * 取消指定的操作
     * 
     * 通过操作ID取消正在运行的操作。只有状态为 RUNNING 的操作才能被取消。
     * 
     * @public
     * @param {number} operationId - 要取消的操作ID
     * @returns {boolean} 是否成功取消操作
     * 
     * @example
     * ```typescript
     * const cancelled = manager.cancelOperation(123);
     * if (cancelled) {
     *   console.log('Operation 123 was cancelled');
     * } else {
     *   console.log('Operation 123 could not be cancelled (not found or not running)');
     * }
     * ```
     */
    public cancelOperation(operationId: number): boolean {
        const operation = this.pendingOperations.get(operationId);
        if (!operation) return false;

        if (operation.status === OperationStatus.RUNNING) {
            operation.abortController.abort();
            operation.status = OperationStatus.CANCELLED;
            this.log(`Cancelled operation ${operationId}`);
            
            this.callbacks.onCancel?.(operation);
            this.cleanupCompletedOperations();
            return true;
        }

        return false;
    }

    /**
     * 取消所有操作
     * 
     * 取消管理器中所有正在运行的操作，并清空资源操作映射表。
     * 
     * @public
     * 
     * @example
     * ```typescript
     * // 在应用关闭或重置时取消所有操作
     * manager.cancelAllOperations();
     * ```
     */
    public cancelAllOperations(): void {
        this.log('Cancelling all operations');

        for (const [id] of this.pendingOperations.entries()) {
            this.cancelOperation(id);
        }

        this.currentResourceOperation.clear();
    }

    /**
     * 检查操作是否仍然有效
     * 
     * 验证操作是否存在、未被取消、状态为运行中，以及（如果指定了资源ID）
     * 是否为该资源的当前活跃操作。
     * 
     * @public
     * @param {number} operationId - 要检查的操作ID
     * @param {string | number} [resourceId] - 可选的资源ID，用于验证是否为当前活跃操作
     * @returns {boolean} 操作是否有效
     * 
     * @example
     * ```typescript
     * // 在长时间运行的操作中定期检查有效性
     * const saveDocument = async (signal: AbortSignal, operationId: number) => {
     *   for (let i = 0; i < 100; i++) {
     *     if (!manager.isOperationValid(operationId, 'doc-123')) {
     *       throw new Error('Operation is no longer valid');
     *     }
     *     await processChunk(i);
     *   }
     * };
     * ```
     */
    public isOperationValid(
        operationId: number,
        resourceId?: string | number
    ): boolean {
        const operation = this.pendingOperations.get(operationId);
        
        if (!operation) return false;
        if (operation.abortController.signal.aborted) return false;
        if (operation.status !== OperationStatus.RUNNING) return false;
        
        // 如果指定了资源ID，检查是否为当前资源的活跃操作
        if (resourceId !== undefined) {
            const currentOperationId = this.currentResourceOperation.get(resourceId);
            if (currentOperationId !== operationId) return false;
        }

        return true;
    }

    /**
     * 执行异步操作
     * 
     * 这是管理器的核心方法，用于执行异步操作并管理其生命周期。
     * 该方法会自动处理并发控制、竞态条件、超时管理等复杂逻辑。
     * 
     * @public
     * @template T - 操作返回值的类型
     * @param {string | number} resourceId - 操作关联的资源ID
     * @param {OperationExecutor<T>} executor - 实际执行操作的函数
     * @param {string} [operationType] - 操作类型标识，用于调试和日志
     * @returns {Promise<OperationResult<T>>} 操作执行结果
     * 
     * @throws {Error} 当达到最大并发限制时抛出错误
     * 
     * @example
     * ```typescript
     * // 执行文档保存操作
     * const result = await manager.executeOperation(
     *   'document-123',
     *   async (signal, operationId) => {
     *     // 检查操作是否被取消
     *     if (signal.aborted) {
     *       throw new Error('Operation was cancelled');
     *     }
     *     
     *     // 执行实际的保存逻辑
     *     const saved = await api.saveDocument(documentData);
     *     return saved;
     *   },
     *   'save-document'
     * );
     * 
     * if (result.success) {
     *   console.log('Document saved successfully:', result.data);
     * } else {
     *   console.error('Failed to save document:', result.error);
     * }
     * ```
     */
    public async executeOperation<T = any>(
        resourceId: string | number,
        executor: OperationExecutor<T>,
        operationType?: string
    ): Promise<OperationResult<T>> {
        // 检查并发限制
        if (this.config.maxConcurrent > 0) {
            const runningCount = Array.from(this.pendingOperations.values())
                .filter(op => op.status === OperationStatus.RUNNING).length;
            
            if (runningCount >= this.config.maxConcurrent) {
                throw new Error(`Maximum concurrent operations limit reached: ${this.config.maxConcurrent}`);
            }
        }

        const operation = this.createOperation(resourceId, operationType);
        
        try {
            // 取消同一资源的其他操作
            this.cancelResourceOperations(resourceId, operation.id);
            
            // 设置当前资源的活跃操作
            this.currentResourceOperation.set(resourceId, operation.id);
            
            // 添加到待处理操作列表
            this.pendingOperations.set(operation.id, operation);
            
            // 设置超时
            if (this.config.timeout > 0) {
                setTimeout(() => {
                    if (this.isOperationValid(operation.id)) {
                        this.cancelOperation(operation.id);
                    }
                }, this.config.timeout);
            }

            // 更新状态为运行中
            operation.status = OperationStatus.RUNNING;
            this.callbacks.onStart?.(operation);
            this.log(`Started operation ${operation.id} for resource ${resourceId}`);

            // 执行操作
            const result = await executor(operation.abortController.signal, operation.id);

            // 检查操作是否仍然有效
            if (!this.isOperationValid(operation.id, resourceId)) {
                throw new Error('Operation was cancelled');
            }

            // 操作成功完成
            operation.status = OperationStatus.COMPLETED;
            this.callbacks.onComplete?.(operation);
            this.log(`Completed operation ${operation.id}`);

            this.cleanupCompletedOperations();

            return {
                success: true,
                data: result,
                operation
            };

        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            
            if (operation.abortController.signal.aborted) {
                operation.status = OperationStatus.CANCELLED;
                this.log(`Operation ${operation.id} was cancelled`);
            } else {
                operation.status = OperationStatus.FAILED;
                this.callbacks.onError?.(operation, err);
                this.log(`Operation ${operation.id} failed:`, err.message);
            }

            this.cleanupCompletedOperations();

            return {
                success: false,
                error: err,
                operation
            };
        } finally {
            // 清理当前资源操作记录
            if (this.currentResourceOperation.get(resourceId) === operation.id) {
                this.currentResourceOperation.delete(resourceId);
            }
        }
    }

    /**
     * 获取操作信息
     * 
     * 根据操作ID获取操作的详细信息。
     * 
     * @public
     * @param {number} operationId - 操作ID
     * @returns {OperationInfo | undefined} 操作信息，如果操作不存在则返回 undefined
     * 
     * @example
     * ```typescript
     * const operation = manager.getOperation(123);
     * if (operation) {
     *   console.log(`Operation ${operation.id} status: ${operation.status}`);
     * } else {
     *   console.log('Operation not found');
     * }
     * ```
     */
    public getOperation(operationId: number): OperationInfo | undefined {
        return this.pendingOperations.get(operationId);
    }

    /**
     * 获取资源的当前操作ID
     * 
     * 获取指定资源当前正在执行的操作ID。
     * 
     * @public
     * @param {string | number} resourceId - 资源ID
     * @returns {number | undefined} 当前操作ID，如果没有正在执行的操作则返回 undefined
     * 
     * @example
     * ```typescript
     * const currentOpId = manager.getCurrentOperationId('document-123');
     * if (currentOpId) {
     *   console.log(`Document 123 is currently being processed by operation ${currentOpId}`);
     * } else {
     *   console.log('No active operation for document 123');
     * }
     * ```
     */
    public getCurrentOperationId(resourceId: string | number): number | undefined {
        return this.currentResourceOperation.get(resourceId);
    }

    /**
     * 获取所有待处理操作
     * 
     * 返回管理器中所有待处理操作的列表，包括待执行、正在执行和已完成的操作。
     * 
     * @public
     * @returns {OperationInfo[]} 所有待处理操作的数组
     * 
     * @example
     * ```typescript
     * const allOperations = manager.getPendingOperations();
     * console.log(`Total operations: ${allOperations.length}`);
     * 
     * allOperations.forEach(op => {
     *   console.log(`Operation ${op.id}: ${op.status} (${op.type || 'unknown'})`);
     * });
     * ```
     */
    public getPendingOperations(): OperationInfo[] {
        return Array.from(this.pendingOperations.values());
    }

    /**
     * 获取运行中的操作数量
     * 
     * 返回当前正在执行的操作数量，用于监控并发情况。
     * 
     * @public
     * @returns {number} 正在运行的操作数量
     * 
     * @example
     * ```typescript
     * const runningCount = manager.getRunningOperationsCount();
     * console.log(`Currently running operations: ${runningCount}`);
     * 
     * if (runningCount >= maxConcurrent) {
     *   console.warn('Approaching maximum concurrent operations limit');
     * }
     * ```
     */
    public getRunningOperationsCount(): number {
        return Array.from(this.pendingOperations.values())
            .filter(op => op.status === OperationStatus.RUNNING).length;
    }

    /**
     * 销毁管理器
     * 
     * 清理管理器的所有资源，取消所有正在运行的操作，清空所有映射表。
     * 通常在应用关闭或组件卸载时调用。
     * 
     * @public
     * 
     * @example
     * ```typescript
     * // 在组件卸载时清理资源
     * useEffect(() => {
     *   return () => {
     *     manager.destroy();
     *   };
     * }, []);
     * 
     * // 或在应用关闭时
     * window.addEventListener('beforeunload', () => {
     *   manager.destroy();
     * });
     * ```
     */
    public destroy(): void {
        this.log('Destroying AsyncOperationManager');
        this.cancelAllOperations();
        this.pendingOperations.clear();
        this.currentResourceOperation.clear();
    }
}