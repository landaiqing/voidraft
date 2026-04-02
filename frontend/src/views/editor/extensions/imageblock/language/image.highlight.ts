import { styleTags, tags as t } from '@lezer/highlight';

export const imageHighlighting = styleTags({
  ImgKeyword: t.keyword,

  'RefAttributeName SrcAttributeName WidthAttributeName HeightAttributeName AltAttributeName TitleAttributeName':
    t.attributeName,

  StringLiteral: t.string,
  NumberLiteral: t.number,
  'True False': t.bool,
  Null: t.null,

  LineComment: t.lineComment,

  '=': t.definitionOperator,
  ',': t.separator,
  '( )': t.paren,
});
