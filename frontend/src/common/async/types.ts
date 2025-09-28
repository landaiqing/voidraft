/**
 * 异步操作竞态条件控制相关类型定义
 * 
 * 该模块提供了用于管理异步操作竞态条件的类型定义，
 * 包括操作状态、配置选项、回调函数等核心类型。
 * 
 * @fileoverview 异步操作管理器类型定义
 * @author VoidRaft Team
 * @since 1.0.0
 */

/**
 * 操作状态枚举
 * 
 * 定义异步操作在其生命周期中可能的状态。
 * 
 * @enum {string}
 * @readonly
 * 
 * @example
 * ```typescript
 * import { OperationStatus } from './types';
 * 
 * const status = OperationStatus.RUNNING;
 * console.log(status); // 'running'
 * ```
 */
export enum OperationStatus {
    /** 操作已创建但尚未开始执行 */
    PENDING = 'pending',
    /** 操作正在执行中 */
    RUNNING = 'running',
    /** 操作已成功完成 */
    COMPLETED = 'completed',
    /** 操作已被取消 */
    CANCELLED = 'cancelled',
    /** 操作执行失败 */
    FAILED = 'failed'
}

/**
 * 操作信息接口
 * 
 * 描述单个异步操作的完整信息，包括标识符、状态、控制器等。
 * 
 * @interface OperationInfo
 * 
 * @example
 * ```typescript
 * const operation: OperationInfo = {
 *   id: 1,
 *   resourceId: 'document-123',
 *   status: OperationStatus.RUNNING,
 *   abortController: new AbortController(),
 *   createdAt: Date.now(),
 *   type: 'save-document'
 * };
 * ```
 */
export interface OperationInfo {
    /** 
     * 操作的唯一标识符
     * @type {number}
     */
    id: number;
    
    /** 
     * 关联的资源ID（如文档ID、用户ID等）
     * 用于标识操作所作用的资源，支持字符串或数字类型
     * @type {string | number}
     */
    resourceId: string | number;
    
    /** 
     * 当前操作状态
     * @type {OperationStatus}
     */
    status: OperationStatus;
    
    /** 
     * 用于取消操作的控制器
     * 通过调用 abortController.abort() 可以取消正在执行的操作
     * @type {AbortController}
     */
    abortController: AbortController;
    
    /** 
     * 操作创建时间戳（毫秒）
     * @type {number}
     */
    createdAt: number;
    
    /** 
     * 操作类型标识（可选）
     * 用于调试和日志记录，帮助识别不同类型的操作
     * @type {string}
     * @optional
     */
    type?: string;
}

/**
 * 异步操作管理器配置接口
 * 
 * 定义异步操作管理器的配置选项，用于控制操作的行为和限制。
 * 
 * @interface AsyncOperationManagerConfig
 * 
 * @example
 * ```typescript
 * const config: AsyncOperationManagerConfig = {
 *   timeout: 30000,        // 30秒超时
 *   autoCleanup: true,     // 自动清理已完成操作
 *   maxConcurrent: 5,      // 最多5个并发操作
 *   debug: true            // 启用调试模式
 * };
 * ```
 */
export interface AsyncOperationManagerConfig {
    /** 
     * 操作超时时间（毫秒）
     * 设置为 0 表示不设置超时限制
     * @type {number}
     * @default 0
     * @optional
     */
    timeout?: number;
    
    /** 
     * 是否自动清理已完成的操作
     * 启用后会自动从内存中移除已完成、已取消或失败的操作
     * @type {boolean}
     * @default true
     * @optional
     */
    autoCleanup?: boolean;
    
    /** 
     * 最大并发操作数
     * 设置为 0 表示无并发限制
     * @type {number}
     * @default 0
     * @optional
     */
    maxConcurrent?: number;
    
    /** 
     * 调试模式开关
     * 启用后会在控制台输出详细的操作日志
     * @type {boolean}
     * @default false
     * @optional
     */
    debug?: boolean;
}

/**
 * 操作回调函数集合接口
 * 
 * 定义在操作生命周期的不同阶段可以执行的回调函数。
 * 
 * @interface OperationCallbacks
 * 
 * @example
 * ```typescript
 * const callbacks: OperationCallbacks = {
 *   onStart: (operation) => console.log(`Operation ${operation.id} started`),
 *   onComplete: (operation) => console.log(`Operation ${operation.id} completed`),
 *   onCancel: (operation) => console.log(`Operation ${operation.id} cancelled`),
 *   onError: (operation, error) => console.error(`Operation ${operation.id} failed:`, error)
 * };
 * ```
 */
export interface OperationCallbacks {
    /** 
     * 操作开始时的回调函数
     * @param {OperationInfo} operation - 操作信息
     * @optional
     */
    onStart?: (operation: OperationInfo) => void;
    
    /** 
     * 操作成功完成时的回调函数
     * @param {OperationInfo} operation - 操作信息
     * @optional
     */
    onComplete?: (operation: OperationInfo) => void;
    
    /** 
     * 操作被取消时的回调函数
     * @param {OperationInfo} operation - 操作信息
     * @optional
     */
    onCancel?: (operation: OperationInfo) => void;
    
    /** 
     * 操作执行失败时的回调函数
     * @param {OperationInfo} operation - 操作信息
     * @param {Error} error - 错误对象
     * @optional
     */
    onError?: (operation: OperationInfo, error: Error) => void;
}

/**
 * 操作执行器函数类型
 * 
 * 定义实际执行异步操作的函数签名。
 * 
 * @template T - 操作返回值的类型
 * @param {AbortSignal} signal - 用于检测操作是否被取消的信号
 * @param {number} operationId - 操作的唯一标识符
 * @returns {Promise<T>} 操作执行结果的 Promise
 * 
 * @example
 * ```typescript
 * const saveDocument: OperationExecutor<boolean> = async (signal, operationId) => {
 *   // 检查操作是否被取消
 *   if (signal.aborted) {
 *     throw new Error('Operation was cancelled');
 *   }
 *   
 *   // 执行实际的保存操作
 *   const result = await api.saveDocument(documentData);
 *   return result.success;
 * };
 * ```
 */
export type OperationExecutor<T = any> = (
    signal: AbortSignal,
    operationId: number
) => Promise<T>;

/**
 * 操作执行结果接口
 * 
 * 封装异步操作的执行结果，包括成功状态、数据和错误信息。
 * 
 * @template T - 操作结果数据的类型
 * @interface OperationResult
 * 
 * @example
 * ```typescript
 * // 成功的操作结果
 * const successResult: OperationResult<string> = {
 *   success: true,
 *   data: 'Operation completed successfully',
 *   operation: operationInfo
 * };
 * 
 * // 失败的操作结果
 * const failureResult: OperationResult<never> = {
 *   success: false,
 *   error: new Error('Operation failed'),
 *   operation: operationInfo
 * };
 * ```
 */
export interface OperationResult<T = any> {
    /** 
     * 操作是否成功执行
     * true 表示操作成功完成，false 表示操作失败或被取消
     * @type {boolean}
     */
    success: boolean;
    
    /** 
     * 操作成功时的结果数据
     * 仅在 success 为 true 时有值
     * @type {T}
     * @optional
     */
    data?: T;
    
    /** 
     * 操作失败时的错误信息
     * 仅在 success 为 false 时有值
     * @type {Error}
     * @optional
     */
    error?: Error;
    
    /** 
     * 关联的操作信息
     * 包含操作的完整元数据
     * @type {OperationInfo}
     */
    operation: OperationInfo;
}