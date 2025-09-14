/**
 * Main Scala parser implementation using modular architecture.
 *
 * This parser combines functionality from various modules:
 * - parser-literals.ts: Literal value parsing
 * - Future: expressions, types, patterns, statements, definitions, scala3
 *
 * Gradually migrating from monolithic to modular approach.
 */
import * as tokens from "./lexer";
import type { ParserMethodResult } from "./types";
import { CstParser } from "chevrotain";

export class ScalaParser extends CstParser {
  [key: string]: unknown;
  constructor() {
    super(tokens.allTokens);

    // Initialize modular parser rules within the class
    this.literal = this.RULE("literal", () => {
      this.OR([
        { ALT: () => this.CONSUME(tokens.ScientificNotationLiteral) },
        { ALT: () => this.CONSUME(tokens.FloatingPointLiteral) },
        { ALT: () => this.CONSUME(tokens.IntegerLiteral) },
        { ALT: () => this.CONSUME(tokens.InterpolatedStringLiteral) },
        { ALT: () => this.CONSUME(tokens.StringLiteral) },
        { ALT: () => this.CONSUME(tokens.CharLiteral) },
        { ALT: () => this.CONSUME(tokens.True) },
        { ALT: () => this.CONSUME(tokens.False) },
        { ALT: () => this.CONSUME(tokens.Null) },
        { ALT: () => this.CONSUME(tokens.NotImplemented) },
      ]);
    });

    this.performSelfAnalysis();
  }

  // Entry point
  public compilationUnit = this.RULE("compilationUnit", () => {
    this.MANY(() => {
      this.OR([
        { ALT: () => this.SUBRULE(this.packageClause) },
        { ALT: () => this.SUBRULE(this.importClause) },
        { ALT: () => this.SUBRULE(this.exportClause) },
        {
          ALT: () => {
            // Assignment statement (highest priority for sbt files)
            this.SUBRULE(this.assignmentStatement);
            this.OPTION(() => this.CONSUME(tokens.Semicolon));
          },
          GATE: () => {
            // More flexible GATE to handle complex sbt assignments
            const la1 = this.LA(1);
            const la2 = this.LA(2);
            const la3 = this.LA(3);
            const la4 = this.LA(4);

            if (!la1 || la1.tokenType !== tokens.Identifier) {
              return false;
            }

            if (!la2) {
              return false;
            }

            // Check for direct assignment operators (highest priority)
            if (
              la2.tokenType === tokens.SbtAssign ||
              la2.tokenType === tokens.PlusEquals ||
              la2.tokenType === tokens.MinusEquals ||
              la2.tokenType === tokens.StarEquals ||
              la2.tokenType === tokens.SlashEquals ||
              la2.tokenType === tokens.PercentEquals ||
              la2.tokenType === tokens.AppendEquals
            ) {
              return true;
            }

            // Check for = with clear assignment pattern
            if (la2.tokenType === tokens.Equals && la3) {
              return (
                la3.tokenType === tokens.StringLiteral ||
                la3.tokenType === tokens.IntegerLiteral ||
                la3.tokenType === tokens.FloatingPointLiteral ||
                la3.tokenType === tokens.ScientificNotationLiteral ||
                la3.tokenType === tokens.True ||
                la3.tokenType === tokens.False ||
                la3.tokenType === tokens.Null ||
                la3.tokenType === tokens.Identifier ||
                la3.tokenType === tokens.LeftParen // for function calls like Seq(...)
              );
            }

            // Check for scoped assignment: scope / key := value
            if (
              la2.tokenType === tokens.Slash &&
              la3?.tokenType === tokens.Identifier &&
              la4
            ) {
              return (
                la4.tokenType === tokens.SbtAssign ||
                la4.tokenType === tokens.PlusEquals ||
                la4.tokenType === tokens.MinusEquals ||
                la4.tokenType === tokens.StarEquals ||
                la4.tokenType === tokens.SlashEquals ||
                la4.tokenType === tokens.PercentEquals ||
                la4.tokenType === tokens.AppendEquals ||
                la4.tokenType === tokens.Equals
              );
            }

            return false;
          },
        },
        { ALT: () => this.SUBRULE(this.topLevelDefinition) },
        {
          ALT: () => {
            this.SUBRULE(this.expression);
            this.OPTION2(() => this.CONSUME2(tokens.Semicolon));
          },
        },
      ]);
    });
  });

  // Package declaration
  private packageClause = this.RULE("packageClause", () => {
    this.CONSUME(tokens.Package);
    this.SUBRULE(this.qualifiedIdentifier);
    this.OPTION(() => this.CONSUME(tokens.Semicolon));
  });

  // Import declaration
  private importClause = this.RULE("importClause", () => {
    this.CONSUME(tokens.Import);
    this.SUBRULE(this.importExpression);
    this.OPTION(() => this.CONSUME(tokens.Semicolon));
  });

  private importExpression = this.RULE("importExpression", () => {
    // Parse the base path (e.g., "scala.collection")
    this.CONSUME(tokens.Identifier);
    this.MANY(() => {
      this.CONSUME(tokens.Dot);
      this.OR([
        // Next identifier in path
        { ALT: () => this.CONSUME2(tokens.Identifier) },
        // Wildcard import
        { ALT: () => this.CONSUME(tokens.Underscore) },
        // Multiple import selectors
        {
          ALT: () => {
            this.CONSUME(tokens.LeftBrace);
            this.AT_LEAST_ONE_SEP({
              SEP: tokens.Comma,
              DEF: () => this.SUBRULE(this.importSelector),
            });
            this.CONSUME(tokens.RightBrace);
          },
        },
      ]);
    });
  });

  private importSelector = this.RULE("importSelector", () => {
    this.OR([
      {
        ALT: () => {
          this.CONSUME(tokens.Identifier);
          this.OPTION(() => {
            this.CONSUME(tokens.Arrow);
            this.OR2([
              { ALT: () => this.CONSUME2(tokens.Identifier) },
              { ALT: () => this.CONSUME(tokens.Underscore) },
            ]);
          });
        },
      },
      { ALT: () => this.CONSUME2(tokens.Underscore) }, // Allow wildcard import in selectors
    ]);
  });

  // Export declaration (Scala 3)
  private exportClause = this.RULE("exportClause", () => {
    this.CONSUME(tokens.Export);
    this.SUBRULE(this.exportExpression);
    this.OPTION(() => this.CONSUME(tokens.Semicolon));
  });

  private exportExpression = this.RULE("exportExpression", () => {
    // Parse the base path (e.g., "mypackage")
    this.CONSUME(tokens.Identifier);
    this.MANY(() => {
      this.CONSUME(tokens.Dot);
      this.OR([
        // Next identifier in path
        { ALT: () => this.CONSUME2(tokens.Identifier) },
        // Given keyword for given exports
        { ALT: () => this.CONSUME(tokens.Given) },
        // Wildcard export
        { ALT: () => this.CONSUME(tokens.Underscore) },
        // Multiple export selectors
        {
          ALT: () => {
            this.CONSUME(tokens.LeftBrace);
            this.AT_LEAST_ONE_SEP({
              SEP: tokens.Comma,
              DEF: () => this.SUBRULE(this.exportSelector),
            });
            this.CONSUME(tokens.RightBrace);
          },
        },
      ]);
    });
  });

  private exportSelector = this.RULE("exportSelector", () => {
    this.OR([
      {
        ALT: () => {
          this.CONSUME(tokens.Identifier);
          this.OPTION(() => {
            this.CONSUME(tokens.Arrow);
            this.OR2([
              { ALT: () => this.CONSUME2(tokens.Identifier) },
              { ALT: () => this.CONSUME(tokens.Underscore) },
            ]);
          });
        },
      },
      { ALT: () => this.CONSUME(tokens.Given) }, // export given instances
      { ALT: () => this.CONSUME2(tokens.Underscore) }, // Allow wildcard export in selectors
    ]);
  });

