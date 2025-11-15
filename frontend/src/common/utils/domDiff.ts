/**
 * 轻量级 DOM Diff 算法实现
 * 基于 morphdom 思路，只更新变化的节点，保持未变化的节点不动
 */

/**
 * 比较并更新两个 DOM 节点
 * @param fromNode 原节点
 * @param toNode 目标节点
 */
export function morphNode(fromNode: Node, toNode: Node): void {
  // 节点类型不同，直接替换
  if (fromNode.nodeType !== toNode.nodeType || fromNode.nodeName !== toNode.nodeName) {
    fromNode.parentNode?.replaceChild(toNode.cloneNode(true), fromNode);
    return;
  }

  // 文本节点：比较内容
  if (fromNode.nodeType === Node.TEXT_NODE) {
    if (fromNode.nodeValue !== toNode.nodeValue) {
      fromNode.nodeValue = toNode.nodeValue;
    }
    return;
  }

  // 元素节点：更新属性和子节点
  if (fromNode.nodeType === Node.ELEMENT_NODE) {
    const fromEl = fromNode as Element;
    const toEl = toNode as Element;

    // 更新属性
    morphAttributes(fromEl, toEl);

    // 更新子节点
    morphChildren(fromEl, toEl);
  }
}

/**
 * 更新元素属性
 */
function morphAttributes(fromEl: Element, toEl: Element): void {
  // 移除旧属性
  const fromAttrs = fromEl.attributes;
  for (let i = fromAttrs.length - 1; i >= 0; i--) {
    const attr = fromAttrs[i];
    if (!toEl.hasAttribute(attr.name)) {
      fromEl.removeAttribute(attr.name);
    }
  }

  // 添加/更新新属性
  const toAttrs = toEl.attributes;
  for (let i = 0; i < toAttrs.length; i++) {
    const attr = toAttrs[i];
    const fromValue = fromEl.getAttribute(attr.name);
    if (fromValue !== attr.value) {
      fromEl.setAttribute(attr.name, attr.value);
    }
  }
}

/**
 * 更新子节点（核心 diff 算法）
 */
function morphChildren(fromEl: Element, toEl: Element): void {
  const fromChildren = Array.from(fromEl.childNodes);
  const toChildren = Array.from(toEl.childNodes);

  const fromLen = fromChildren.length;
  const toLen = toChildren.length;
  const minLen = Math.min(fromLen, toLen);

  // 1. 更新公共部分
  for (let i = 0; i < minLen; i++) {
    morphNode(fromChildren[i], toChildren[i]);
  }

  // 2. 移除多余的旧节点
  if (fromLen > toLen) {
    for (let i = fromLen - 1; i >= toLen; i--) {
      fromEl.removeChild(fromChildren[i]);
    }
  }

  // 3. 添加新节点
  if (toLen > fromLen) {
    for (let i = fromLen; i < toLen; i++) {
      fromEl.appendChild(toChildren[i].cloneNode(true));
    }
  }
}

/**
 * 优化版：使用 key 进行更智能的 diff（可选）
 * 适用于有 data-key 属性的元素
 */
export function morphWithKeys(fromEl: Element, toEl: Element): void {
  const toChildren = Array.from(toEl.children) as Element[];

  // 构建 from 的 key 映射
  const fromKeyMap = new Map<string, Element>();
  Array.from(fromEl.children).forEach((child) => {
    const key = child.getAttribute('data-key');
    if (key) {
      fromKeyMap.set(key, child);
    }
  });

  const processedKeys = new Set<string>();

  // 按照 toChildren 的顺序处理
  toChildren.forEach((toChild, toIndex) => {
    const key = toChild.getAttribute('data-key');
    if (!key) return;

    processedKeys.add(key);
    const fromChild = fromKeyMap.get(key);

    if (fromChild) {
      // 找到对应节点，更新内容
      morphNode(fromChild, toChild);

      // 确保节点在正确的位置
      const currentNode = fromEl.children[toIndex];
      if (currentNode !== fromChild) {
        // 将 fromChild 移动到正确位置
        fromEl.insertBefore(fromChild, currentNode);
      }
    } else {
      // 新节点，插入到正确位置
      const currentNode = fromEl.children[toIndex];
      fromEl.insertBefore(toChild.cloneNode(true), currentNode || null);
    }
  });

  // 删除不再存在的节点（从后往前删除，避免索引问题）
  const childrenToRemove: Element[] = [];
  fromKeyMap.forEach((child, key) => {
    if (!processedKeys.has(key)) {
      childrenToRemove.push(child);
    }
  });
  childrenToRemove.forEach(child => {
    fromEl.removeChild(child);
  });
}

/**
 * 高级 API：直接从 HTML 字符串更新元素
 */
export function morphHTML(element: Element, htmlString: string): void {
  const tempContainer = document.createElement('div');
  tempContainer.innerHTML = htmlString;

  // 更新元素的子节点列表
  morphChildren(element, tempContainer);
}

/**
 * 批量更新（使用 DocumentFragment）
 */
export function batchMorph(element: Element, htmlString: string): void {
  const tempContainer = document.createElement('div');
  tempContainer.innerHTML = htmlString;

  const fragment = document.createDocumentFragment();
  Array.from(tempContainer.childNodes).forEach(node => {
    fragment.appendChild(node);
  });

  // 清空原内容
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }

  // 批量插入
  element.appendChild(fragment);
}

