#!/usr/bin/env node

import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('Building image grammar parser...');

try {
  const grammarFile = path.join(__dirname, 'image.grammar');
  if (!fs.existsSync(grammarFile)) {
    throw new Error('Grammar file image.grammar not found');
  }

  execSync('npx lezer-generator image.grammar -o image.parser.ts --typeScript', {
    cwd: __dirname,
    stdio: 'inherit',
  });

  const parserFile = path.join(__dirname, 'image.parser.ts');
  const termsFile = path.join(__dirname, 'image.parser.terms.ts');

  if (!fs.existsSync(parserFile) || !fs.existsSync(termsFile)) {
    throw new Error('Failed to generate image parser artifacts');
  }

  console.log('Generated image.parser.ts and image.parser.terms.ts');
} catch (error) {
  console.error('Failed to build image grammar parser:', error instanceof Error ? error.message : error);
  process.exit(1);
}
