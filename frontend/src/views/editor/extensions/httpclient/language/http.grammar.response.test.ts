import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { httpLanguage } from './index';
import { syntaxTree } from '@codemirror/language';

/**
 * 创建测试用的 EditorState
 */
function createTestState(content: string): EditorState {
  return EditorState.create({
    doc: content,
    extensions: [httpLanguage]
  });
}

/**
 * 检查节点是否存在
 */
function hasNode(state: EditorState, nodeName: string): boolean {
  const tree = syntaxTree(state);
  let found = false;
  tree.iterate({
    enter: (node) => {
      if (node.name === nodeName) {
        found = true;
        return false;
      }
    }
  });
  return found;
}

/**
 * 获取节点文本
 */
function getNodeText(state: EditorState, nodeName: string): string | null {
  const tree = syntaxTree(state);
  let text: string | null = null;
  tree.iterate({
    enter: (node) => {
      if (node.name === nodeName) {
        text = state.doc.sliceString(node.from, node.to);
        return false;
      }
    }
  });
  return text;
}

describe('HTTP Grammar - @response 响应语法', () => {
  
  it('✅ 成功响应 - 完整格式', () => {
    const content = `@response 200 123ms 2025-10-31T10:30:31 {
  "message": "success",
  "data": [1, 2, 3]
}`;
    
    const state = createTestState(content);
    
    expect(hasNode(state, 'ResponseDeclaration')).toBe(true);
    expect(hasNode(state, 'ResponseStatus')).toBe(true);
    expect(hasNode(state, 'ResponseTime')).toBe(true);
    expect(hasNode(state, 'ResponseTimestamp')).toBe(true);
    expect(hasNode(state, 'ResponseBlock')).toBe(true);
  });

  it('✅ 错误响应 - error 关键字', () => {
    const content = `@response error 0ms 2025-10-31T10:30:31 {
  "error": "Network timeout"
}`;
    
    const state = createTestState(content);
    
    expect(hasNode(state, 'ResponseDeclaration')).toBe(true);
    expect(hasNode(state, 'ErrorStatus')).toBe(true);
    expect(hasNode(state, 'TimeUnit')).toBe(true);
  });

  it('✅ 响应与请求结合', () => {
    const content = `GET "https://api.example.com/users" {}

@response 200 123ms 2025-10-31T10:30:31 {
  "users": [
    { "id": 1, "name": "Alice" },
    { "id": 2, "name": "Bob" }
  ]
}`;
    
    const state = createTestState(content);
    
    expect(hasNode(state, 'RequestStatement')).toBe(true);
    expect(hasNode(state, 'ResponseDeclaration')).toBe(true);
  });

  it('✅ 多个请求和响应', () => {
    const content = `GET "https://api.example.com/users" {}
@response 200 100ms 2025-10-31T10:30:31 {
  "users": []
}

POST "https://api.example.com/users" {
  @json { "name": "Alice" }
}
@response 201 50ms 2025-10-31T10:30:32 {
  "id": 1,
  "name": "Alice"
}`;
    
    const state = createTestState(content);
    const tree = syntaxTree(state);
    
    // 统计 ResponseDeclaration 数量
    let responseCount = 0;
    tree.iterate({
      enter: (node) => {
        if (node.name === 'ResponseDeclaration') {
          responseCount++;
        }
      }
    });
    
    expect(responseCount).toBe(2);
  });

  it('✅ 响应状态码类型', () => {
    const testCases = [
      { status: '200', shouldParse: true },
      { status: '201', shouldParse: true },
      { status: '404', shouldParse: true },
      { status: '500', shouldParse: true },
      { status: 'error', shouldParse: true }
    ];
    
    testCases.forEach(({ status, shouldParse }) => {
      const content = `@response ${status} 0ms 2025-10-31T10:30:31 { "data": null }`;
      const state = createTestState(content);
      expect(hasNode(state, 'ResponseDeclaration')).toBe(shouldParse);
    });
  });

  it('✅ 响应时间单位', () => {
    const content = `@response 200 12345ms 2025-10-31T10:30:31 {
  "data": "test"
}`;
    
    const state = createTestState(content);
    
    expect(hasNode(state, 'TimeUnit')).toBe(true);
    expect(getNodeText(state, 'TimeUnit')).toBe('ms');
  });

  it('✅ 响应块包含复杂 JSON', () => {
    const content = `@response 200 150ms 2025-10-31T10:30:31 {
  "status": "success",
  "data": {
    "users": [
      {
        "id": 1,
        "name": "Alice",
        "email": "alice@example.com",
        "active": true
      },
      {
        "id": 2,
        "name": "Bob",
        "email": "bob@example.com",
        "active": false
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 10,
      "total": 100
    }
  }
}`;
    
    const state = createTestState(content);
    
    expect(hasNode(state, 'ResponseDeclaration')).toBe(true);
    expect(hasNode(state, 'JsonObject')).toBe(true);
    expect(hasNode(state, 'JsonArray')).toBe(true);
  });

  it('✅ 空响应体', () => {
    const content = `@response 204 50ms 2025-10-31T10:30:31 {}`;
    
    const state = createTestState(content);
    
    expect(hasNode(state, 'ResponseDeclaration')).toBe(true);
    expect(hasNode(state, 'ResponseBlock')).toBe(true);
  });

  it('✅ 响应体为数组', () => {
    const content = `@response 200 80ms 2025-10-31T10:30:31 [
  { "id": 1, "name": "Alice" },
  { "id": 2, "name": "Bob" }
]`;
    
    const state = createTestState(content);
    
    expect(hasNode(state, 'ResponseDeclaration')).toBe(true);
    expect(hasNode(state, 'JsonArray')).toBe(true);
  });

  it('✅ 时间戳格式', () => {
    const testCases = [
      '2025-10-31T10:30:31',
      '2025-01-01T00:00:00',
      '2025-12-31T23:59:59'
    ];
    
    testCases.forEach(timestamp => {
      const content = `@response 200 100ms ${timestamp} { "data": null }`;
      const state = createTestState(content);
      expect(hasNode(state, 'ResponseTimestamp')).toBe(true);
    });
  });

  it('❌ 缺少必填字段应该有错误', () => {
    const invalidCases = [
      '@response 200 { "data": null }',  // 缺少时间和时间戳
      '@response 200 100ms { "data": null }',  // 缺少时间戳
    ];
    
    invalidCases.forEach(content => {
      const state = createTestState(content);
      const tree = syntaxTree(state);
      
      // 检查是否有错误节点
      let hasError = false;
      tree.iterate({
        enter: (node) => {
          if (node.name === '⚠') {
            hasError = true;
            return false;
          }
        }
      });
      
      expect(hasError).toBe(true);
    });
  });

  it('✅ 与变量结合', () => {
    const content = `@var {
  apiUrl: "https://api.example.com"
}

GET "https://api.example.com/users" {}

@response 200 123ms 2025-10-31T10:30:31 {
  "users": []
}`;
    
    const state = createTestState(content);
    
    expect(hasNode(state, 'VarDeclaration')).toBe(true);
    expect(hasNode(state, 'RequestStatement')).toBe(true);
    expect(hasNode(state, 'ResponseDeclaration')).toBe(true);
  });
});

