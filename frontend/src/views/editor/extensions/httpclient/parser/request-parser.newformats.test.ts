import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { httpLanguage } from '../language';
import { parseHttpRequest } from './request-parser';

/**
 * 创建测试用的 EditorState
 */
function createTestState(content: string): EditorState {
  return EditorState.create({
    doc: content,
    extensions: [httpLanguage]
  });
}

describe('HTTP Request Parser - 新格式测试', () => {
  
  describe('✅ @params - URL 参数', () => {
    it('应该正确解析 params 请求', () => {
      const content = `GET "https://api.example.com/users" {
  @params {
    page: 1,
    size: 20,
    keyword: "张三"
  }
}`;
      
      const state = createTestState(content);
      const request = parseHttpRequest(state, 0);
      
      expect(request).not.toBeNull();
      expect(request?.method).toBe('GET');
      expect(request?.url).toBe('https://api.example.com/users');
      expect(request?.bodyType).toBe('params');
      expect(request?.body).toEqual({
        page: 1,
        size: 20,
        keyword: '张三'
      });
    });
  });
  
  describe('✅ @xml - XML 格式', () => {
    it('应该正确解析 xml 请求', () => {
      const content = `POST "https://api.example.com/soap" {
  content-type: "application/xml"
  
  @xml {
    xml: "<user><name>张三</name><age>25</age></user>"
  }
}`;
      
      const state = createTestState(content);
      const request = parseHttpRequest(state, 0);
      
      expect(request).not.toBeNull();
      expect(request?.method).toBe('POST');
      expect(request?.bodyType).toBe('xml');
      expect(request?.body).toEqual({
        xml: '<user><name>张三</name><age>25</age></user>'
      });
      expect(request?.headers['content-type']).toBe('application/xml');
    });
    
    it('应该正确解析空 xml 块', () => {
      const content = `POST "https://api.example.com/soap" {
  @xml {}
}`;
      
      const state = createTestState(content);
      const request = parseHttpRequest(state, 0);
      
      expect(request).not.toBeNull();
      expect(request?.bodyType).toBe('xml');
      expect(request?.body).toEqual({});
    });
  });
  
  describe('✅ @html - HTML 格式', () => {
    it('应该正确解析 html 请求', () => {
      const content = `POST "https://api.example.com/render" {
  content-type: "text/html"
  
  @html {
    html: "<div><h1>标题</h1><p>内容</p></div>"
  }
}`;
      
      const state = createTestState(content);
      const request = parseHttpRequest(state, 0);
      
      expect(request).not.toBeNull();
      expect(request?.method).toBe('POST');
      expect(request?.bodyType).toBe('html');
      expect(request?.body).toEqual({
        html: '<div><h1>标题</h1><p>内容</p></div>'
      });
      expect(request?.headers['content-type']).toBe('text/html');
    });
    
    it('应该正确解析空 html 块', () => {
      const content = `POST "https://api.example.com/render" {
  @html {}
}`;
      
      const state = createTestState(content);
      const request = parseHttpRequest(state, 0);
      
      expect(request).not.toBeNull();
      expect(request?.bodyType).toBe('html');
      expect(request?.body).toEqual({});
    });
  });
  
  describe('✅ @javascript - JavaScript 格式', () => {
    it('应该正确解析 javascript 请求', () => {
      const content = `POST "https://api.example.com/execute" {
  content-type: "application/javascript"
  
  @javascript {
    javascript: "function hello() { return 'Hello World'; }"
  }
}`;
      
      const state = createTestState(content);
      const request = parseHttpRequest(state, 0);
      
      expect(request).not.toBeNull();
      expect(request?.method).toBe('POST');
      expect(request?.bodyType).toBe('javascript');
      expect(request?.body).toEqual({
        javascript: "function hello() { return 'Hello World'; }"
      });
      expect(request?.headers['content-type']).toBe('application/javascript');
    });
    
    it('应该正确解析空 javascript 块', () => {
      const content = `POST "https://api.example.com/execute" {
  @javascript {}
}`;
      
      const state = createTestState(content);
      const request = parseHttpRequest(state, 0);
      
      expect(request).not.toBeNull();
      expect(request?.bodyType).toBe('javascript');
      expect(request?.body).toEqual({});
    });
  });
  
  describe('✅ @binary - 二进制文件', () => {
    it('应该正确解析 binary 请求', () => {
      const content = `POST "https://api.example.com/upload" {
  content-type: "application/octet-stream"
  
  @binary {
    binary: "@file E://Documents/avatar.png"
  }
}`;
      
      const state = createTestState(content);
      const request = parseHttpRequest(state, 0);
      
      expect(request).not.toBeNull();
      expect(request?.method).toBe('POST');
      expect(request?.bodyType).toBe('binary');
      expect(request?.body).toEqual({
        binary: '@file E://Documents/avatar.png'
      });
      expect(request?.headers['content-type']).toBe('application/octet-stream');
    });
    
    it('应该正确解析空 binary 块', () => {
      const content = `POST "https://api.example.com/upload" {
  @binary {}
}`;
      
      const state = createTestState(content);
      const request = parseHttpRequest(state, 0);
      
      expect(request).not.toBeNull();
      expect(request?.bodyType).toBe('binary');
      expect(request?.body).toEqual({});
    });
  });
  
  describe('✅ 混合使用场景', () => {
    it('应该正确解析带 params 和 headers 的请求', () => {
      const content = `GET "https://api.example.com/search" {
  authorization: "Bearer token123"
  
  @params {
    q: "关键词",
    page: 1,
    limit: 50
  }
}`;
      
      const state = createTestState(content);
      const request = parseHttpRequest(state, 0);
      
      expect(request).not.toBeNull();
      expect(request?.method).toBe('GET');
      expect(request?.headers['authorization']).toBe('Bearer token123');
      expect(request?.bodyType).toBe('params');
      expect(request?.body).toEqual({
        q: '关键词',
        page: 1,
        limit: 50
      });
    });
    
    it('应该正确解析复杂 XML 内容', () => {
      const content = `POST "https://api.example.com/soap" {
  @xml {
    xml: "<soap:Envelope xmlns:soap=\\"http://www.w3.org/2003/05/soap-envelope\\"><soap:Body><GetUser><UserId>123</UserId></GetUser></soap:Body></soap:Envelope>"
  }
}`;
      
      const state = createTestState(content);
      const request = parseHttpRequest(state, 0);
      
      expect(request).not.toBeNull();
      expect(request?.bodyType).toBe('xml');
      expect(request?.body.xml).toContain('soap:Envelope');
      expect(request?.body.xml).toContain('GetUser');
    });
  });
  
  describe('✅ 对比：传统格式仍然可用', () => {
    it('JSON 格式仍然正常工作', () => {
      const content = `POST "https://api.example.com/api" {
  @json {
    name: "张三",
    age: 25,
    email: "test@example.com"
  }
}`;
      
      const state = createTestState(content);
      const request = parseHttpRequest(state, 0);
      
      expect(request).not.toBeNull();
      expect(request?.bodyType).toBe('json');
      expect(request?.body).toEqual({
        name: '张三',
        age: 25,
        email: 'test@example.com'
      });
    });
    
    it('FormData 格式仍然正常工作', () => {
      const content = `POST "https://api.example.com/form" {
  @formdata {
    username: "admin",
    password: "123456"
  }
}`;
      
      const state = createTestState(content);
      const request = parseHttpRequest(state, 0);
      
      expect(request).not.toBeNull();
      expect(request?.bodyType).toBe('formdata');
      expect(request?.body).toEqual({
        username: 'admin',
        password: '123456'
      });
    });
  });
  
  describe('✅ 多个请求解析', () => {
    it('应该能在同一文档中解析不同格式的请求', () => {
      const content = `POST "https://api.example.com/xml" {
  @xml {
    xml: "<user><name>张三</name></user>"
  }
}

POST "https://api.example.com/html" {
  @html {
    html: "<div>内容</div>"
  }
}

POST "https://api.example.com/js" {
  @javascript {
    javascript: "console.log('test');"
  }
}`;
      
      const state = createTestState(content);
      
      // 解析第一个请求（XML）
      const request1 = parseHttpRequest(state, 0);
      expect(request1?.bodyType).toBe('xml');
      expect(request1?.body.xml).toContain('张三');
      
      // 解析第二个请求（HTML）- 找到第二个 POST 的位置
      const secondPostIndex = content.indexOf('POST', 10);
      const request2 = parseHttpRequest(state, secondPostIndex);
      expect(request2?.bodyType).toBe('html');
      expect(request2?.body.html).toContain('内容');
      
      // 解析第三个请求（JavaScript）
      const thirdPostIndex = content.indexOf('POST', secondPostIndex + 10);
      const request3 = parseHttpRequest(state, thirdPostIndex);
      expect(request3?.bodyType).toBe('javascript');
      expect(request3?.body.javascript).toContain('console.log');
    });
  });
});

