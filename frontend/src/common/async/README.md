# 异步操作管理器 (AsyncOperationManager)

一个用于控制异步操作竞态条件的 TypeScript 模块，确保操作的正确性和一致性。

## 功能特性

- 🚀 **竞态条件控制**: 自动取消同一资源的过时操作
- 🔄 **操作生命周期管理**: 完整的状态跟踪和回调支持
- 🎯 **资源隔离**: 基于资源ID的操作隔离机制
- ⚡ **并发控制**: 支持最大并发数限制
- ⏰ **超时处理**: 可配置的操作超时机制
- 🧹 **内存管理**: 自动清理已完成的操作
- 🐛 **调试友好**: 内置日志系统

## 安装和导入

```typescript
import { AsyncOperationManager } from '@/common/async';
// 或者
import AsyncOperationManager from '@/common/async';
```

## 基本用法

### 创建管理器实例

```typescript
const operationManager = new AsyncOperationManager({
    timeout: 5000,        // 5秒超时
    autoCleanup: true,    // 自动清理已完成操作
    maxConcurrent: 3,     // 最大并发数
    debug: true           // 启用调试日志
});
```

### 执行异步操作

```typescript
const result = await operationManager.executeOperation(
    'document-123',  // 资源ID
    async (signal, operationId) => {
        // 检查操作是否被取消
        if (signal.aborted) {
            throw new Error('Operation cancelled');
        }
        
        // 执行异步操作
        const data = await fetchData();
        
        // 再次检查取消状态
        if (signal.aborted) {
            throw new Error('Operation cancelled');
        }
        
        return data;
    },
    'fetch-data'  // 操作类型（可选，用于调试）
);

if (result.success) {
    console.log('操作成功:', result.data);
} else {
    console.error('操作失败:', result.error);
}
```

## API 文档

### 构造函数

```typescript
new AsyncOperationManager(config?, callbacks?)
```

#### 配置选项 (AsyncOperationManagerConfig)

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `timeout` | `number` | `0` | 操作超时时间（毫秒），0表示不超时 |
| `autoCleanup` | `boolean` | `true` | 是否自动清理已完成的操作 |
| `maxConcurrent` | `number` | `0` | 最大并发操作数，0表示无限制 |
| `debug` | `boolean` | `false` | 是否启用调试模式 |

#### 回调函数 (OperationCallbacks)

```typescript
{
    onStart?: (operation: OperationInfo) => void;     // 操作开始
    onComplete?: (operation: OperationInfo) => void;  // 操作完成
    onCancel?: (operation: OperationInfo) => void;    // 操作取消
    onError?: (operation: OperationInfo, error: Error) => void; // 操作失败
}
```

### 主要方法

#### executeOperation<T>(resourceId, executor, operationType?)

执行异步操作的核心方法。

**参数:**
- `resourceId: string | number` - 资源标识符
- `executor: OperationExecutor<T>` - 操作执行函数
- `operationType?: string` - 操作类型（可选）

**返回:** `Promise<OperationResult<T>>`

#### cancelResourceOperations(resourceId, excludeOperationId?)

取消指定资源的所有操作。

#### cancelOperation(operationId)

取消指定的操作。

#### cancelAllOperations()

取消所有正在进行的操作。

#### isOperationValid(operationId, resourceId?)

检查操作是否仍然有效。

### 查询方法

- `getOperation(operationId)` - 获取操作信息
- `getCurrentOperationId(resourceId)` - 获取资源的当前操作ID
- `getPendingOperations()` - 获取所有待处理操作
- `getRunningOperationsCount()` - 获取运行中的操作数量

## 使用场景

### 1. 编辑器文档切换

```typescript
// 防止快速切换文档时的内容混乱
const loadDocument = async (documentId: number) => {
    const result = await operationManager.executeOperation(
        documentId,
        async (signal) => {
            // 保存当前文档
            await saveCurrentDocument();
            
            if (signal.aborted) return;
            
            // 加载新文档
            const content = await loadDocumentContent(documentId);
            
            if (signal.aborted) return;
            
            return content;
        },
        'load-document'
    );
    
    if (result.success) {
        updateEditor(result.data);
    }
};
```

### 2. 搜索功能

```typescript
// 取消过时的搜索请求
const search = async (query: string) => {
    const result = await operationManager.executeOperation(
        'search',
        async (signal) => {
            const results = await searchAPI(query, { signal });
            return results;
        },
        'search-query'
    );
    
    if (result.success) {
        displaySearchResults(result.data);
    }
};
```

### 3. 数据加载

```typescript
// 避免页面切换时的数据竞态
const loadPageData = async (pageId: string) => {
    const result = await operationManager.executeOperation(
        `page-${pageId}`,
        async (signal) => {
            const [userData, pageContent, settings] = await Promise.all([
                fetchUserData(signal),
                fetchPageContent(pageId, signal),
                fetchSettings(signal)
            ]);
            
            return { userData, pageContent, settings };
        },
        'load-page'
    );
    
    if (result.success) {
        renderPage(result.data);
    }
};
```

## 操作状态

操作在生命周期中会经历以下状态：

- `PENDING` - 待处理
- `RUNNING` - 运行中
- `COMPLETED` - 已完成
- `CANCELLED` - 已取消
- `FAILED` - 失败

## 最佳实践

### 1. 合理使用资源ID

```typescript
// ✅ 好的做法：使用具体的资源标识
operationManager.executeOperation('document-123', executor);
operationManager.executeOperation('user-456', executor);

// ❌ 避免：使用过于宽泛的标识
operationManager.executeOperation('global', executor);
```

### 2. 及时检查取消状态

```typescript
// ✅ 在关键点检查取消状态
const executor = async (signal) => {
    const step1 = await longRunningTask1();
    if (signal.aborted) throw new Error('Cancelled');
    
    const step2 = await longRunningTask2();
    if (signal.aborted) throw new Error('Cancelled');
    
    return processResults(step1, step2);
};
```

### 3. 使用有意义的操作类型

```typescript
// ✅ 使用描述性的操作类型
operationManager.executeOperation(docId, executor, 'auto-save');
operationManager.executeOperation(docId, executor, 'manual-save');
operationManager.executeOperation(docId, executor, 'export-pdf');
```

### 4. 适当的错误处理

```typescript
const result = await operationManager.executeOperation(resourceId, executor);

if (!result.success) {
    if (result.operation.status === OperationStatus.CANCELLED) {
        // 操作被取消，通常不需要显示错误
        console.log('Operation was cancelled');
    } else {
        // 真正的错误，需要处理
        console.error('Operation failed:', result.error);
        showErrorMessage(result.error.message);
    }
}
```

## 注意事项

1. **内存管理**: 启用 `autoCleanup` 以防止内存泄漏
2. **并发控制**: 根据应用需求设置合适的 `maxConcurrent` 值
3. **超时设置**: 为长时间运行的操作设置合理的超时时间
4. **错误处理**: 区分取消和真正的错误，提供适当的用户反馈
5. **调试模式**: 在开发环境启用 `debug` 模式以便排查问题

## 类型定义

完整的类型定义请参考 `types.ts` 文件。

## 许可证

本模块遵循项目的整体许可证。