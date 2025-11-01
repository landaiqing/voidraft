#!/usr/bin/env node

/**
 * 解析器构建脚本
 * 使用 lezer-generator 从语法文件生成解析器
 * 使用：node build-parser.js
 */

import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('🚀 start building parser...');

try {
  // 检查语法文件是否存在
  const grammarFile = path.join(__dirname, 'codeblock.grammar');
  if (!fs.existsSync(grammarFile)) {
    throw new Error('grammarFile codeblock.grammar not found');
  }

  console.log('📄 grammar file:', grammarFile);

  // 运行 lezer-generator
  console.log('⚙️  building parser...');
  execSync('npx lezer-generator codeblock.grammar -o parser.ts --typeScript', {
    cwd: __dirname,
    stdio: 'inherit'
  });

  // 检查生成的文件
  const parserFile = path.join(__dirname, 'parser.ts');
  const termsFile = path.join(__dirname, 'parser.terms.ts');

  if (fs.existsSync(parserFile) && fs.existsSync(termsFile)) {
    console.log('✅ parser file successfully generated！');
    console.log('📦 parser files:');
    console.log('  - parser.ts');
    console.log('  - parser.terms.ts');
  } else {
    throw new Error('failed to generate parser');
  }

  console.log('🎉 build success！');

} catch (error) {
  console.error('❌ build failed:', error.message);
  process.exit(1);
} 