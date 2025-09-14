import { createToken, Lexer, ILexingResult } from "chevrotain";

// Keywords
export const Val = createToken({ name: "Val", pattern: /val\b/ });
export const Var = createToken({ name: "Var", pattern: /var\b/ });
export const Def = createToken({ name: "Def", pattern: /def\b/ });
export const Class = createToken({ name: "Class", pattern: /class\b/ });
export const ObjectKeyword = createToken({
  name: "Object",
  pattern: /object\b/,
});
export const Trait = createToken({ name: "Trait", pattern: /trait\b/ });
export const Extends = createToken({ name: "Extends", pattern: /extends\b/ });
export const With = createToken({ name: "With", pattern: /with\b/ });
export const If = createToken({ name: "If", pattern: /if\b/ });
export const Else = createToken({ name: "Else", pattern: /else\b/ });
export const While = createToken({ name: "While", pattern: /while\b/ });
export const For = createToken({ name: "For", pattern: /for\b/ });
export const Yield = createToken({ name: "Yield", pattern: /yield\b/ });
export const Return = createToken({ name: "Return", pattern: /return\b/ });
export const New = createToken({ name: "New", pattern: /new\b/ });
export const This = createToken({ name: "This", pattern: /this\b/ });
export const Super = createToken({ name: "Super", pattern: /super\b/ });
export const Package = createToken({ name: "Package", pattern: /package\b/ });
export const Import = createToken({ name: "Import", pattern: /import\b/ });
export const Case = createToken({ name: "Case", pattern: /case\b/ });
export const Match = createToken({ name: "Match", pattern: /match\b/ });
export const Try = createToken({ name: "Try", pattern: /try\b/ });
export const Catch = createToken({ name: "Catch", pattern: /catch\b/ });
export const Finally = createToken({ name: "Finally", pattern: /finally\b/ });
export const Throw = createToken({ name: "Throw", pattern: /throw\b/ });
export const Null = createToken({ name: "Null", pattern: /null\b/ });
export const True = createToken({ name: "True", pattern: /true\b/ });
export const False = createToken({ name: "False", pattern: /false\b/ });
export const NotImplemented = createToken({
  name: "NotImplemented",
  pattern: /\?\?\?/,
});
export const Type = createToken({ name: "Type", pattern: /type\b/ });
export const Private = createToken({ name: "Private", pattern: /private\b/ });
export const Protected = createToken({
  name: "Protected",
  pattern: /protected\b/,
});
export const Public = createToken({ name: "Public", pattern: /public\b/ });
export const Abstract = createToken({
  name: "Abstract",
  pattern: /abstract\b/,
});
export const Final = createToken({ name: "Final", pattern: /final\b/ });
export const Sealed = createToken({ name: "Sealed", pattern: /sealed\b/ });
export const Implicit = createToken({
  name: "Implicit",
  pattern: /implicit\b/,
});
export const Lazy = createToken({ name: "Lazy", pattern: /lazy\b/ });
export const Override = createToken({
  name: "Override",
  pattern: /override\b/,
});
export const Given = createToken({ name: "Given", pattern: /given\b/ });
export const Using = createToken({ name: "Using", pattern: /using\b/ });
export const To = createToken({ name: "To", pattern: /to\b/ });
export const Enum = createToken({ name: "Enum", pattern: /enum\b/ });
export const Array = createToken({ name: "Array", pattern: /Array\b/ });
export const Extension = createToken({
  name: "Extension",
  pattern: /extension\b/,
});
export const Export = createToken({ name: "Export", pattern: /export\b/ });
export const Opaque = createToken({ name: "Opaque", pattern: /opaque\b/ });
export const Inline = createToken({ name: "Inline", pattern: /inline\b/ });
export const Transparent = createToken({
  name: "Transparent",
  pattern: /transparent\b/,
});

