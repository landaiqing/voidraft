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

  it('应该正确解析标准的 GET 请求（包含 @json 和 @res）', () => {
    const code = `GET  "http://127.0.0.1:80/api/create" {
  host: "https://api.example.com",
  content-type: "application/json",
  user-agent: 'Mozilla/5.0',
  
  @json {
     name : "xxx",
     test: "xx"
  }
  
 	@res {
     code: 200,
	 status: "ok",
	 size: "20kb",
	 time: "2025-10-31 10:30:26",
	 data: {
         xxx:"xxx"
		 
	 }
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

  it('应该支持 @json/@res 块后面不加逗号（JSON块内部必须用逗号）', () => {
    const code = `POST "http://test.com" {
  host: "test.com"
  
  @json {
    name: "xxx",
    test: "xx"
  }
  
  @res {
    code: 200,
    status: "ok"
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
  
  @res {
    code: 200,
    message: "success",
    data: {
      id: 12345
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
  
  @res {
    code: 200,
    message: "上传成功",
    url: "https://cdn.example.com/avatar.png"
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
  
  @res {
    code: 200,
    message: "登录成功",
    token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
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
  
  # 期望的响应
  @res {
    code: 200,
    # 用户token
    token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
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

  it('✅ 混合多种格式 - JSON + 响应', () => {
    const code = `POST "http://api.example.com/login" {
  content-type: "application/json"
  user-agent: "Mozilla/5.0"
  
  @json {
    username: "admin",
    password: "123456"
  }
  
  @res {
    code: 200,
    message: "登录成功",
    token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
    user: {
      id: 1,
      name: "管理员"
    }
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

