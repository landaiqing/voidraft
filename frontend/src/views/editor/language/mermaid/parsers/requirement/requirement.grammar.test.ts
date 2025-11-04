import { describe, it, expect } from 'vitest';
import { parser } from './requirement.parser.grammar';

/**
 * Requirement Diagram Grammar 测试
 * 
 * 测试目标：验证标准的 Mermaid Requirement Diagram 语法是否能正确解析，不应该出现错误节点（⚠）
 */
describe('Requirement Diagram Grammar 解析测试', () => {
  
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

  it('应该正确解析基础的 requirementDiagram 声明', () => {
    const code = `requirementDiagram
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

  it('应该正确解析空的需求定义', () => {
    const code = `requirementDiagram

    requirement test_req {
    }
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

  it('应该正确解析带 ID 的需求', () => {
    const code = `requirementDiagram

    requirement test_req {
        id: 1
    }
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

  it('应该正确解析带文本的需求', () => {
    const code = `requirementDiagram

    requirement test_req {
        id: 1
        text: the test text
    }
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

  it('应该正确解析带风险级别的需求', () => {
    const code = `requirementDiagram

    requirement test_req {
        id: 1
        text: the test text
        risk: high
    }
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

  it('应该正确解析带验证方法的需求', () => {
    const code = `requirementDiagram

    requirement test_req {
        id: 1
        text: the test text
        risk: high
        verifymethod: test
    }
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

  it('应该正确解析不同类型的需求（functionalRequirement）', () => {
    const code = `requirementDiagram

    functionalRequirement test_req {
        id: 1.1
        text: the test text
    }
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

  it('应该正确解析元素定义', () => {
    const code = `requirementDiagram

    element test_entity {
        type: simulation
    }
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

  it('应该正确解析关系（contains）', () => {
    const code = `requirementDiagram

    requirement test_req {
        id: 1
    }
    
    element test_entity {
        type: simulation
    }
    
    test_entity - contains -> test_req
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

  it('应该正确解析反向关系', () => {
    const code = `requirementDiagram

    requirement test_req {
        id: 1
    }
    
    element test_entity {
        type: simulation
    }
    
    test_req <- satisfies - test_entity
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

  it('应该正确解析完整的需求图示例', () => {
    const code = `requirementDiagram

    requirement test_req {
        id: 1
        text: the test text.
        risk: high
        verifymethod: test
    }

    functionalRequirement test_req2 {
        id: 1.1
        text: the second test text.
        risk: low
        verifymethod: inspection
    }

    element test_entity {
        type: simulation
    }

    test_entity - satisfies -> test_req2
    test_req - traces -> test_req2
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

