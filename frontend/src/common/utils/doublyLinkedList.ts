/**
 * 双向链表节点
 * 
 * @template T 节点数据的类型
 */
export class DoublyLinkedListNode<T> {
  public data: T;
  public prev: DoublyLinkedListNode<T> | null = null;
  public next: DoublyLinkedListNode<T> | null = null;

  constructor(data: T) {
    this.data = data;
  }
}

/**
 * 双向链表实现
 * 提供 O(1) 时间复杂度的插入、删除和移动操作
 * 
 * @template T 链表数据的类型
 */
export class DoublyLinkedList<T> {
  private head: DoublyLinkedListNode<T> | null = null;
  private tail: DoublyLinkedListNode<T> | null = null;
  private _size = 0;

  /**
   * 获取链表大小
   * 
   * @returns 链表中节点的数量
   */
  get size(): number {
    return this._size;
  }

  /**
   * 检查链表是否为空
   * 
   * @returns 链表是否为空
   */
  get isEmpty(): boolean {
    return this._size === 0;
  }

  /**
   * 获取头节点
   * 
   * @returns 头节点，如果链表为空则返回null
   */
  get first(): DoublyLinkedListNode<T> | null {
    return this.head;
  }

  /**
   * 获取尾节点
   * 
   * @returns 尾节点，如果链表为空则返回null
   */
  get last(): DoublyLinkedListNode<T> | null {
    return this.tail;
  }

  /**
   * 在链表头部添加节点
   * 
   * @param data 要添加的数据
   * @returns 新创建的节点
   */
  addFirst(data: T): DoublyLinkedListNode<T> {
    const newNode = new DoublyLinkedListNode(data);
    
    if (this.head === null) {
      this.head = this.tail = newNode;
    } else {
      newNode.next = this.head;
      this.head.prev = newNode;
      this.head = newNode;
    }
    
    this._size++;
    return newNode;
  }

  /**
   * 在链表尾部添加节点
   * 
   * @param data 要添加的数据
   * @returns 新创建的节点
   */
  addLast(data: T): DoublyLinkedListNode<T> {
    const newNode = new DoublyLinkedListNode(data);
    
    if (this.tail === null) {
      this.head = this.tail = newNode;
    } else {
      newNode.prev = this.tail;
      this.tail.next = newNode;
      this.tail = newNode;
    }
    
    this._size++;
    return newNode;
  }

  /**
   * 删除指定节点
   * 
   * @param node 要删除的节点
   * @returns 被删除节点的数据
   */
  remove(node: DoublyLinkedListNode<T>): T {
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }

    // 清理节点引用，防止内存泄漏
    const data = node.data;
    node.prev = null;
    node.next = null;
    
    this._size--;
    return data;
  }

  /**
   * 删除头节点
   * 
   * @returns 被删除节点的数据，如果链表为空则返回undefined
   */
  removeFirst(): T | undefined {
    if (this.head === null) {
      return undefined;
    }
    return this.remove(this.head);
  }

  /**
   * 删除尾节点
   * 
   * @returns 被删除节点的数据，如果链表为空则返回undefined
   */
  removeLast(): T | undefined {
    if (this.tail === null) {
      return undefined;
    }
    return this.remove(this.tail);
  }

  /**
   * 将节点移动到链表头部
   * 
   * @param node 要移动的节点
   */
  moveToFirst(node: DoublyLinkedListNode<T>): void {
    if (node === this.head) {
      return; // 已经在头部
    }

    // 从当前位置移除
    if (node.prev) {
      node.prev.next = node.next;
    }
    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }

    // 移动到头部
    node.prev = null;
    node.next = this.head;
    if (this.head) {
      this.head.prev = node;
    }
    this.head = node;

    // 如果链表之前为空，更新尾节点
    if (this.tail === null) {
      this.tail = node;
    }
  }

  /**
   * 将节点移动到链表尾部
   * 
   * @param node 要移动的节点
   */
  moveToLast(node: DoublyLinkedListNode<T>): void {
    if (node === this.tail) {
      return; // 已经在尾部
    }

    // 从当前位置移除
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }
    if (node.next) {
      node.next.prev = node.prev;
    }

    // 移动到尾部
    node.next = null;
    node.prev = this.tail;
    if (this.tail) {
      this.tail.next = node;
    }
    this.tail = node;

    // 如果链表之前为空，更新头节点
    if (this.head === null) {
      this.head = node;
    }
  }

  /**
   * 清空链表
   * 
   * @param onClear 清空时对每个节点数据的回调函数
   */
  clear(onClear?: (data: T) => void): void {
    let current = this.head;
    while (current) {
      const next = current.next;
      
      if (onClear) {
        onClear(current.data);
      }
      
      // 清理节点引用，防止内存泄漏
      current.prev = null;
      current.next = null;
      
      current = next;
    }
    
    this.head = null;
    this.tail = null;
    this._size = 0;
  }

  /**
   * 将链表转换为数组
   * 
   * @returns 包含所有节点数据的数组，按从头到尾的顺序
   */
  toArray(): T[] {
    const result: T[] = [];
    let current = this.head;
    while (current) {
      result.push(current.data);
      current = current.next;
    }
    return result;
  }

  /**
   * 遍历链表
   * 
   * @param callback 对每个节点数据执行的回调函数
   */
  forEach(callback: (data: T, index: number) => void): void {
    let current = this.head;
    let index = 0;
    while (current) {
      callback(current.data, index);
      current = current.next;
      index++;
    }
  }
}