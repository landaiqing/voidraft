import { LRLanguage, LanguageSupport } from '@codemirror/language';
import { styleTags, tags } from '@lezer/highlight';
import { parser } from './mathjs.parser';

export const mathjsLanguage = LRLanguage.define({
  name: 'mathjs',
  parser: parser.configure({
    props: [
      styleTags({
        Number: tags.number,
        String: tags.string,
        Boolean: tags.bool,
        Null: tags.null,
        Function: tags.function(tags.variableName),
        Constant: tags.constant(tags.variableName),
        Unit: tags.unit,
        Currency: tags.unit,
        Identifier: tags.variableName,
        Operator: tags.operator,
        Punctuation: tags.punctuation,
        LineComment: tags.lineComment,
        '( )': tags.paren,
        '[ ]': tags.squareBracket,
        '{ }': tags.brace,
      }),
    ],
  }),
  languageData: {
    commentTokens: { line: ['#'] },
    closeBrackets: { brackets: ['(', '[', '{', "'", '"'] },
  },
});

export function mathjs() {
  return new LanguageSupport(mathjsLanguage);
}
