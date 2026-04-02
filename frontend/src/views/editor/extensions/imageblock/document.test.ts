import {EditorState} from '@codemirror/state';
import {describe, expect, it, vi} from 'vitest';

vi.mock('@/views/editor/extensions/codeblock/lang-parser/languages', async () => {
  const {imageLanguage} = await import('@/views/editor/extensions/imageblock/language/image-language');

  return {
    LANGUAGES: [
      {token: 'text', parser: null},
      {token: 'image', parser: imageLanguage.parser},
    ],
    languageMapping: {
      image: imageLanguage.parser,
    },
  };
});

import {getCodeBlockLanguageExtension} from '@/views/editor/extensions/codeblock/lang-parser';
import {createDelimiter} from '@/views/editor/extensions/codeblock/parser';
import {blockState} from '@/views/editor/extensions/codeblock/state';
import {moveImageItemInBlock, removeImageItemFromBlock} from './document';
import {imageBlockSelectionField} from './selection';

function createView(state: EditorState) {
  return {
    get state() {
      return state;
    },
    dispatch(spec: Parameters<EditorState['update']>[0]) {
      state = state.update(spec).state;
    },
  };
}

describe('removeImageItemFromBlock', () => {
  it('removes one image record and keeps the block', () => {
    let state = EditorState.create({
      doc: [
        createDelimiter('image', false, 'write'),
        'img(ref="sha256-1", src="/media/a.png")\n',
        'img(ref="sha256-2", src="/media/b.png")',
      ].join(''),
      extensions: [
        blockState,
        imageBlockSelectionField,
        ...getCodeBlockLanguageExtension(),
      ],
    });

    const block = state.field(blockState)[0];
    const view = createView(state);

    expect(removeImageItemFromBlock(view as never, block, 0)).toBe(true);
    expect(view.state.doc.toString()).toContain('sha256-2');
    expect(view.state.doc.toString()).not.toContain('sha256-1');
    expect(view.state.field(blockState)).toHaveLength(1);
    expect(view.state.field(imageBlockSelectionField)?.itemIndex).toBe(0);
  });

  it('removes the whole image block when the last image is deleted', () => {
    let state = EditorState.create({
      doc: [
        createDelimiter('text', false, 'write'),
        'before\n',
        createDelimiter('image', false, 'write'),
        'img(ref="sha256-1", src="/media/a.png")',
      ].join(''),
      extensions: [
        blockState,
        imageBlockSelectionField,
        ...getCodeBlockLanguageExtension(),
      ],
    });

    const block = state.field(blockState)[1];
    const view = createView(state);

    expect(removeImageItemFromBlock(view as never, block, 0)).toBe(true);
    expect(view.state.doc.toString()).not.toContain('sha256-1');
    expect(view.state.field(blockState)).toHaveLength(1);
    expect(view.state.field(blockState)[0].language.name).toBe('text');
    expect(view.state.field(imageBlockSelectionField, false)).toBeNull();
  });
});

describe('moveImageItemInBlock', () => {
  it('moves an image record within the current block', () => {
    let state = EditorState.create({
      doc: [
        createDelimiter('image', false, 'write'),
        'img(ref="sha256-1", src="/media/a.png")\n',
        'img(ref="sha256-2", src="/media/b.png")\n',
        'img(ref="sha256-3", src="/media/c.png")',
      ].join(''),
      extensions: [
        blockState,
        imageBlockSelectionField,
        ...getCodeBlockLanguageExtension(),
      ],
    });

    const block = state.field(blockState)[0];
    const view = createView(state);

    expect(moveImageItemInBlock(view as never, block, 0, 3)).toBe(true);
    expect(view.state.doc.toString()).toContain([
      'img(ref="sha256-2", src="/media/b.png")',
      'img(ref="sha256-3", src="/media/c.png")',
      'img(ref="sha256-1", src="/media/a.png")',
    ].join('\n'));
    expect(view.state.field(imageBlockSelectionField)?.itemIndex).toBe(2);
  });
});