  // Top-level definitions
  private topLevelDefinition = this.RULE("topLevelDefinition", () => {
    this.MANY(() => this.SUBRULE(this.annotation));
    this.MANY2(() => this.SUBRULE(this.modifier));
    this.OR([
      { ALT: () => this.SUBRULE(this.classDefinition) },
      { ALT: () => this.SUBRULE(this.objectDefinition) },
      { ALT: () => this.SUBRULE(this.traitDefinition) },
      { ALT: () => this.SUBRULE(this.enumDefinition) },
      { ALT: () => this.SUBRULE(this.extensionDefinition) },
      { ALT: () => this.SUBRULE(this.valDefinition) },
      { ALT: () => this.SUBRULE(this.varDefinition) },
      { ALT: () => this.SUBRULE(this.defDefinition) },
      { ALT: () => this.SUBRULE(this.givenDefinition) },
      { ALT: () => this.SUBRULE(this.typeDefinition) },
    ]);
  });

  // Annotations
  private annotation = this.RULE("annotation", () => {
    this.CONSUME(tokens.At);
    this.SUBRULE(this.qualifiedIdentifier);
    // Support multiple parameter lists: @Inject() or @Inject()(val x: Type) or @Entity(name = "value")
    this.MANY(() => {
      this.CONSUME(tokens.LeftParen);
      this.MANY_SEP({
        SEP: tokens.Comma,
        DEF: () => this.SUBRULE(this.annotationArgument),
      });
      this.CONSUME(tokens.RightParen);
    });
  });

  private annotationArgument = this.RULE("annotationArgument", () => {
    this.OR([
      {
        // Parameter declaration: val x: Type or var y: Type
        ALT: () => {
          this.OR2([
            { ALT: () => this.CONSUME(tokens.Val) },
            { ALT: () => this.CONSUME(tokens.Var) },
          ]);
          this.CONSUME(tokens.Identifier);
          this.CONSUME(tokens.Colon);
          this.SUBRULE(this.type);
          // Optional default value
          this.OPTION(() => {
            this.CONSUME(tokens.Equals);
            this.SUBRULE(this.expression);
          });
        },
        GATE: () => {
          // Look ahead for val/var followed by identifier and colon
          const first = this.LA(1);
          const second = this.LA(2);
          const third = this.LA(3);
          return (
            first &&
            (first.tokenType === tokens.Val ||
              first.tokenType === tokens.Var) &&
            second &&
            second.tokenType === tokens.Identifier &&
            third &&
            third.tokenType === tokens.Colon
          );
        },
      },
      {
        // Named argument: name = value
        ALT: () => {
          this.CONSUME2(tokens.Identifier);
          this.CONSUME2(tokens.Equals);
          this.SUBRULE2(this.expression);
        },
        GATE: () => {
          // Look ahead for identifier followed by equals (not val/var)
          const first = this.LA(1);
          const second = this.LA(2);
          return (
            first &&
            first.tokenType === tokens.Identifier &&
            second &&
            second.tokenType === tokens.Equals
          );
        },
      },
      {
        // Positional argument: value
        ALT: () => this.SUBRULE3(this.expression),
      },
    ]);
  });

  // Modifiers
  private modifier = this.RULE("modifier", () => {
    this.OR([
      { ALT: () => this.CONSUME(tokens.Private) },
      { ALT: () => this.CONSUME(tokens.Protected) },
      { ALT: () => this.CONSUME(tokens.Public) },
      { ALT: () => this.CONSUME(tokens.Abstract) },
      { ALT: () => this.CONSUME(tokens.Final) },
      { ALT: () => this.CONSUME(tokens.Sealed) },
      { ALT: () => this.CONSUME(tokens.Implicit) },
      { ALT: () => this.CONSUME(tokens.Lazy) },
      { ALT: () => this.CONSUME(tokens.Override) },
      { ALT: () => this.CONSUME(tokens.Case) },
      { ALT: () => this.CONSUME(tokens.Inline) },
      { ALT: () => this.CONSUME(tokens.Transparent) },
    ]);
  });

  // Class definition
  private classDefinition = this.RULE("classDefinition", () => {
    this.CONSUME(tokens.Class);
    this.CONSUME(tokens.Identifier);
    this.OPTION(() => this.SUBRULE(this.typeParameters));
    // Constructor annotations (for DI patterns like @Inject())
    this.MANY(() => this.SUBRULE(this.annotation));
    // Constructor parameters (multiple parameter lists supported)
    this.MANY2(() => this.SUBRULE(this.classParameters));
    this.OPTION2(() => this.SUBRULE(this.extendsClause));
    this.OPTION3(() => this.SUBRULE(this.classBody));
  });

  // Object definition
  private objectDefinition = this.RULE("objectDefinition", () => {
    this.CONSUME(tokens.ObjectKeyword);
    this.CONSUME(tokens.Identifier);
    this.OPTION(() => this.SUBRULE(this.extendsClause));
    this.OPTION2(() => this.SUBRULE(this.classBody));
  });

  // Trait definition
  private traitDefinition = this.RULE("traitDefinition", () => {
    this.CONSUME(tokens.Trait);
    this.CONSUME(tokens.Identifier);
    this.OPTION(() => this.SUBRULE(this.typeParameters));
    this.OPTION2(() => this.SUBRULE(this.extendsClause));
    this.OPTION3(() => this.SUBRULE(this.classBody));
  });

  // Enum definition (Scala 3)
  private enumDefinition = this.RULE("enumDefinition", () => {
    this.CONSUME(tokens.Enum);
    this.CONSUME(tokens.Identifier);
    this.OPTION(() => this.SUBRULE(this.typeParameters));
    this.OPTION2(() => this.SUBRULE(this.classParameters));
    this.OPTION3(() => this.SUBRULE(this.extendsClause));
    this.CONSUME(tokens.LeftBrace);
    this.MANY(() => this.SUBRULE(this.enumCase));
    this.CONSUME(tokens.RightBrace);
  });

  private enumCase = this.RULE("enumCase", () => {
    this.CONSUME(tokens.Case);
    this.CONSUME(tokens.Identifier);
    this.OPTION(() => this.SUBRULE(this.classParameters));
    this.OPTION2(() => this.SUBRULE(this.extendsClause));
    this.OPTION3(() => this.CONSUME(tokens.Semicolon));
  });

  // Extension definition (Scala 3)
  private extensionDefinition = this.RULE("extensionDefinition", () => {
    this.CONSUME(tokens.Extension);
    this.OPTION(() => this.SUBRULE(this.typeParameters));
    this.CONSUME(tokens.LeftParen);
    this.CONSUME(tokens.Identifier);
    this.CONSUME(tokens.Colon);
    this.SUBRULE(this.type);
    this.CONSUME(tokens.RightParen);
    this.CONSUME(tokens.LeftBrace);
    this.MANY(() => this.SUBRULE(this.extensionMember));
    this.CONSUME(tokens.RightBrace);
  });

  private extensionMember = this.RULE("extensionMember", () => {
    this.MANY(() => this.SUBRULE(this.modifier));
    this.SUBRULE(this.defDefinition);
  });

  // Val definition
  private valDefinition = this.RULE("valDefinition", () => {
    this.CONSUME(tokens.Val);
    this.OR([
      {
        // Simple variable with optional type: val x: Type = expr or val x: Type (abstract)
        ALT: () => {
          this.CONSUME(tokens.Identifier);
          this.OPTION(() => {
            this.CONSUME(tokens.Colon);
            this.SUBRULE(this.type);
          });
          this.OPTION3(() => {
            this.CONSUME(tokens.Equals);
            this.SUBRULE(this.expression);
          });
        },
        GATE: () => {
          // This alternative is for simple identifier patterns only
          // Must handle: val x = ..., val x: Type = ..., val x: Type (abstract)
          // Must NOT handle: val (x, y) = ..., val SomeClass(...) = ...
          const first = this.LA(1);
          const second = this.LA(2);

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
          this.SUBRULE(this.pattern);
          this.CONSUME2(tokens.Equals);
          this.SUBRULE2(this.expression);
        },
      },
    ]);
    this.OPTION4(() => this.CONSUME(tokens.Semicolon));
  });

