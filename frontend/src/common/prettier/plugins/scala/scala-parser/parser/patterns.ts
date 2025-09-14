/**
 * Pattern matching parsing module
 */
import { BaseParserModule, tokens } from "./base";
import type { ParserMethod, CstNode } from "chevrotain";

export class PatternParserMixin extends BaseParserModule {
  // Dependencies from other modules
  literal!: ParserMethod<unknown[], CstNode>;
  qualifiedIdentifier!: ParserMethod<unknown[], CstNode>;
  type!: ParserMethod<unknown[], CstNode>;
  expression!: ParserMethod<unknown[], CstNode>;

  // Pattern rule
  pattern = this.parser.RULE("pattern", () => {
    this.parser.OR([
      // Wildcard pattern: _
      { ALT: () => this.consumeTokenType(tokens.Underscore) },
      // Literal pattern
      { ALT: () => this.subrule(this.literal) },
      // Variable pattern (lowercase identifier)
      {
        ALT: () => this.consumeTokenType(tokens.Identifier),
        GATE: () => {
          const la1 = this.parser.LA(1);
          if (la1?.tokenType !== tokens.Identifier) return false;
          const firstChar = la1.image[0];
          return (
            firstChar === firstChar.toLowerCase() &&
            firstChar !== firstChar.toUpperCase()
          );
        },
      },
      // Stable identifier pattern (uppercase or qualified)
      {
        ALT: () => this.subrule(this.qualifiedIdentifier),
      },
      // Constructor pattern: Type(patterns...)
      {
        ALT: () => {
          this.subrule(this.qualifiedIdentifier);
          this.consumeTokenType(tokens.LeftParen);
          this.parser.MANY_SEP({
            SEP: tokens.Comma,
            DEF: () => this.subrule(this.pattern),
          });
          this.consumeTokenType(tokens.RightParen);
        },
        GATE: () => {
          // Look for Constructor(...)
          let i = 1;
          while (this.parser.LA(i)?.tokenType === tokens.Identifier) {
            if (this.parser.LA(i + 1)?.tokenType === tokens.Dot) {
              i += 2;
            } else {
              return this.parser.LA(i + 1)?.tokenType === tokens.LeftParen;
            }
          }
          return false;
        },
      },
      // Tuple pattern: (p1, p2, ...)
      {
        ALT: () => {
          this.consumeTokenType(tokens.LeftParen);
          this.parser.MANY_SEP({
            SEP: tokens.Comma,
            DEF: () => this.subrule(this.pattern),
          });
          this.consumeTokenType(tokens.RightParen);
        },
      },
      // Typed pattern: pattern : Type
      {
        ALT: () => {
          this.subrule(this.pattern);
          this.consumeTokenType(tokens.Colon);
          this.subrule(this.type);
        },
        GATE: () => {
          // Complex lookahead for typed patterns
          let i = 1;
          let parenDepth = 0;
          while (i < 20) {
            const token = this.parser.LA(i);
            if (!token) return false;
            if (token.tokenType === tokens.LeftParen) parenDepth++;
            if (token.tokenType === tokens.RightParen) parenDepth--;
            if (parenDepth === 0 && token.tokenType === tokens.Colon) {
              return true;
            }
            if (
              parenDepth === 0 &&
              (token.tokenType === tokens.Arrow ||
                token.tokenType === tokens.Equals ||
                token.tokenType === tokens.If)
            ) {
              return false;
            }
            i++;
          }
          return false;
        },
      },
      // Alternative pattern: p1 | p2 | ...
      {
        ALT: () => {
          this.subrule(this.pattern);
          this.parser.MANY(() => {
            this.consumeTokenType(tokens.BitwiseOr);
            this.subrule(this.pattern);
          });
        },
        GATE: () => {
          // Look for | in patterns
          let i = 1;
          let parenDepth = 0;
          while (i < 20) {
            const token = this.parser.LA(i);
            if (!token) return false;
            if (token.tokenType === tokens.LeftParen) parenDepth++;
            if (token.tokenType === tokens.RightParen) parenDepth--;
            if (parenDepth === 0 && token.tokenType === tokens.BitwiseOr) {
              return true;
            }
            if (
              parenDepth === 0 &&
              (token.tokenType === tokens.Arrow ||
                token.tokenType === tokens.Equals)
            ) {
              return false;
            }
            i++;
          }
          return false;
        },
      },
    ]);
  });

  // Case clause (used in match expressions and partial functions)
  caseClause = this.parser.RULE("caseClause", () => {
    this.consumeTokenType(tokens.Case);
    this.subrule(this.pattern);

    // Optional guard
    this.parser.OPTION(() => {
      this.consumeTokenType(tokens.If);
      this.subrule(this.expression);
    });

    this.consumeTokenType(tokens.Arrow);

    // Case body - can be expression or block
    this.parser.OR([
      // Block of statements
      {
        ALT: () => {
          this.parser.MANY(() => {
            this.subrule(this.expression);
            this.parser.OPTION(() => this.consumeTokenType(tokens.Semicolon));
          });
        },
        GATE: () => {
          // If next token is 'case' or '}', this is the end
          const la1 = this.parser.LA(1);
          return (
            la1?.tokenType !== tokens.Case &&
            la1?.tokenType !== tokens.RightBrace
          );
        },
      },
      // Empty case (rare but valid)
      { ALT: () => {} },
    ]);
  });

  // Generator (used in for comprehensions)
  generator = this.parser.RULE("generator", () => {
    this.parser.OR([
      // Pattern generator: pattern <- expression
      {
        ALT: () => {
          this.subrule(this.pattern);
          this.consumeTokenType(tokens.LeftArrow);
          this.subrule(this.expression);
        },
      },
      // Value definition: pattern = expression
      {
        ALT: () => {
          this.subrule(this.pattern);
          this.consumeTokenType(tokens.Equals);
          this.subrule(this.expression);
        },
      },
      // Guard: if expression
      {
        ALT: () => {
          this.consumeTokenType(tokens.If);
          this.subrule(this.expression);
        },
      },
    ]);
  });

  // Extractor pattern (for advanced pattern matching)
  extractorPattern = this.parser.RULE("extractorPattern", () => {
    this.subrule(this.qualifiedIdentifier);
    this.consumeTokenType(tokens.LeftParen);
    this.parser.MANY_SEP({
      SEP: tokens.Comma,
      DEF: () => {
        this.parser.OR([
          // Regular pattern
          { ALT: () => this.subrule(this.pattern) },
          // Sequence pattern: _*
          {
            ALT: () => {
              this.consumeTokenType(tokens.Underscore);
              this.consumeTokenType(tokens.Star);
            },
          },
        ]);
      },
    });
    this.consumeTokenType(tokens.RightParen);
  });

  // Infix pattern (for pattern matching with infix operators)
  infixPattern = this.parser.RULE("infixPattern", () => {
    this.subrule(this.pattern);
    this.consumeTokenType(tokens.Identifier);
    this.subrule(this.pattern);
  });

  // XML pattern (if XML support is needed)
  xmlPattern = this.parser.RULE("xmlPattern", () => {
    // Placeholder for XML patterns
    // This would require XML-specific tokens
    this.consumeTokenType(tokens.StringLiteral);
  });
}
