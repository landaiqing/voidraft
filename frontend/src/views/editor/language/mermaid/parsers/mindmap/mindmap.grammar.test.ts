import { describe, it, expect } from 'vitest';
import { parser } from './mindmap.parser.grammar';

/**
 * Mindmap Grammar 测试
 * 
 * 测试目标：验证标准的 Mermaid Mindmap 语法是否能正确解析，不应该出现错误节点（⚠）
 */
describe('Mindmap Grammar 解析测试', () => {
  
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

  it('应该正确解析基础的 mindmap 声明', () => {
    const code = `mindmap
  Root
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

  it('应该正确解析带子节点的 mindmap', () => {
    const code = `mindmap
  Root
    A
    B
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

  it('应该正确解析多层级的 mindmap', () => {
    const code = `mindmap
  Root
    A
      A1
      A2
    B
      B1
      B2
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

  it('应该正确解析带方括号形状的节点', () => {
    const code = `mindmap
  Root
    [Square node]
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

  it('应该正确解析带圆括号形状的节点', () => {
    const code = `mindmap
  Root
    (Rounded node)
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

  it('应该正确解析带双圆括号形状的节点（圆形）', () => {
    const code = `mindmap
  Root
    ((Circle node))
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

  it('应该正确解析带花括号形状的节点（六边形）', () => {
    const code = `mindmap
  Root
    {{Hexagon node}}
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

  it('应该正确解析完整的 mindmap 示例', () => {
    const code = `mindmap
  root((mindmap))
    Origins
      Long history
      ::icon(fa fa-book)
      Popularisation
        British popular psychology author Tony Buzan
    Research
      On effectiveness<br/>and features
      On Automatic creation
        Uses
            Creative techniques
            Strategic planning
            Argument mapping
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