  // Var definition
  private varDefinition = this.RULE("varDefinition", () => {
    this.CONSUME(tokens.Var);
    this.CONSUME(tokens.Identifier);
    this.OPTION(() => {
      this.CONSUME(tokens.Colon);
      this.SUBRULE(this.type);
    });
    this.CONSUME(tokens.Equals);
    this.SUBRULE(this.expression);
    this.OPTION2(() => this.CONSUME(tokens.Semicolon));
  });

  // Method definition
  private defDefinition = this.RULE("defDefinition", () => {
    this.CONSUME(tokens.Def);
    this.CONSUME(tokens.Identifier);
    this.OPTION(() => this.SUBRULE(this.typeParameters));
    this.OPTION2(() => this.SUBRULE(this.parameterLists));
    this.OPTION3(() => {
      this.CONSUME(tokens.Colon);
      this.SUBRULE(this.type);
    });
    this.OPTION4(() => {
      this.CONSUME(tokens.Equals);
      this.SUBRULE(this.expression);
    });
    this.OPTION5(() => this.CONSUME(tokens.Semicolon));
  });

  // Auxiliary constructor
  private auxiliaryConstructor = this.RULE("auxiliaryConstructor", () => {
    this.CONSUME(tokens.Def);
    this.CONSUME(tokens.This);
    this.AT_LEAST_ONE(() => this.SUBRULE(this.parameterList));
    this.CONSUME(tokens.Equals);
    this.SUBRULE(this.expression);
    this.OPTION(() => this.CONSUME(tokens.Semicolon));
  });

  // Given definition (Scala 3)
  private givenDefinition = this.RULE("givenDefinition", () => {
    this.CONSUME(tokens.Given);
    this.OR([
      {
        ALT: () => {
          // Named given with parameters: given name[T](using ord: Type): Type
          this.CONSUME(tokens.Identifier);
          this.OPTION(() => this.SUBRULE(this.typeParameters));
          this.OPTION2(() => this.SUBRULE(this.parameterLists));
          this.CONSUME(tokens.Colon);
          this.SUBRULE(this.type);
        },
        GATE: () => {
          // Look ahead to distinguish from anonymous given
          // Check if we have Identifier followed by : (with optional type params/params)
          let i = 1; // Start after Given token

          // Skip over identifier
          if (this.LA(i)?.tokenType === tokens.Identifier) {
            i++;

            // Skip over optional type parameters [...]
            if (this.LA(i)?.tokenType === tokens.LeftBracket) {
              let bracketCount = 1;
              i++;
              while (bracketCount > 0 && this.LA(i)) {
                if (this.LA(i).tokenType === tokens.LeftBracket) bracketCount++;
                if (this.LA(i).tokenType === tokens.RightBracket)
                  bracketCount--;
                i++;
              }
            }

            // Skip over optional parameter lists (...)
            if (this.LA(i)?.tokenType === tokens.LeftParen) {
              let parenCount = 1;
              i++;
              while (parenCount > 0 && this.LA(i)) {
                if (this.LA(i).tokenType === tokens.LeftParen) parenCount++;
                if (this.LA(i).tokenType === tokens.RightParen) parenCount--;
                i++;
              }
            }

            // Check if we have a colon after identifier and optional parts
            return this.LA(i)?.tokenType === tokens.Colon;
          }
          return false;
        },
      },
      {
        ALT: () => {
          // Anonymous given: given Type = expression
          this.SUBRULE2(this.type);
        },
      },
    ]);
    this.OPTION3(() => {
      this.CONSUME(tokens.Equals);
      this.SUBRULE(this.expression);
    });
    this.OPTION4(() => this.CONSUME(tokens.Semicolon));
  });

  // Type definitions
  private typeDefinition = this.RULE("typeDefinition", () => {
    this.OPTION(() => this.CONSUME(tokens.Opaque)); // Support opaque types
    this.CONSUME(tokens.Type);
    this.CONSUME(tokens.Identifier);
    this.OPTION2(() => this.SUBRULE(this.typeParameters));
    this.CONSUME(tokens.Equals);
    this.SUBRULE(this.type);
    this.OPTION3(() => this.CONSUME(tokens.Semicolon));
  });

  // Annotated class parameters (for DI patterns like @Inject()(val params...))
  private annotatedClassParameters = this.RULE(
    "annotatedClassParameters",
    () => {
      // Multiple parameter lists supported (annotations handled at topLevel)
      this.AT_LEAST_ONE(() => this.SUBRULE(this.classParameters));
    },
  );

  // Class parameters
  private classParameters = this.RULE("classParameters", () => {
    this.CONSUME(tokens.LeftParen);
    this.MANY_SEP({
      SEP: tokens.Comma,
      DEF: () => this.SUBRULE(this.classParameter),
    });
    this.CONSUME(tokens.RightParen);
  });

  private classParameter = this.RULE("classParameter", () => {
    this.MANY(() => this.SUBRULE(this.modifier));
    this.OPTION(() => {
      this.OR([
        { ALT: () => this.CONSUME(tokens.Val) },
        { ALT: () => this.CONSUME(tokens.Var) },
      ]);
    });
    this.CONSUME(tokens.Identifier);
    this.CONSUME(tokens.Colon);
    this.SUBRULE(this.type);
    this.OPTION2(() => {
      this.CONSUME(tokens.Equals);
      this.SUBRULE(this.expression);
    });
  });

  // Parameter lists
  private parameterLists = this.RULE("parameterLists", () => {
    this.AT_LEAST_ONE(() => this.SUBRULE(this.parameterList));
  });

  private parameterList = this.RULE("parameterList", () => {
    this.CONSUME(tokens.LeftParen);
    this.MANY_SEP({
      SEP: tokens.Comma,
      DEF: () => this.SUBRULE(this.parameter),
    });
    this.CONSUME(tokens.RightParen);
  });

  private parameter = this.RULE("parameter", () => {
    this.OPTION(() => {
      this.OR([
        { ALT: () => this.CONSUME(tokens.Using) },
        { ALT: () => this.CONSUME(tokens.Implicit) },
      ]);
    });
    this.CONSUME(tokens.Identifier);
    this.CONSUME(tokens.Colon);
    this.SUBRULE(this.type);
    this.OPTION2(() => {
      this.CONSUME(tokens.Equals);
      this.SUBRULE(this.expression);
    });
  });

  // Type parameters
  private typeParameters = this.RULE("typeParameters", () => {
    this.CONSUME(tokens.LeftBracket);
    this.MANY_SEP({
      SEP: tokens.Comma,
      DEF: () => this.SUBRULE(this.typeParameter),
    });
    this.CONSUME(tokens.RightBracket);
  });

  private typeParameter = this.RULE("typeParameter", () => {
    // Handle variance annotations +T, -T
    this.OPTION(() => {
      this.OR([
        { ALT: () => this.CONSUME(tokens.Plus) },
        { ALT: () => this.CONSUME(tokens.Minus) },
      ]);
    });
    this.CONSUME(tokens.Identifier);
    this.OPTION2(() => {
      this.OR2([
        {
          ALT: () => {
            this.CONSUME(tokens.SubtypeOf);
            this.SUBRULE(this.type);
          },
        },
        {
          ALT: () => {
            this.CONSUME(tokens.SupertypeOf);
            this.SUBRULE2(this.type);
          },
        },
      ]);
    });
  });

  // Extends clause
  private extendsClause = this.RULE("extendsClause", () => {
    this.CONSUME(tokens.Extends);
    this.SUBRULE(this.type);
    this.MANY(() => {
      this.CONSUME(tokens.With);
      this.SUBRULE2(this.type);
    });
  });

  // Class body
  private classBody = this.RULE("classBody", () => {
    this.CONSUME(tokens.LeftBrace);
    this.MANY(() => this.SUBRULE(this.classMember));
    this.CONSUME(tokens.RightBrace);
  });

