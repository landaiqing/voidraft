import { describe, it, expect } from 'vitest';
import { parser } from './pie.parser.grammar';

/**
 * Pie Chart Grammar 测试
 * 
 * 测试目标：验证标准的 Mermaid Pie Chart 语法是否能正确解析，不应该出现错误节点（⚠）
 */
describe('Pie Chart Grammar 解析测试', () => {
  
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

  it('应该正确解析基础的 pie 声明', () => {
    const code = `pie
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

  it('应该正确解析带 showData 的 pie 图', () => {
    const code = `pie showData
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

  it('应该正确解析带标题的 pie 图', () => {
    const code = `pie title My Pie Chart
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

  it('应该正确解析带数据的 pie 图', () => {
    const code = `pie
    "Dogs" : 386
    "Cats" : 85
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

  it('应该正确解析带标题和数据的完整 pie 图', () => {
    const code = `pie title Pets adopted by volunteers
    "Dogs" : 386
    "Cats" : 85
    "Rats" : 15
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

  it('应该正确解析带小数值的数据', () => {
    const code = `pie
    "A" : 10.5
    "B" : 20.75
    "C" : 30.25
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

  it('应该正确解析带 showData 和完整数据的 pie 图', () => {
    const code = `pie showData
    title Key elements in Product X
    "Calcium" : 42.96
    "Potassium" : 50.05
    "Magnesium" : 10.01
    "Iron" : 5
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

