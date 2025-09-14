/**
 * Literal parsing module for all Scala literal types
 */
import { BaseParserModule, tokens } from "./base";

// Module for literal parsing - no additional imports needed

export class LiteralParserMixin extends BaseParserModule {
  // Main literal rule
  literal = this.parser.RULE("literal", () => {
    this.parser.OR([
      // Numeric literals
      { ALT: () => this.consumeTokenType(tokens.IntegerLiteral) },
      { ALT: () => this.consumeTokenType(tokens.FloatingPointLiteral) },
      { ALT: () => this.consumeTokenType(tokens.ScientificNotationLiteral) },

      // Boolean literals
      { ALT: () => this.consumeTokenType(tokens.True) },
      { ALT: () => this.consumeTokenType(tokens.False) },

      // Character literal
      { ALT: () => this.consumeTokenType(tokens.CharLiteral) },

      // String literals
      { ALT: () => this.consumeTokenType(tokens.StringLiteral) },
      { ALT: () => this.consumeTokenType(tokens.InterpolatedStringLiteral) },

      // Interpolated strings
      { ALT: () => this.subrule(this.interpolatedString) },

      // Null literal
      { ALT: () => this.consumeTokenType(tokens.Null) },

      // Unit literal ()
      {
        ALT: () => {
          this.consumeTokenType(tokens.LeftParen);
          this.consumeTokenType(tokens.RightParen);
        },
      },
    ]);
  });

  // Interpolated string
  interpolatedString = this.parser.RULE("interpolatedString", () => {
    this.parser.OR([
      // s-interpolator
      { ALT: () => this.consumeTokenType(tokens.InterpolatedString) },
      // f-interpolator
      { ALT: () => this.consumeTokenType(tokens.FormattedString) },
      // raw-interpolator
      { ALT: () => this.consumeTokenType(tokens.RawString) },
      // Custom interpolator
      { ALT: () => this.consumeTokenType(tokens.CustomInterpolatedString) },
    ]);
  });

  // Numeric literal with suffix
  numericLiteral = this.parser.RULE("numericLiteral", () => {
    this.parser.OR([
      // Integer types
      {
        ALT: () => {
          this.consumeTokenType(tokens.IntegerLiteral);
          this.parser.OPTION(() => {
            this.parser.OR([
              { ALT: () => this.consumeTokenType(tokens.LongSuffix) },
              { ALT: () => this.consumeTokenType(tokens.IntSuffix) },
              { ALT: () => this.consumeTokenType(tokens.ShortSuffix) },
              { ALT: () => this.consumeTokenType(tokens.ByteSuffix) },
            ]);
          });
        },
      },
      // Floating point types
      {
        ALT: () => {
          this.consumeTokenType(tokens.FloatingPointLiteral);
          this.parser.OPTION(() => {
            this.parser.OR([
              { ALT: () => this.consumeTokenType(tokens.FloatSuffix) },
              { ALT: () => this.consumeTokenType(tokens.DoubleSuffix) },
            ]);
          });
        },
      },
    ]);
  });

  // XML literal (if XML support is needed)
  xmlLiteral = this.parser.RULE("xmlLiteral", () => {
    // Placeholder for XML literals
    // This would require XML-specific lexing
    this.consumeTokenType(tokens.StringLiteral);
  });

  // Collection literal patterns (syntactic sugar)
  collectionLiteral = this.parser.RULE("collectionLiteral", () => {
    this.parser.OR([
      // List literal: List(1, 2, 3)
      {
        ALT: () => {
          this.consumeTokenType(tokens.Identifier); // List, Set, etc.
          this.consumeTokenType(tokens.LeftParen);
          this.parser.MANY_SEP({
            SEP: tokens.Comma,
            DEF: () => this.subrule(this.literal),
          });
          this.consumeTokenType(tokens.RightParen);
        },
      },
      // Array literal: Array(1, 2, 3)
      {
        ALT: () => {
          this.consumeTokenType(tokens.Array);
          this.consumeTokenType(tokens.LeftParen);
          this.parser.MANY_SEP({
            SEP: tokens.Comma,
            DEF: () => this.subrule(this.literal),
          });
          this.consumeTokenType(tokens.RightParen);
        },
      },
    ]);
  });
}
