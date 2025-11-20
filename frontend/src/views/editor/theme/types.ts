export type SyntaxTag =
  | 'comment'
  | 'lineComment'
  | 'blockComment'
  | 'docComment'
  | 'name'
  | 'variableName'
  | 'typeName'
  | 'tagName'
  | 'propertyName'
  | 'attributeName'
  | 'className'
  | 'labelName'
  | 'namespace'
  | 'macroName'
  | 'literal'
  | 'string'
  | 'docString'
  | 'character'
  | 'attributeValue'
  | 'number'
  | 'integer'
  | 'float'
  | 'bool'
  | 'regexp'
  | 'escape'
  | 'color'
  | 'url'
  | 'keyword'
  | 'self'
  | 'null'
  | 'atom'
  | 'unit'
  | 'modifier'
  | 'operatorKeyword'
  | 'controlKeyword'
  | 'definitionKeyword'
  | 'moduleKeyword'
  | 'operator'
  | 'derefOperator'
  | 'arithmeticOperator'
  | 'logicOperator'
  | 'bitwiseOperator'
  | 'compareOperator'
  | 'updateOperator'
  | 'definitionOperator'
  | 'typeOperator'
  | 'controlOperator'
  | 'punctuation'
  | 'separator'
  | 'bracket'
  | 'angleBracket'
  | 'squareBracket'
  | 'paren'
  | 'brace'
  | 'content'
  | 'heading'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'heading4'
  | 'heading5'
  | 'heading6'
  | 'contentSeparator'
  | 'list'
  | 'quote'
  | 'emphasis'
  | 'strong'
  | 'link'
  | 'monospace'
  | 'strikethrough'
  | 'inserted'
  | 'deleted'
  | 'changed'
  | 'invalid'
  | 'meta'
  | 'documentMeta'
  | 'annotation'
  | 'processingInstruction'
  | 'definition'
  | 'constant'
  | 'function'
  | 'standard'
  | 'local'
  | 'special';

export interface ThemeTagColors {
  comment: string;
  lineComment: string;
  blockComment: string;
  docComment: string;
  name: string;
  variableName: string;
  typeName: string;
  tagName: string;
  propertyName: string;
  attributeName: string;
  className: string;
  labelName: string;
  namespace: string;
  macroName: string;
  literal: string;
  string: string;
  docString: string;
  character: string;
  attributeValue: string;
  number: string;
  integer: string;
  float: string;
  bool: string;
  regexp: string;
  escape: string;
  color: string;
  url: string;
  keyword: string;
  self: string;
  null: string;
  atom: string;
  unit: string;
  modifier: string;
  operatorKeyword: string;
  controlKeyword: string;
  definitionKeyword: string;
  moduleKeyword: string;
  operator: string;
  derefOperator: string;
  arithmeticOperator: string;
  logicOperator: string;
  bitwiseOperator: string;
  compareOperator: string;
  updateOperator: string;
  definitionOperator: string;
  typeOperator: string;
  controlOperator: string;
  punctuation: string;
  separator: string;
  bracket: string;
  angleBracket: string;
  squareBracket: string;
  paren: string;
  brace: string;
  content: string;
  heading: string;
  heading1: string;
  heading2: string;
  heading3: string;
  heading4: string;
  heading5: string;
  heading6: string;
  contentSeparator: string;
  list: string;
  quote: string;
  emphasis: string;
  strong: string;
  link: string;
  monospace: string;
  strikethrough: string;
  inserted: string;
  deleted: string;
  changed: string;
  invalid: string;
  meta: string;
  documentMeta: string;
  annotation: string;
  processingInstruction: string;
  definition: string;
  constant: string;
  function: string;
  standard: string;
  local: string;
  special: string;
}

export interface ThemeColors extends ThemeTagColors {
  themeName: string;
  dark: boolean;

  background: string;  // 背景
  backgroundSecondary: string; // 第二背景块

  foreground: string;  // 背景文字颜色

  cursor: string; // 光标颜色
  selection: string;  // 选中文字颜色
  activeLine: string;  // 当前行颜色
  lineNumber: string;  // 行号颜色
  activeLineNumber: string;  // 当前行号颜色

  diffInserted?: string;  // 插入颜色
  diffDeleted?: string;  // 删除颜色
  diffChanged?: string;  // 变更颜色

  borderColor: string;  // 边框颜色
  matchingBracket: string;  // 匹配括号颜色
}