  private classMember = this.RULE("classMember", () => {
    this.MANY(() => this.SUBRULE(this.annotation));
    this.MANY2(() => this.SUBRULE(this.modifier));
    this.OR([
      {
        ALT: () => this.SUBRULE(this.auxiliaryConstructor),
        GATE: () => {
          // Check if this is "def this"
          return (
            this.LA(1).tokenType === tokens.Def &&
            this.LA(2).tokenType === tokens.This
          );
        },
      },
      { ALT: () => this.SUBRULE(this.valDefinition) },
      { ALT: () => this.SUBRULE(this.varDefinition) },
      { ALT: () => this.SUBRULE(this.defDefinition) },
      { ALT: () => this.SUBRULE(this.givenDefinition) },
      { ALT: () => this.SUBRULE(this.classDefinition) },
      { ALT: () => this.SUBRULE(this.objectDefinition) },
      { ALT: () => this.SUBRULE(this.traitDefinition) },
      { ALT: () => this.SUBRULE(this.enumDefinition) },
      { ALT: () => this.SUBRULE(this.extensionDefinition) },
      {
        ALT: () => {
          // Try assignment statement
          this.SUBRULE(this.assignmentStatement);
          this.OPTION(() => this.CONSUME(tokens.Semicolon));
        },
        GATE: () => {
          // Check if this looks like an assignment (support sbt scoped assignments)
          const first = this.LA(1);
          const second = this.LA(2);
          const third = this.LA(3);
          const fourth = this.LA(4);

          return (
            first.tokenType === tokens.Identifier &&
            // Direct assignment: name := value
            (second.tokenType === tokens.PlusEquals ||
              second.tokenType === tokens.MinusEquals ||
              second.tokenType === tokens.StarEquals ||
              second.tokenType === tokens.SlashEquals ||
              second.tokenType === tokens.PercentEquals ||
              second.tokenType === tokens.SbtAssign ||
              second.tokenType === tokens.Equals ||
              // Scoped assignment: scope / key := value
              (second.tokenType === tokens.Slash &&
                third &&
                third.tokenType === tokens.Identifier &&
                fourth &&
                (fourth.tokenType === tokens.PlusEquals ||
                  fourth.tokenType === tokens.MinusEquals ||
                  fourth.tokenType === tokens.StarEquals ||
                  fourth.tokenType === tokens.SlashEquals ||
                  fourth.tokenType === tokens.PercentEquals ||
                  fourth.tokenType === tokens.SbtAssign ||
                  fourth.tokenType === tokens.Equals)))
          );
        },
      },
      {
        ALT: () => {
          this.SUBRULE(this.expression);
          this.OPTION2(() => this.CONSUME2(tokens.Semicolon));
        },
      },
    ]);
  });

  // Types
  private type = this.RULE("type", () => {
    this.SUBRULE(this.matchType);
  });

  private matchType = this.RULE("matchType", () => {
    this.SUBRULE(this.unionType);
    this.OPTION(() => {
      this.CONSUME(tokens.Match);
      this.CONSUME(tokens.LeftBrace);
      this.MANY(() => {
        this.SUBRULE(this.matchTypeCase);
      });
      this.CONSUME(tokens.RightBrace);
    });
  });

  private matchTypeCase = this.RULE("matchTypeCase", () => {
    this.CONSUME(tokens.Case);
    this.SUBRULE(this.type);
    this.CONSUME(tokens.Arrow);
    this.SUBRULE2(this.type);
  });

  private unionType = this.RULE("unionType", () => {
    this.SUBRULE(this.intersectionType);
    this.MANY(() => {
      this.CONSUME(tokens.BitwiseOr); // | for union types
      this.SUBRULE2(this.intersectionType);
    });
  });

  private intersectionType = this.RULE("intersectionType", () => {
    this.SUBRULE(this.baseType);
    this.MANY(() => {
      this.CONSUME(tokens.BitwiseAnd); // & for intersection types
      this.SUBRULE2(this.baseType);
    });
  });

  private baseType = this.RULE("baseType", () => {
    this.OR([
      // Array type constructor (highest priority)
      {
        ALT: () => {
          this.CONSUME(tokens.Array);
          this.OPTION(() => {
            this.CONSUME(tokens.LeftBracket);
            this.MANY_SEP({
              SEP: tokens.Comma,
              DEF: () => this.SUBRULE(this.typeArgument),
            });
            this.CONSUME(tokens.RightBracket);
          });
        },
      },
      // Type lambda: [X] =>> F[X]
      {
        ALT: () => {
          this.SUBRULE(this.typeLambda);
        },
        GATE: () => {
          // Look ahead to detect type lambda pattern
          // Pattern: [ [typeParam [, ...]] ] =>>
          if (this.LA(1)?.tokenType !== tokens.LeftBracket) return false;

          // Simple check: look for =>> after some tokens
          let i = 2; // Start after LeftBracket
          const MAX_LOOKAHEAD = 20; // Reduced for safety

          // Handle simple case: [X] =>>
          if (
            this.LA(2)?.tokenType === tokens.Identifier &&
            this.LA(3)?.tokenType === tokens.RightBracket
          ) {
            return this.LA(4)?.tokenType === tokens.TypeLambdaArrow;
          }

          // Handle variance: [+X] =>> or [-X] =>>
          if (
            (this.LA(2)?.tokenType === tokens.Plus ||
              this.LA(2)?.tokenType === tokens.Minus) &&
            this.LA(3)?.tokenType === tokens.Identifier &&
            this.LA(4)?.tokenType === tokens.RightBracket
          ) {
            return this.LA(5)?.tokenType === tokens.TypeLambdaArrow;
          }

          // Handle empty: [] =>>
          if (this.LA(2)?.tokenType === tokens.RightBracket) {
            return this.LA(3)?.tokenType === tokens.TypeLambdaArrow;
          }

          // More complex cases with bounds - scan forward
          let bracketCount = 1;
          while (i < MAX_LOOKAHEAD && this.LA(i)) {
            const token = this.LA(i);
            if (token.tokenType === tokens.LeftBracket) bracketCount++;
            if (token.tokenType === tokens.RightBracket) {
              bracketCount--;
              if (bracketCount === 0) {
                // Found closing bracket, check for =>>
                return this.LA(i + 1)?.tokenType === tokens.TypeLambdaArrow;
              }
            }
            i++;
          }

          return false;
        },
      },
      // Polymorphic function type: [T] => T => T
      {
        ALT: () => {
          this.SUBRULE(this.polymorphicFunctionType);
        },
        GATE: () => {
          // Look ahead to detect polymorphic function type pattern
          // Pattern: [ [typeParam [, ...]] ] =>
          if (this.LA(1).tokenType !== tokens.LeftBracket) return false;

          // Skip to find ] => pattern
          let i = 2; // Start after LeftBracket
          let bracketCount = 0;
          const MAX_LOOKAHEAD = 50; // Prevent infinite loops

          while (
            this.LA(i) &&
            i < MAX_LOOKAHEAD &&
            (bracketCount > 0 || this.LA(i).tokenType !== tokens.RightBracket)
          ) {
            if (this.LA(i).tokenType === tokens.LeftBracket) bracketCount++;
            if (this.LA(i).tokenType === tokens.RightBracket) bracketCount--;
            i++;
          }

          // Check for ] => (ensure we didn't hit the lookahead limit)
          return (
            i < MAX_LOOKAHEAD &&
            this.LA(i)?.tokenType === tokens.RightBracket &&
            this.LA(i + 1)?.tokenType === tokens.Arrow
          );
        },
      },
      // Context function type: Type ?=> Type
      {
        ALT: () => {
          this.SUBRULE(this.contextFunctionType);
        },
        GATE: () => {
          // Look ahead to detect context function type pattern
          // We need to find ?=> pattern after parsing a type
          let i = 1;

          // Handle parenthesized types: (A, B) ?=> C or (A | B) ?=> C
          if (this.LA(i)?.tokenType === tokens.LeftParen) {
            let parenCount = 1;
            i++;
            while (parenCount > 0 && this.LA(i)) {
              if (this.LA(i).tokenType === tokens.LeftParen) parenCount++;
              if (this.LA(i).tokenType === tokens.RightParen) parenCount--;
              i++;
            }

            // Check if we have ?=> after closing paren
            return this.LA(i)?.tokenType === tokens.ContextArrow;
          }

          // Handle simple types
          if (this.LA(i)?.tokenType === tokens.Identifier) {
            i++;

            // Skip dots and more identifiers
            while (
              this.LA(i)?.tokenType === tokens.Dot &&
              this.LA(i + 1)?.tokenType === tokens.Identifier
            ) {
              i += 2;
            }

            // Skip optional type parameters [...]
            if (this.LA(i)?.tokenType === tokens.LeftBracket) {
              let bracketCount = 1;
              i++;
              while (bracketCount > 0 && this.LA(i)) {
                if (this.LA(i).tokenType === tokens.LeftBracket) bracketCount++;
                if (this.LA(i).tokenType === tokens.RightBracket)
                  bracketCount--;
                i++;
              }
            }

            // Check if we have ?=> after the type
            return this.LA(i)?.tokenType === tokens.ContextArrow;
          }

          return false;
        },
      },
      // Dependent function type: (x: Int) => Vector[x.type]
      {
        ALT: () => {
          this.SUBRULE(this.dependentFunctionType);
        },
        GATE: () => {
          // Look ahead to detect dependent function type pattern
          // Pattern: ( [identifier : type [, ...]] ) =>
          if (this.LA(1).tokenType !== tokens.LeftParen) return false;

          // Handle empty parameter list: () =>
          if (this.LA(2)?.tokenType === tokens.RightParen) {
            return this.LA(3)?.tokenType === tokens.Arrow;
          }

          let i = 2; // Start after LeftParen

          // Skip identifier
          if (this.LA(i)?.tokenType === tokens.Identifier) {
            i++;

            // Check for colon
            if (this.LA(i)?.tokenType === tokens.Colon) {
              i++;

              // Skip type - simplified check for now
              // We need to find ) => pattern
              let parenCount = 0;
              while (
                this.LA(i) &&
                (parenCount > 0 || this.LA(i).tokenType !== tokens.RightParen)
              ) {
                if (this.LA(i).tokenType === tokens.LeftParen) parenCount++;
                if (this.LA(i).tokenType === tokens.RightParen) parenCount--;
                i++;
              }

              // Check for ) =>
              if (
                this.LA(i)?.tokenType === tokens.RightParen &&
                this.LA(i + 1)?.tokenType === tokens.Arrow
              ) {
                return true;
              }
            }
          }

          return false;
        },
      },
      // Tuple type or parenthesized type: (A, B) or (String | Int)
      {
        ALT: () => {
          this.CONSUME(tokens.LeftParen);
          this.SUBRULE(this.tupleTypeOrParenthesized);
          this.CONSUME(tokens.RightParen);
        },
      },
      // Simple type (without recursion to avoid left recursion)
      {
        ALT: () => {
          this.SUBRULE(this.simpleType);
        },
      },
    ]);
  });

