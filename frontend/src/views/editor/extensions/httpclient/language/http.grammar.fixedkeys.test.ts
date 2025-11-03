import { describe, it, expect } from 'vitest';
import { parser } from './http.parser';

describe('HTTP Grammar - 固定 Key 约束测试', () => {
  
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
  
  describe('✅ @xml - 正确使用固定 key', () => {
    it('应该接受正确的 xml key', () => {
      const content = `POST "https://api.example.com/soap" {
  @xml {
    xml: "<user><name>张三</name></user>"
  }
}`;
      
      console.log('\n测试内容:');
      console.log(content);
      
      parseAndCheck(content, false);
    });
    
    it('应该拒绝错误的 key 名称', () => {
      const content = `POST "https://api.example.com/soap" {
  @xml {
    data: "<user><name>张三</name></user>"
  }
}`;
      
      console.log('\n测试内容（应该有错误）:');
      console.log(content);
      
      parseAndCheck(content, true);
    });
    
    it('应该拒绝多个属性', () => {
      const content = `POST "https://api.example.com/soap" {
  @xml {
    xml: "<user></user>",
    other: "value"
  }
}`;
      
      console.log('\n测试内容（应该有错误）:');
      console.log(content);
      
      parseAndCheck(content, true);
    });
  });
  
  describe('✅ @html - 正确使用固定 key', () => {
    it('应该接受正确的 html key', () => {
      const content = `POST "https://api.example.com/render" {
  @html {
    html: "<div><h1>标题</h1></div>"
  }
}`;
      
      console.log('\n测试内容:');
      console.log(content);
      
      parseAndCheck(content, false);
    });
    
    it('应该拒绝错误的 key 名称', () => {
      const content = `POST "https://api.example.com/render" {
  @html {
    content: "<div><h1>标题</h1></div>"
  }
}`;
      
      console.log('\n测试内容（应该有错误）:');
      console.log(content);
      
      parseAndCheck(content, true);
    });
  });
  
  describe('✅ @javascript - 正确使用固定 key', () => {
    it('应该接受正确的 javascript key', () => {
      const content = `POST "https://api.example.com/execute" {
  @javascript {
    javascript: "function hello() { return 'world'; }"
  }
}`;
      
      console.log('\n测试内容:');
      console.log(content);
      
      parseAndCheck(content, false);
    });
    
    it('应该拒绝错误的 key 名称', () => {
      const content = `POST "https://api.example.com/execute" {
  @javascript {
    code: "function hello() { return 'world'; }"
  }
}`;
      
      console.log('\n测试内容（应该有错误）:');
      console.log(content);
      
      parseAndCheck(content, true);
    });
  });
  
  describe('✅ @binary - 正确使用固定 key', () => {
    it('应该接受正确的 binary key', () => {
      const content = `POST "https://api.example.com/upload" {
  @binary {
    binary: "@file E://Documents/avatar.png"
  }
}`;
      
      console.log('\n测试内容:');
      console.log(content);
      
      parseAndCheck(content, false);
    });
    
    it('应该拒绝错误的 key 名称', () => {
      const content = `POST "https://api.example.com/upload" {
  @binary {
    file: "@file E://Documents/avatar.png"
  }
}`;
      
      console.log('\n测试内容（应该有错误）:');
      console.log(content);
      
      parseAndCheck(content, true);
    });
  });
  
  describe('✅ 对比：@json 和 @params 允许任意 key', () => {
    it('@json 可以使用任意 key 名称', () => {
      const content = `POST "https://api.example.com/api" {
  @json {
    name: "张三",
    age: 25,
    email: "test@example.com"
  }
}`;
      
      console.log('\n测试内容:');
      console.log(content);
      
      parseAndCheck(content, false);
    });
    
    it('@params 可以使用任意 key 名称', () => {
      const content = `GET "https://api.example.com/users" {
  @params {
    page: 1,
    size: 20,
    filter: "active"
  }
}`;
      
      console.log('\n测试内容:');
      console.log(content);
      
      parseAndCheck(content, false);
    });
  });
  
  describe('✅ 空块测试 - 现在支持空块', () => {
    it('@xml 空块应该成功', () => {
      const content = `POST "https://api.example.com/soap" {
  @xml {}
}`;
      
      console.log('\n测试内容:');
      console.log(content);
      
      parseAndCheck(content, false);
    });
    
    it('@html 空块应该成功', () => {
      const content = `POST "https://api.example.com/render" {
  @html {}
}`;
      
      console.log('\n测试内容:');
      console.log(content);
      
      parseAndCheck(content, false);
    });
    
    it('@javascript 空块应该成功', () => {
      const content = `POST "https://api.example.com/execute" {
  @javascript {}
}`;
      
      console.log('\n测试内容:');
      console.log(content);
      
      parseAndCheck(content, false);
    });
    
    it('@binary 空块应该成功', () => {
      const content = `POST "https://api.example.com/upload" {
  @binary {}
}`;
      
      console.log('\n测试内容:');
      console.log(content);
      
      parseAndCheck(content, false);
    });
  });
  
  describe('❌ 定义了 key 但没有值应该报错', () => {
    it('@xml 定义了 xml key 但没有值', () => {
      const content = `POST "https://api.example.com/soap" {
  @xml {
    xml:
  }
}`;
      
      console.log('\n测试内容（应该有错误）:');
      console.log(content);
      
      parseAndCheck(content, true);
    });
    
    it('@html 定义了 html key 但没有值', () => {
      const content = `POST "https://api.example.com/render" {
  @html {
    html:
  }
}`;
      
      console.log('\n测试内容（应该有错误）:');
      console.log(content);
      
      parseAndCheck(content, true);
    });
    
    it('@javascript 定义了 javascript key 但没有值', () => {
      const content = `POST "https://api.example.com/execute" {
  @javascript {
    javascript:
  }
}`;
      
      console.log('\n测试内容（应该有错误）:');
      console.log(content);
      
      parseAndCheck(content, true);
    });
    
    it('@binary 定义了 binary key 但没有值', () => {
      const content = `POST "https://api.example.com/upload" {
  @binary {
    binary:
  }
}`;
      
      console.log('\n测试内容（应该有错误）:');
      console.log(content);
      
      parseAndCheck(content, true);
    });
  });
});

