/**
 * Scala 3 specific features parsing module
 */
import { BaseParserModule, tokens } from "./base";
import type { ParserMethod, CstNode } from "chevrotain";

export class Scala3ParserMixin extends BaseParserModule {
  // Dependencies from other modules
  annotation!: ParserMethod<unknown[], CstNode>;
  modifier!: ParserMethod<unknown[], CstNode>;
  typeParameters!: ParserMethod<unknown[], CstNode>;
  type!: ParserMethod<unknown[], CstNode>;
  expression!: ParserMethod<unknown[], CstNode>;
  pattern!: ParserMethod<unknown[], CstNode>;
  parameterLists!: ParserMethod<unknown[], CstNode>;
  classBody!: ParserMethod<unknown[], CstNode>;
  extendsClause!: ParserMethod<unknown[], CstNode>;
  qualifiedIdentifier!: ParserMethod<unknown[], CstNode>;
  valDefinition!: ParserMethod<unknown[], CstNode>;
  defDefinition!: ParserMethod<unknown[], CstNode>;
  typeDefinition!: ParserMethod<unknown[], CstNode>;

  // Enum definition (Scala 3)
  enumDefinition = this.parser.RULE("enumDefinition", () => {
    this.consumeTokenType(tokens.Enum);
    this.consumeTokenType(tokens.Identifier);
    this.parser.OPTION(() => this.subrule(this.typeParameters));
    this.parser.OPTION(() => this.subrule(this.extendsClause));
    this.consumeTokenType(tokens.LeftBrace);
    this.parser.MANY(() => {
      this.parser.OR([
        { ALT: () => this.subrule(this.enumCase) },
        { ALT: () => this.subrule(this.classMember) },
      ]);
      this.parser.OPTION(() => this.consumeTokenType(tokens.Semicolon));
    });
    this.consumeTokenType(tokens.RightBrace);
  });

  // Enum case
  enumCase = this.parser.RULE("enumCase", () => {
    this.consumeTokenType(tokens.Case);
    this.consumeTokenType(tokens.Identifier);
    this.parser.OPTION(() => {
      this.consumeTokenType(tokens.LeftParen);
      this.parser.MANY_SEP({
        SEP: tokens.Comma,
        DEF: () => {
          this.consumeTokenType(tokens.Identifier);
          this.consumeTokenType(tokens.Colon);
          this.subrule(this.type);
        },
      });
      this.consumeTokenType(tokens.RightParen);
    });
    this.parser.OPTION(() => {
      this.consumeTokenType(tokens.Extends);
      this.subrule(this.type);
    });
  });

  // Extension definition (Scala 3)
  extensionDefinition = this.parser.RULE("extensionDefinition", () => {
    this.consumeTokenType(tokens.Extension);

    // Optional type parameters before the extended type
    this.parser.OPTION(() => this.subrule(this.typeParameters));

    // Extended type with parameters
    this.consumeTokenType(tokens.LeftParen);
    this.consumeTokenType(tokens.Identifier);
    this.consumeTokenType(tokens.Colon);
    this.subrule(this.type);
    this.consumeTokenType(tokens.RightParen);

    // Optional using/given clauses
    this.parser.MANY(() => this.subrule(this.parameterLists));

    // Extension body
    this.parser.OR([
      // Single method
      { ALT: () => this.subrule(this.extensionMember) },
      // Multiple methods in braces
      {
        ALT: () => {
          this.consumeTokenType(tokens.LeftBrace);
          this.parser.MANY(() => {
            this.subrule(this.extensionMember);
            this.parser.OPTION(() => this.consumeTokenType(tokens.Semicolon));
          });
          this.consumeTokenType(tokens.RightBrace);
        },
      },
    ]);
  });

  // Extension member
  extensionMember = this.parser.RULE("extensionMember", () => {
    this.parser.MANY(() => this.subrule(this.annotation));
    this.parser.MANY(() => this.subrule(this.modifier));
    this.parser.OR([
      { ALT: () => this.subrule(this.defDefinition) },
      { ALT: () => this.subrule(this.valDefinition) },
      { ALT: () => this.subrule(this.typeDefinition) },
    ]);
  });

