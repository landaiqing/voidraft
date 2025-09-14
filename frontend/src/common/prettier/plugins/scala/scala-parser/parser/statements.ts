/**
 * Statement parsing module for package, import, and export declarations
 */
import { BaseParserModule, tokens } from "./base";
import type { ParserMethod, CstNode } from "chevrotain";

export class StatementParserMixin extends BaseParserModule {
  // Dependencies from other modules
  qualifiedIdentifier!: ParserMethod<unknown[], CstNode>;
  expression!: ParserMethod<unknown[], CstNode>;

  // Package declaration
  packageClause = this.parser.RULE("packageClause", () => {
    this.consumeTokenType(tokens.Package);
    this.subrule(this.qualifiedIdentifier);
    this.optionalConsume(tokens.Semicolon);
  });

  // Import declaration
  importClause = this.parser.RULE("importClause", () => {
    this.consumeTokenType(tokens.Import);
    this.subrule(this.importExpression);
    this.optionalConsume(tokens.Semicolon);
  });

  importExpression = this.parser.RULE("importExpression", () => {
    // Parse the base path (e.g., "scala.collection")
    this.consumeTokenType(tokens.Identifier);
    this.manyOf(() => {
      this.consumeTokenType(tokens.Dot);
      this.oneOf([
        // Next identifier in path
        {
          ALT: () =>
            this.parser.CONSUME(tokens.Identifier, { LABEL: "Identifier2" }),
        },
        // Wildcard import
        { ALT: () => this.consumeTokenType(tokens.Underscore) },
        // Multiple import selectors
        {
          ALT: () => {
            this.consumeTokenType(tokens.LeftBrace);
            this.parser.AT_LEAST_ONE_SEP({
              SEP: tokens.Comma,
              DEF: () => this.subrule(this.importSelector),
            });
            this.consumeTokenType(tokens.RightBrace);
          },
        },
      ]);
    });
  });

  importSelector = this.parser.RULE("importSelector", () => {
    this.oneOf([
      {
        ALT: () => {
          this.consumeTokenType(tokens.Identifier);
          this.parser.OPTION(() => {
            this.consumeTokenType(tokens.Arrow);
            this.oneOf([
              {
                ALT: () =>
                  this.parser.CONSUME(tokens.Identifier, {
                    LABEL: "Identifier2",
                  }),
              },
              { ALT: () => this.consumeTokenType(tokens.Underscore) },
            ]);
          });
        },
      },
      {
        ALT: () =>
          this.parser.CONSUME(tokens.Underscore, { LABEL: "Underscore2" }),
      }, // Allow wildcard import in selectors
    ]);
  });

  // Export declaration (Scala 3)
  exportClause = this.parser.RULE("exportClause", () => {
    this.consumeTokenType(tokens.Export);
    this.subrule(this.exportExpression);
    this.optionalConsume(tokens.Semicolon);
  });

  exportExpression = this.parser.RULE("exportExpression", () => {
    // Parse the base path (e.g., "mypackage")
    this.consumeTokenType(tokens.Identifier);
    this.manyOf(() => {
      this.consumeTokenType(tokens.Dot);
      this.oneOf([
        // Next identifier in path
        {
          ALT: () =>
            this.parser.CONSUME(tokens.Identifier, { LABEL: "Identifier2" }),
        },
        // Given keyword for given exports
        { ALT: () => this.consumeTokenType(tokens.Given) },
        // Wildcard export
        { ALT: () => this.consumeTokenType(tokens.Underscore) },
        // Multiple export selectors
        {
          ALT: () => {
            this.consumeTokenType(tokens.LeftBrace);
            this.parser.AT_LEAST_ONE_SEP({
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
    this.oneOf([
      {
        ALT: () => {
          this.consumeTokenType(tokens.Identifier);
          this.parser.OPTION(() => {
            this.consumeTokenType(tokens.Arrow);
            this.oneOf([
              {
                ALT: () =>
                  this.parser.CONSUME(tokens.Identifier, {
                    LABEL: "Identifier2",
                  }),
              },
              { ALT: () => this.consumeTokenType(tokens.Underscore) },
            ]);
          });
        },
      },
      {
        ALT: () =>
          this.parser.CONSUME(tokens.Underscore, { LABEL: "Underscore2" }),
      },
      { ALT: () => this.consumeTokenType(tokens.Given) },
      {
        ALT: () => {
          this.consumeTokenType(tokens.Given);
          this.consumeTokenType(tokens.Identifier);
        },
      },
    ]);
  });

  // Assignment statement (for sbt files and general assignments)
  assignmentStatement = this.parser.RULE("assignmentStatement", () => {
    this.consumeTokenType(tokens.Identifier);
    this.oneOf([
      { ALT: () => this.consumeTokenType(tokens.SbtAssign) },
      { ALT: () => this.consumeTokenType(tokens.PlusEquals) },
      { ALT: () => this.consumeTokenType(tokens.MinusEquals) },
      { ALT: () => this.consumeTokenType(tokens.StarEquals) },
      { ALT: () => this.consumeTokenType(tokens.SlashEquals) },
      { ALT: () => this.consumeTokenType(tokens.PercentEquals) },
      { ALT: () => this.consumeTokenType(tokens.AppendEquals) },
      { ALT: () => this.consumeTokenType(tokens.Equals) },
    ]);
    this.subrule(this.expression);
  });
}
