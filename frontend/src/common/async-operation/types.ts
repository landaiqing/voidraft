/**
 * 异步操作竞态条件控制相关类型定义
 */

/**
 * 操作状态枚举
 */
export enum OperationStatus {
    PENDING = 'pending',
    RUNNING = 'running',
    COMPLETED = 'completed',
    CANCELLED = 'cancelled',
    FAILED = 'failed'
}

/**
 * 操作信息接口
 */
export interface OperationInfo {
    /** 操作ID */
    id: number;
    /** 资源ID（如文档ID、用户ID等） */
    resourceId: string | number;
    /** 操作状态 */
    status: OperationStatus;
    /** 取消控制器 */
    abortController: AbortController;
    /** 创建时间 */
    createdAt: number;
    /** 操作类型（可选，用于调试） */
    type?: string;
}

/**
 * 操作管理器配置
 */
export interface AsyncOperationManagerConfig {
    /** 操作超时时间（毫秒），0表示不超时 */
    timeout?: number;
    /** 是否自动清理已完成的操作 */
    autoCleanup?: boolean;
    /** 最大并发操作数，0表示无限制 */
    maxConcurrent?: number;
    /** 调试模式 */
    debug?: boolean;
}

/**
 * 操作回调函数类型
 */
export interface OperationCallbacks {
    /** 操作开始回调 */
    onStart?: (operation: OperationInfo) => void;
    /** 操作完成回调 */
    onComplete?: (operation: OperationInfo) => void;
    /** 操作取消回调 */
    onCancel?: (operation: OperationInfo) => void;
    /** 操作失败回调 */
    onError?: (operation: OperationInfo, error: Error) => void;
}

/**
 * 操作执行器函数类型
 */
export type OperationExecutor<T = any> = (
    signal: AbortSignal,
    operationId: number
) => Promise<T>;

/**
 * 操作结果类型
 */
export interface OperationResult<T = any> {
    /** 操作是否成功 */
    success: boolean;
    /** 操作结果数据 */
    data?: T;
    /** 错误信息 */
    error?: Error;
    /** 操作信息 */
    operation: OperationInfo;
}