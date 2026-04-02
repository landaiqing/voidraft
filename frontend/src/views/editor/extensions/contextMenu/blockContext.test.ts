import {EditorState} from '@codemirror/state';
import {describe, expect, it, vi} from 'vitest';
vi.mock('../codeblock/lang-parser/languages', () => ({
  LANGUAGES: [
    {token: 'text'},
    {token: 'image'},
  ],
}));

import {getActiveNoteBlock} from '../codeblock/state';
import {createDelimiter} from '../codeblock/parser';
import {blockState} from '../codeblock/state';
import {runCommandInMenuBlock} from './blockContext';
import type {MenuContext} from './menuSchema';

describe('runCommandInMenuBlock', () => {
  it('executes the command against the block targeted by the context menu', () => {
    let state = EditorState.create({
      doc: [
        createDelimiter('text', false, 'write'),
        'first block\n',
        createDelimiter('image', false, 'write'),
        'img(ref="sha256-1", src="/media/a.png")',
      ].join(''),
      selection: {anchor: 1},
      extensions: [blockState],
    });

    const blocks = state.field(blockState);
    const targetBlock = blocks[1];
    const command = vi.fn(view => getActiveNoteBlock(view.state)?.language.name === 'image');
    const wrapped = runCommandInMenuBlock(command);

    const view = {
      get state() {
        return state;
      },
      dispatch(spec: Parameters<EditorState['update']>[0]) {
        state = state.update(spec).state;
      },
    };

    const context: MenuContext = {
      view: view as never,
      event: {} as MouseEvent,
      targetPos: targetBlock.content.from,
      targetBlock,
      hasSelection: false,
      selectionText: '',
      isEditable: true,
    };

    expect(wrapped(view as never, context)).toBe(true);
    expect(command).toHaveBeenCalledOnce();
    expect(getActiveNoteBlock(state)?.language.name).toBe('image');
    expect(state.selection.main.head).toBe(targetBlock.content.from);
  });
});
