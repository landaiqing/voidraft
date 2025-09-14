/**
 * Expression parsing module for all types of expressions in Scala
 */
import { BaseParserModule, tokens } from "./base";
import type { ParserMethod, CstNode } from "chevrotain";

export class ExpressionParserMixin extends BaseParserModule {
  // Dependencies from other modules
  annotation!: ParserMethod<unknown[], CstNode>;
  modifier!: ParserMethod<unknown[], CstNode>;
  type!: ParserMethod<unknown[], CstNode>;
  literal!: ParserMethod<unknown[], CstNode>;
  qualifiedIdentifier!: ParserMethod<unknown[], CstNode>;
  pattern!: ParserMethod<unknown[], CstNode>;
  parameterLists!: ParserMethod<unknown[], CstNode>;
  typeArgument!: ParserMethod<unknown[], CstNode>;
  caseClause!: ParserMethod<unknown[], CstNode>;
  generator!: ParserMethod<unknown[], CstNode>;

  // Main expression rule
  expression = this.parser.RULE("expression", () => {
    this.parser.OR([
      // Polymorphic function literal (Scala 3)
      {
        ALT: () => this.subrule(this.polymorphicFunctionLiteral),
        GATE: () => {
          const la1 = this.parser.LA(1);
          return la1?.tokenType === tokens.LeftBracket;
        },
      },
      // Regular expressions
      { ALT: () => this.subrule(this.assignmentOrInfixExpression) },
    ]);
  });

  // Assignment or infix expression
  assignmentOrInfixExpression = this.parser.RULE(
    "assignmentOrInfixExpression",
    () => {
      this.subrule(this.postfixExpression);
      this.parser.MANY(() => {
        this.subrule(this.infixOperator);
        this.subrule(this.postfixExpression);
      });
    },
  );

  // Postfix expression
  postfixExpression = this.parser.RULE("postfixExpression", () => {
    this.subrule(this.primaryExpression);
    this.parser.MANY(() => {
      this.parser.OR([
        // Method call with parentheses
        {
          ALT: () => {
            this.consumeTokenType(tokens.LeftParen);
            this.parser.MANY_SEP({
              SEP: tokens.Comma,
              DEF: () => this.subrule(this.expression),
            });
            this.consumeTokenType(tokens.RightParen);
          },
        },
        // Type arguments
        {
          ALT: () => {
            this.consumeTokenType(tokens.LeftBracket);
            this.parser.MANY_SEP({
              SEP: tokens.Comma,
              DEF: () => this.subrule(this.typeArgument),
            });
            this.consumeTokenType(tokens.RightBracket);
          },
        },
        // Member access
        {
          ALT: () => {
            this.consumeTokenType(tokens.Dot);
            this.consumeTokenType(tokens.Identifier);
          },
        },
        // Postfix operator (like Ask pattern ?)
        {
          ALT: () => {
            this.consumeTokenType(tokens.Question);
          },
        },
      ]);
    });
  });

