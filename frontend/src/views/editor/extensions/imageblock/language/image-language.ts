import { LRLanguage, LanguageSupport } from '@codemirror/language';
import { parser } from './image.parser';
import { imageHighlighting } from './image.highlight';

export const imageLanguage = LRLanguage.define({
  parser: parser.configure({
    props: [imageHighlighting],
  }),
  languageData: {
    closeBrackets: { brackets: ['(', '"', "'"] },
    wordChars: '-_',
  },
});

export function image() {
  return new LanguageSupport(imageLanguage);
}
