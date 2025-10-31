#!/usr/bin/env node

/**
 * HTTP Grammar Parser Builder
 * 编译 Lezer grammar 文件为 JavaScript parser
 * 使用命令行方式编译
 */

import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('🚀 开始编译 HTTP grammar parser...');

try {
  // 检查语法文件是否存在
  const grammarFile = path.join(__dirname, 'http.grammar');
  if (!fs.existsSync(grammarFile)) {
    throw new Error('语法文件 http.grammar 未找到');
  }

  console.log('📄 语法文件:', grammarFile);

  // 运行 lezer-generator
  console.log('⚙️  编译 parser...');
  execSync('npx lezer-generator http.grammar -o http.grammar.js', {
    cwd: __dirname,
    stdio: 'inherit'
  });

  // 检查生成的文件
  const parserFile = path.join(__dirname, 'http.grammar.js');
  const termsFile = path.join(__dirname, 'http.grammar.terms.js');

  if (fs.existsSync(parserFile) && fs.existsSync(termsFile)) {
    console.log('✅ Parser 文件成功生成！');
    console.log('📦 生成的文件:');
    console.log('  - http.grammar.js');
    console.log('  - http.grammar.terms.js');
  } else {
    throw new Error('Parser 生成失败');
  }

  console.log('🎉 编译成功！');

} catch (error) {
  console.error('❌ 编译失败:', error.message);
  process.exit(1);
}