// Identifiers (must come after keywords)
// Enhanced Unicode identifier support following Scala Language Specification
// Operator identifier for custom operators (e.g., +++, <~>, etc.)
export const OperatorIdentifier = createToken({
  name: "OperatorIdentifier",
  pattern: /[+\-*/%:&|^<>=!~?#@$\\]+/,
});

// Backward compatible with existing implementation, enhanced mathematical symbol support
// Supports: Latin, Greek, Cyrillic, CJK, Arabic, Hebrew, Mathematical symbols, Emojis (via surrogate pairs)
export const Identifier = createToken({
  name: "Identifier",
  pattern:
    /(?:_[a-zA-Z0-9_$\u00C0-\u00FF\u0370-\u03FF\u0400-\u04FF\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\u0590-\u05FF\u0600-\u06FF\u2200-\u22FF\u27C0-\u27EF\u2980-\u29FF\u2A00-\u2AFF]+|[a-zA-Z$\u00C0-\u00FF\u0370-\u03FF\u0400-\u04FF\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\u0590-\u05FF\u0600-\u06FF\u2200-\u22FF\u27C0-\u27EF\u2980-\u29FF\u2A00-\u2AFF][a-zA-Z0-9_$\u00C0-\u00FF\u0370-\u03FF\u0400-\u04FF\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\u0590-\u05FF\u0600-\u06FF\u2200-\u22FF\u27C0-\u27EF\u2980-\u29FF\u2A00-\u2AFF]*)/u,
});

// Literals
export const IntegerLiteral = createToken({
  name: "IntegerLiteral",
  pattern: /-?\d+[lLiIsSbB]?/,
});

// Scientific notation literal (must come before FloatingPointLiteral)
export const ScientificNotationLiteral = createToken({
  name: "ScientificNotationLiteral",
  pattern: /-?\d+(\.\d+)?[eE][+-]?\d+[fFdD]?/,
});

export const FloatingPointLiteral = createToken({
  name: "FloatingPointLiteral",
  pattern: /-?\d+\.\d+[fFdD]?|-?\.\d+[fFdD]?/,
});

export const StringLiteral = createToken({
  name: "StringLiteral",
  pattern: /"""[\s\S]*?"""|"([^"\\]|\\.|\\u[0-9A-Fa-f]{4})*"/,
});

export const InterpolatedStringLiteral = createToken({
  name: "InterpolatedStringLiteral",
  pattern:
    /[a-zA-Z_][a-zA-Z0-9_]*"""[\s\S]*?"""|[a-zA-Z_][a-zA-Z0-9_]*"([^"\\]|\\.|\\u[0-9A-Fa-f]{4}|\$[a-zA-Z_][a-zA-Z0-9_]*|\$\{[^}]*\})*"/,
});

export const CharLiteral = createToken({
  name: "CharLiteral",
  pattern: /'([^'\\]|\\.|\\u[0-9A-Fa-f]{4})'/,
});