  private tupleTypeOrParenthesized = this.RULE(
    "tupleTypeOrParenthesized",
    () => {
      this.SUBRULE(this.type);
      this.MANY(() => {
        this.CONSUME(tokens.Comma);
        this.SUBRULE2(this.type);
      });
    },
  );

  private simpleType = this.RULE("simpleType", () => {
    // Regular type with optional type arguments
    this.SUBRULE(this.qualifiedIdentifier);
    this.OPTION(() => {
      this.CONSUME(tokens.LeftBracket);
      this.MANY_SEP({
        SEP: tokens.Comma,
        DEF: () => this.SUBRULE(this.typeArgument),
      });
      this.CONSUME(tokens.RightBracket);
    });
  });

  private typeArgument = this.RULE("typeArgument", () => {
    this.OR([
      // Kind Projector notation: *
      { ALT: () => this.CONSUME(tokens.Star) },
      // Array type constructor
      {
        ALT: () => {
          this.CONSUME(tokens.Array);
          this.OPTION(() => {
            this.CONSUME(tokens.LeftBracket);
            this.MANY_SEP({
              SEP: tokens.Comma,
              DEF: () => this.SUBRULE(this.typeArgument),
            });
            this.CONSUME(tokens.RightBracket);
          });
        },
      },
      // Union and intersection types
      { ALT: () => this.SUBRULE(this.typeArgumentUnion) },
    ]);
  });

  private typeArgumentUnion = this.RULE("typeArgumentUnion", () => {
    this.SUBRULE(this.typeArgumentIntersection);
    this.MANY(() => {
      this.CONSUME(tokens.BitwiseOr); // | for union types
      this.SUBRULE2(this.typeArgumentIntersection);
    });
  });

  private typeArgumentIntersection = this.RULE(
    "typeArgumentIntersection",
    () => {
      this.SUBRULE(this.typeArgumentSimple);
      this.MANY(() => {
        this.CONSUME(tokens.BitwiseAnd); // & for intersection types
        this.SUBRULE2(this.typeArgumentSimple);
      });
    },
  );

  private typeArgumentSimple = this.RULE("typeArgumentSimple", () => {
    this.OR([
      // Parenthesized type
      {
        ALT: () => {
          this.CONSUME(tokens.LeftParen);
          this.SUBRULE(this.typeArgument);
          this.CONSUME(tokens.RightParen);
        },
      },
      // Regular type with optional type arguments
      {
        ALT: () => {
          this.SUBRULE(this.qualifiedIdentifier);
          this.OPTION(() => {
            this.CONSUME(tokens.LeftBracket);
            this.MANY_SEP({
              SEP: tokens.Comma,
              DEF: () => this.SUBRULE2(this.typeArgument),
            });
            this.CONSUME(tokens.RightBracket);
          });
        },
      },
    ]);
  });

  private typeLambda = this.RULE("typeLambda", () => {
    this.CONSUME(tokens.LeftBracket);
    this.MANY_SEP({
      SEP: tokens.Comma,
      DEF: () => this.SUBRULE(this.typeLambdaParameter),
    });
    this.CONSUME(tokens.RightBracket);
    this.CONSUME(tokens.TypeLambdaArrow);
    this.SUBRULE(this.type);
  });

  private typeLambdaParameter = this.RULE("typeLambdaParameter", () => {
    // Handle variance annotations +X, -X
    this.OPTION(() => {
      this.OR([
        { ALT: () => this.CONSUME(tokens.Plus) },
        { ALT: () => this.CONSUME(tokens.Minus) },
      ]);
    });
    this.CONSUME(tokens.Identifier);
    this.OPTION2(() => {
      this.OR2([
        {
          ALT: () => {
            this.CONSUME(tokens.SubtypeOf);
            this.SUBRULE(this.type);
          },
        },
        {
          ALT: () => {
            this.CONSUME(tokens.SupertypeOf);
            this.SUBRULE2(this.type);
          },
        },
      ]);
    });
  });

  private dependentFunctionType = this.RULE("dependentFunctionType", () => {
    this.CONSUME(tokens.LeftParen);
    this.OPTION(() => {
      this.MANY_SEP({
        SEP: tokens.Comma,
        DEF: () => this.SUBRULE(this.dependentParameter),
      });
    });
    this.CONSUME(tokens.RightParen);
    this.CONSUME(tokens.Arrow);
    this.SUBRULE(this.type);
  });

  private dependentParameter = this.RULE("dependentParameter", () => {
    this.CONSUME(tokens.Identifier);
    this.CONSUME(tokens.Colon);
    this.SUBRULE(this.type);
  });

  private polymorphicFunctionType = this.RULE("polymorphicFunctionType", () => {
    // Type parameters: [T] or [A, B]
    this.CONSUME(tokens.LeftBracket);
    this.MANY_SEP({
      SEP: tokens.Comma,
      DEF: () => this.SUBRULE(this.polymorphicTypeParameter),
    });
    this.CONSUME(tokens.RightBracket);
    this.CONSUME(tokens.Arrow);
    // The rest of the type (function type)
    this.SUBRULE(this.type);
  });

  private contextFunctionType = this.RULE("contextFunctionType", () => {
    // Handle both simple types and parenthesized complex types
    this.OR([
      {
        ALT: () => {
          // Parenthesized type: (A, B) or (A | B)
          this.CONSUME(tokens.LeftParen);
          this.SUBRULE(this.tupleTypeOrParenthesized);
          this.CONSUME(tokens.RightParen);
        },
      },
      {
        ALT: () => {
          // Simple type: String, List[Int], etc.
          this.SUBRULE(this.simpleType);
        },
      },
    ]);
    this.CONSUME(tokens.ContextArrow);
    this.SUBRULE(this.type);
  });

