import {Extension} from '@codemirror/state';
import {createBaseTheme} from '../base';
import type {ThemeColors} from '../types';

const chalky = '#e5c07b';
const coral = '#e06c75';
const cyan = '#56b6c2';
const ivory = '#abb2bf';
const stone = '#7d8799';
const malibu = '#61afef';
const sage = '#98c379';
const whiskey = '#d19a66';
const violet = '#c678dd';
const darkBackground = '#21252b';
const highlightBackground = '#313949ff';
const background = '#282c34';
const selection = '#3e4451';

export const config: ThemeColors = {
  themeName: 'one-dark',
  dark: true,

  background,
  backgroundSecondary: highlightBackground,
  foreground: ivory,
  cursor: '#528bff',
  selection,
  activeLine: '#6699ff0b',
  lineNumber: stone,
  activeLineNumber: ivory,
  diffInserted: sage,
  diffDeleted: coral,
  diffChanged: whiskey,
  borderColor: darkBackground,
  matchingBracket: '#bad0f847',

  comment: stone,
  lineComment: '#6c7484',
  blockComment: '#606775',
  docComment: '#8b92a0',
  name: ivory,
  variableName: coral,
  typeName: chalky,
  tagName: '#e4c78f',
  propertyName: '#d7dee8',
  attributeName: '#efb8c2',
  className: chalky,
  labelName: '#f7b267',
  namespace: '#88c0ff',
  macroName: malibu,
  literal: chalky,
  string: sage,
  docString: '#b3d899',
  character: '#d9f59c',
  attributeValue: '#f0c390',
  number: chalky,
  integer: '#f2c78d',
  float: '#f1ba6a',
  bool: '#f28f6a',
  regexp: cyan,
  escape: '#7fd5e9',
  color: whiskey,
  url: '#7dc7ff',
  keyword: violet,
  self: '#d98ae8',
  null: '#ef8fa8',
  atom: whiskey,
  unit: '#fbd38a',
  modifier: '#d391f2',
  operatorKeyword: '#78c3d6',
  controlKeyword: '#bf6edb',
  definitionKeyword: '#d383e6',
  moduleKeyword: '#a6c1ff',
  operator: cyan,
  derefOperator: '#72c1d3',
  arithmeticOperator: '#6ab4ce',
  logicOperator: '#6ccad7',
  bitwiseOperator: '#4fa8c2',
  compareOperator: '#64b9cc',
  updateOperator: '#4299b8',
  definitionOperator: '#398daf',
  typeOperator: '#3fc4e2',
  controlOperator: '#3f96b0',
  punctuation: '#8eaac2',
  separator: '#7a96b1',
  bracket: '#b3bcc7',
  angleBracket: '#cfd5dd',
  squareBracket: '#96a2ae',
  paren: '#7f8c97',
  brace: '#9aa5af',
  content: ivory,
  heading: coral,
  heading1: '#ffb19d',
  heading2: '#ffa188',
  heading3: '#ff9173',
  heading4: '#ff825e',
  heading5: '#ff7249',
  heading6: '#ff6234',
  contentSeparator: cyan,
  list: '#9da7b4',
  quote: '#8b94a4',
  emphasis: ivory,
  strong: '#f4f6f8',
  link: malibu,
  monospace: '#c2cad1',
  strikethrough: '#9ea5b1',
  inserted: sage,
  deleted: coral,
  changed: whiskey,
  invalid: '#ffffff',
  meta: '#96a1b4',
  documentMeta: '#8a95a6',
  annotation: '#84d0ff',
  processingInstruction: '#7c889c',
  definition: '#c9cfd8',
  constant: whiskey,
  function: malibu,
  standard: '#aeb7c5',
  local: '#b9c2ce',
  special: '#f4d67a',
};

export const oneDark: Extension = createBaseTheme(config);
