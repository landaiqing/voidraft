import type { DoublyLinkedNode } from './interfaces';

/**
 * 双向链表实现
 * 用于高效管理LRU缓存的访问顺序，所有操作都是O(1)时间复杂度
 * 
 * @template T 节点值的类型
 */
export class DoublyLinkedList<T> {
  /** 头节点（虚拟节点） */
  private head: DoublyLinkedNode<T>;
  /** 尾节点（虚拟节点） */
  private tail: DoublyLinkedNode<T>;
  /** 当前节点数量 */
  private count: number = 0;

  /**
   * 构造函数
   * 创建头尾虚拟节点，简化边界处理
   */
  constructor() {
    // 创建虚拟头节点
    this.head = {
      value: null as any,
      key: 'head',
      prev: null,
      next: null
    };

    // 创建虚拟尾节点
    this.tail = {
      value: null as any,
      key: 'tail',
      prev: null,
      next: null
    };

    // 连接头尾节点
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  /**
   * 在头部添加节点
   * 时间复杂度: O(1)
   * 
   * @param node 要添加的节点
   */
  addToHead(node: DoublyLinkedNode<T>): void {
    node.prev = this.head;
    node.next = this.head.next;
    
    if (this.head.next) {
      this.head.next.prev = node;
    }
    this.head.next = node;
    
    this.count++;
  }

  /**
   * 移除指定节点
   * 时间复杂度: O(1)
   * 
   * @param node 要移除的节点
   */
  removeNode(node: DoublyLinkedNode<T>): void {
    if (node.prev) {
      node.prev.next = node.next;
    }
    if (node.next) {
      node.next.prev = node.prev;
    }
    
    this.count--;
  }

  /**
   * 移除尾部节点
   * 时间复杂度: O(1)
   * 
   * @returns 被移除的节点，如果链表为空则返回null
   */
  removeTail(): DoublyLinkedNode<T> | null {
    const lastNode = this.tail.prev;
    
    if (lastNode === this.head) {
      return null; // 链表为空
    }
    
    this.removeNode(lastNode!);
    return lastNode!;
  }

  /**
   * 将节点移动到头部
   * 时间复杂度: O(1)
   * 
   * @param node 要移动的节点
   */
  moveToHead(node: DoublyLinkedNode<T>): void {
    this.removeNode(node);
    this.addToHead(node);
  }

  /**
   * 创建新节点
   * 
   * @param key 节点键
   * @param value 节点值
   * @returns 新创建的节点
   */
  createNode(key: string | number, value: T): DoublyLinkedNode<T> {
    return {
      key,
      value,
      prev: null,
      next: null
    };
  }

  /**
   * 获取链表大小
   * 
   * @returns 当前节点数量
   */
  size(): number {
    return this.count;
  }

  /**
   * 检查链表是否为空
   * 
   * @returns 是否为空
   */
  isEmpty(): boolean {
    return this.count === 0;
  }

  /**
   * 清空链表
   */
  clear(): void {
    this.head.next = this.tail;
    this.tail.prev = this.head;
    this.count = 0;
  }

  /**
   * 获取所有节点的值（从头到尾）
   * 主要用于调试和测试
   * 
   * @returns 所有节点值的数组
   */
  toArray(): T[] {
    const result: T[] = [];
    let current = this.head.next;
    
    while (current && current !== this.tail) {
      result.push(current.value);
      current = current.next;
    }
    
    return result;
  }
}