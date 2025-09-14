import type {
  CstNode,
  IToken,
  ILexingError,
  IRecognitionException,
  CstElement,
} from "chevrotain";

export interface SourceLocation {
  startOffset: number;
  endOffset: number;
  startLine: number;
  endLine: number;
  startColumn: number;
  endColumn: number;
}

export interface ScalaCstNode extends CstNode {
  name: string;
  children: Record<string, CstElement[]>;
  location?: SourceLocation;
  // Additional properties for compatibility
  image?: string;
  type?: string;
  originalComments?: string[];
  startLine?: number;
  value?: string;
  startOffset?: number;
  endOffset?: number;
}

export interface ParseResult {
  cst: ScalaCstNode;
  errors: IRecognitionException[];
  comments: IToken[];
}

export interface LexResult {
  tokens: IToken[];
  errors: ILexingError[];
  groups: {
    comments?: IToken[];
  };
}

export interface TokenBounds {
  start: number;
  end: number;
}

export interface LineColumn {
  line: number;
  column: number;
}

// Chevrotain パーサーメソッドの戻り値型
export interface ParserMethodResult extends CstNode {
  name: string;
  children: Record<string, (CstNode | IToken)[]>;
}

// パーサールールの型定義
export type ParserRule<T = ParserMethodResult> = () => T;
