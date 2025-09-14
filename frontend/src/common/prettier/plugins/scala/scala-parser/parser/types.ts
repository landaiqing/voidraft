/**
 * Type system parsing module for Scala types
 */
import { BaseParserModule, tokens } from "./base";
import type { ParserMethod, CstNode } from "chevrotain";

export class TypeParserMixin extends BaseParserModule {
  // Dependencies from other modules
  qualifiedIdentifier!: ParserMethod<unknown[], CstNode>;
  expression!: ParserMethod<unknown[], CstNode>;
  literal!: ParserMethod<unknown[], CstNode>;

  // Main type rule
  type = this.parser.RULE("type", () => {
    this.subrule(this.unionType);
  });

  // Union types (Scala 3)
  unionType = this.parser.RULE("unionType", () => {
    this.subrule(this.intersectionType);
    this.parser.MANY(() => {
      this.consumeTokenType(tokens.BitwiseOr);
      this.subrule(this.intersectionType);
    });
  });

  // Intersection types (Scala 3)
  intersectionType = this.parser.RULE("intersectionType", () => {
    this.subrule(this.baseType);
    this.parser.MANY(() => {
      this.consumeTokenType(tokens.BitwiseAnd);
      this.subrule(this.baseType);
    });
  });

  // Base type
  baseType = this.parser.RULE("baseType", () => {
    this.parser.OR([
      // Simple type
      { ALT: () => this.subrule(this.simpleType) },
      // Function type: A => B or (A, B) => C
      {
        ALT: () => {
          this.parser.OR([
            // Single parameter without parentheses
            {
              ALT: () => this.subrule(this.simpleType),
            },
            // Multiple parameters or single with parentheses
            {
              ALT: () => {
                this.consumeTokenType(tokens.LeftParen);
                this.parser.MANY_SEP({
                  SEP: tokens.Comma,
                  DEF: () => this.subrule(this.type),
                });
                this.consumeTokenType(tokens.RightParen);
              },
            },
          ]);
          this.consumeTokenType(tokens.Arrow);
          this.subrule(this.type);
        },
        GATE: () => {
          // Look ahead to detect function types
          let i = 1;
          const la1 = this.parser.LA(i);

          // Simple function type: Type =>
          if (la1?.tokenType === tokens.Identifier) {
            const la2 = this.parser.LA(2);
            if (la2?.tokenType === tokens.Arrow) return true;
            if (la2?.tokenType === tokens.Dot) {
              // Handle qualified types like A.B =>
              i = 3;
              while (
                this.parser.LA(i)?.tokenType === tokens.Identifier &&
                this.parser.LA(i + 1)?.tokenType === tokens.Dot
              ) {
                i += 2;
              }
              return this.parser.LA(i + 1)?.tokenType === tokens.Arrow;
            }
          }

          // Parenthesized function type: (...) =>
          if (la1?.tokenType === tokens.LeftParen) {
            let parenCount = 1;
            i = 2;
            while (parenCount > 0 && i < 50) {
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
      // Context function type (Scala 3): A ?=> B
      {
        ALT: () => this.subrule(this.contextFunctionType),
        GATE: () => {
          // Look for ?=> pattern
          let i = 1;
          while (i < 20) {
            const token = this.parser.LA(i);
            if (token?.tokenType === tokens.QuestionArrow) return true;
            if (!token) return false;
            i++;
          }
          return false;
        },
      },
      // Dependent function type (Scala 3)
      {
        ALT: () => this.subrule(this.dependentFunctionType),
        GATE: () => {
          const la1 = this.parser.LA(1);
          const la2 = this.parser.LA(2);
          const la3 = this.parser.LA(3);
          return (
            la1?.tokenType === tokens.LeftParen &&
            la2?.tokenType === tokens.Identifier &&
            la3?.tokenType === tokens.Colon
          );
        },
      },
      // Polymorphic function type (Scala 3): [T] => T => T
      {
        ALT: () => this.subrule(this.polymorphicFunctionType),
        GATE: () => {
          const la1 = this.parser.LA(1);
          if (la1?.tokenType !== tokens.LeftBracket) return false;

          // Look for ] =>> pattern
          let i = 2;
          let bracketCount = 1;
          while (bracketCount > 0 && i < 30) {
            const token = this.parser.LA(i);
            if (token?.tokenType === tokens.LeftBracket) bracketCount++;
            if (token?.tokenType === tokens.RightBracket) bracketCount--;
            i++;
          }
          return this.parser.LA(i)?.tokenType === tokens.DoubleArrow;
        },
      },
    ]);
  });

  // Simple type
  simpleType = this.parser.RULE("simpleType", () => {
    this.parser.OR([
      // Literal type
      {
        ALT: () => this.subrule(this.literal),
        GATE: () => {
          const la1 = this.parser.LA(1);
          return (
            la1?.tokenType === tokens.IntegerLiteral ||
            la1?.tokenType === tokens.FloatingPointLiteral ||
            la1?.tokenType === tokens.True ||
            la1?.tokenType === tokens.CharLiteral ||
            la1?.tokenType === tokens.StringLiteral ||
            la1?.tokenType === tokens.Null
          );
        },
      },
      // Tuple type or parenthesized type
      { ALT: () => this.subrule(this.tupleTypeOrParenthesized) },
      // Type projection: T#U
      {
        ALT: () => {
          this.subrule(this.simpleType);
          this.consumeTokenType(tokens.Hash);
          this.consumeTokenType(tokens.Identifier);
        },
        GATE: () => {
          // Complex lookahead for type projection
          let i = 1;
          while (i < 20) {
            const token = this.parser.LA(i);
            if (token?.tokenType === tokens.Hash) return true;
            if (
              !token ||
              token.tokenType === tokens.Arrow ||
              token.tokenType === tokens.Comma
            )
              return false;
            i++;
          }
          return false;
        },
      },
      // Singleton type: x.type
      {
        ALT: () => {
          this.subrule(this.qualifiedIdentifier);
          this.consumeTokenType(tokens.Dot);
          this.consumeTokenType(tokens.Type);
        },
        GATE: () => {
          let i = 1;
          while (
            this.parser.LA(i)?.tokenType === tokens.Identifier &&
            this.parser.LA(i + 1)?.tokenType === tokens.Dot
          ) {
            i += 2;
          }
          return (
            this.parser.LA(i)?.tokenType === tokens.Identifier &&
            this.parser.LA(i + 1)?.tokenType === tokens.Dot &&
            this.parser.LA(i + 2)?.tokenType === tokens.Type
          );
        },
      },
      // Wildcard type: _
      {
        ALT: () => this.consumeTokenType(tokens.Underscore),
      },
      // Kind projector: * or ?
      {
        ALT: () => {
          this.parser.OR([
            { ALT: () => this.consumeTokenType(tokens.Star) },
            { ALT: () => this.consumeTokenType(tokens.Question) },
          ]);
        },
      },
      // Array type constructor
      {
        ALT: () => {
          this.consumeTokenType(tokens.Array);
          this.parser.OPTION(() => {
            this.consumeTokenType(tokens.LeftBracket);
            this.parser.MANY_SEP({
              SEP: tokens.Comma,
              DEF: () => this.subrule(this.typeArgument),
            });
            this.consumeTokenType(tokens.RightBracket);
          });
        },
      },
      // Regular type with optional type arguments
      {
        ALT: () => {
          this.subrule(this.qualifiedIdentifier);
          this.parser.OPTION(() => {
            this.consumeTokenType(tokens.LeftBracket);
            this.parser.MANY_SEP({
              SEP: tokens.Comma,
              DEF: () => this.subrule(this.typeArgument),
            });
            this.consumeTokenType(tokens.RightBracket);
          });
        },
      },
    ]);
  });

  // Type argument
  typeArgument = this.parser.RULE("typeArgument", () => {
    // Optional variance annotation
    this.parser.OPTION(() => {
      this.parser.OR([
        { ALT: () => this.consumeTokenType(tokens.Plus) },
        { ALT: () => this.consumeTokenType(tokens.Minus) },
      ]);
    });
    this.subrule(this.type);
  });

  // Tuple type or parenthesized type
  tupleTypeOrParenthesized = this.parser.RULE(
    "tupleTypeOrParenthesized",
    () => {
      this.consumeTokenType(tokens.LeftParen);
      this.parser.OPTION(() => {
        this.subrule(this.type);
        this.parser.MANY(() => {
          this.consumeTokenType(tokens.Comma);
          this.subrule(this.type);
        });
      });
      this.consumeTokenType(tokens.RightParen);
    },
  );

  // Context function type (Scala 3)
  contextFunctionType = this.parser.RULE("contextFunctionType", () => {
    this.parser.OR([
      // Single parameter
      { ALT: () => this.subrule(this.simpleType) },
      // Multiple parameters
      {
        ALT: () => {
          this.consumeTokenType(tokens.LeftParen);
          this.parser.MANY_SEP({
            SEP: tokens.Comma,
            DEF: () => this.subrule(this.type),
          });
          this.consumeTokenType(tokens.RightParen);
        },
      },
    ]);
    this.consumeTokenType(tokens.QuestionArrow);
    this.subrule(this.type);
  });

  // Dependent function type (Scala 3)
  dependentFunctionType = this.parser.RULE("dependentFunctionType", () => {
    this.consumeTokenType(tokens.LeftParen);
    this.parser.AT_LEAST_ONE_SEP({
      SEP: tokens.Comma,
      DEF: () => this.subrule(this.dependentParameter),
    });
    this.consumeTokenType(tokens.RightParen);
    this.consumeTokenType(tokens.Arrow);
    this.subrule(this.type);
  });

  // Dependent parameter
  dependentParameter = this.parser.RULE("dependentParameter", () => {
    this.consumeTokenType(tokens.Identifier);
    this.consumeTokenType(tokens.Colon);
    this.subrule(this.type);
  });

  // Polymorphic function type (Scala 3)
  polymorphicFunctionType = this.parser.RULE("polymorphicFunctionType", () => {
    this.consumeTokenType(tokens.LeftBracket);
    this.parser.MANY_SEP({
      SEP: tokens.Comma,
      DEF: () => this.subrule(this.typeLambdaParameter),
    });
    this.consumeTokenType(tokens.RightBracket);
    this.consumeTokenType(tokens.DoubleArrow);
    this.subrule(this.type);
  });

  // Type lambda (Scala 3)
  typeLambda = this.parser.RULE("typeLambda", () => {
    this.consumeTokenType(tokens.LeftBracket);
    this.parser.MANY_SEP({
      SEP: tokens.Comma,
      DEF: () => this.subrule(this.typeLambdaParameter),
    });
    this.consumeTokenType(tokens.RightBracket);
    this.consumeTokenType(tokens.DoubleArrow);
    this.subrule(this.type);
  });

  // Type lambda parameter
  typeLambdaParameter = this.parser.RULE("typeLambdaParameter", () => {
    // Optional variance
    this.parser.OPTION(() => {
      this.parser.OR([
        { ALT: () => this.consumeTokenType(tokens.Plus) },
        { ALT: () => this.consumeTokenType(tokens.Minus) },
      ]);
    });
    this.consumeTokenType(tokens.Identifier);
    // Optional type bounds
    this.parser.OPTION(() => {
      this.parser.OR([
        {
          ALT: () => {
            this.consumeTokenType(tokens.ColonLess);
            this.subrule(this.type);
          },
        },
        {
          ALT: () => {
            this.consumeTokenType(tokens.GreaterColon);
            this.subrule(this.type);
          },
        },
      ]);
    });
  });

  // Type parameters
  typeParameters = this.parser.RULE("typeParameters", () => {
    this.consumeTokenType(tokens.LeftBracket);
    this.parser.MANY_SEP({
      SEP: tokens.Comma,
      DEF: () => this.subrule(this.typeParameter),
    });
    this.consumeTokenType(tokens.RightBracket);
  });

  // Type parameter
  typeParameter = this.parser.RULE("typeParameter", () => {
    // Optional variance annotation
    this.parser.OPTION(() => {
      this.parser.OR([
        { ALT: () => this.consumeTokenType(tokens.Plus) },
        { ALT: () => this.consumeTokenType(tokens.Minus) },
      ]);
    });
    this.consumeTokenType(tokens.Identifier);
    // Optional type bounds
    this.parser.OPTION(() => {
      this.parser.OR([
        {
          ALT: () => {
            this.consumeTokenType(tokens.ColonLess);
            this.subrule(this.type);
          },
        },
        {
          ALT: () => {
            this.consumeTokenType(tokens.GreaterColon);
            this.subrule(this.type);
          },
        },
      ]);
    });
  });

  // Match type (Scala 3)
  matchType = this.parser.RULE("matchType", () => {
    this.subrule(this.type);
    this.consumeTokenType(tokens.Match);
    this.consumeTokenType(tokens.LeftBrace);
    this.parser.MANY(() => this.subrule(this.matchTypeCase));
    this.consumeTokenType(tokens.RightBrace);
  });

  // Match type case
  matchTypeCase = this.parser.RULE("matchTypeCase", () => {
    this.consumeTokenType(tokens.Case);
    this.subrule(this.type);
    this.consumeTokenType(tokens.Arrow);
    this.subrule(this.type);
  });
}
