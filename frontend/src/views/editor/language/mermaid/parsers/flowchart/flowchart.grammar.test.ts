import { describe, it, expect } from 'vitest';
import { parser } from './flowchart.parser.grammar';

/**
 * Flowchart Grammar 测试
 * 
 * 测试目标：验证标准的 Mermaid Flowchart 语法是否能正确解析，不应该出现错误节点（⚠）
 */
describe('Flowchart Grammar 解析测试', () => {
  
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

  it('应该正确解析基础的 flowchart 声明（TB 方向）', () => {
    const code = `flowchart TB
    A
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

  it('应该正确解析基础的 graph 声明（LR 方向）', () => {
    const code = `graph LR
    A
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

  it('应该正确解析带方框节点的流程图', () => {
    const code = `flowchart TD
    A[Christmas]
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

  it('应该正确解析带箭头连接的节点', () => {
    const code = `flowchart TD
    A --> B
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

  it('应该正确解析带标签的连接线', () => {
    const code = `flowchart TD
    A -- text --> B
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

  it('应该正确解析不同形状的节点（圆形）', () => {
    const code = `flowchart TD
    A((Circle))
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

  it('应该正确解析不同形状的节点（菱形）', () => {
    const code = `flowchart TD
    A{Diamond}
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

  it('应该正确解析完整的流程图示例', () => {
    const code = `flowchart TD
    A[Start] --> B{Is it?}
    B -->|Yes| C[OK]
    B -->|No| D[End]
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

