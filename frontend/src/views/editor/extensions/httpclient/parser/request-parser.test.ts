import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { HttpRequestParser } from './request-parser';
import { http } from '../language';

/**
 * 创建测试用的编辑器状态
 */
function createTestState(code: string): EditorState {
  return EditorState.create({
    doc: code,
    extensions: [http()],
  });
}

describe('HttpRequestParser', () => {
  describe('基本请求解析', () => {
    it('应该解析简单的 GET 请求', () => {
      const code = `GET "http://api.example.com/users" {
  host: "api.example.com"
  content-type: "application/json"
}`;

      const state = createTestState(code);
      const parser = new HttpRequestParser(state);
      const request = parser.parseRequestAt(0);

      expect(request).not.toBeNull();
      expect(request?.method).toBe('GET');
      expect(request?.url).toBe('http://api.example.com/users');
      expect(request?.headers).toEqual({
        host: 'api.example.com',
        'content-type': 'application/json',
      });
      expect(request?.bodyType).toBeUndefined();
      expect(request?.body).toBeUndefined();
    });

    it('应该解析 POST 请求（带 JSON 请求体）', () => {
      const code = `POST "http://api.example.com/users" {
  content-type: "application/json"
  
  @json {
    name: "张三",
    age: 25,
    email: "zhangsan@example.com"
  }
}`;

      const state = createTestState(code);
      const parser = new HttpRequestParser(state);
      const request = parser.parseRequestAt(0);

      expect(request).not.toBeNull();
      expect(request?.method).toBe('POST');
      expect(request?.url).toBe('http://api.example.com/users');
      expect(request?.headers).toEqual({
        'content-type': 'application/json',
      });
      expect(request?.bodyType).toBe('json');
      expect(request?.body).toEqual({
        name: '张三',
        age: 25,
        email: 'zhangsan@example.com',
      });
    });

    it('应该解析 PUT 请求', () => {
      const code = `PUT "http://api.example.com/users/123" {
  authorization: "Bearer token123"
  
  @json {
    name: "李四"
  }
}`;

      const state = createTestState(code);
      const parser = new HttpRequestParser(state);
      const request = parser.parseRequestAt(0);

      expect(request).not.toBeNull();
      expect(request?.method).toBe('PUT');
      expect(request?.url).toBe('http://api.example.com/users/123');
    });

    it('应该解析 DELETE 请求', () => {
      const code = `DELETE "http://api.example.com/users/123" {
  authorization: "Bearer token123"
}`;

      const state = createTestState(code);
      const parser = new HttpRequestParser(state);
      const request = parser.parseRequestAt(0);

      expect(request).not.toBeNull();
      expect(request?.method).toBe('DELETE');
      expect(request?.url).toBe('http://api.example.com/users/123');
    });
  });

  describe('请求体类型解析', () => {
    it('应该解析 @json 请求体', () => {
      const code = `POST "http://api.example.com/test" {
  @json {
    username: "admin",
    password: "123456"
  }
}`;

      const state = createTestState(code);
      const parser = new HttpRequestParser(state);
      const request = parser.parseRequestAt(0);

      expect(request?.bodyType).toBe('json');
      expect(request?.body).toEqual({
        username: 'admin',
        password: '123456',
      });
    });

    it('应该解析 @formdata 请求体', () => {
      const code = `POST "http://api.example.com/upload" {
  @formdata {
    file: "avatar.png",
    description: "用户头像"
  }
}`;

      const state = createTestState(code);
      const parser = new HttpRequestParser(state);
      const request = parser.parseRequestAt(0);

      expect(request?.bodyType).toBe('formdata');
      expect(request?.body).toEqual({
        file: 'avatar.png',
        description: '用户头像',
      });
    });

    it('应该解析 @urlencoded 请求体', () => {
      const code = `POST "http://api.example.com/login" {
  @urlencoded {
    username: "admin",
    password: "123456"
  }
}`;

      const state = createTestState(code);
      const parser = new HttpRequestParser(state);
      const request = parser.parseRequestAt(0);

      expect(request?.bodyType).toBe('urlencoded');
      expect(request?.body).toEqual({
        username: 'admin',
        password: '123456',
      });
    });

    it('应该解析 @text 请求体', () => {
      const code = `POST "http://api.example.com/webhook" {
  @text {
    content: "纯文本内容"
  }
}`;

      const state = createTestState(code);
      const parser = new HttpRequestParser(state);
      const request = parser.parseRequestAt(0);

      expect(request?.bodyType).toBe('text');
      expect(request?.body).toEqual({
        content: '纯文本内容',
      });
    });
  });

  describe('复杂数据类型', () => {
    it('应该解析嵌套对象', () => {
      const code = `POST "http://api.example.com/users" {
  @json {
    user: {
      name: "张三",
      age: 25
    },
    settings: {
      theme: "dark"
    }
  }
}`;

      const state = createTestState(code);
      const parser = new HttpRequestParser(state);
      const request = parser.parseRequestAt(0);

      expect(request?.body).toEqual({
        user: {
          name: '张三',
          age: 25,
        },
        settings: {
          theme: 'dark',
        },
      });
    });

    it('应该解析布尔值', () => {
      const code = `POST "http://api.example.com/test" {
  @json {
    enabled: true,
    disabled: false
  }
}`;

      const state = createTestState(code);
      const parser = new HttpRequestParser(state);
      const request = parser.parseRequestAt(0);

      expect(request?.body).toEqual({
        enabled: true,
        disabled: false,
      });
    });

    it('应该解析数字', () => {
      const code = `POST "http://api.example.com/test" {
  @json {
    count: 100,
    price: 19.99
  }
}`;

      const state = createTestState(code);
      const parser = new HttpRequestParser(state);
      const request = parser.parseRequestAt(0);

      expect(request?.body).toEqual({
        count: 100,
        price: 19.99,
      });
    });
  });

  describe('Headers 解析', () => {
    it('应该解析多个 headers', () => {
      const code = `GET "http://api.example.com/users" {
  host: "api.example.com"
  authorization: "Bearer token123"
  content-type: "application/json"
  user-agent: "Mozilla/5.0"
  accept: "application/json"
}`;

      const state = createTestState(code);
      const parser = new HttpRequestParser(state);
      const request = parser.parseRequestAt(0);

      expect(request?.headers).toEqual({
        host: 'api.example.com',
        authorization: 'Bearer token123',
        'content-type': 'application/json',
        'user-agent': 'Mozilla/5.0',
        accept: 'application/json',
      });
    });

    it('应该支持单引号字符串', () => {
      const code = `GET "http://api.example.com/users" {
  user-agent: 'Mozilla/5.0'
}`;

      const state = createTestState(code);
      const parser = new HttpRequestParser(state);
      const request = parser.parseRequestAt(0);

      expect(request?.headers['user-agent']).toBe('Mozilla/5.0');
    });
  });

  describe('位置信息', () => {
    it('应该记录请求的位置信息', () => {
      const code = `GET "http://api.example.com/users" {
  host: "api.example.com"
}`;

      const state = createTestState(code);
      const parser = new HttpRequestParser(state);
      const request = parser.parseRequestAt(0);

      expect(request?.position).toBeDefined();
      expect(request?.position.line).toBe(1);
      expect(request?.position.from).toBe(0);
      expect(request?.position.to).toBeGreaterThan(0);
    });
  });

  describe('错误处理', () => {
    it('解析不完整的请求应该返回 null', () => {
      const code = `GET {
  host: "test.com"
}`;

      const state = createTestState(code);
      const parser = new HttpRequestParser(state);
      const request = parser.parseRequestAt(0);

      expect(request).toBeNull();
    });

    it('解析无效位置应该返回 null', () => {
      const code = `GET "http://test.com" { }`;

      const state = createTestState(code);
      const parser = new HttpRequestParser(state);
      const request = parser.parseRequestAt(1000); // 超出范围

      expect(request).toBeNull();
    });
  });

  describe('多个请求', () => {
    it('应该正确解析指定位置的请求', () => {
      const code = `GET "http://api.example.com/users" {
  host: "api.example.com"
}

POST "http://api.example.com/users" {
  @json {
    name: "test"
  }
}`;

      const state = createTestState(code);
      const parser = new HttpRequestParser(state);

      // 解析第一个请求
      const request1 = parser.parseRequestAt(0);
      expect(request1?.method).toBe('GET');

      // 解析第二个请求（大概在 60+ 字符位置）
      const request2 = parser.parseRequestAt(70);
      expect(request2?.method).toBe('POST');
      expect(request2?.body).toEqual({ name: 'test' });
    });
  });
});

