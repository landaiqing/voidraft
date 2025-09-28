# 缓存系统

简洁高效的 LRU 缓存实现，支持泛型和自动清理。

## 特性

- 🚀 高性能 LRU 缓存算法
- 🔧 TypeScript 泛型支持
- 🧹 自动资源清理
- 📊 缓存统计信息
- ⏰ TTL 过期支持
- 🎯 简洁易用的 API
- 🔐 多种哈希算法支持
- 🏗️ 模块化设计，易于扩展

## 基础用法

### 创建缓存

```typescript
import { LruCache, CacheManager, createCacheItem } from '@/common/cache';

// 直接创建缓存
const cache = new LruCache({
  maxSize: 100,
  ttl: 5 * 60 * 1000, // 5 分钟
  onEvict: (item) => console.log('Evicted:', item)
});

// 使用缓存管理器
const manager = new CacheManager();
const myCache = manager.createCache('myCache', { maxSize: 50 });
```

### 缓存操作

```typescript
// 创建缓存项
const item = createCacheItem('key1', { 
  name: 'example',
  data: { foo: 'bar' }
});

// 设置缓存
cache.set('key1', item);

// 获取缓存
const cached = cache.get('key1');

// 检查存在
if (cache.has('key1')) {
  // 处理逻辑
}

// 移除缓存
cache.remove('key1');
```

### 自动清理资源

```typescript
interface MyItem extends CacheItem, DisposableCacheItem {
  resource: SomeResource;
  dispose(): void;
}

const item: MyItem = {
  id: 'resource1',
  lastAccessed: new Date(),
  createdAt: new Date(),
  resource: new SomeResource(),
  dispose() {
    this.resource.cleanup();
  }
};

// 当项被驱逐或移除时，dispose 方法会自动调用
cache.set('resource1', item);
```

### 哈希工具使用

```typescript
import { createHash, generateCacheKey } from '@/common/cache';

// 生成简单哈希
const hash = createHash('some content');

// 生成缓存键
const key = generateCacheKey('user', userId, 'profile');
```

## API 参考

### LruCache

- `get(id)` - 获取缓存项（O(1)）
- `set(id, item)` - 设置缓存项（O(1)）
- `remove(id)` - 移除缓存项（O(1)）
- `has(id)` - 检查是否存在（O(1)）
- `clear()` - 清空缓存
- `size()` - 获取缓存大小
- `getStats()` - 获取统计信息
- `cleanup()` - 清理过期项

### CacheManager

- `getCache(name, config?)` - 获取或创建缓存
- `createCache(name, config)` - 创建新缓存
- `removeCache(name)` - 删除缓存
- `clearAll()` - 清空所有缓存
- `getAllStats()` - 获取所有统计信息
- `cleanupAll()` - 清理所有缓存的过期项

## 工具函数

- `generateCacheKey(...parts)` - 生成缓存键
- `createHash(content)` - 创建内容哈希
- `createCacheItem(id, data)` - 创建缓存项