  // Primary expression
  primaryExpression = this.parser.RULE("primaryExpression", () => {
    this.parser.OR([
      // Literals
      { ALT: () => this.subrule(this.literal) },
      // Identifier
      { ALT: () => this.consumeTokenType(tokens.Identifier) },
      // This and super
      { ALT: () => this.consumeTokenType(tokens.This) },
      { ALT: () => this.consumeTokenType(tokens.Super) },
      // Underscore (placeholder)
      { ALT: () => this.consumeTokenType(tokens.Underscore) },
      // Parenthesized expression
      {
        ALT: () => {
          this.consumeTokenType(tokens.LeftParen);
          this.parser.OPTION(() => this.subrule(this.expression));
          this.consumeTokenType(tokens.RightParen);
        },
      },
      // Block expression
      { ALT: () => this.subrule(this.blockExpression) },
      // New expression
      { ALT: () => this.subrule(this.newExpression) },
      // Partial function literal
      { ALT: () => this.subrule(this.partialFunctionLiteral) },
      // Quote expression (Scala 3)
      { ALT: () => this.subrule(this.quoteExpression) },
      // Splice expression (Scala 3)
      { ALT: () => this.subrule(this.spliceExpression) },
      // If expression
      { ALT: () => this.subrule(this.ifExpression) },
      // While expression
      { ALT: () => this.subrule(this.whileExpression) },
      // Try expression
      { ALT: () => this.subrule(this.tryExpression) },
      // For expression
      { ALT: () => this.subrule(this.forExpression) },
      // Match expression
      {
        ALT: () => {
          this.subrule(this.expression);
          this.consumeTokenType(tokens.Match);
          this.consumeTokenType(tokens.LeftBrace);
          this.parser.MANY(() => this.subrule(this.caseClause));
          this.consumeTokenType(tokens.RightBrace);
        },
      },
      // Lambda expression
      {
        ALT: () => {
          this.parser.OR([
            // Simple identifier lambda: x =>
            {
              ALT: () => {
                this.consumeTokenType(tokens.Identifier);
              },
            },
            // Multiple parameters with optional types: (x, y) =>
            {
              ALT: () => {
                this.consumeTokenType(tokens.LeftParen);
                this.parser.MANY_SEP({
                  SEP: tokens.Comma,
                  DEF: () => {
                    this.consumeTokenType(tokens.Identifier);
                    this.parser.OPTION(() => {
                      this.consumeTokenType(tokens.Colon);
                      this.subrule(this.type);
                    });
                  },
                });
                this.consumeTokenType(tokens.RightParen);
              },
            },
          ]);
          this.consumeTokenType(tokens.Arrow);
          this.subrule(this.expression);
        },
        GATE: () => {
          const la1 = this.parser.LA(1);
          const la2 = this.parser.LA(2);

          // Simple lambda: identifier =>
          if (
            la1?.tokenType === tokens.Identifier &&
            la2?.tokenType === tokens.Arrow
          ) {
            return true;
          }

          // Parenthesized lambda: ( ... ) =>
          if (la1?.tokenType === tokens.LeftParen) {
            let i = 2;
            let parenCount = 1;
            while (parenCount > 0 && this.parser.LA(i)) {
              const token = this.parser.LA(i);
              if (token?.tokenType === tokens.LeftParen) parenCount++;
              if (token?.tokenType === tokens.RightParen) parenCount--;
              i++;
            }
            return this.parser.LA(i)?.tokenType === tokens.Arrow;
          }

          return false;
        },
      },
    ]);
  });