  // Given definition (Scala 3)
  givenDefinition = this.parser.RULE("givenDefinition", () => {
    this.consumeTokenType(tokens.Given);

    // Optional given name
    this.parser.OPTION(() => {
      this.consumeTokenType(tokens.Identifier);
    });

    // Optional type parameters
    this.parser.OPTION(() => this.subrule(this.typeParameters));

    // Optional parameter lists (for given with parameters)
    this.parser.MANY(() => this.subrule(this.parameterLists));

    this.consumeTokenType(tokens.Colon);
    this.subrule(this.type);

    // Implementation
    this.parser.OR([
      // With implementation
      {
        ALT: () => {
          this.consumeTokenType(tokens.With);
          this.parser.OR([
            // Block implementation
            { ALT: () => this.subrule(this.classBody) },
            // Expression implementation
            {
              ALT: () => {
                this.consumeTokenType(tokens.Equals);
                this.subrule(this.expression);
              },
            },
          ]);
        },
      },
      // Direct implementation with =
      {
        ALT: () => {
          this.consumeTokenType(tokens.Equals);
          this.subrule(this.expression);
        },
      },
    ]);
  });

  // Opaque type definition (Scala 3)
  opaqueTypeDefinition = this.parser.RULE("opaqueTypeDefinition", () => {
    this.consumeTokenType(tokens.Opaque);
    this.consumeTokenType(tokens.Type);
    this.consumeTokenType(tokens.Identifier);
    this.parser.OPTION(() => this.subrule(this.typeParameters));

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

    this.consumeTokenType(tokens.Equals);
    this.subrule(this.type);
  });

  // Inline modifier handling (Scala 3)
  inlineDefinition = this.parser.RULE("inlineDefinition", () => {
    this.consumeTokenType(tokens.Inline);
    this.parser.OR([
      {
        ALT: () => this.subrule(this.defDefinition),
      },
      {
        ALT: () => this.subrule(this.valDefinition),
      },
    ]);
  });

  // Transparent modifier handling (Scala 3)
  transparentDefinition = this.parser.RULE("transparentDefinition", () => {
    this.consumeTokenType(tokens.Transparent);
    this.consumeTokenType(tokens.Inline);
    this.subrule(this.defDefinition);
  });

  // Export clause (already implemented in statements, but Scala 3 specific)
  // Moved from statements module for better organization
  exportClause = this.parser.RULE("exportClause", () => {
    this.consumeTokenType(tokens.Export);
    this.subrule(this.exportExpression);
    this.parser.OPTION(() => this.consumeTokenType(tokens.Semicolon));
  });

  exportExpression = this.parser.RULE("exportExpression", () => {
    this.subrule(this.qualifiedIdentifier);
    this.consumeTokenType(tokens.Dot);
    this.parser.MANY(() => {
      this.consumeTokenType(tokens.Dot);
      this.parser.OR([
        {
          ALT: () => this.consumeTokenType(tokens.Identifier),
        },
        { ALT: () => this.consumeTokenType(tokens.Underscore) },
        { ALT: () => this.consumeTokenType(tokens.Given) },
        {
          ALT: () => {
            this.consumeTokenType(tokens.LeftBrace);
            this.parser.MANY_SEP({
              SEP: tokens.Comma,
              DEF: () => this.subrule(this.exportSelector),
            });
            this.consumeTokenType(tokens.RightBrace);
          },
        },
      ]);
    });
  });

  exportSelector = this.parser.RULE("exportSelector", () => {
    this.parser.OR([
      // given selector
      { ALT: () => this.consumeTokenType(tokens.Given) },
      // Regular selector with optional rename
      {
        ALT: () => {
          this.consumeTokenType(tokens.Identifier);
          this.parser.OPTION(() => {
            this.parser.OR([
              // Rename: x => y
              {
                ALT: () => {
                  this.consumeTokenType(tokens.Arrow);
                  this.consumeTokenType(tokens.Identifier);
                },
              },
              // Hide: x => _
              {
                ALT: () => {
                  this.consumeTokenType(tokens.Arrow);
                  this.consumeTokenType(tokens.Underscore);
                },
              },
            ]);
          });
        },
      },
    ]);
  });

  // Using clause (Scala 3 - for context parameters)
  usingClause = this.parser.RULE("usingClause", () => {
    this.consumeTokenType(tokens.Using);
    this.consumeTokenType(tokens.LeftParen);
    this.parser.MANY_SEP({
      SEP: tokens.Comma,
      DEF: () => {
        this.consumeTokenType(tokens.Identifier);
        this.consumeTokenType(tokens.Colon);
        this.subrule(this.type);
      },
    });
    this.consumeTokenType(tokens.RightParen);
  });

  // Helper rule placeholder
  classMember = this.parser.RULE("classMember", () => {
    // Placeholder - should be in definitions.ts
    this.parser.OR([
      {
        ALT: () => this.subrule(this.valDefinition),
      },
      {
        ALT: () => this.subrule(this.defDefinition),
      },
      {
        ALT: () => this.subrule(this.typeDefinition),
      },
    ]);
  });
}
