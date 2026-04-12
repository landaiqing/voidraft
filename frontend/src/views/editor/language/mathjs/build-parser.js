import { buildParserFile } from '@lezer/generator';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, writeFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const templatePath = join(__dirname, 'mathjs.grammar.template');
const builtinsPath = join(__dirname, 'builtins.json');
const grammarPath = join(__dirname, 'mathjs.grammar');
const parserPath = join(__dirname, 'mathjs.parser.ts');
const termsPath = join(__dirname, 'mathjs.parser.terms.ts');

function specialize(names) {
  return names.map((name) => `@specialize<Identifier, "${name}">`).join(' | ');
}

console.log('开始构建 Math.js 语法解析器...\n');

try {
  const template = readFileSync(templatePath, 'utf-8');
  const builtins = JSON.parse(readFileSync(builtinsPath, 'utf-8'));

  const grammar = template
    .replace('__FUNCTIONS__', specialize(builtins.functions))
    .replace('__CONSTANTS__', specialize(builtins.constants))
    .replace('__UNITS__', specialize(builtins.units))
    .replace('__CURRENCIES__', specialize(builtins.currencies || []));

  writeFileSync(grammarPath, grammar);
  console.log(`✓ 生成 grammar: ${grammarPath}`);

  const result = buildParserFile(grammar, {
    fileName: 'mathjs.grammar',
    typeScript: true,
    warn: (message) => console.warn(`警告: ${message}`),
  });

  writeFileSync(parserPath, result.parser);
  console.log(`✓ 生成 parser: ${parserPath}`);

  if (result.terms) {
    writeFileSync(termsPath, result.terms);
    console.log(`✓ 生成 terms: ${termsPath}`);
  }

  console.log('\nMath.js 语法解析器构建完成');
} catch (error) {
  console.error('构建 Math.js 语法解析器失败:', error.message);
  process.exit(1);
}
