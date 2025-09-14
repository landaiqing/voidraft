/**
 * Definition parsing module for class, object, trait, method, and variable definitions
 */
import { BaseParserModule, tokens } from "./base";
import type { ParserMethod, CstNode } from "chevrotain";

export class DefinitionParserMixin extends BaseParserModule {
  // Dependencies from other modules
  annotation!: ParserMethod<unknown[], CstNode>;
  modifier!: ParserMethod<unknown[], CstNode>;
  typeParameters!: ParserMethod<unknown[], CstNode>;
  classParameters!: ParserMethod<unknown[], CstNode>;
  extendsClause!: ParserMethod<unknown[], CstNode>;
  classBody!: ParserMethod<unknown[], CstNode>;
  type!: ParserMethod<unknown[], CstNode>;
  expression!: ParserMethod<unknown[], CstNode>;
  pattern!: ParserMethod<unknown[], CstNode>;
  parameterLists!: ParserMethod<unknown[], CstNode>;

  // Class definition
  classDefinition = this.parser.RULE("classDefinition", () => {
    this.consumeTokenType(tokens.Class);
    this.consumeTokenType(tokens.Identifier);
    this.parser.OPTION(() => this.subrule(this.typeParameters));
    // Constructor annotations (for DI patterns like @Inject())
    this.manyOf(() => this.subrule(this.annotation));
    // Constructor parameters (multiple parameter lists supported)
    this.parser.MANY(() => this.subrule(this.classParameters));
    this.parser.OPTION(() => this.subrule(this.extendsClause));
    this.parser.OPTION(() => this.subrule(this.classBody));
  });

  // Object definition
  objectDefinition = this.parser.RULE("objectDefinition", () => {
    this.consumeTokenType(tokens.ObjectKeyword);
    this.consumeTokenType(tokens.Identifier);
    this.parser.OPTION(() => this.subrule(this.extendsClause));
    this.parser.OPTION(() => this.subrule(this.classBody));
  });

  // Trait definition
  traitDefinition = this.parser.RULE("traitDefinition", () => {
    this.consumeTokenType(tokens.Trait);
    this.consumeTokenType(tokens.Identifier);
    this.parser.OPTION(() => this.subrule(this.typeParameters));
    this.parser.OPTION(() => this.subrule(this.extendsClause));
    this.parser.OPTION(() => this.subrule(this.classBody));
  });

  // Enum definition (Scala 3)
  enumDefinition = this.parser.RULE("enumDefinition", () => {
    this.consumeTokenType(tokens.Enum);
    this.consumeTokenType(tokens.Identifier);
    this.parser.OPTION(() => this.subrule(this.typeParameters));
    this.parser.OPTION(() => this.subrule(this.classParameters));
    this.parser.OPTION(() => this.subrule(this.extendsClause));
    this.consumeTokenType(tokens.LeftBrace);
    this.manyOf(() => this.subrule(this.enumCaseDef));
    this.consumeTokenType(tokens.RightBrace);
  });

  enumCaseDef = this.parser.RULE("enumCaseDef", () => {
    this.consumeTokenType(tokens.Case);
    this.consumeTokenType(tokens.Identifier);
    this.parser.OPTION(() => this.subrule(this.classParameters));
    this.parser.OPTION(() => this.subrule(this.extendsClause));
    this.parser.OPTION(() => this.consumeTokenType(tokens.Semicolon));
  });

  // Extension definition (Scala 3)
  extensionDefinition = this.parser.RULE("extensionDefinition", () => {
    this.consumeTokenType(tokens.Extension);
    this.parser.OPTION(() => this.subrule(this.typeParameters));
    this.consumeTokenType(tokens.LeftParen);
    this.consumeTokenType(tokens.Identifier);
    this.consumeTokenType(tokens.Colon);
    this.subrule(this.type);
    this.consumeTokenType(tokens.RightParen);
    this.consumeTokenType(tokens.LeftBrace);
    this.manyOf(() => this.subrule(this.extensionMemberDef));
    this.consumeTokenType(tokens.RightBrace);
  });

  extensionMemberDef = this.parser.RULE("extensionMemberDef", () => {
    this.manyOf(() => this.subrule(this.modifier));
    this.subrule(this.defDefinition);
  });

  // Val definition
  valDefinition = this.parser.RULE("valDefinition", () => {
    this.consumeTokenType(tokens.Val);
    this.oneOf([
      {
        // Simple variable with optional type: val x: Type = expr or val x: Type (abstract)
        ALT: () => {
          this.consumeTokenType(tokens.Identifier);
          this.parser.OPTION(() => {
            this.consumeTokenType(tokens.Colon);
            this.subrule(this.type);
          });
          this.parser.OPTION(() => {
            this.consumeTokenType(tokens.Equals);
            this.subrule(this.expression);
          });
        },
        GATE: () => {
          // This alternative is for simple identifier patterns only
          // Must handle: val x = ..., val x: Type = ..., val x: Type (abstract)
          // Must NOT handle: val (x, y) = ..., val SomeClass(...) = ...
          const first = this.lookahead(1);
          const second = this.lookahead(2);

          // If first token is not identifier, this is not a simple val
          if (!first || first.tokenType !== tokens.Identifier) return false;

          // If second token is left paren, this is a constructor pattern
          if (second && second.tokenType === tokens.LeftParen) return false;

          // Otherwise, this is a simple identifier (with or without type, with or without assignment)
          return true;
        },
      },
      {
        // Pattern matching: val (x, y) = expr or val SomeClass(...) = expr
        ALT: () => {
          this.subrule(this.pattern);
          this.consumeTokenType(tokens.Equals);
          this.subrule(this.expression);
        },
      },
    ]);
    this.parser.OPTION(() => this.consumeTokenType(tokens.Semicolon));
  });

  // Var definition
  varDefinition = this.parser.RULE("varDefinition", () => {
    this.consumeTokenType(tokens.Var);
    this.consumeTokenType(tokens.Identifier);
    this.parser.OPTION(() => {
      this.consumeTokenType(tokens.Colon);
      this.subrule(this.type);
    });
    this.consumeTokenType(tokens.Equals);
    this.subrule(this.expression);
    this.parser.OPTION(() => this.consumeTokenType(tokens.Semicolon));
  });

  // Method definition
  defDefinition = this.parser.RULE("defDefinition", () => {
    this.consumeTokenType(tokens.Def);
    this.oneOf([
      // Regular method name
      { ALT: () => this.consumeTokenType(tokens.Identifier) },
      // Constructor (this keyword)
      { ALT: () => this.consumeTokenType(tokens.This) },
    ]);
    this.parser.OPTION(() => this.subrule(this.typeParameters));
    this.parser.OPTION(() => this.subrule(this.parameterLists));
    this.parser.OPTION(() => {
      this.consumeTokenType(tokens.Colon);
      this.subrule(this.type);
    });
    this.parser.OPTION(() => {
      this.consumeTokenType(tokens.Equals);
      this.subrule(this.expression);
    });
    this.parser.OPTION(() => this.consumeTokenType(tokens.Semicolon));
  });

  // Type definition
  typeDefinition = this.parser.RULE("typeDefinition", () => {
    this.consumeTokenType(tokens.Type);
    this.consumeTokenType(tokens.Identifier);
    this.parser.OPTION(() => this.subrule(this.typeParameters));
    this.consumeTokenType(tokens.Equals);
    this.subrule(this.type);
    this.parser.OPTION(() => this.consumeTokenType(tokens.Semicolon));
  });
}
