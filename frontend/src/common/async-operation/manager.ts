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
 * 用于控制异步操作的竞态条件，确保操作的正确性和一致性
 */
export class AsyncOperationManager {
    private operationSequence = 0;
    private pendingOperations = new Map<number, OperationInfo>();
    private currentResourceOperation = new Map<string | number, number>();
    private config: Required<AsyncOperationManagerConfig>;
    private callbacks: OperationCallbacks;

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
     */
    private getNextOperationId(): number {
        return ++this.operationSequence;
    }

    /**
     * 记录日志（调试模式下）
     */
    private log(message: string, ...args: any[]): void {
        if (this.config.debug) {
            console.log(`[AsyncOperationManager] ${message}`, ...args);
        }
    }

    /**
     * 创建操作信息
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
     * 取消指定资源的所有操作（除了指定的操作ID）
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
     * 取消指定操作
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
     */
    public getOperation(operationId: number): OperationInfo | undefined {
        return this.pendingOperations.get(operationId);
    }

    /**
     * 获取资源的当前操作ID
     */
    public getCurrentOperationId(resourceId: string | number): number | undefined {
        return this.currentResourceOperation.get(resourceId);
    }

    /**
     * 获取所有待处理操作
     */
    public getPendingOperations(): OperationInfo[] {
        return Array.from(this.pendingOperations.values());
    }

    /**
     * 获取运行中的操作数量
     */
    public getRunningOperationsCount(): number {
        return Array.from(this.pendingOperations.values())
            .filter(op => op.status === OperationStatus.RUNNING).length;
    }

    /**
     * 销毁管理器，取消所有操作
     */
    public destroy(): void {
        this.log('Destroying AsyncOperationManager');
        this.cancelAllOperations();
        this.pendingOperations.clear();
        this.currentResourceOperation.clear();
    }
}