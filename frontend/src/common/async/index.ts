/**
 * 异步操作管理模块
 * 
 * 该模块提供了用于管理异步操作竞态条件的完整解决方案。
 * 主要用于防止同一资源上的并发操作冲突，确保操作的正确性和一致性。
 * 
 * @fileoverview 异步操作管理模块入口文件
 * @author VoidRaft Team
 * @since 1.0.0
 * 
 * @example
 * ```typescript
 * import { AsyncOperationManager, OperationStatus } from '@/common/async';
 * 
 * // 创建管理器实例
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
 *     if (signal.aborted) throw new Error('Cancelled');
 *     return await saveDocument(data);
 *   }
 * );
 * 
 * if (result.success) {
 *   console.log('Operation completed:', result.data);
 * }
 * ```
 */

/**
 * 导出异步操作管理器类
 * 
 * AsyncOperationManager 是该模块的核心类，提供了完整的异步操作管理功能。
 * 
 * @see {@link AsyncOperationManager} 异步操作管理器类的详细文档
 */
export { AsyncOperationManager } from './manager';

/**
 * 导出所有类型定义
 * 
 * 包括操作状态枚举、接口定义、配置选项等所有相关类型。
 * 这些类型为使用异步操作管理器提供了完整的 TypeScript 类型支持。
 * 
 * 导出的类型包括：
 * - OperationStatus: 操作状态枚举
 * - OperationInfo: 操作信息接口
 * - AsyncOperationManagerConfig: 管理器配置接口
 * - OperationCallbacks: 操作回调函数接口
 * - OperationExecutor: 操作执行器函数类型
 * - OperationResult: 操作结果接口
 * 
 * @see {@link ./types} 类型定义文件
 */
export * from './types';

/**
 * 默认导出异步操作管理器类
 * 
 * 提供默认导出，方便使用 `import AsyncOperationManager from '@/common/async'` 的方式导入。
 * 
 * @default AsyncOperationManager
 * 
 * @example
 * ```typescript
 * import AsyncOperationManager from '@/common/async';
 * 
 * const manager = new AsyncOperationManager();
 * ```
 */
export { AsyncOperationManager as default } from './manager';