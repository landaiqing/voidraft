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
import {getImageBlockItems} from './syntax';

describe('image block syntax integration', () => {
  it('reads image items from the nested image parser inside a code block', () => {
    const doc = [
      createDelimiter('image', false, 'write'),
      'img(ref="sha256-1", src="/media/a.png", alt="cover", width=320, height=180, title="cover image")\n',
      'img(src="https://example.com/demo.png", ref="sha256-2", width=240, height=240)',
    ].join('');

    const state = EditorState.create({
      doc,
      extensions: [
        blockState,
        ...getCodeBlockLanguageExtension(),
      ],
    });

    const [block] = state.field(blockState);
    expect(block?.language.name).toBe('image');

    expect(getImageBlockItems(state, block!)).toEqual([
      {
        ref: 'sha256-1',
        src: '/media/a.png',
        alt: 'cover',
        title: 'cover image',
        width: 320,
        height: 180,
      },
      {
        ref: 'sha256-2',
        src: 'https://example.com/demo.png',
        alt: undefined,
        title: undefined,
        width: 240,
        height: 240,
      },
    ]);
  });
});
