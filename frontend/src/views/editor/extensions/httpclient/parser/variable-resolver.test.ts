import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { httpLanguage } from '../language/http-language';
import { VariableResolver } from './variable-resolver';
import { HttpRequestParser } from './request-parser';

/**
 * 创建测试用的 EditorState
 */
function createTestState(content: string): EditorState {
  return EditorState.create({
    doc: content,
    extensions: [httpLanguage],
  });
}

describe('VariableResolver 测试', () => {
  
  it('✅ 解析 @var 声明（无块范围）', () => {
    const content = `@var {
  baseUrl: "https://api.example.com",
  version: "v1",
  timeout: 30000
}`;

    const state = createTestState(content);
    const resolver = new VariableResolver(state);
    const variables = resolver.getAllVariables();

    expect(variables.get('baseUrl')).toBe('https://api.example.com');
    expect(variables.get('version')).toBe('v1');
    expect(variables.get('timeout')).toBe(30000);
  });

  it('✅ 解析 @var 声明（指定块范围）', () => {
    const content = `@var {
  baseUrl: "https://api.example.com",
  version: "v1",
  timeout: 30000
}`;

    const state = createTestState(content);
    // 指定块范围（整个内容）
    const blockRange = { from: 0, to: content.length };
    const resolver = new VariableResolver(state, blockRange);
    const variables = resolver.getAllVariables();

    expect(variables.get('baseUrl')).toBe('https://api.example.com');
    expect(variables.get('version')).toBe('v1');
    expect(variables.get('timeout')).toBe(30000);
  });

  it('✅ 解析变量引用', () => {
    const resolver = new VariableResolver(createTestState(''));
    
    const ref1 = resolver.parseVariableRef('{{baseUrl}}');
    expect(ref1).toEqual({
      name: 'baseUrl',
      defaultValue: undefined,
      raw: '{{baseUrl}}',
    });

    const ref2 = resolver.parseVariableRef('{{token:default-token}}');
    expect(ref2).toEqual({
      name: 'token',
      defaultValue: 'default-token',
      raw: '{{token:default-token}}',
    });
  });

  it('✅ 替换字符串中的变量', () => {
    const content = `@var {
  baseUrl: "https://api.example.com",
  version: "v1"
}`;

    const state = createTestState(content);
    const resolver = new VariableResolver(state);

    const result = resolver.replaceVariables('{{baseUrl}}/{{version}}/users');
    expect(result).toBe('https://api.example.com/v1/users');
  });

  it('✅ 使用默认值', () => {
    const content = `@var {
  baseUrl: "https://api.example.com"
}`;

    const state = createTestState(content);
    const resolver = new VariableResolver(state);

    const result = resolver.replaceVariables('{{baseUrl}}/{{version:v1}}/users');
    expect(result).toBe('https://api.example.com/v1/users');
  });

  it('✅ 变量未定义且无默认值，保持原样', () => {
    const state = createTestState('');
    const resolver = new VariableResolver(state);

    const result = resolver.replaceVariables('{{undefined}}/users');
    expect(result).toBe('{{undefined}}/users');
  });

  it('✅ 嵌套对象变量 - 路径访问', () => {
    const content = `@var {
  config: {
    nested: {
      deep: {
        value: 123
      }
    }
  },
  simple: "test"
}`;

    const state = createTestState(content);
    const resolver = new VariableResolver(state);

    // 测试简单变量
    expect(resolver.resolveVariable('simple')).toBe('test');

    // 测试嵌套路径访问
    expect(resolver.resolveVariable('config.nested.deep.value')).toBe(123);

    // 测试部分路径访问
    const nestedObj = resolver.resolveVariable('config.nested');
    expect(nestedObj).toEqual({ deep: { value: 123 } });

    // 测试不存在的路径
    expect(resolver.resolveVariable('config.notExist', 'default')).toBe('default');

    // 测试字符串替换
    const result = resolver.replaceVariables('Value is {{config.nested.deep.value}}');
    expect(result).toBe('Value is 123');
  });

  it('✅ 嵌套对象变量 - 整个对象引用', () => {
    const content = `@var {
  config: {
    host: "example.com",
    port: 8080
  }
}`;

    const state = createTestState(content);
    const resolver = new VariableResolver(state);

    // 引用整个对象
    const configObj = resolver.resolveVariable('config');
    expect(configObj).toEqual({
      host: 'example.com',
      port: 8080
    });

    // 字符串中引用对象会转换为 JSON
    const result = resolver.replaceVariables('Config: {{config}}');
    expect(result).toBe('Config: {"host":"example.com","port":8080}');
  });

  it('✅ 块范围限制 - 只解析块内的变量', () => {
    // 模拟多块文档
    const content = `@var {
  block1Var: "value1"
}

GET "http://example.com" {}

--- 块分隔 ---

@var {
  block2Var: "value2"
}

POST "http://example.com" {}`;

    const state = createTestState(content);
    
    // 第一个块：只包含 block1Var
    const block1Range = { from: 0, to: 60 };
    const resolver1 = new VariableResolver(state, block1Range);
    expect(resolver1.getAllVariables().get('block1Var')).toBe('value1');
    expect(resolver1.getAllVariables().get('block2Var')).toBeUndefined();

    // 第二个块：只包含 block2Var
    const block2Start = content.indexOf('@var {', 60);
    const block2Range = { from: block2Start, to: content.length };
    const resolver2 = new VariableResolver(state, block2Range);
    expect(resolver2.getAllVariables().get('block1Var')).toBeUndefined();
    expect(resolver2.getAllVariables().get('block2Var')).toBe('value2');
  });
});

