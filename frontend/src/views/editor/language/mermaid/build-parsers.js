import { buildParserFile } from '@lezer/generator';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, writeFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const parsersDir = join(__dirname, 'parsers');

const parserTypes = [
  'mermaid',
  'mindmap',
  'pie',
  'flowchart',
  'sequence',
  'journey',
  'requirement',
  'gantt'
];

console.log('开始构建 Mermaid 语法解析器...\n');

for (const type of parserTypes) {
  try {
    const grammarPath = join(parsersDir, type, `${type}.grammar`);
    const outputPath = join(parsersDir, type, `${type}.parser.grammar.ts`);
    
    console.log(`正在处理: ${type}`);
    console.log(`  读取: ${grammarPath}`);
    
    const grammar = readFileSync(grammarPath, 'utf-8');
    const result = buildParserFile(grammar, {
      fileName: `${type}.grammar`,
      typeScript: true,
      warn: (message) => console.warn(`  警告: ${message}`)
    });
    
    writeFileSync(outputPath, result.parser);
    console.log(`  ✓ 生成: ${outputPath}`);
    
    // 生成 terms 文件
    if (result.terms) {
      const termsPath = join(parsersDir, type, `${type}.grammar.terms.ts`);
      writeFileSync(termsPath, result.terms);
      console.log(`  ✓ 生成: ${termsPath}`);
    }
    
    console.log('');
  } catch (error) {
    console.error(`  ✗ 错误: ${type} - ${error.message}\n`);
    process.exit(1);
  }
}

console.log('✓ 所有解析器构建完成！');

