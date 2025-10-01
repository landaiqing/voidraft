import { DoublyLinkedList, DoublyLinkedListNode } from './doublyLinkedList';

/**
 * LRU缓存项
 * 
 * @template K 键的类型
 * @template V 值的类型
 */
interface LruCacheItem<K, V> {
  key: K;
  value: V;
}

/**
 * LRU (Least Recently Used) 缓存实现
 * 使用双向链表 + Map 实现 O(1) 时间复杂度的所有操作
 * 
 * @template K 键的类型
 * @template V 值的类型
 */
export class LruCache<K, V> {
  private readonly maxSize: number;
  private readonly cache = new Map<K, DoublyLinkedListNode<LruCacheItem<K, V>>>();
  private readonly lru = new DoublyLinkedList<LruCacheItem<K, V>>();

  /**
   * 创建LRU缓存实例
   * 
   * @param maxSize 最大缓存大小
   */
  constructor(maxSize: number) {
    if (maxSize <= 0) {
      throw new Error('Max size must be greater than 0');
    }
    this.maxSize = maxSize;
  }

  /**
   * 获取缓存值
   * 
   * @param key 键
   * @returns 缓存的值，如果不存在则返回undefined
   */
  get(key: K): V | undefined {
    const node = this.cache.get(key);
    if (node) {
      // 将访问的节点移动到链表尾部（最近使用）
      this.lru.moveToLast(node);
      return node.data.value;
    }
    return undefined;
  }

  /**
   * 设置缓存值
   * 
   * @param key 键
   * @param value 值
   * @param onEvict 当有项目被驱逐时的回调函数
   */
  set(key: K, value: V, onEvict?: (evictedKey: K, evictedValue: V) => void): void {
    const existingNode = this.cache.get(key);
    
    // 如果键已存在，更新值并移动到最近使用
    if (existingNode) {
      existingNode.data.value = value;
      this.lru.moveToLast(existingNode);
      return;
    }

    // 如果缓存已满，移除最少使用的项
    if (this.cache.size >= this.maxSize) {
      const oldestNode = this.lru.first;
      if (oldestNode) {
        const { key: evictedKey, value: evictedValue } = oldestNode.data;
        this.cache.delete(evictedKey);
        this.lru.removeFirst();
        
        if (onEvict) {
          onEvict(evictedKey, evictedValue);
        }
      }
    }

    // 添加新项到链表尾部（最近使用）
    const newNode = this.lru.addLast({ key, value });
    this.cache.set(key, newNode);
  }

  /**
   * 检查键是否存在
   * 
   * @param key 键
   * @returns 是否存在
   */
  has(key: K): boolean {
    return this.cache.has(key);
  }

  /**
   * 删除指定键的缓存
   * 
   * @param key 键
   * @returns 是否成功删除
   */
  delete(key: K): boolean {
    const node = this.cache.get(key);
    if (node) {
      this.cache.delete(key);
      this.lru.remove(node);
      return true;
    }
    return false;
  }

  /**
   * 清空缓存
   * 
   * @param onEvict 清空时对每个项目的回调函数
   */
  clear(onEvict?: (key: K, value: V) => void): void {
    if (onEvict) {
      this.lru.forEach(item => {
        onEvict(item.key, item.value);
      });
    }
    this.cache.clear();
    this.lru.clear();
  }

  /**
   * 获取缓存大小
   * 
   * @returns 当前缓存项数量
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * 获取所有键
   * 
   * @returns 所有键的数组，按最近使用顺序排列（从最少使用到最近使用）
   */
  keys(): K[] {
    return this.lru.toArray().map(item => item.key);
  }

  /**
   * 获取所有值
   * 
   * @returns 所有值的数组，按最近使用顺序排列（从最少使用到最近使用）
   */
  values(): V[] {
    return this.lru.toArray().map(item => item.value);
  }
}