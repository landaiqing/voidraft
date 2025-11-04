import { describe, it, expect } from 'vitest';
import { parser } from './gantt.parser.grammar';

/**
 * Gantt Diagram Grammar 测试
 * 
 * 测试目标：验证标准的 Mermaid Gantt Diagram 语法是否能正确解析，不应该出现错误节点（⚠）
 */
describe('Gantt Diagram Grammar 解析测试', () => {
  
  /**
   * 辅助函数：解析代码并返回语法树
   */
  function parseCode(code: string) {
    const tree = parser.parse(code);
    return tree;
  }

  /**
   * 辅助函数：检查语法树中是否有错误节点
   */
  function hasErrorNodes(tree: any): { hasError: boolean; errors: Array<{ name: string; from: number; to: number; text: string }> } {
    const errors: Array<{ name: string; from: number; to: number; text: string }> = [];
    
    tree.iterate({
      enter: (node: any) => {
        if (node.name === '⚠') {
          errors.push({
            name: node.name,
            from: node.from,
            to: node.to,
            text: tree.toString().substring(node.from, node.to)
          });
        }
      }
    });
    
    return {
      hasError: errors.length > 0,
      errors
    };
  }

  /**
   * 辅助函数：打印语法树结构（用于调试）
   */
  function printTree(tree: any, code: string, maxDepth = 5) {
    const lines: string[] = [];
    
    tree.iterate({
      enter: (node: any) => {
        const depth = getNodeDepth(tree, node);
        if (depth > maxDepth) return false; // 限制深度
        
        const indent = '  '.repeat(depth);
        const text = code.substring(node.from, Math.min(node.to, node.from + 30));
        const displayText = text.length === 30 ? text + '...' : text;
        
        lines.push(`${indent}${node.name} [${node.from}-${node.to}]: "${displayText.replace(/\n/g, '\\n')}"`);
      }
    });
    
    return lines.join('\n');
  }

  /**
   * 获取节点深度
   */
  function getNodeDepth(tree: any, targetNode: any): number {
    let depth = 0;
    let current = targetNode;
    while (current.parent) {
      depth++;
      current = current.parent;
    }
    return depth;
  }

  it('应该正确解析基础的 gantt 声明', () => {
    const code = `gantt
`;
    
    const tree = parseCode(code);
    const result = hasErrorNodes(tree);
    
    if (result.hasError) {
      console.log('语法树：');
      console.log(printTree(tree, code));
      console.log('错误节点：', result.errors);
    }
    
    expect(result.hasError).toBe(false);
  });

  it('应该正确解析带标题的 gantt 图', () => {
    const code = `gantt
    title A Gantt Diagram
`;
    
    const tree = parseCode(code);
    const result = hasErrorNodes(tree);
    
    if (result.hasError) {
      console.log('语法树：');
      console.log(printTree(tree, code));
      console.log('错误节点：', result.errors);
    }
    
    expect(result.hasError).toBe(false);
  });

  it('应该正确解析带日期格式的 gantt 图', () => {
    const code = `gantt
    dateFormat YYYY-MM-DD
`;
    
    const tree = parseCode(code);
    const result = hasErrorNodes(tree);
    
    if (result.hasError) {
      console.log('语法树：');
      console.log(printTree(tree, code));
      console.log('错误节点：', result.errors);
    }
    
    expect(result.hasError).toBe(false);
  });

  it('应该正确解析带章节的 gantt 图', () => {
    const code = `gantt
    dateFormat YYYY-MM-DD
    section Section
`;
    
    const tree = parseCode(code);
    const result = hasErrorNodes(tree);
    
    if (result.hasError) {
      console.log('语法树：');
      console.log(printTree(tree, code));
      console.log('错误节点：', result.errors);
    }
    
    expect(result.hasError).toBe(false);
  });

  it('应该正确解析带任务的 gantt 图', () => {
    const code = `gantt
    dateFormat YYYY-MM-DD
    title Adding GANTT diagram functionality to mermaid
    section A section
    Completed task            :done,    des1, 2014-01-06,2014-01-08
`;
    
    const tree = parseCode(code);
    const result = hasErrorNodes(tree);
    
    if (result.hasError) {
      console.log('语法树：');
      console.log(printTree(tree, code));
      console.log('错误节点：', result.errors);
    }
    
    expect(result.hasError).toBe(false);
  });

  it('应该正确解析带活动任务的 gantt 图', () => {
    const code = `gantt
    dateFormat YYYY-MM-DD
    section A section
    Active task               :active,  des2, 2014-01-09, 3d
`;
    
    const tree = parseCode(code);
    const result = hasErrorNodes(tree);
    
    if (result.hasError) {
      console.log('语法树：');
      console.log(printTree(tree, code));
      console.log('错误节点：', result.errors);
    }
    
    expect(result.hasError).toBe(false);
  });

  it('应该正确解析带 axisFormat 的 gantt 图', () => {
    const code = `gantt
    dateFormat YYYY-MM-DD
    axisFormat %m-%d
`;
    
    const tree = parseCode(code);
    const result = hasErrorNodes(tree);
    
    if (result.hasError) {
      console.log('语法树：');
      console.log(printTree(tree, code));
      console.log('错误节点：', result.errors);
    }
    
    expect(result.hasError).toBe(false);
  });

  it('应该正确解析带 excludes 的 gantt 图', () => {
    const code = `gantt
    dateFormat YYYY-MM-DD
    excludes weekends
`;
    
    const tree = parseCode(code);
    const result = hasErrorNodes(tree);
    
    if (result.hasError) {
      console.log('语法树：');
      console.log(printTree(tree, code));
      console.log('错误节点：', result.errors);
    }
    
    expect(result.hasError).toBe(false);
  });

  it('应该正确解析带 todayMarker 的 gantt 图', () => {
    const code = `gantt
    dateFormat YYYY-MM-DD
    todayMarker off
`;
    
    const tree = parseCode(code);
    const result = hasErrorNodes(tree);
    
    if (result.hasError) {
      console.log('语法树：');
      console.log(printTree(tree, code));
      console.log('错误节点：', result.errors);
    }
    
    expect(result.hasError).toBe(false);
  });

  it('应该正确解析完整的 gantt 图示例', () => {
    const code = `gantt
    dateFormat  YYYY-MM-DD
    title       Adding GANTT diagram functionality to mermaid
    excludes    weekends
    
    section A section
    Completed task            :done,    des1, 2014-01-06,2014-01-08
    Active task               :active,  des2, 2014-01-09, 3d
    Future task               :         des3, after des2, 5d
    Future task2              :         des4, after des3, 5d

    section Critical tasks
    Completed task in the critical line :crit, done, 2014-01-06,24h
    Implement parser and jison          :crit, done, after des1, 2d
    Create tests for parser             :crit, active, 3d
    Future task in critical line        :crit, 5d
    Create tests for renderer           :2d
    Add to mermaid                      :1d
`;
    
    const tree = parseCode(code);
    const result = hasErrorNodes(tree);
    
    if (result.hasError) {
      console.log('语法树：');
      console.log(printTree(tree, code));
      console.log('错误节点：', result.errors);
    }
    
    expect(result.hasError).toBe(false);
  });
});

