import { describe, it, expect } from 'vitest';
import { parser } from './http.parser';

/**
 * HTTP 变量功能测试
 * 
 * 测试变量定义 @var 和变量引用 {{variableName}} 语法
 */
describe('HTTP 变量功能测试', () => {
  
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
        if (depth > maxDepth) return false;
        
        const indent = '  '.repeat(depth);
        const text = code.substring(node.from, Math.min(node.to, node.from + 30));
        const displayText = text.length === 30 ? text + '...' : text;
        
        lines.push(`${indent}${node.name} [${node.from}-${node.to}]: "${displayText.replace(/\n/g, '\\n')}"`);
      }
    });
    
    return lines.join('\n');
  }

  function getNodeDepth(tree: any, targetNode: any): number {
    let depth = 0;
    let current = targetNode;
    while (current.parent) {
      depth++;
      current = current.parent;
    }
    return depth;
  }

  it('✅ @var - 变量声明', () => {
    const code = `@var {
  baseUrl: "https://api.example.com",
  version: "v1",
  timeout: 30000
}`;

    const tree = parseCode(code);
    const result = hasErrorNodes(tree);
    
    if (result.hasError) {
      console.log('\n❌ @var 变量声明格式错误:');
      result.errors.forEach(err => {
        console.log(`  - ${err.name} at ${err.from}-${err.to}: "${err.text}"`);
      });
      console.log('\n完整语法树:');
      console.log(printTree(tree, code));
    }
    
    expect(result.hasError).toBe(false);
    
    // 验证是否有 VarDeclaration 节点
    let hasVarDeclaration = false;
    let hasVarKeyword = false;
    tree.iterate({
      enter: (node: any) => {
        if (node.name === 'VarDeclaration') hasVarDeclaration = true;
        if (node.name === 'VarKeyword') hasVarKeyword = true;
      }
    });
    
    expect(hasVarDeclaration).toBe(true);
    expect(hasVarKeyword).toBe(true);
  });

  it('✅ 变量引用 - 在属性值中使用', () => {
    const code = `GET "http://example.com" {
  timeout: {{timeout}}
}`;

    const tree = parseCode(code);
    const result = hasErrorNodes(tree);
    
    if (result.hasError) {
      console.log('\n❌ 变量引用格式错误:');
      result.errors.forEach(err => {
        console.log(`  - ${err.name} at ${err.from}-${err.to}: "${err.text}"`);
      });
      console.log('\n完整语法树:');
      console.log(printTree(tree, code));
    }
    
    expect(result.hasError).toBe(false);
    
    // 验证是否有 VariableRef 节点
    let hasVariableRef = false;
    tree.iterate({
      enter: (node: any) => {
        if (node.name === 'VariableRef') hasVariableRef = true;
      }
    });
    
    expect(hasVariableRef).toBe(true);
  });

  it('✅ 变量引用 - 带默认值 {{variableName:default}}', () => {
    const code = `GET "http://example.com" {
  authorization: "Bearer {{token:default-token}}"
}`;

    const tree = parseCode(code);
    const result = hasErrorNodes(tree);
    
    if (result.hasError) {
      console.log('\n❌ 带默认值的变量引用格式错误:');
      result.errors.forEach(err => {
        console.log(`  - ${err.name} at ${err.from}-${err.to}: "${err.text}"`);
      });
      console.log('\n完整语法树:');
      console.log(printTree(tree, code));
    }
    
    expect(result.hasError).toBe(false);
  });

  it('✅ 完整示例 - 变量定义和使用（用户提供的示例）', () => {
    const code = `@var {
  baseUrl: "https://api.example.com",
  version: "v1",
  timeout: 30000
}

GET "{{baseUrl}}/{{version}}/users" {
  timeout: {{timeout}},
  authorization: "Bearer {{token:default-token}}"
}`;

    const tree = parseCode(code);
    const result = hasErrorNodes(tree);
    
    if (result.hasError) {
      console.log('\n❌ 完整示例格式错误:');
      result.errors.forEach(err => {
        console.log(`  - ${err.name} at ${err.from}-${err.to}: "${err.text}"`);
      });
      console.log('\n完整语法树:');
      console.log(printTree(tree, code));
    }
    
    expect(result.hasError).toBe(false);
  });

  it('✅ 变量在 JSON 请求体中使用', () => {
    const code = `@var {
  userId: "12345",
  userName: "张三"
}

POST "http://api.example.com/users" {
  @json {
    id: {{userId}},
    name: {{userName}},
    email: "{{userName}}@example.com"
  }
}`;

    const tree = parseCode(code);
    const result = hasErrorNodes(tree);
    
    if (result.hasError) {
      console.log('\n❌ JSON 中使用变量格式错误:');
      result.errors.forEach(err => {
        console.log(`  - ${err.name} at ${err.from}-${err.to}: "${err.text}"`);
      });
      console.log('\n完整语法树:');
      console.log(printTree(tree, code));
    }
    
    expect(result.hasError).toBe(false);
  });

  it('✅ 变量在多个请求中使用', () => {
    const code = `@var {
  baseUrl: "https://api.example.com",
  token: "Bearer abc123"
}

GET "{{baseUrl}}/users" {
  authorization: {{token}}
}

POST "{{baseUrl}}/users" {
  authorization: {{token}},
  
  @json {
    name: "test"
  }
}`;

    const tree = parseCode(code);
    const result = hasErrorNodes(tree);
    
    if (result.hasError) {
      console.log('\n❌ 多请求中使用变量格式错误:');
      result.errors.forEach(err => {
        console.log(`  - ${err.name} at ${err.from}-${err.to}: "${err.text}"`);
      });
      console.log('\n完整语法树:');
      console.log(printTree(tree, code));
    }
    
    expect(result.hasError).toBe(false);
  });

  it('✅ URL 中包含多个变量', () => {
    const code = `GET "{{protocol}}://{{host}}:{{port}}/{{path}}/{{resource}}" {
  host: "example.com"
}`;

    const tree = parseCode(code);
    const result = hasErrorNodes(tree);
    
    if (result.hasError) {
      console.log('\n❌ URL 多变量格式错误:');
      result.errors.forEach(err => {
        console.log(`  - ${err.name} at ${err.from}-${err.to}: "${err.text}"`);
      });
      console.log('\n完整语法树:');
      console.log(printTree(tree, code));
    }
    
    expect(result.hasError).toBe(false);
  });

  it('✅ 变量名包含下划线和数字', () => {
    const code = `@var {
  api_base_url_v2: "https://api.example.com",
  timeout_30s: 30000,
  user_id_123: "123"
}

GET "{{api_base_url_v2}}/users/{{user_id_123}}" {
  timeout: {{timeout_30s}}
}`;

    const tree = parseCode(code);
    const result = hasErrorNodes(tree);
    
    if (result.hasError) {
      console.log('\n❌ 变量名包含下划线和数字格式错误:');
      result.errors.forEach(err => {
        console.log(`  - ${err.name} at ${err.from}-${err.to}: "${err.text}"`);
      });
      console.log('\n完整语法树:');
      console.log(printTree(tree, code));
    }
    
    expect(result.hasError).toBe(false);
  });

  it('✅ 变量默认值包含特殊字符', () => {
    const code = `GET "http://example.com" {
  authorization: "Bearer {{token:eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0}}"
}`;

    const tree = parseCode(code);
    const result = hasErrorNodes(tree);
    
    if (result.hasError) {
      console.log('\n❌ 变量默认值特殊字符格式错误:');
      result.errors.forEach(err => {
        console.log(`  - ${err.name} at ${err.from}-${err.to}: "${err.text}"`);
      });
      console.log('\n完整语法树:');
      console.log(printTree(tree, code));
    }
    
    expect(result.hasError).toBe(false);
  });

  it('✅ 混合变量和普通值', () => {
    const code = `@var {
  baseUrl: "https://api.example.com",
  version: "v1"
}

POST "{{baseUrl}}/{{version}}/users" {
  content-type: "application/json",
  authorization: "Bearer {{token:default}}",
  user-agent: "Mozilla/5.0",
  
  @json {
    name: "张三",
    age: 25,
    apiUrl: {{baseUrl}},
    apiVersion: {{version}}
  }
}`;

    const tree = parseCode(code);
    const result = hasErrorNodes(tree);
    
    if (result.hasError) {
      console.log('\n❌ 混合变量和普通值格式错误:');
      result.errors.forEach(err => {
        console.log(`  - ${err.name} at ${err.from}-${err.to}: "${err.text}"`);
      });
      console.log('\n完整语法树:');
      console.log(printTree(tree, code));
    }
    
    expect(result.hasError).toBe(false);
  });
});