  // Infix operator
  infixOperator = this.parser.RULE("infixOperator", () => {
    this.parser.OR([
      // Special compound assignment operators
      { ALT: () => this.consumeTokenType(tokens.PlusEquals) },
      { ALT: () => this.consumeTokenType(tokens.MinusEquals) },
      { ALT: () => this.consumeTokenType(tokens.StarEquals) },
      { ALT: () => this.consumeTokenType(tokens.SlashEquals) },
      { ALT: () => this.consumeTokenType(tokens.PercentEquals) },
      { ALT: () => this.consumeTokenType(tokens.AppendEquals) },
      // sbt-specific operators
      { ALT: () => this.consumeTokenType(tokens.SbtAssign) },
      { ALT: () => this.consumeTokenType(tokens.DoublePercent) },
      // Basic operators
      { ALT: () => this.consumeTokenType(tokens.Plus) },
      { ALT: () => this.consumeTokenType(tokens.Minus) },
      { ALT: () => this.consumeTokenType(tokens.Star) },
      { ALT: () => this.consumeTokenType(tokens.Slash) },
      { ALT: () => this.consumeTokenType(tokens.Percent) },
      // Comparison operators
      { ALT: () => this.consumeTokenType(tokens.Equals) },
      { ALT: () => this.consumeTokenType(tokens.EqualsEquals) }, // Use EqualsEquals instead of DoubleEquals
      { ALT: () => this.consumeTokenType(tokens.NotEquals) },
      { ALT: () => this.consumeTokenType(tokens.LessThan) }, // Use LessThan instead of Less
      { ALT: () => this.consumeTokenType(tokens.GreaterThan) }, // Use GreaterThan instead of Greater
      { ALT: () => this.consumeTokenType(tokens.LessThanEquals) }, // Use LessThanEquals instead of LessEquals
      { ALT: () => this.consumeTokenType(tokens.GreaterThanEquals) }, // Use GreaterThanEquals instead of GreaterEquals
      // Logical operators
      { ALT: () => this.consumeTokenType(tokens.LogicalAnd) }, // Use LogicalAnd instead of DoubleAmpersand
      { ALT: () => this.consumeTokenType(tokens.LogicalOr) }, // Use LogicalOr instead of DoublePipe
      // Bitwise operators
      { ALT: () => this.consumeTokenType(tokens.BitwiseAnd) }, // Use BitwiseAnd instead of Ampersand
      { ALT: () => this.consumeTokenType(tokens.BitwiseOr) }, // Use BitwiseOr instead of Pipe
      { ALT: () => this.consumeTokenType(tokens.BitwiseXor) }, // Use BitwiseXor instead of Caret
      // Shift operators
      { ALT: () => this.consumeTokenType(tokens.LeftShift) }, // Use LeftShift instead of DoubleLeftAngle
      { ALT: () => this.consumeTokenType(tokens.RightShift) }, // Use RightShift instead of DoubleRightAngle
      { ALT: () => this.consumeTokenType(tokens.UnsignedRightShift) }, // Use UnsignedRightShift instead of TripleRightAngle
      // Type operators
      { ALT: () => this.consumeTokenType(tokens.Colon) },
      { ALT: () => this.consumeTokenType(tokens.ColonEquals) },
      // Collection operators
      { ALT: () => this.consumeTokenType(tokens.ConcatOp) }, // Use ConcatOp instead of DoublePlus
      { ALT: () => this.consumeTokenType(tokens.PrependOp) }, // Use PrependOp instead of ColonColon
      { ALT: () => this.consumeTokenType(tokens.AppendOp) }, // Use AppendOp instead of ColonPlus/PlusColon
      // XML operators
      { ALT: () => this.consumeTokenType(tokens.Backslash) },
      // General operator
      { ALT: () => this.consumeTokenType(tokens.OperatorIdentifier) },
      // Identifier as operator (for named methods used as infix)
      {
        ALT: () => this.consumeTokenType(tokens.Identifier),
      },
    ]);
  });

  // Polymorphic function literal (Scala 3)
  polymorphicFunctionLiteral = this.parser.RULE(
    "polymorphicFunctionLiteral",
    () => {
      this.consumeTokenType(tokens.LeftBracket);
      this.parser.MANY_SEP({
        SEP: tokens.Comma,
        DEF: () => this.subrule(this.polymorphicTypeParameter),
      });
      this.consumeTokenType(tokens.RightBracket);
      this.consumeTokenType(tokens.Arrow);
      this.subrule(this.expression);
    },
  );

  // New expression
  newExpression = this.parser.RULE("newExpression", () => {
    this.consumeTokenType(tokens.New);
    this.parser.OR([
      // New with class instantiation
      {
        ALT: () => {
          this.subrule(this.type);
          this.parser.MANY(() => {
            this.consumeTokenType(tokens.LeftParen);
            this.parser.MANY_SEP({
              SEP: tokens.Comma,
              DEF: () => this.subrule(this.expression),
            });
            this.consumeTokenType(tokens.RightParen);
          });
        },
      },
      // New with anonymous class
      {
        ALT: () => {
          this.consumeTokenType(tokens.LeftBrace);
          // Class body content
          this.consumeTokenType(tokens.RightBrace);
        },
      },
    ]);
  });