// Operators
export const Equals = createToken({ name: "Equals", pattern: /=/ });
export const Plus = createToken({ name: "Plus", pattern: /\+/ });
export const Minus = createToken({ name: "Minus", pattern: /-/ });
export const Star = createToken({ name: "Star", pattern: /\*/ });
export const Slash = createToken({ name: "Slash", pattern: /\// });
export const Backslash = createToken({ name: "Backslash", pattern: /\\/ });
export const Percent = createToken({ name: "Percent", pattern: /%/ });
export const LessThan = createToken({ name: "LessThan", pattern: /</ });
export const GreaterThan = createToken({ name: "GreaterThan", pattern: />/ });
export const LessThanEquals = createToken({
  name: "LessThanEquals",
  pattern: /<=/,
});
export const GreaterThanEquals = createToken({
  name: "GreaterThanEquals",
  pattern: />=/,
});
export const EqualsEquals = createToken({
  name: "EqualsEquals",
  pattern: /==/,
});
export const DoubleEquals = EqualsEquals; // Alias for modular parser compatibility
export const NotEquals = createToken({ name: "NotEquals", pattern: /!=/ });
export const LogicalAnd = createToken({ name: "LogicalAnd", pattern: /&&/ });
export const LogicalOr = createToken({ name: "LogicalOr", pattern: /\|\|/ });
export const Exclamation = createToken({ name: "Exclamation", pattern: /!/ });
export const Arrow = createToken({ name: "Arrow", pattern: /=>/ });
export const TypeLambdaArrow = createToken({
  name: "TypeLambdaArrow",
  pattern: /=>>/,
});
export const DoubleArrow = TypeLambdaArrow; // Alias for modular parser compatibility
export const LeftArrow = createToken({ name: "LeftArrow", pattern: /<-/ });
export const RightArrow = createToken({ name: "RightArrow", pattern: /->/ });
export const ContextArrow = createToken({
  name: "ContextArrow",
  pattern: /\?=>/,
});
export const SubtypeOf = createToken({ name: "SubtypeOf", pattern: /<:/ });
export const ColonLess = SubtypeOf; // Alias for modular parser compatibility
export const SupertypeOf = createToken({ name: "SupertypeOf", pattern: />:/ });
export const GreaterColon = SupertypeOf; // Alias for modular parser compatibility
export const AppendOp = createToken({ name: "AppendOp", pattern: /:\+/ });
export const PlusColon = AppendOp; // Alias for modular parser compatibility
export const ColonPlus = createToken({ name: "ColonPlus", pattern: /:\+/ }); // Same as AppendOp but separate token for parser
export const PrependOp = createToken({ name: "PrependOp", pattern: /::/ });
export const ColonColon = PrependOp; // Alias for modular parser compatibility
export const ConcatOp = createToken({ name: "ConcatOp", pattern: /\+\+/ });
export const DoublePlus = ConcatOp; // Alias for modular parser compatibility
export const AppendEquals = createToken({
  name: "AppendEquals",
  pattern: /\+\+=/,
});
// Compound assignment operators
export const PlusEquals = createToken({ name: "PlusEquals", pattern: /\+=/ });
export const MinusEquals = createToken({ name: "MinusEquals", pattern: /-=/ });
export const StarEquals = createToken({ name: "StarEquals", pattern: /\*=/ });
export const SlashEquals = createToken({ name: "SlashEquals", pattern: /\/=/ });
export const PercentEquals = createToken({
  name: "PercentEquals",
  pattern: /%=/,
});
// sbt DSL operators
export const DoublePercent = createToken({
  name: "DoublePercent",
  pattern: /%%/,
});
// Bitwise operators
export const BitwiseAnd = createToken({ name: "BitwiseAnd", pattern: /&/ });
export const BitwiseOr = createToken({ name: "BitwiseOr", pattern: /\|/ });
export const BitwiseXor = createToken({ name: "BitwiseXor", pattern: /\^/ });
export const BitwiseTilde = createToken({ name: "BitwiseTilde", pattern: /~/ });
export const LeftShift = createToken({ name: "LeftShift", pattern: /<</ });
export const RightShift = createToken({ name: "RightShift", pattern: />>/ });
export const UnsignedRightShift = createToken({
  name: "UnsignedRightShift",
  pattern: />>>/,
});
export const Colon = createToken({ name: "Colon", pattern: /:/ });
export const ColonEquals = createToken({ name: "ColonEquals", pattern: /:=/ });
export const SbtAssign = ColonEquals; // Alias for sbt compatibility
export const Semicolon = createToken({ name: "Semicolon", pattern: /;/ });
export const Comma = createToken({ name: "Comma", pattern: /,/ });
export const Dot = createToken({ name: "Dot", pattern: /\./ });
export const Underscore = createToken({
  name: "Underscore",
  pattern: /_/,
});
export const At = createToken({ name: "At", pattern: /@/ });
export const Question = createToken({ name: "Question", pattern: /\?/ });

// Quote and Splice tokens for Scala 3 macros
export const QuoteStart = createToken({ name: "QuoteStart", pattern: /'\{/ });
export const SpliceStart = createToken({
  name: "SpliceStart",
  pattern: /\$\{/,
});

// Additional tokens for modular parser
export const Quote = createToken({ name: "Quote", pattern: /'/ });
export const Dollar = createToken({ name: "Dollar", pattern: /\$/ });
// QuestionArrow is now alias for ContextArrow to avoid duplicate patterns
export const QuestionArrow = ContextArrow;

// String interpolation tokens
export const InterpolatedString = createToken({
  name: "InterpolatedString",
  pattern: /s"([^"\\]|\\.|\\u[0-9A-Fa-f]{4})*"/,
});
export const FormattedString = createToken({
  name: "FormattedString",
  pattern: /f"([^"\\]|\\.|\\u[0-9A-Fa-f]{4})*"/,
});
export const RawString = createToken({
  name: "RawString",
  pattern: /raw"([^"\\]|\\.|\\u[0-9A-Fa-f]{4})*"/,
});
export const CustomInterpolatedString = createToken({
  name: "CustomInterpolatedString",
  pattern: /[a-zA-Z_][a-zA-Z0-9_]*"([^"\\]|\\.|\\u[0-9A-Fa-f]{4})*"/,
});

// Numeric suffix tokens
export const LongSuffix = createToken({ name: "LongSuffix", pattern: /[lL]/ });
export const IntSuffix = createToken({ name: "IntSuffix", pattern: /[iI]/ });
export const ShortSuffix = createToken({
  name: "ShortSuffix",
  pattern: /[sS]/,
});
export const ByteSuffix = createToken({ name: "ByteSuffix", pattern: /[bB]/ });
export const FloatSuffix = createToken({
  name: "FloatSuffix",
  pattern: /[fF]/,
});
export const DoubleSuffix = createToken({
  name: "DoubleSuffix",
  pattern: /[dD]/,
});

