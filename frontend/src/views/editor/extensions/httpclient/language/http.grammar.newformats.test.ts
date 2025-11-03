import { describe, it, expect } from 'vitest';
import { parser } from './http.parser';

describe('HTTP Grammar - 新增请求格式测试', () => {
  
  function parseAndCheck(content: string, expectError: boolean = false) {
    const tree = parser.parse(content);
    
    console.log('\n=== 语法树结构 ===');
    let hasError = false;
    tree.iterate({
      enter: (node) => {
        const depth = getDepth(node.node);
        const indent = '  '.repeat(depth);
        const text = content.slice(node.from, node.to);
        const preview = text.length > 60 ? text.slice(0, 60) + '...' : text;
        
        if (node.name === '⚠') {
          hasError = true;
          console.log(`${indent}⚠ 错误节点 [${node.from}-${node.to}]: ${JSON.stringify(preview)}`);
        } else {
          console.log(`${indent}${node.name.padEnd(30 - depth * 2)} [${String(node.from).padStart(3)}-${String(node.to).padEnd(3)}]: ${JSON.stringify(preview)}`);
        }
      }
    });
    
    if (expectError) {
      expect(hasError).toBe(true);
    } else {
      expect(hasError).toBe(false);
    }
    
    function getDepth(currentNode: any): number {
      let depth = 0;
      let node = currentNode;
      while (node && node.parent) {
        depth++;
        node = node.parent;
      }
      return depth;
    }
  }
  
  it('✅ @params - URL 参数', () => {
    const content = `GET "https://api.example.com/users" {
  @params {
    page: 1,
    size: 20,
    keyword: "张三"
  }
}`;
    
    console.log('\n测试内容:');
    console.log(content);
    
    parseAndCheck(content);
  });
  
  it('✅ @xml - XML 格式请求体', () => {
    const content = `POST "https://api.example.com/soap" {
  content-type: "application/xml"
  
  @xml {
    xml: "<user><name>张三</name><age>25</age></user>"
  }
}`;
    
    console.log('\n测试内容:');
    console.log(content);
    
    parseAndCheck(content);
  });
  
  it('✅ @html - HTML 格式请求体', () => {
    const content = `POST "https://api.example.com/render" {
  content-type: "text/html"
  
  @html {
    html: "<div><h1>标题</h1><p>内容</p></div>"
  }
}`;
    
    console.log('\n测试内容:');
    console.log(content);
    
    parseAndCheck(content);
  });
  
  it('✅ @javascript - JavaScript 格式请求体', () => {
    const content = `POST "https://api.example.com/execute" {
  content-type: "application/javascript"
  
  @javascript {
    javascript: "function hello() { return 'Hello World'; }"
  }
}`;
    
    console.log('\n测试内容:');
    console.log(content);
    
    parseAndCheck(content);
  });
  
  it('✅ @binary - 二进制文件上传', () => {
    const content = `POST "https://api.example.com/upload" {
  content-type: "application/octet-stream"
  
  @binary {
    binary: "@file E://Documents/avatar.png"
  }
}`;
    
    console.log('\n测试内容:');
    console.log(content);
    
    parseAndCheck(content);
  });
  
  it('✅ 混合使用 - @params 和响应', () => {
    const content = `GET "https://api.example.com/search" {
  authorization: "Bearer token123"
  
  @params {
    q: "关键词",
    page: 1,
    limit: 50
  }
}

@response 200-OK 156ms 2025-11-03T10:30:00 {
  "total": 100,
  "data": []
}`;
    
    console.log('\n测试内容:');
    console.log(content);
    
    parseAndCheck(content);
  });
  
  it('✅ 复杂 XML 内容', () => {
    const content = `POST "https://api.example.com/soap" {
  @xml {
    xml: "<soap:Envelope xmlns:soap=\\"http://www.w3.org/2003/05/soap-envelope\\"><soap:Body><GetUser><UserId>123</UserId></GetUser></soap:Body></soap:Envelope>"
  }
}`;
    
    console.log('\n测试内容:');
    console.log(content);
    
    parseAndCheck(content);
  });
  
  it('✅ 多行 JavaScript', () => {
    const content = `POST "https://api.example.com/run" {
  @javascript {
    javascript: "function calculate(a, b) {\\n  return a + b;\\n}"
  }
}`;
    
    console.log('\n测试内容:');
    console.log(content);
    
    parseAndCheck(content);
  });
  
  it('✅ @binary 支持不同路径格式', () => {
    const content = `POST "https://api.example.com/upload" {
  @binary {
    binary: "@file C:/Users/Documents/file.pdf"
  }
}`;
    
    console.log('\n测试内容:');
    console.log(content);
    
    parseAndCheck(content);
  });
  
  it('✅ @params 支持空值', () => {
    const content = `GET "https://api.example.com/list" {
  @params {
    filter: "",
    page: 1
  }
}`;
    
    console.log('\n测试内容:');
    console.log(content);
    
    parseAndCheck(content);
  });
  
  it('✅ @xml 空块', () => {
    const content = `POST "https://api.example.com/soap" {
  content-type: "application/xml"
  
  @xml {}
}`;
    
    console.log('\n测试内容:');
    console.log(content);
    
    parseAndCheck(content);
  });
  
  it('✅ @html 空块', () => {
    const content = `POST "https://api.example.com/render" {
  @html {}
}`;
    
    console.log('\n测试内容:');
    console.log(content);
    
    parseAndCheck(content);
  });
  
  it('✅ @javascript 空块', () => {
    const content = `POST "https://api.example.com/execute" {
  @javascript {}
}`;
    
    console.log('\n测试内容:');
    console.log(content);
    
    parseAndCheck(content);
  });
  
  it('✅ @binary 空块', () => {
    const content = `POST "https://api.example.com/upload" {
  @binary {}
}`;
    
    console.log('\n测试内容:');
    console.log(content);
    
    parseAndCheck(content);
  });
  
  it('❌ @xml 定义了 key 但没有值应该报错', () => {
    const content = `POST "https://api.example.com/soap" {
  @xml {
    xml:
  }
}`;
    
    console.log('\n测试内容:');
    console.log(content);
    
    parseAndCheck(content, true);
  });
  
  it('❌ @html 定义了 key 但没有值应该报错', () => {
    const content = `POST "https://api.example.com/render" {
  @html {
    html:
  }
}`;
    
    console.log('\n测试内容:');
    console.log(content);
    
    parseAndCheck(content, true);
  });
  
  it('✅ @xml 与其他格式混合', () => {
    const content = `POST "https://api.example.com/multi" {
  authorization: "Bearer token123"
  
  @xml {
    xml: "<data><item>test</item></data>"
  }
}`;
    
    console.log('\n测试内容:');
    console.log(content);
    
    parseAndCheck(content);
  });
  
  it('✅ 多个请求使用不同格式', () => {
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
}

POST "https://api.example.com/binary" {
  @binary {
    binary: "@file C:/test.bin"
  }
}`;
    
    console.log('\n测试内容:');
    console.log(content);
    
    parseAndCheck(content);
  });
});

