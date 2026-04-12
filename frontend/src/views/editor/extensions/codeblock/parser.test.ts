import { describe, expect, it, vi } from 'vitest';
import { EditorState } from '@codemirror/state';

vi.mock('./lang-parser/languages', () => ({
  LANGUAGES: [
    { token: 'text' },
    { token: 'ts' },
    { token: 'json' },
    { token: 'math' },
    { token: 'go' },
  ],
}));

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

  it('parses createdAt metadata from delimiters', () => {
    const createdAt = '2026-04-12T08:30:00.000Z';
    const delimiter = createDelimiter('math', false, 'write', createdAt);

    expect(parseDelimiter(delimiter)).toEqual({
      language: 'math',
      auto: false,
      access: 'write',
      createdAt,
    });
  });

  it('keeps createdAt metadata when reading blocks from string', () => {
    const createdAt = '2026-04-12T08:30:00.000Z';
    const document = [
      createDelimiter('math', false, 'write', createdAt),
      '1 + 1\n',
    ].join('');

    const state = EditorState.create({ doc: document });
    const [block] = getBlocksFromString(state);

    expect(block?.createdAt).toBe(createdAt);
    expect(block?.language).toEqual({ name: 'math', auto: false });
  });
});
