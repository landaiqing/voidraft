/**
 * TypeScript type definitions for TOML Prettier plugin
 */

// TOML CST Node types based on @toml-tools/parser
export interface TomlCstNode {
  name?: string;
  image?: string;
  children?: Record<string, TomlCstNode[]>;
  startOffset?: number;
  endOffset?: number;
  startLine?: number;
  endLine?: number;
  tokenType?: any;
}

export interface TomlComment extends TomlCstNode {
  image: string;
}

export interface TomlContext {
  [key: string]: TomlCstNode[];
}

export interface TomlValue extends TomlCstNode {
  children: TomlContext;
}

export interface TomlKeyVal extends TomlCstNode {
  key: TomlCstNode[];
  val: TomlCstNode[];
}

export interface TomlArray extends TomlCstNode {
  arrayValues?: TomlCstNode;
  commentNewline?: TomlCstNode[];
}

export interface TomlInlineTable extends TomlCstNode {
  inlineTableKeyVals?: TomlCstNode;
}

export interface TomlTable extends TomlCstNode {
  table: TomlCstNode[];
}

export interface TomlExpression extends TomlCstNode {
  keyval?: TomlKeyVal[];
  table?: TomlTable[];
  Comment?: TomlComment[];
}

export interface TomlDocument extends TomlCstNode {
  expression?: TomlExpression[];
}

// Print options for TOML formatting
export interface TomlPrintOptions {
  printWidth?: number;
  tabWidth?: number;
  useTabs?: boolean;
}
