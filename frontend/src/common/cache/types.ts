// 缓存项基础接口
export interface CacheItem {
  /** 缓存项的唯一标识 */
  id: string | number;
  /** 最后访问时间 */
  lastAccessed: Date;
  /** 创建时间 */
  createdAt: Date;
}

// 可清理的缓存项接口
export interface DisposableCacheItem extends CacheItem {
  /** 清理资源的方法 */
  dispose(): void | Promise<void>;
}

// 缓存配置
export interface CacheConfig {
  /** 最大缓存数量 */
  maxSize: number;
  /** 生存时间（毫秒），可选 */
  ttl?: number;
  /** 驱逐回调函数，可选 */
  onEvict?: (item: any) => void | Promise<void>;
}

// 缓存统计信息
export interface CacheStats {
  /** 当前缓存项数量 */
  size: number;
  /** 最大容量 */
  maxSize: number;
  /** 命中次数 */
  hits: number;
  /** 未命中次数 */
  misses: number;
  /** 命中率 */
  hitRate: number;
}