import { describe, it, expect } from 'vitest';
import { parser } from './http.parser';

/**
 * HTTP Grammar 测试
 * 
 * 测试目标：验证标准的 HTTP 请求语法是否能正确解析，不应该出现错误节点（⚠）
 */
describe('HTTP Grammar 解析测试', () => {
  
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
    let cursor = tree.cursor();
    
    function traverse(node: any, currentDepth: number): boolean {
      if (node.from === targetNode.from && node.to === targetNode.to && node.name === targetNode.name) {
        depth = currentDepth;
        return true;
      }
      return false;
    }
    
    // 简化：假设深度就是节点的层级
    let current = targetNode;
    while (current.parent) {
      depth++;
      current = current.parent;
    }
    
    return depth;
  }

  it('应该正确解析标准的 GET 请求（包含 @json）', () => {
    const code = `GET  "http://127.0.0.1:80/api/create" {
  host: "https://api.example.com",
  content-type: "application/json",
  user-agent: 'Mozilla/5.0',
  
  @json {
     name : "xxx",
     test: "xx"
  }
}`;

    const tree = parseCode(code);
    const result = hasErrorNodes(tree);
    
    // 如果有错误，打印详细信息
    if (result.hasError) {
      console.log('\n❌ 发现错误节点:');
      result.errors.forEach(err => {
        console.log(`  - ${err.name} at ${err.from}-${err.to}: "${err.text}"`);
      });
      console.log('\n完整语法树:');
      console.log(printTree(tree, code));
    }
    
    expect(result.hasError).toBe(false);
    expect(result.errors).toHaveLength(0);
  });

  it('应该正确解析简单的 POST 请求', () => {
    const code = `POST "http://127.0.0.1/api" {
  host: "example.com",
  content-type: "application/json"
}`;

    const tree = parseCode(code);
    const result = hasErrorNodes(tree);
    
    if (result.hasError) {
      console.log('\n❌ 发现错误节点:');
      result.errors.forEach(err => {
        console.log(`  - ${err.name} at ${err.from}-${err.to}: "${err.text}"`);
      });
      console.log('\n完整语法树:');
      console.log(printTree(tree, code));
    }
    
    expect(result.hasError).toBe(false);
  });

  it('应该正确解析带嵌套块的请求', () => {
    const code = `POST "http://test.com" {
  @json {
    user: {
      name: "test",
      age: 25
    }
  }
}`;

    const tree = parseCode(code);
    const result = hasErrorNodes(tree);
    
    if (result.hasError) {
      console.log('\n❌ 发现错误节点:');
      result.errors.forEach(err => {
        console.log(`  - ${err.name} at ${err.from}-${err.to}: "${err.text}"`);
      });
      console.log('\n完整语法树:');
      console.log(printTree(tree, code));
    }
    
    expect(result.hasError).toBe(false);
  });

  it('应该正确识别 RequestStatement 节点', () => {
    const code = `GET "http://test.com" {
  host: "test.com"
}`;

    const tree = parseCode(code);
    let hasRequestStatement = false;
    let hasMethod = false;
    let hasUrl = false;
    let hasBlock = false;
    
    tree.iterate({
      enter: (node: any) => {
        if (node.name === 'RequestStatement') hasRequestStatement = true;
        if (node.name === 'Method' || node.name === 'GET') hasMethod = true;
        if (node.name === 'Url') hasUrl = true;
        if (node.name === 'Block') hasBlock = true;
      }
    });
    
    expect(hasRequestStatement).toBe(true);
    expect(hasMethod).toBe(true);
    expect(hasUrl).toBe(true);
    expect(hasBlock).toBe(true);
  });

  it('应该正确解析多个连续的请求', () => {
    const code = `GET "http://test1.com" {
  host: "test1.com"
}

POST "http://test2.com" {
  host: "test2.com"
}`;

    const tree = parseCode(code);
    const result = hasErrorNodes(tree);
    
    if (result.hasError) {
      console.log('\n❌ 发现错误节点:');
      result.errors.forEach(err => {
        console.log(`  - ${err.name} at ${err.from}-${err.to}: "${err.text}"`);
      });
    }
    
    expect(result.hasError).toBe(false);
    
    // 统计 RequestStatement 数量
    let requestCount = 0;
    tree.iterate({
      enter: (node: any) => {
        if (node.name === 'RequestStatement') requestCount++;
      }
    });
    
    expect(requestCount).toBe(2);
  });

  it('错误语法：方法名拼写错误（应该产生错误）', () => {
    const code = `Gef "http://test.com" {
  host: "test.com"
}`;

    const tree = parseCode(code);
    const result = hasErrorNodes(tree);
    
    // 这个应该有错误
    expect(result.hasError).toBe(true);
  });

  it('错误语法：花括号不匹配（应该产生错误）', () => {
    const code = `GET "http://test.com" {
  host: "test.com"`;

    const tree = parseCode(code);
    const result = hasErrorNodes(tree);
    
    // 这个应该有错误
    expect(result.hasError).toBe(true);
  });

  it('应该支持属性后面不加逗号', () => {
    const code = `GET "http://test.com" {
  host: "test.com"
  content-type: "application/json"
  user-agent: "Mozilla/5.0"
}`;

    const tree = parseCode(code);
    const result = hasErrorNodes(tree);
    
    if (result.hasError) {
      console.log('\n❌ 发现错误节点:');
      result.errors.forEach(err => {
        console.log(`  - ${err.name} at ${err.from}-${err.to}: "${err.text}"`);
      });
      console.log('\n完整语法树:');
      console.log(printTree(tree, code));
    }
    
    expect(result.hasError).toBe(false);
  });

  it('应该支持 @json 块后面不加逗号（JSON块内部必须用逗号）', () => {
    const code = `POST "http://test.com" {
  host: "test.com"
  
  @json {
    name: "xxx",
    test: "xx"
  }
}`;

    const tree = parseCode(code);
    const result = hasErrorNodes(tree);
    
    if (result.hasError) {
      console.log('\n❌ 发现错误节点:');
      result.errors.forEach(err => {
        console.log(`  - ${err.name} at ${err.from}-${err.to}: "${err.text}"`);
      });
      console.log('\n完整语法树:');
      console.log(printTree(tree, code));
    }
    
    expect(result.hasError).toBe(false);
  });

  it('应该支持混合使用逗号（有些有逗号，有些没有）', () => {
    const code = `POST "http://test.com" {
  host: "test.com",
  content-type: "application/json"
  user-agent: "Mozilla/5.0",
  
  @json {
    name: "xxx",
    test: "xx"
  }
}`;

    const tree = parseCode(code);
    const result = hasErrorNodes(tree);
    
    if (result.hasError) {
      console.log('\n❌ 发现错误节点:');
      result.errors.forEach(err => {
        console.log(`  - ${err.name} at ${err.from}-${err.to}: "${err.text}"`);
      });
    }
    
    expect(result.hasError).toBe(false);
  });

  it('用户提供的真实示例（HTTP 属性不用逗号，JSON 块内必须用逗号）', () => {
    const code = `GET  "http://127.0.0.1:80/api/create" {
  host: "https://api.example.com"
  content-type: "application/json"
  user-agent: 'Mozilla/5.0'
  
  @json {
    name: "xxx",
    test: "xx"
  }
}`;

    const tree = parseCode(code);
    const result = hasErrorNodes(tree);
    
    if (result.hasError) {
      console.log('\n❌ 发现错误节点:');
      result.errors.forEach(err => {
        console.log(`  - ${err.name} at ${err.from}-${err.to}: "${err.text}"`);
      });
      console.log('\n完整语法树:');
      console.log(printTree(tree, code));
    }
    
    expect(result.hasError).toBe(false);
  });

  it('JSON 块内缺少逗号应该报错', () => {
    const code = `POST "http://test.com" {
  @json {
    name: "xxx"
    test: "xx"
  }
}`;

    const tree = parseCode(code);
    const result = hasErrorNodes(tree);
    
    // JSON 块内缺少逗号，应该有错误
    expect(result.hasError).toBe(true);
  });

  it('支持 @formdata 块（必须使用逗号）', () => {
    const code = `POST "http://test.com" {
  @formdata {
    file: "test.png",
    description: "test file"
  }
}`;

    const tree = parseCode(code);
    const result = hasErrorNodes(tree);
    
    if (result.hasError) {
      console.log('\n❌ 发现错误节点:');
      result.errors.forEach(err => {
        console.log(`  - ${err.name} at ${err.from}-${err.to}: "${err.text}"`);
      });
    }
    
    expect(result.hasError).toBe(false);
  });

  it('支持 JSON 嵌套对象', () => {
    const code = `POST "http://test.com" {
  @json {
    user: {
      name: "test",
      age: 25
    },
    settings: {
      theme: "dark"
    }
  }
}`;

    const tree = parseCode(code);
    const result = hasErrorNodes(tree);
    
    if (result.hasError) {
      console.log('\n❌ 发现错误节点:');
      result.errors.forEach(err => {
        console.log(`  - ${err.name} at ${err.from}-${err.to}: "${err.text}"`);
      });
    }
    
    expect(result.hasError).toBe(false);
  });
});

