/**
 * DOM Diff 算法单元测试
 */
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { morphNode, morphHTML, morphWithKeys } from './domDiff';

describe('DOM Diff Algorithm', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  describe('morphNode - 基础功能', () => {
    test('应该更新文本节点内容', () => {
      const fromNode = document.createTextNode('Hello');
      const toNode = document.createTextNode('World');
      container.appendChild(fromNode);

      morphNode(fromNode, toNode);

      expect(fromNode.nodeValue).toBe('World');
    });

    test('应该保持相同的文本节点不变', () => {
      const fromNode = document.createTextNode('Hello');
      const toNode = document.createTextNode('Hello');
      container.appendChild(fromNode);

      const originalNode = fromNode;
      morphNode(fromNode, toNode);

      expect(fromNode).toBe(originalNode);
      expect(fromNode.nodeValue).toBe('Hello');
    });

    test('应该替换不同类型的节点', () => {
      const fromNode = document.createElement('span');
      fromNode.textContent = 'Hello';
      const toNode = document.createElement('div');
      toNode.textContent = 'World';
      container.appendChild(fromNode);

      morphNode(fromNode, toNode);

      expect(container.firstChild?.nodeName).toBe('DIV');
      expect(container.firstChild?.textContent).toBe('World');
    });
  });

  describe('morphNode - 属性更新', () => {
    test('应该添加新属性', () => {
      const fromEl = document.createElement('div');
      const toEl = document.createElement('div');
      toEl.setAttribute('class', 'test');
      toEl.setAttribute('id', 'myid');
      container.appendChild(fromEl);

      morphNode(fromEl, toEl);

      expect(fromEl.getAttribute('class')).toBe('test');
      expect(fromEl.getAttribute('id')).toBe('myid');
    });

    test('应该更新已存在的属性', () => {
      const fromEl = document.createElement('div');
      fromEl.setAttribute('class', 'old');
      const toEl = document.createElement('div');
      toEl.setAttribute('class', 'new');
      container.appendChild(fromEl);

      morphNode(fromEl, toEl);

      expect(fromEl.getAttribute('class')).toBe('new');
    });

    test('应该删除不存在的属性', () => {
      const fromEl = document.createElement('div');
      fromEl.setAttribute('class', 'test');
      fromEl.setAttribute('id', 'myid');
      const toEl = document.createElement('div');
      toEl.setAttribute('class', 'test');
      container.appendChild(fromEl);

      morphNode(fromEl, toEl);

      expect(fromEl.getAttribute('class')).toBe('test');
      expect(fromEl.hasAttribute('id')).toBe(false);
    });
  });

  describe('morphNode - 子节点更新', () => {
    test('应该添加新子节点', () => {
      const fromEl = document.createElement('ul');
      fromEl.innerHTML = '<li>1</li><li>2</li>';
      const toEl = document.createElement('ul');
      toEl.innerHTML = '<li>1</li><li>2</li><li>3</li>';
      container.appendChild(fromEl);

      morphNode(fromEl, toEl);

      expect(fromEl.children.length).toBe(3);
      expect(fromEl.children[2].textContent).toBe('3');
    });

    test('应该删除多余的子节点', () => {
      const fromEl = document.createElement('ul');
      fromEl.innerHTML = '<li>1</li><li>2</li><li>3</li>';
      const toEl = document.createElement('ul');
      toEl.innerHTML = '<li>1</li><li>2</li>';
      container.appendChild(fromEl);

      morphNode(fromEl, toEl);

      expect(fromEl.children.length).toBe(2);
      expect(fromEl.textContent).toBe('12');
    });

    test('应该更新子节点内容', () => {
      const fromEl = document.createElement('div');
      fromEl.innerHTML = '<p>Old</p>';
      const toEl = document.createElement('div');
      toEl.innerHTML = '<p>New</p>';
      container.appendChild(fromEl);

      const originalP = fromEl.querySelector('p');
      morphNode(fromEl, toEl);

      // 应该保持同一个 p 元素，只更新内容
      expect(fromEl.querySelector('p')).toBe(originalP);
      expect(fromEl.querySelector('p')?.textContent).toBe('New');
    });
  });

  describe('morphHTML - HTML 字符串更新', () => {
    test('应该从 HTML 字符串更新元素', () => {
      const element = document.createElement('div');
      element.innerHTML = '<p>Old</p>';
      container.appendChild(element);

      morphHTML(element, '<p>New</p>');

      expect(element.innerHTML).toBe('<p>New</p>');
    });

    test('应该处理复杂的 HTML 结构', () => {
      const element = document.createElement('div');
      element.innerHTML = '<h1>Title</h1><p>Paragraph</p>';
      container.appendChild(element);

      morphHTML(element, '<h1>New Title</h1><p>New Paragraph</p><span>Extra</span>');

      expect(element.children.length).toBe(3);
      expect(element.querySelector('h1')?.textContent).toBe('New Title');
      expect(element.querySelector('p')?.textContent).toBe('New Paragraph');
      expect(element.querySelector('span')?.textContent).toBe('Extra');
    });
  });

  describe('morphWithKeys - 基于 key 的智能 diff', () => {
    test('应该保持相同 key 的节点', () => {
      const fromEl = document.createElement('ul');
      fromEl.innerHTML = `
        <li data-key="a">A</li>
        <li data-key="b">B</li>
        <li data-key="c">C</li>
      `;
      const toEl = document.createElement('ul');
      toEl.innerHTML = `
        <li data-key="a">A Updated</li>
        <li data-key="b">B</li>
        <li data-key="c">C</li>
      `;
      container.appendChild(fromEl);

      const originalA = fromEl.querySelector('[data-key="a"]');
      morphWithKeys(fromEl, toEl);

      expect(fromEl.querySelector('[data-key="a"]')).toBe(originalA);
      expect(originalA?.textContent).toBe('A Updated');
    });

    test('应该重新排序节点', () => {
      const fromEl = document.createElement('ul');
      fromEl.innerHTML = `
        <li data-key="a">A</li>
        <li data-key="b">B</li>
        <li data-key="c">C</li>
      `;
      const toEl = document.createElement('ul');
      toEl.innerHTML = `
        <li data-key="c">C</li>
        <li data-key="a">A</li>
        <li data-key="b">B</li>
      `;
      container.appendChild(fromEl);

      morphWithKeys(fromEl, toEl);

      const keys = Array.from(fromEl.children).map(child => child.getAttribute('data-key'));
      expect(keys).toEqual(['c', 'a', 'b']);
    });

    test('应该添加新的 key 节点', () => {
      const fromEl = document.createElement('ul');
      fromEl.innerHTML = `
        <li data-key="a">A</li>
        <li data-key="b">B</li>
      `;
      const toEl = document.createElement('ul');
      toEl.innerHTML = `
        <li data-key="a">A</li>
        <li data-key="b">B</li>
        <li data-key="c">C</li>
      `;
      container.appendChild(fromEl);

      morphWithKeys(fromEl, toEl);

      expect(fromEl.children.length).toBe(3);
      expect(fromEl.querySelector('[data-key="c"]')?.textContent).toBe('C');
    });

    test('应该删除不存在的 key 节点', () => {
      const fromEl = document.createElement('ul');
      fromEl.innerHTML = `
        <li data-key="a">A</li>
        <li data-key="b">B</li>
        <li data-key="c">C</li>
      `;
      const toEl = document.createElement('ul');
      toEl.innerHTML = `
        <li data-key="a">A</li>
        <li data-key="c">C</li>
      `;
      container.appendChild(fromEl);

      morphWithKeys(fromEl, toEl);

      expect(fromEl.children.length).toBe(2);
      expect(fromEl.querySelector('[data-key="b"]')).toBeNull();
    });
  });

  describe('性能测试', () => {
    test('应该高效处理大量节点', () => {
      const fromEl = document.createElement('ul');
      for (let i = 0; i < 1000; i++) {
        const li = document.createElement('li');
        li.textContent = `Item ${i}`;
        fromEl.appendChild(li);
      }

      const toEl = document.createElement('ul');
      for (let i = 0; i < 1000; i++) {
        const li = document.createElement('li');
        li.textContent = `Updated Item ${i}`;
        toEl.appendChild(li);
      }

      container.appendChild(fromEl);

      const startTime = performance.now();
      morphNode(fromEl, toEl);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(100); // 应该在 100ms 内完成
      expect(fromEl.children.length).toBe(1000);
      expect(fromEl.children[0].textContent).toBe('Updated Item 0');
    });
  });

  describe('边界情况', () => {
    test('应该处理空节点', () => {
      const fromEl = document.createElement('div');
      const toEl = document.createElement('div');
      container.appendChild(fromEl);

      expect(() => morphNode(fromEl, toEl)).not.toThrow();
    });

    test('应该处理只有文本的节点', () => {
      const fromEl = document.createElement('div');
      fromEl.textContent = 'Hello';
      const toEl = document.createElement('div');
      toEl.textContent = 'World';
      container.appendChild(fromEl);

      morphNode(fromEl, toEl);

      expect(fromEl.textContent).toBe('World');
    });

    test('应该处理嵌套的复杂结构', () => {
      const fromEl = document.createElement('div');
      fromEl.innerHTML = `
        <div class="outer">
          <div class="inner">
            <span>Text</span>
          </div>
        </div>
      `;

      const toEl = document.createElement('div');
      toEl.innerHTML = `
        <div class="outer modified">
          <div class="inner">
            <span>Updated Text</span>
            <strong>New</strong>
          </div>
        </div>
      `;

      container.appendChild(fromEl);

      morphNode(fromEl, toEl);

      expect(fromEl.querySelector('.outer')?.classList.contains('modified')).toBe(true);
      expect(fromEl.querySelector('span')?.textContent).toBe('Updated Text');
      expect(fromEl.querySelector('strong')?.textContent).toBe('New');
    });
  });
});