  // Block expression
  blockExpression = this.parser.RULE("blockExpression", () => {
    this.consumeTokenType(tokens.LeftBrace);
    this.parser.MANY(() => {
      this.subrule(this.blockStatement);
      this.parser.OPTION(() => this.consumeTokenType(tokens.Semicolon));
    });
    this.consumeTokenType(tokens.RightBrace);
  });

  // Partial function literal
  partialFunctionLiteral = this.parser.RULE("partialFunctionLiteral", () => {
    this.consumeTokenType(tokens.LeftBrace);
    this.parser.AT_LEAST_ONE(() => this.subrule(this.caseClause));
    this.consumeTokenType(tokens.RightBrace);
  });

  // Quote expression (Scala 3)
  quoteExpression = this.parser.RULE("quoteExpression", () => {
    this.consumeTokenType(tokens.Quote);
    this.consumeTokenType(tokens.LeftBrace);
    this.subrule(this.expression);
    this.consumeTokenType(tokens.RightBrace);
  });

  // Splice expression (Scala 3)
  spliceExpression = this.parser.RULE("spliceExpression", () => {
    this.consumeTokenType(tokens.Dollar);
    this.consumeTokenType(tokens.LeftBrace);
    this.subrule(this.expression);
    this.consumeTokenType(tokens.RightBrace);
  });

  // If expression
  ifExpression = this.parser.RULE("ifExpression", () => {
    this.consumeTokenType(tokens.If);
    this.consumeTokenType(tokens.LeftParen);
    this.subrule(this.expression);
    this.consumeTokenType(tokens.RightParen);
    this.subrule(this.expression);
    this.parser.OPTION(() => {
      this.consumeTokenType(tokens.Else);
      this.subrule(this.expression);
    });
  });

  // While expression
  whileExpression = this.parser.RULE("whileExpression", () => {
    this.consumeTokenType(tokens.While);
    this.consumeTokenType(tokens.LeftParen);
    this.subrule(this.expression);
    this.consumeTokenType(tokens.RightParen);
    this.subrule(this.expression);
  });

  // Try expression
  tryExpression = this.parser.RULE("tryExpression", () => {
    this.consumeTokenType(tokens.Try);
    this.subrule(this.expression);
    this.parser.OPTION(() => {
      this.consumeTokenType(tokens.Catch);
      this.parser.OR([
        // Pattern-based catch
        {
          ALT: () => {
            this.consumeTokenType(tokens.LeftBrace);
            this.parser.MANY(() => this.subrule(this.caseClause));
            this.consumeTokenType(tokens.RightBrace);
          },
        },
        // Expression-based catch
        {
          ALT: () => this.subrule(this.expression),
        },
      ]);
    });
    this.parser.OPTION(() => {
      this.consumeTokenType(tokens.Finally);
      this.subrule(this.expression);
    });
  });

  // For expression/comprehension
  forExpression = this.parser.RULE("forExpression", () => {
    this.consumeTokenType(tokens.For);
    this.parser.OR([
      // For with parentheses
      {
        ALT: () => {
          this.consumeTokenType(tokens.LeftParen);
          this.parser.AT_LEAST_ONE_SEP({
            SEP: tokens.Semicolon,
            DEF: () => this.subrule(this.generator),
          });
          this.consumeTokenType(tokens.RightParen);
        },
      },
      // For with braces
      {
        ALT: () => {
          this.consumeTokenType(tokens.LeftBrace);
          this.parser.MANY(() => this.subrule(this.generator));
          this.consumeTokenType(tokens.RightBrace);
        },
      },
    ]);
    this.parser.OPTION(() => this.consumeTokenType(tokens.Yield));
    this.subrule(this.expression);
  });

  // Helper rule dependencies (to be implemented in other modules)
  polymorphicTypeParameter = this.parser.RULE(
    "polymorphicTypeParameter",
    () => {
      // Placeholder - should be in types.ts
      this.consumeTokenType(tokens.Identifier);
    },
  );

  blockStatement = this.parser.RULE("blockStatement", () => {
    // Placeholder - should be in statements.ts
    this.subrule(this.expression);
  });
}