describe('HTTP 请求体格式测试', () => {
  
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

  it('✅ @json - JSON 格式请求体', () => {
    const code = `POST "http://api.example.com/users" {
  content-type: "application/json"
  authorization: "Bearer token123"
  
  @json {
    name: "张三",
    age: 25,
    email: "zhangsan@example.com",
    address: {
      city: "北京",
      street: "长安街"
    },
    tags: {
      skill: "TypeScript",
      level: "advanced"
    }
  }
}`;

    const tree = parseCode(code);
    const result = hasErrorNodes(tree);
    
    if (result.hasError) {
      console.log('\n❌ @json 格式错误:');
      result.errors.forEach(err => {
        console.log(`  - ${err.name} at ${err.from}-${err.to}: "${err.text}"`);
      });
    }
    
    expect(result.hasError).toBe(false);
  });

  it('✅ @formdata - 表单数据格式', () => {
    const code = `POST "http://api.example.com/upload" {
  content-type: "multipart/form-data"
  
  @formdata {
    file: "avatar.png",
    username: "zhangsan",
    email: "zhangsan@example.com",
    age: 25,
    description: "用户头像上传"
  }
}`;

    const tree = parseCode(code);
    const result = hasErrorNodes(tree);
    
    if (result.hasError) {
      console.log('\n❌ @formdata 格式错误:');
      result.errors.forEach(err => {
        console.log(`  - ${err.name} at ${err.from}-${err.to}: "${err.text}"`);
      });
    }
    
    expect(result.hasError).toBe(false);
  });

  it('✅ @urlencoded - URL 编码格式', () => {
    const code = `POST "http://api.example.com/login" {
  content-type: "application/x-www-form-urlencoded"
  
  @urlencoded {
    username: "admin",
    password: "123456",
    remember: true
  }
}`;

    const tree = parseCode(code);
    const result = hasErrorNodes(tree);
    
    if (result.hasError) {
      console.log('\n❌ @urlencoded 格式错误:');
      result.errors.forEach(err => {
        console.log(`  - ${err.name} at ${err.from}-${err.to}: "${err.text}"`);
      });
    }
    
    expect(result.hasError).toBe(false);
  });

  it('✅ @text - 纯文本请求体', () => {
    const code = `POST "http://api.example.com/webhook" {
  content-type: "text/plain"
  
  @text {
    content: "这是一段纯文本内容，可以包含多行\\n支持中文和特殊字符！@#$%"
  }
}`;

    const tree = parseCode(code);
    const result = hasErrorNodes(tree);
    
    if (result.hasError) {
      console.log('\n❌ @text 格式错误:');
      result.errors.forEach(err => {
        console.log(`  - ${err.name} at ${err.from}-${err.to}: "${err.text}"`);
      });
    }
    
    expect(result.hasError).toBe(false);
  });

  it('✅ # 单行注释', () => {
    const code = `# 这是一个用户登录接口
POST "http://api.example.com/login" {
  # 添加认证头
  content-type: "application/json"
  
  # 登录参数
  @json {
    username: "admin",
    password: "123456"
  }
}`;

    const tree = parseCode(code);
    const result = hasErrorNodes(tree);
    
    if (result.hasError) {
      console.log('\n❌ 单行注释格式错误:');
      result.errors.forEach(err => {
        console.log(`  - ${err.name} at ${err.from}-${err.to}: "${err.text}"`);
      });
    }
    
    expect(result.hasError).toBe(false);
  });

  it('✅ 混合多种格式 - JSON 请求', () => {
    const code = `POST "http://api.example.com/login" {
  content-type: "application/json"
  user-agent: "Mozilla/5.0"
  
  @json {
    username: "admin",
    password: "123456"
  }
}`;

    const tree = parseCode(code);
    const result = hasErrorNodes(tree);
    
    if (result.hasError) {
      console.log('\n❌ 混合格式错误:');
      result.errors.forEach(err => {
        console.log(`  - ${err.name} at ${err.from}-${err.to}: "${err.text}"`);
      });
    }
    
    expect(result.hasError).toBe(false);
  });

  it('✅ 复杂嵌套 JSON', () => {
    const code = `POST "http://api.example.com/complex" {
  @json {
    user: {
      profile: {
        name: "张三",
        contact: {
          email: "zhangsan@example.com",
          phone: "13800138000"
        }
      },
      settings: {
        theme: "dark",
        language: "zh-CN"
      }
    },
    metadata: {
      version: "1.0",
      timestamp: 1234567890
    }
  }
}`;

    const tree = parseCode(code);
    const result = hasErrorNodes(tree);
    
    if (result.hasError) {
      console.log('\n❌ 复杂嵌套格式错误:');
      result.errors.forEach(err => {
        console.log(`  - ${err.name} at ${err.from}-${err.to}: "${err.text}"`);
      });
    }
    
    expect(result.hasError).toBe(false);
  });

  it('✅ 多个请求（不同格式 + 注释）', () => {
    const code = `# JSON 请求
POST "http://api.example.com/json" {
  @json {
    name: "test"
  }
}

# FormData 请求
POST "http://api.example.com/form" {
  @formdata {
    file: "test.txt",
    description: "test"
  }
}

# URLEncoded 请求
POST "http://api.example.com/login" {
  @urlencoded {
    username: "admin",
    password: "123456"
  }
}`;

    const tree = parseCode(code);
    const result = hasErrorNodes(tree);
    
    if (result.hasError) {
      console.log('\n❌ 多请求格式错误:');
      result.errors.forEach(err => {
        console.log(`  - ${err.name} at ${err.from}-${err.to}: "${err.text}"`);
      });
    }
    
    expect(result.hasError).toBe(false);
  });
});