  // Patterns
  private pattern = this.RULE("pattern", () => {
    this.OR([
      // TODO: Tuple pattern support disabled temporarily due to parsing conflicts
      // {
      //   ALT: () => {
      //     // Tuple pattern: (a, b, c)
      //     this.CONSUME(tokens.LeftParen);
      //     this.SUBRULE(this.pattern);
      //     this.MANY(() => {
      //       this.CONSUME(tokens.Comma);
      //       this.SUBRULE3(this.pattern);
      //     });
      //     this.CONSUME(tokens.RightParen);
      //   },
      // },
      {
        ALT: () => {
          // Array pattern: Array[T] or Array(args)
          this.CONSUME(tokens.Array);
          this.OR2([
            {
              ALT: () => {
                // Array type pattern: Array[T]
                this.CONSUME(tokens.LeftBracket);
                this.CONSUME(tokens.Identifier); // Use Identifier instead of pattern to avoid recursion
                this.CONSUME(tokens.RightBracket);
              },
            },
            {
              ALT: () => {
                // Array constructor pattern: Array(args)
                this.CONSUME2(tokens.LeftParen);
                this.MANY_SEP({
                  SEP: tokens.Comma,
                  DEF: () => this.SUBRULE2(this.pattern),
                });
                this.CONSUME2(tokens.RightParen);
              },
            },
          ]);
        },
      },
      {
        ALT: () => {
          // Constructor pattern: SomeClass(args)
          this.CONSUME2(tokens.Identifier);
          this.CONSUME3(tokens.LeftParen);
          this.MANY_SEP2({
            SEP: tokens.Comma,
            DEF: () => this.SUBRULE3(this.pattern),
          });
          this.CONSUME3(tokens.RightParen);
        },
        GATE: () => {
          // Only try if we see Identifier followed by LeftParen
          const nextToken = this.LA(2);
          return nextToken && nextToken.tokenType === tokens.LeftParen;
        },
      },
      {
        ALT: () => {
          // Type pattern with type arguments: List[T]
          this.CONSUME3(tokens.Identifier);
          this.OPTION(() => {
            this.CONSUME2(tokens.LeftBracket);
            this.MANY_SEP3({
              SEP: tokens.Comma,
              DEF: () => {
                this.CONSUME5(tokens.Identifier); // Use Identifier instead of pattern to avoid recursion
              },
            });
            this.CONSUME2(tokens.RightBracket);
          });
        },
        GATE: () => {
          // Only try if we see Identifier followed by LeftBracket
          const nextToken = this.LA(2);
          return nextToken && nextToken.tokenType === tokens.LeftBracket;
        },
      },
      {
        ALT: () => {
          // Simple variable pattern
          this.CONSUME4(tokens.Identifier);
        },
      },
      { ALT: () => this.CONSUME(tokens.Underscore) },
      { ALT: () => this.SUBRULE(this.literal) },
    ]);
  });

  // Expressions (simplified for MVP)
  private expression = this.RULE("expression", () => {
    // Try lambda expression with backtracking
    this.OR([
      {
        ALT: () => {
          // Polymorphic function literal: [T] => (x: T) => x
          this.SUBRULE(this.polymorphicFunctionLiteral);
        },
        GATE: () => {
          // Only try if we see [ followed by identifier (type parameter)
          const la1 = this.LA(1);
          const la2 = this.LA(2);
          return (
            la1?.tokenType === tokens.LeftBracket &&
            la2?.tokenType === tokens.Identifier
          );
        },
      },
      {
        ALT: () => {
          // Lambda with parameter list: (x: Int, y: Int) => x + y
          this.SUBRULE(this.parameterList);
          this.CONSUME(tokens.Arrow);
          this.SUBRULE(this.expression);
        },
        GATE: () => {
          // Only try if we see ( followed by parameter pattern
          const la2 = this.LA(2);
          const la3 = this.LA(3);
          return (
            la2 &&
            la2.tokenType === tokens.Identifier &&
            la3 &&
            la3.tokenType === tokens.Colon
          );
        },
      },
      {
        ALT: () => {
          // Block lambda: { x => ... }
          this.CONSUME(tokens.LeftBrace);
          this.CONSUME2(tokens.Identifier);
          this.CONSUME3(tokens.Arrow);
          this.MANY(() => this.SUBRULE(this.blockStatement));
          this.OPTION(() => this.SUBRULE3(this.expression));
          this.CONSUME(tokens.RightBrace);
        },
        GATE: () => {
          // Only try if we see { followed by identifier and arrow
          const la2 = this.LA(2);
          const la3 = this.LA(3);
          return (
            la2 &&
            la2.tokenType === tokens.Identifier &&
            la3 &&
            la3.tokenType === tokens.Arrow
          );
        },
      },
      {
        ALT: () => {
          // Simple lambda: x => x * 2
          this.CONSUME(tokens.Identifier);
          this.CONSUME2(tokens.Arrow);
          this.SUBRULE2(this.expression);
        },
        GATE: () => {
          // Only try lambda if we see Identifier followed by Arrow
          const nextTokens = this.LA(2);
          return nextTokens && nextTokens.tokenType === tokens.Arrow;
        },
      },
      {
        ALT: () => this.SUBRULE(this.assignmentOrInfixExpression),
      },
    ]);
  });

  private assignmentOrInfixExpression = this.RULE(
    "assignmentOrInfixExpression",
    () => {
      this.SUBRULE(this.postfixExpression);
      // First check for assignment (excluding sbt assignments - those are handled at top level)
      this.OPTION(() => {
        this.OR([
          { ALT: () => this.CONSUME(tokens.Equals) },
          // Removed sbt-specific operators to avoid conflict with assignmentStatement
        ]);
        this.SUBRULE3(this.expression);
      });
      // Then handle infix operators
      this.MANY(() => {
        this.SUBRULE(this.infixOperator);
        this.SUBRULE2(this.postfixExpression);
      });
    },
  );

  private postfixExpression = this.RULE("postfixExpression", () => {
    this.SUBRULE(this.primaryExpression);
    this.MANY(() => {
      this.OR([
        {
          ALT: () => {
            this.CONSUME(tokens.Dot);
            this.CONSUME(tokens.Identifier);
            this.OR2([
              {
                ALT: () => {
                  // Regular method call with parentheses
                  this.CONSUME(tokens.LeftParen);
                  this.OPTION2(() => {
                    this.MANY_SEP({
                      SEP: tokens.Comma,
                      DEF: () => this.SUBRULE4(this.expression),
                    });
                  });
                  this.CONSUME(tokens.RightParen);
                },
              },
              {
                ALT: () => {
                  // Method call with block lambda
                  this.CONSUME3(tokens.LeftBrace);
                  this.CONSUME3(tokens.Identifier);
                  this.CONSUME2(tokens.Arrow);
                  this.MANY3(() => this.SUBRULE(this.blockStatement));
                  this.OPTION4(() => this.SUBRULE5(this.expression));
                  this.CONSUME2(tokens.RightBrace);
                },
              },
              {
                ALT: () => {
                  // No arguments (method call without parentheses)
                },
              },
            ]);
          },
        },
        {
          ALT: () => {
            this.CONSUME2(tokens.LeftParen);
            this.MANY_SEP2({
              SEP: tokens.Comma,
              DEF: () => this.SUBRULE2(this.expression),
            });
            this.CONSUME2(tokens.RightParen);
          },
        },
        {
          ALT: () => {
            this.CONSUME(tokens.Match);
            this.CONSUME(tokens.LeftBrace);
            this.MANY2(() => this.SUBRULE(this.caseClause));
            this.CONSUME(tokens.RightBrace);
          },
        },
        {
          ALT: () => {
            // Type parameters only: List[Int], Map[String, Int]
            this.CONSUME(tokens.LeftBracket);
            this.MANY_SEP3({
              SEP: tokens.Comma,
              DEF: () => this.SUBRULE5(this.type),
            });
            this.CONSUME(tokens.RightBracket);
            // Arguments are optional after type parameters
            this.OPTION3(() => {
              this.CONSUME3(tokens.LeftParen);
              this.MANY_SEP4({
                SEP: tokens.Comma,
                DEF: () => this.SUBRULE6(this.expression),
              });
              this.CONSUME3(tokens.RightParen);
            });
          },
        },
      ]);
    });
  });