// Additional missing tokens
export const Hash = createToken({ name: "Hash", pattern: /#/ });

// Delimiters
export const LeftParen = createToken({ name: "LeftParen", pattern: /\(/ });
export const RightParen = createToken({ name: "RightParen", pattern: /\)/ });
export const LeftBracket = createToken({ name: "LeftBracket", pattern: /\[/ });
export const RightBracket = createToken({
  name: "RightBracket",
  pattern: /\]/,
});
export const LeftBrace = createToken({ name: "LeftBrace", pattern: /\{/ });
export const RightBrace = createToken({ name: "RightBrace", pattern: /\}/ });

// Whitespace and Comments
export const WhiteSpace = createToken({
  name: "WhiteSpace",
  pattern: /\s+/,
  group: Lexer.SKIPPED,
});

export const LineComment = createToken({
  name: "LineComment",
  pattern: /\/\/[^\n\r]*/,
  group: "comments",
});

export const BlockComment = createToken({
  name: "BlockComment",
  pattern: /\/\*([^*]|\*(?!\/))*\*\//,
  group: "comments",
});

// All tokens in order
export const allTokens = [
  // Comments (must come before operators)
  LineComment,
  BlockComment,

  // Whitespace
  WhiteSpace,

  // Keywords (must come before Identifier)
  Val,
  Var,
  Def,
  Class,
  ObjectKeyword,
  Trait,
  Extends,
  With,
  If,
  Else,
  While,
  For,
  Yield,
  Return,
  New,
  This,
  Super,
  Package,
  Import,
  Case,
  Match,
  Try,
  Catch,
  Finally,
  Throw,
  Null,
  True,
  False,
  NotImplemented,
  Type,
  Private,
  Protected,
  Public,
  Abstract,
  Final,
  Sealed,
  Implicit,
  Lazy,
  Override,
  Given,
  Using,
  To,
  Enum,
  Array,
  Extension,
  Export,
  Opaque,
  Inline,
  Transparent,

  // Literals
  ScientificNotationLiteral, // Must come before FloatingPointLiteral
  FloatingPointLiteral, // Must come before IntegerLiteral
  IntegerLiteral,
  // String interpolation literals (must come before StringLiteral)
  CustomInterpolatedString,
  InterpolatedString,
  FormattedString,
  RawString,
  InterpolatedStringLiteral, // Must come before StringLiteral
  StringLiteral,
  CharLiteral,

  // Multi-character operators (must come before single-character)
  TypeLambdaArrow, // Must come before Arrow to avoid ambiguity
  ContextArrow, // Must come before Arrow to avoid ambiguity
  Arrow,
  LeftArrow,
  RightArrow,
  SubtypeOf,
  SupertypeOf,
  LessThanEquals,
  GreaterThanEquals,
  EqualsEquals,
  NotEquals,
  LogicalAnd,
  LogicalOr,
  ColonEquals, // := must come before :
  AppendOp,
  PrependOp,
  AppendEquals, // ++= must come before ++
  ConcatOp,
  // Quote and splice tokens (must come before single-character)
  QuoteStart, // '{ must come before single '
  SpliceStart, // ${ must come before single $
  // Compound assignment operators
  PlusEquals,
  MinusEquals,
  StarEquals,
  SlashEquals,
  PercentEquals,
  // Bitwise shift operators (must come before single-character)
  UnsignedRightShift, // >>> must come before >>
  LeftShift,
  RightShift,

  // Single-character operators
  Equals,
  Plus,
  Minus,
  Star,
  Slash,
  Backslash,
  DoublePercent, // %% must come before single %
  Percent,
  LessThan,
  GreaterThan,
  Exclamation,
  BitwiseAnd,
  BitwiseOr,
  BitwiseXor,
  BitwiseTilde,
  Colon,
  Semicolon,
  Comma,
  Dot,
  At,
  // QuestionArrow removed - now an alias for ContextArrow
  Question,
  Quote,
  Dollar,
  Hash,

  // Delimiters
  LeftParen,
  RightParen,
  LeftBracket,
  RightBracket,
  LeftBrace,
  RightBrace,

  // Operator identifier (before regular identifier)
  OperatorIdentifier,

  // Identifier (must come before underscore)
  Identifier,

  // Underscore (must come after identifier to not interfere with _identifier patterns)
  Underscore,
];

// レキサーの作成（インポート時の問題を回避するための遅延初期化）
let scalaLexerInstance: Lexer | null = null;

/**
 * Scalaコードの字句解析を行うレキサー
 */
export const ScalaLexer = {
  /**
   * レキサーインスタンスを取得（遅延初期化）
   * @returns Chevrotainレキサーのインスタンス
   */
  get instance(): Lexer {
    if (!scalaLexerInstance) {
      scalaLexerInstance = new Lexer(allTokens);
    }
    return scalaLexerInstance;
  },
  /**
   * 入力文字列をトークン化
   * @param input - 字句解析対象のScalaソースコード
   * @returns トークン化の結果（トークン、エラー、グループ化されたトークン）
   */
  tokenize(input: string): ILexingResult {
    return this.instance.tokenize(input);
  },
};

// Export lexer instance for backward compatibility with tests
export const lexerInstance = ScalaLexer;