describe('HTTP 新格式测试 - params/xml/html/javascript/binary', () => {
  
  function parseCode(code: string) {
    const tree = parser.parse(code);
    return tree;
  }

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

  it('✅ @params - URL 参数格式', () => {
    const code = `GET "http://api.example.com/users" {
  authorization: "Bearer token123"
  
  @params {
    page: 1,
    size: 20,
    keyword: "张三",
    status: "active"
  }
}`;

    const tree = parseCode(code);
    const result = hasErrorNodes(tree);
    
    if (result.hasError) {
      console.log('\n❌ @params 格式错误:');
      result.errors.forEach(err => {
        console.log(`  - ${err.name} at ${err.from}-${err.to}: "${err.text}"`);
      });
    }
    
    expect(result.hasError).toBe(false);
  });

  it('✅ @xml - XML 格式', () => {
    const code = `POST "http://api.example.com/soap" {
  content-type: "application/xml"
  
  @xml {
    xml: "<user><name>张三</name><age>25</age></user>"
  }
}`;

    const tree = parseCode(code);
    const result = hasErrorNodes(tree);
    
    if (result.hasError) {
      console.log('\n❌ @xml 格式错误:');
      result.errors.forEach(err => {
        console.log(`  - ${err.name} at ${err.from}-${err.to}: "${err.text}"`);
      });
    }
    
    expect(result.hasError).toBe(false);
  });

  it('✅ @xml - 空块', () => {
    const code = `POST "http://api.example.com/soap" {
  @xml {}
}`;

    const tree = parseCode(code);
    const result = hasErrorNodes(tree);
    
    if (result.hasError) {
      console.log('\n❌ @xml 空块格式错误:');
      result.errors.forEach(err => {
        console.log(`  - ${err.name} at ${err.from}-${err.to}: "${err.text}"`);
      });
    }
    
    expect(result.hasError).toBe(false);
  });

  it('✅ @html - HTML 格式', () => {
    const code = `POST "http://api.example.com/render" {
  content-type: "text/html"
  
  @html {
    html: "<div><h1>标题</h1><p>内容</p></div>"
  }
}`;

    const tree = parseCode(code);
    const result = hasErrorNodes(tree);
    
    if (result.hasError) {
      console.log('\n❌ @html 格式错误:');
      result.errors.forEach(err => {
        console.log(`  - ${err.name} at ${err.from}-${err.to}: "${err.text}"`);
      });
    }
    
    expect(result.hasError).toBe(false);
  });

  it('✅ @html - 空块', () => {
    const code = `POST "http://api.example.com/render" {
  @html {}
}`;

    const tree = parseCode(code);
    const result = hasErrorNodes(tree);
    
    if (result.hasError) {
      console.log('\n❌ @html 空块格式错误:');
      result.errors.forEach(err => {
        console.log(`  - ${err.name} at ${err.from}-${err.to}: "${err.text}"`);
      });
    }
    
    expect(result.hasError).toBe(false);
  });

  it('✅ @javascript - JavaScript 格式', () => {
    const code = `POST "http://api.example.com/execute" {
  content-type: "application/javascript"
  
  @javascript {
    javascript: "function hello() { return 'Hello World'; }"
  }
}`;

    const tree = parseCode(code);
    const result = hasErrorNodes(tree);
    
    if (result.hasError) {
      console.log('\n❌ @javascript 格式错误:');
      result.errors.forEach(err => {
        console.log(`  - ${err.name} at ${err.from}-${err.to}: "${err.text}"`);
      });
    }
    
    expect(result.hasError).toBe(false);
  });

  it('✅ @javascript - 空块', () => {
    const code = `POST "http://api.example.com/execute" {
  @javascript {}
}`;

    const tree = parseCode(code);
    const result = hasErrorNodes(tree);
    
    if (result.hasError) {
      console.log('\n❌ @javascript 空块格式错误:');
      result.errors.forEach(err => {
        console.log(`  - ${err.name} at ${err.from}-${err.to}: "${err.text}"`);
      });
    }
    
    expect(result.hasError).toBe(false);
  });

  it('✅ @binary - 二进制文件上传', () => {
    const code = `POST "http://api.example.com/upload" {
  content-type: "application/octet-stream"
  
  @binary {
    binary: "@file E://Documents/avatar.png"
  }
}`;

    const tree = parseCode(code);
    const result = hasErrorNodes(tree);
    
    if (result.hasError) {
      console.log('\n❌ @binary 格式错误:');
      result.errors.forEach(err => {
        console.log(`  - ${err.name} at ${err.from}-${err.to}: "${err.text}"`);
      });
    }
    
    expect(result.hasError).toBe(false);
  });

  it('✅ @binary - 空块', () => {
    const code = `POST "http://api.example.com/upload" {
  @binary {}
}`;

    const tree = parseCode(code);
    const result = hasErrorNodes(tree);
    
    if (result.hasError) {
      console.log('\n❌ @binary 空块格式错误:');
      result.errors.forEach(err => {
        console.log(`  - ${err.name} at ${err.from}-${err.to}: "${err.text}"`);
      });
    }
    
    expect(result.hasError).toBe(false);
  });

  it('✅ 复杂 XML - SOAP 请求', () => {
    const code = `POST "http://api.example.com/soap" {
  @xml {
    xml: "<soap:Envelope xmlns:soap=\\"http://www.w3.org/2003/05/soap-envelope\\"><soap:Body><GetUser><UserId>123</UserId></GetUser></soap:Body></soap:Envelope>"
  }
}`;

    const tree = parseCode(code);
    const result = hasErrorNodes(tree);
    
    if (result.hasError) {
      console.log('\n❌ 复杂 XML 格式错误:');
      result.errors.forEach(err => {
        console.log(`  - ${err.name} at ${err.from}-${err.to}: "${err.text}"`);
      });
    }
    
    expect(result.hasError).toBe(false);
  });

  it('✅ 混合使用 - params + headers', () => {
    const code = `GET "http://api.example.com/search" {
  authorization: "Bearer token123"
  user-agent: "Mozilla/5.0"
  
  @params {
    q: "搜索关键词",
    page: 1,
    limit: 50,
    sort: "desc"
  }
}`;

    const tree = parseCode(code);
    const result = hasErrorNodes(tree);
    
    if (result.hasError) {
      console.log('\n❌ 混合使用格式错误:');
      result.errors.forEach(err => {
        console.log(`  - ${err.name} at ${err.from}-${err.to}: "${err.text}"`);
      });
    }
    
    expect(result.hasError).toBe(false);
  });

  it('✅ 多个不同新格式的请求', () => {
    const code = `# XML 请求
POST "http://api.example.com/xml" {
  @xml {
    xml: "<user><name>张三</name></user>"
  }
}

# HTML 请求
POST "http://api.example.com/html" {
  @html {
    html: "<div>内容</div>"
  }
}

# JavaScript 请求
POST "http://api.example.com/js" {
  @javascript {
    javascript: "console.log('test');"
  }
}

# Binary 请求
POST "http://api.example.com/upload" {
  @binary {
    binary: "@file C:/test.bin"
  }
}`;

    const tree = parseCode(code);
    const result = hasErrorNodes(tree);
    
    if (result.hasError) {
      console.log('\n❌ 多新格式请求错误:');
      result.errors.forEach(err => {
        console.log(`  - ${err.name} at ${err.from}-${err.to}: "${err.text}"`);
      });
    }
    
    expect(result.hasError).toBe(false);
    
    // 统计 RequestStatement 数量
    let requestCount = 0;
    tree.iterate({
      enter: (node: any) => {
        if (node.name === 'RequestStatement') requestCount++;
      }
    });
    
    expect(requestCount).toBe(4);
  });

  it('❌ @xml - 定义了 xml key 但没有值（应该报错）', () => {
    const code = `POST "http://api.example.com/soap" {
  @xml {
    xml:
  }
}`;

    const tree = parseCode(code);
    const result = hasErrorNodes(tree);
    
    // 应该有错误
    expect(result.hasError).toBe(true);
  });

  it('❌ @html - 定义了 html key 但没有值（应该报错）', () => {
    const code = `POST "http://api.example.com/render" {
  @html {
    html:
  }
}`;

    const tree = parseCode(code);
    const result = hasErrorNodes(tree);
    
    // 应该有错误
    expect(result.hasError).toBe(true);
  });

  it('❌ @xml - 使用错误的 key 名称（应该报错）', () => {
    const code = `POST "http://api.example.com/soap" {
  @xml {
    data: "<user><name>张三</name></user>"
  }
}`;

    const tree = parseCode(code);
    const result = hasErrorNodes(tree);
    
    // 应该有错误
    expect(result.hasError).toBe(true);
  });

  it('✅ 所有格式组合测试', () => {
    const code = `# 传统格式
POST "http://api.example.com/json" {
  @json {
    name: "test",
    age: 25
  }
}

POST "http://api.example.com/form" {
  @formdata {
    file: "test.png",
    desc: "description"
  }
}

POST "http://api.example.com/login" {
  @urlencoded {
    username: "admin",
    password: "123456"
  }
}

POST "http://api.example.com/text" {
  @text {
    content: "纯文本内容"
  }
}

# 新格式
GET "http://api.example.com/search" {
  @params {
    q: "keyword",
    page: 1
  }
}

POST "http://api.example.com/xml" {
  @xml {
    xml: "<data>test</data>"
  }
}

POST "http://api.example.com/html" {
  @html {
    html: "<div>test</div>"
  }
}

POST "http://api.example.com/js" {
  @javascript {
    javascript: "alert('test');"
  }
}

POST "http://api.example.com/upload" {
  @binary {
    binary: "@file C:/file.bin"
  }
}`;

    const tree = parseCode(code);
    const result = hasErrorNodes(tree);
    
    if (result.hasError) {
      console.log('\n❌ 所有格式组合测试错误:');
      result.errors.forEach(err => {
        console.log(`  - ${err.name} at ${err.from}-${err.to}: "${err.text}"`);
      });
    }
    
    expect(result.hasError).toBe(false);
    
    // 统计 RequestStatement 数量（应该有9个）
    let requestCount = 0;
    tree.iterate({
      enter: (node: any) => {
        if (node.name === 'RequestStatement') requestCount++;
      }
    });
    
    expect(requestCount).toBe(9);
  });
});