  private primaryExpression = this.RULE("primaryExpression", () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.literal) },
      { ALT: () => this.CONSUME(tokens.Identifier) },
      { ALT: () => this.CONSUME(tokens.Array) }, // Support Array constructor calls
      { ALT: () => this.CONSUME(tokens.This) },
      { ALT: () => this.SUBRULE(this.newExpression) },
      { ALT: () => this.SUBRULE(this.forExpression) },
      { ALT: () => this.SUBRULE(this.ifExpression) },
      { ALT: () => this.SUBRULE(this.whileExpression) },
      { ALT: () => this.SUBRULE(this.tryExpression) },
      {
        ALT: () => {
          // Unary negation: !expression
          this.CONSUME(tokens.Exclamation);
          this.SUBRULE(this.postfixExpression);
        },
      },
      {
        ALT: () => {
          // Bitwise complement: ~expression
          this.CONSUME(tokens.BitwiseTilde);
          this.SUBRULE2(this.postfixExpression);
        },
      },
      {
        ALT: () => {
          this.CONSUME(tokens.LeftParen);
          this.SUBRULE(this.assignmentOrInfixExpression);
          this.CONSUME(tokens.RightParen);
        },
      },
      {
        ALT: () => {
          // PartialFunction literal: { case ... }
          this.SUBRULE(this.partialFunctionLiteral);
        },
        GATE: () => {
          // Only try if we see { followed by case
          const la2 = this.LA(2);
          return la2 && la2.tokenType === tokens.Case;
        },
      },
      { ALT: () => this.SUBRULE(this.blockExpression) },
      { ALT: () => this.SUBRULE(this.quoteExpression) },
      { ALT: () => this.SUBRULE(this.spliceExpression) },
    ]);
  });

  private newExpression = this.RULE("newExpression", () => {
    this.CONSUME(tokens.New);
    this.SUBRULE(this.type);
    this.OPTION(() => {
      this.CONSUME(tokens.LeftParen);
      this.MANY_SEP({
        SEP: tokens.Comma,
        DEF: () => this.SUBRULE(this.expression),
      });
      this.CONSUME(tokens.RightParen);
    });
  });

  private caseClause = this.RULE("caseClause", () => {
    this.CONSUME(tokens.Case);
    this.SUBRULE(this.pattern);
    this.OPTION(() => {
      this.CONSUME(tokens.If);
      this.SUBRULE(this.expression);
    });
    this.CONSUME(tokens.Arrow);
    this.SUBRULE2(this.expression);
  });

  private ifExpression = this.RULE("ifExpression", () => {
    this.CONSUME(tokens.If);
    this.CONSUME(tokens.LeftParen);
    this.SUBRULE(this.expression);
    this.CONSUME(tokens.RightParen);
    this.SUBRULE2(this.expression);
    this.OPTION(() => {
      this.CONSUME(tokens.Else);
      this.SUBRULE3(this.expression);
    });
  });

  private whileExpression = this.RULE("whileExpression", () => {
    this.CONSUME(tokens.While);
    this.CONSUME(tokens.LeftParen);
    this.SUBRULE(this.expression);
    this.CONSUME(tokens.RightParen);
    this.SUBRULE2(this.expression);
  });

  private tryExpression = this.RULE("tryExpression", () => {
    this.CONSUME(tokens.Try);
    this.SUBRULE(this.expression);
    this.OPTION(() => {
      this.CONSUME(tokens.Catch);
      this.CONSUME(tokens.LeftBrace);
      this.MANY(() => this.SUBRULE(this.caseClause));
      this.CONSUME(tokens.RightBrace);
    });
    this.OPTION2(() => {
      this.CONSUME(tokens.Finally);
      this.SUBRULE2(this.expression);
    });
  });

  private forExpression = this.RULE("forExpression", () => {
    this.CONSUME(tokens.For);
    this.OR([
      {
        ALT: () => {
          this.CONSUME(tokens.LeftParen);
          this.MANY_SEP({
            SEP: tokens.Semicolon,
            DEF: () => this.SUBRULE(this.generator),
          });
          this.CONSUME(tokens.RightParen);
        },
      },
      {
        ALT: () => {
          this.CONSUME(tokens.LeftBrace);
          this.MANY(() => this.SUBRULE2(this.generator));
          this.CONSUME(tokens.RightBrace);
        },
      },
    ]);
    this.OPTION(() => this.CONSUME(tokens.Yield));
    this.SUBRULE(this.expression);
  });

  private generator = this.RULE("generator", () => {
    this.SUBRULE(this.pattern);
    this.CONSUME(tokens.LeftArrow);
    this.SUBRULE(this.expression);
    this.MANY(() => {
      this.CONSUME(tokens.If);
      this.SUBRULE2(this.expression);
    });
  });

  private partialFunctionLiteral = this.RULE("partialFunctionLiteral", () => {
    this.CONSUME(tokens.LeftBrace);
    this.AT_LEAST_ONE(() => this.SUBRULE(this.caseClause));
    this.CONSUME(tokens.RightBrace);
  });

  private blockExpression = this.RULE("blockExpression", () => {
    this.CONSUME(tokens.LeftBrace);
    this.MANY(() => this.SUBRULE(this.blockStatement));
    this.CONSUME(tokens.RightBrace);
  });

  private quoteExpression = this.RULE("quoteExpression", () => {
    this.CONSUME(tokens.QuoteStart); // '{
    this.SUBRULE(this.expression);
    this.CONSUME(tokens.RightBrace); // }
  });

  private spliceExpression = this.RULE("spliceExpression", () => {
    this.CONSUME(tokens.SpliceStart); // ${
    this.SUBRULE(this.expression);
    this.CONSUME(tokens.RightBrace); // }
  });

  private polymorphicFunctionLiteral = this.RULE(
    "polymorphicFunctionLiteral",
    () => {
      // Type parameters: [T] or [A, B]
      this.CONSUME(tokens.LeftBracket);
      this.MANY_SEP({
        SEP: tokens.Comma,
        DEF: () => this.SUBRULE(this.polymorphicTypeParameter),
      });
      this.CONSUME(tokens.RightBracket);
      this.CONSUME(tokens.Arrow);
      // The rest of the expression (usually another lambda)
      this.SUBRULE(this.expression);
    },
  );

  private polymorphicTypeParameter = this.RULE(
    "polymorphicTypeParameter",
    () => {
      // Optional variance annotation
      this.OPTION(() => {
        this.OR([
          { ALT: () => this.CONSUME(tokens.Plus) },
          { ALT: () => this.CONSUME(tokens.Minus) },
        ]);
      });

      this.CONSUME(tokens.Identifier);

      // Optional type bounds
      this.OPTION2(() => {
        this.OR2([
          {
            ALT: () => {
              this.CONSUME(tokens.SubtypeOf);
              this.SUBRULE(this.type);
            },
          },
          {
            ALT: () => {
              this.CONSUME(tokens.SupertypeOf);
              this.SUBRULE2(this.type);
            },
          },
        ]);
      });

      // Optional context bound: T: Ordering
      this.OPTION3(() => {
        this.CONSUME(tokens.Colon);
        this.SUBRULE3(this.type);
      });
    },
  );

  private blockStatement = this.RULE("blockStatement", () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.valDefinition) },
      { ALT: () => this.SUBRULE(this.varDefinition) },
      { ALT: () => this.SUBRULE(this.defDefinition) },
      {
        ALT: () => {
          // Try assignment statement
          this.SUBRULE(this.assignmentStatement);
          this.OPTION(() => this.CONSUME(tokens.Semicolon));
        },
        GATE: () => {
          // Check if this looks like an assignment (support sbt scoped assignments)
          const first = this.LA(1);
          const second = this.LA(2);
          const third = this.LA(3);
          const fourth = this.LA(4);

          return (
            first.tokenType === tokens.Identifier &&
            // Direct assignment: name := value
            (second.tokenType === tokens.PlusEquals ||
              second.tokenType === tokens.MinusEquals ||
              second.tokenType === tokens.StarEquals ||
              second.tokenType === tokens.SlashEquals ||
              second.tokenType === tokens.PercentEquals ||
              second.tokenType === tokens.SbtAssign ||
              second.tokenType === tokens.Equals ||
              // Scoped assignment: scope / key := value
              (second.tokenType === tokens.Slash &&
                third &&
                third.tokenType === tokens.Identifier &&
                fourth &&
                (fourth.tokenType === tokens.PlusEquals ||
                  fourth.tokenType === tokens.MinusEquals ||
                  fourth.tokenType === tokens.StarEquals ||
                  fourth.tokenType === tokens.SlashEquals ||
                  fourth.tokenType === tokens.PercentEquals ||
                  fourth.tokenType === tokens.SbtAssign ||
                  fourth.tokenType === tokens.Equals)))
          );
        },
      },
      {
        ALT: () => {
          this.SUBRULE(this.expression);
          this.OPTION2(() => this.CONSUME2(tokens.Semicolon));
        },
      },
    ]);
  });

  private assignmentStatement = this.RULE("assignmentStatement", () => {
    // Support sbt scoped assignments like "test / javaOptions" or "ThisBuild / version"
    this.SUBRULE(this.sbtLeftSide);
    this.OR([
      { ALT: () => this.CONSUME(tokens.Equals) },
      { ALT: () => this.CONSUME(tokens.PlusEquals) },
      { ALT: () => this.CONSUME(tokens.MinusEquals) },
      { ALT: () => this.CONSUME(tokens.StarEquals) },
      { ALT: () => this.CONSUME(tokens.SlashEquals) },
      { ALT: () => this.CONSUME(tokens.PercentEquals) },
      { ALT: () => this.CONSUME(tokens.AppendEquals) },
      { ALT: () => this.CONSUME(tokens.SbtAssign) },
    ]);
    this.SUBRULE(this.sbtValue);
  });

  private sbtLeftSide = this.RULE("sbtLeftSide", () => {
    this.CONSUME(tokens.Identifier);
    this.MANY(() => {
      this.OR([
        {
          // Support slash notation like "test / javaOptions"
          ALT: () => {
            this.CONSUME(tokens.Slash);
            this.CONSUME2(tokens.Identifier);
          },
        },
        {
          // Support dot notation like "Test.parallelExecution"
          ALT: () => {
            this.CONSUME(tokens.Dot);
            this.CONSUME3(tokens.Identifier);
          },
        },
      ]);
    });
  });

  private sbtValue = this.RULE("sbtValue", () => {
    // Simply delegate to expression - it handles all cases including sbt expressions
    this.SUBRULE(this.expression);
  });

  private sbtExpression = this.RULE("sbtExpression", () => {
    this.SUBRULE(this.sbtPrimary);
    this.MANY(() => {
      this.OR([
        {
          ALT: () => {
            this.CONSUME(tokens.DoublePercent);
            this.SUBRULE2(this.sbtPrimary);
          },
        },
        {
          ALT: () => {
            this.CONSUME(tokens.Percent);
            this.SUBRULE3(this.sbtPrimary);
          },
        },
      ]);
    });
  });

  private sbtPrimary = this.RULE("sbtPrimary", () => {
    this.OR([
      { ALT: () => this.CONSUME(tokens.StringLiteral) },
      {
        ALT: () => {
          this.CONSUME(tokens.Identifier);
          this.OPTION(() => {
            this.CONSUME(tokens.LeftParen);
            this.MANY(() => {
              this.SUBRULE(this.sbtValue);
              this.OPTION2(() => this.CONSUME(tokens.Comma));
            });
            this.CONSUME(tokens.RightParen);
          });
        },
      },
    ]);
  });

  private infixOperator = this.RULE("infixOperator", () => {
    this.OR([
      { ALT: () => this.CONSUME(tokens.Plus) },
      { ALT: () => this.CONSUME(tokens.Minus) },
      { ALT: () => this.CONSUME(tokens.Star) },
      { ALT: () => this.CONSUME(tokens.Slash) },
      { ALT: () => this.CONSUME(tokens.DoublePercent) },
      { ALT: () => this.CONSUME(tokens.Percent) },
      { ALT: () => this.CONSUME(tokens.LessThan) },
      { ALT: () => this.CONSUME(tokens.GreaterThan) },
      { ALT: () => this.CONSUME(tokens.LessThanEquals) },
      { ALT: () => this.CONSUME(tokens.GreaterThanEquals) },
      { ALT: () => this.CONSUME(tokens.EqualsEquals) },
      { ALT: () => this.CONSUME(tokens.NotEquals) },
      { ALT: () => this.CONSUME(tokens.LogicalAnd) },
      { ALT: () => this.CONSUME(tokens.LogicalOr) },
      { ALT: () => this.CONSUME(tokens.BitwiseAnd) },
      { ALT: () => this.CONSUME(tokens.BitwiseOr) },
      { ALT: () => this.CONSUME(tokens.BitwiseXor) },
      { ALT: () => this.CONSUME(tokens.LeftShift) },
      { ALT: () => this.CONSUME(tokens.RightShift) },
      { ALT: () => this.CONSUME(tokens.UnsignedRightShift) },
      { ALT: () => this.CONSUME(tokens.AppendOp) },
      { ALT: () => this.CONSUME(tokens.PrependOp) },
      { ALT: () => this.CONSUME(tokens.ConcatOp) },
      { ALT: () => this.CONSUME(tokens.RightArrow) },
      { ALT: () => this.CONSUME(tokens.Dot) },
      { ALT: () => this.CONSUME(tokens.To) },
      { ALT: () => this.CONSUME(tokens.Question) }, // Ask pattern operator
      { ALT: () => this.CONSUME(tokens.Identifier) }, // For general infix methods
    ]);
  });

  // Literals - delegated to createLiteralRule (initialized in constructor)
  private literal: () => ParserMethodResult;

  // Qualified identifier
  private qualifiedIdentifier = this.RULE("qualifiedIdentifier", () => {
    this.CONSUME(tokens.Identifier);
    this.MANY(() => {
      this.CONSUME(tokens.Dot);
      this.OR([
        { ALT: () => this.CONSUME2(tokens.Identifier) },
        { ALT: () => this.CONSUME(tokens.Type) }, // Allow .type for singleton types
      ]);
    });
  });
}

