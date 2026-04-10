import { describe, expect, it } from 'vitest';
import { EditorState } from '@codemirror/state';
import { createDelimiter, getBlocksFromString, parseDelimiter } from './parser';

describe('codeblock delimiter access', () => {
  it('parses readonly delimiters with auto-detect', () => {
    expect(parseDelimiter(createDelimiter('ts', true, 'read'))).toEqual({
      language: 'ts',
      auto: true,
      access: 'read',
    });
  });

  it('keeps legacy delimiters writable by default', () => {
    expect(parseDelimiter('\n∞∞∞go-a\n')).toEqual({
      language: 'go',
      auto: true,
      access: 'write',
    });
  });

  it('parses a first delimiter without the leading newline', () => {
    expect(parseDelimiter('∞∞∞text-a-w\n')).toEqual({
      language: 'text',
      auto: true,
      access: 'write',
    });

    const state = EditorState.create({ doc: '∞∞∞text-a-w\nhello' });
    const blocks = getBlocksFromString(state);

    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.delimiter).toEqual({ from: 0, to: '∞∞∞text-a-w\n'.length });
    expect(blocks[0]?.content).toEqual({ from: '∞∞∞text-a-w\n'.length, to: '∞∞∞text-a-w\nhello'.length });
  });

  it('builds block access from string parsing', () => {
    const document = [
      createDelimiter('ts', false, 'read'),
      'const value = 1;\n',
      createDelimiter('json', true, 'write'),
      '{}',
    ].join('');

    const state = EditorState.create({ doc: document });
    const blocks = getBlocksFromString(state);

    expect(blocks).toHaveLength(2);
    expect(blocks[0]?.access).toBe('read');
    expect(blocks[0]?.language).toEqual({ name: 'ts', auto: false });
    expect(blocks[1]?.access).toBe('write');
    expect(blocks[1]?.language).toEqual({ name: 'json', auto: true });
  });
});
