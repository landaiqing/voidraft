import { describe, expect, it, vi } from 'vitest';
import { EditorState } from '@codemirror/state';
import { blockState } from '../codeblock/state';
import { codeBlockEvent, LANGUAGE_CHANGE } from '../codeblock/annotation';
import {
  DELIMITER_PREFIX,
  DELIMITER_SUFFIX,
  READONLY_SUFFIX,
  WRITABLE_SUFFIX,
} from '../codeblock/types';
import { createBlockReadonlyExtension } from './index';

vi.mock('../codeblock/lang-parser/languages', () => ({
  LANGUAGES: [{ token: 'text' }],
}));

function createTestState(doc: string) {
  return EditorState.create({
    doc,
    extensions: [
      blockState,
      createBlockReadonlyExtension(),
    ],
  });
}

function createDelimiter(access: 'read' | 'write') {
  const accessSuffix = access === 'read' ? READONLY_SUFFIX : WRITABLE_SUFFIX;
  return `${DELIMITER_PREFIX}text${accessSuffix}${DELIMITER_SUFFIX}`;
}

function createTestDocument() {
  return [
    createDelimiter('write'),
    'const writable = 1;\n',
    createDelimiter('read'),
    'const readonlyValue = 2;\n',
    createDelimiter('write'),
    'const tail = 3;\n',
  ].join('');
}

describe('block readonly protection', () => {
  it('blocks edits inside readonly block content', () => {
    const state = createTestState(createTestDocument());
    const readonlyBlock = state.field(blockState)[1]!;

    const transaction = state.update({
      changes: {
        from: readonlyBlock.content.from,
        to: readonlyBlock.content.from + 5,
        insert: 'let',
      },
    });

    expect(transaction.state.doc.toString()).toBe(state.doc.toString());
  });

  it('blocks deleting a readonly block from its start boundary', () => {
    const state = createTestState(createTestDocument());
    const readonlyBlock = state.field(blockState)[1]!;

    const transaction = state.update({
      changes: {
        from: readonlyBlock.content.from - 1,
        to: readonlyBlock.content.from,
        insert: '',
      },
    });

    expect(transaction.state.doc.toString()).toBe(state.doc.toString());
  });

  it('still allows updating a readonly block delimiter through internal commands', () => {
    const state = createTestState(createTestDocument());
    const readonlyBlock = state.field(blockState)[1]!;
    const writableDelimiter = createDelimiter('write');

    const transaction = state.update({
      changes: {
        from: readonlyBlock.delimiter.from,
        to: readonlyBlock.delimiter.to,
        insert: writableDelimiter,
      },
      annotations: [codeBlockEvent.of(LANGUAGE_CHANGE)],
    });

    expect(transaction.state.field(blockState)[1]?.access).toBe('write');
  });
});