// Export singleton parser instance
export const parserInstance = new ScalaParser();

/**
 * MODULAR PARSER INTEGRATION PLAN
 *
 * This file represents a transitional state where the monolithic parser.ts
 * has been prepared for gradual integration with the modular parser architecture
 * located in src/parser/.
 *
 * The modular parsers are already implemented and working:
 * - literals.ts: Complete literal value parsing
 * - expressions.ts: Complete expression parsing including lambdas, operators
 * - types.ts: Complete type system with Scala 3 features
 * - patterns.ts: Pattern matching and destructuring
 * - statements.ts: Import/export statements
 * - definitions.ts: Class/object/trait/val/var/def definitions
 * - scala3.ts: Scala 3 specific features (enum, extension, given, etc.)
 *
 * INTEGRATION CHALLENGES:
 * 1. Rule Name Conflicts: Many modules define rules with the same names
 * 2. Circular Dependencies: Modules need to reference each other's rules
 * 3. Testing Stability: Need to maintain 94.4% test success rate during migration
 *
 * RECOMMENDED APPROACH:
 * 1. Create new parser class that extends ScalaParser
 * 2. Override specific methods with modular implementations one by one
 * 3. Use composition rather than inheritance to avoid rule conflicts
 * 4. Gradual feature-by-feature migration with comprehensive testing
 *
 * STATUS: Architecture documented, modules ready, awaiting careful integration.
 */