describe('HttpRequestParser 集成变量测试', () => {
  
  it('✅ 解析带变量的 URL', () => {
    const content = `@var {
  baseUrl: "https://api.example.com",
  version: "v1"
}

GET "{{baseUrl}}/{{version}}/users" {
  host: "example.com"
}`;

    const state = createTestState(content);
    const parser = new HttpRequestParser(state);
    
    // 查找 GET 请求的位置
    const getPos = content.indexOf('GET');
    const request = parser.parseRequestAt(getPos);

    expect(request).not.toBeNull();
    expect(request?.url).toBe('https://api.example.com/v1/users');
  });

  it('✅ 解析 HTTP 头中的变量', () => {
    const content = `@var {
  token: "Bearer abc123",
  timeout: 5000
}

GET "http://example.com" {
  authorization: {{token}},
  timeout: {{timeout}}
}`;

    const state = createTestState(content);
    const parser = new HttpRequestParser(state);
    
    const getPos = content.indexOf('GET');
    const request = parser.parseRequestAt(getPos);

    expect(request).not.toBeNull();
    expect(request?.headers.authorization).toBe('Bearer abc123');
    // HTTP Header 值会被转换为字符串
    expect(request?.headers.timeout).toBe('5000');
  });

  it('✅ 解析 JSON 请求体中的变量', () => {
    const content = `@var {
  userId: "12345",
  userName: "张三"
}

POST "http://api.example.com/users" {
  @json {
    id: {{userId}},
    name: {{userName}}
  }
}`;

    const state = createTestState(content);
    const parser = new HttpRequestParser(state);
    
    const postPos = content.indexOf('POST');
    const request = parser.parseRequestAt(postPos);

    expect(request).not.toBeNull();
    expect(request?.body).toEqual({
      id: '12345',
      name: '张三',
    });
  });

  it('✅ 字符串中嵌入变量', () => {
    const content = `@var {
  userName: "张三"
}

POST "http://api.example.com/users" {
  @json {
    name: {{userName}},
    email: "{{userName}}@example.com"
  }
}`;

    const state = createTestState(content);
    const parser = new HttpRequestParser(state);
    
    const postPos = content.indexOf('POST');
    const request = parser.parseRequestAt(postPos);

    expect(request).not.toBeNull();
    expect(request?.body).toEqual({
      name: '张三',
      email: '张三@example.com',
    });
  });

  it('✅ 使用变量默认值', () => {
    const content = `@var {
  baseUrl: "https://api.example.com"
}

GET "{{baseUrl}}/users" {
  timeout: {{timeout:30000}},
  authorization: "Bearer {{token:default-token}}"
}`;

    const state = createTestState(content);
    const parser = new HttpRequestParser(state);
    
    const getPos = content.indexOf('GET');
    const request = parser.parseRequestAt(getPos);

    expect(request).not.toBeNull();
    // HTTP Header 值会被转换为字符串
    expect(request?.headers.timeout).toBe('30000');
    expect(request?.headers.authorization).toBe('Bearer default-token');
  });

  it('✅ 嵌套变量在 HTTP 请求中使用', () => {
    const content = `@var {
  api: {
    base: "https://api.example.com",
    version: "v1",
    endpoints: {
      users: "/users",
      posts: "/posts"
    }
  },
  config: {
    timeout: 5000
  }
}

GET "{{api.base}}/{{api.version}}{{api.endpoints.users}}" {
  timeout: {{config.timeout}}
}`;

    const state = createTestState(content);
    const parser = new HttpRequestParser(state);
    
    const getPos = content.indexOf('GET');
    const request = parser.parseRequestAt(getPos);

    expect(request).not.toBeNull();
    expect(request?.url).toBe('https://api.example.com/v1/users');
    expect(request?.headers.timeout).toBe('5000');
  });

  it('✅ 完整示例 - 用户提供的场景', () => {
    const content = `@var {
  baseUrl: "https://api.example.com",
  version: "v1",
  timeout: 30000
}

GET "{{baseUrl}}/{{version}}/users" {
  timeout: {{timeout}},
  authorization: "Bearer {{token:default-token}}"
}`;

    const state = createTestState(content);
    const parser = new HttpRequestParser(state);
    
    const getPos = content.indexOf('GET');
    const request = parser.parseRequestAt(getPos);

    expect(request).not.toBeNull();
    expect(request?.url).toBe('https://api.example.com/v1/users');
    // HTTP Header 值会被转换为字符串（Go 后端要求）
    expect(request?.headers.timeout).toBe('30000');
    expect(request?.headers.authorization).toBe('Bearer default-token');
  });
});

