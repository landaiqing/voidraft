/**
 * Scala 3 specific visitor methods for modern language features
 */
import { getChildNodes, getFirstChild, getNodeImage } from "./utils";
import type { PrintContext, CSTNode } from "./utils";

export interface Scala3Visitor {
  visit(node: CSTNode, ctx: PrintContext): string;
  getIndentation(ctx: PrintContext): string;
  visitModifiers(modifiers: CSTNode[], ctx: PrintContext): string;
}

export class Scala3VisitorMethods {
  private visitor: Scala3Visitor;

  constructor(visitor: Scala3Visitor) {
    this.visitor = visitor;
  }

  // Quote and splice expressions for macros
  visitQuoteExpression(node: CSTNode, ctx: PrintContext): string {
    const expression = getFirstChild(node, "expression");
    return (
      "'{ " + (expression ? this.visitor.visit(expression, ctx) : "") + " }"
    );
  }

  visitSpliceExpression(node: CSTNode, ctx: PrintContext): string {
    const expression = getFirstChild(node, "expression");
    return (
      "${ " + (expression ? this.visitor.visit(expression, ctx) : "") + " }"
    );
  }

  // Polymorphic function literals
  visitPolymorphicFunctionLiteral(node: CSTNode, ctx: PrintContext): string {
    let result = "[";

    const polymorphicTypeParams = getChildNodes(
      node,
      "polymorphicTypeParameter",
    );
    if (polymorphicTypeParams.length > 0) {
      const parameters = polymorphicTypeParams.map((param: CSTNode) =>
        this.visitor.visit(param, ctx),
      );
      result += parameters.join(", ");
    }

    result += "] => ";
    const expression = getFirstChild(node, "expression");
    result += expression ? this.visitor.visit(expression, ctx) : "";

    return result;
  }

  // Polymorphic function types
  visitPolymorphicFunctionType(node: CSTNode, ctx: PrintContext): string {
    let result = "[";

    const polymorphicTypeParams = getChildNodes(
      node,
      "polymorphicTypeParameter",
    );
    if (polymorphicTypeParams.length > 0) {
      const parameters = polymorphicTypeParams.map((param: CSTNode) =>
        this.visitor.visit(param, ctx),
      );
      result += parameters.join(", ");
    }

    result += "] => ";
    const typeNode = getFirstChild(node, "type");
    if (typeNode) {
      result += this.visitor.visit(typeNode, ctx);
    }

    return result;
  }

  visitPolymorphicTypeParameter(node: CSTNode, ctx: PrintContext): string {
    let result = "";

    // Add variance annotation if present
    const plusTokens = getChildNodes(node, "Plus");
    const minusTokens = getChildNodes(node, "Minus");
    if (plusTokens.length > 0) {
      result += "+";
    } else if (minusTokens.length > 0) {
      result += "-";
    }

    const identifiers = getChildNodes(node, "Identifier");
    if (identifiers.length > 0) {
      result += getNodeImage(identifiers[0]);
    }

    // Handle type bounds
    const subtypeOf = getChildNodes(node, "SubtypeOf");
    const supertypeOf = getChildNodes(node, "SupertypeOf");
    const typeNode = getFirstChild(node, "type");

    if (subtypeOf.length > 0 && typeNode) {
      result += " <: " + this.visitor.visit(typeNode, ctx);
    }
    if (supertypeOf.length > 0 && typeNode) {
      result += " >: " + this.visitor.visit(typeNode, ctx);
    }

    return result;
  }

  // Enum definitions
  visitEnumDefinition(node: CSTNode, ctx: PrintContext): string {
    const identifiers = getChildNodes(node, "Identifier");
    let result =
      "enum " + (identifiers.length > 0 ? getNodeImage(identifiers[0]) : "");

    const typeParameters = getFirstChild(node, "typeParameters");
    if (typeParameters) {
      result += this.visitor.visit(typeParameters, ctx);
    }

    const classParameters = getFirstChild(node, "classParameters");
    if (classParameters) {
      result += this.visitor.visit(classParameters, ctx);
    }

    const extendsClause = getFirstChild(node, "extendsClause");
    if (extendsClause) {
      result += " " + this.visitor.visit(extendsClause, ctx);
    }

    result += " {\n";

    const enumCases = getChildNodes(node, "enumCase");
    if (enumCases.length > 0) {
      const indent = this.visitor.getIndentation(ctx);
      const cases = enumCases.map(
        (c: CSTNode) => indent + this.visitor.visit(c, ctx),
      );
      result += cases.join("\n");
    }

    result += "\n}";

    return result;
  }

  visitEnumCase(node: CSTNode, ctx: PrintContext): string {
    const identifiers = getChildNodes(node, "Identifier");
    let result =
      "case " + (identifiers.length > 0 ? getNodeImage(identifiers[0]) : "");

    const classParameters = getFirstChild(node, "classParameters");
    if (classParameters) {
      result += this.visitor.visit(classParameters, ctx);
    }

    const extendsClause = getFirstChild(node, "extendsClause");
    if (extendsClause) {
      result += " " + this.visitor.visit(extendsClause, ctx);
    }

    return result;
  }

  // Extension methods
  visitExtensionDefinition(node: CSTNode, ctx: PrintContext): string {
    let result = "extension";

    const typeParameters = getFirstChild(node, "typeParameters");
    if (typeParameters) {
      result += this.visitor.visit(typeParameters, ctx);
    }

    const identifiers = getChildNodes(node, "Identifier");
    const typeNode = getFirstChild(node, "type");
    result +=
      " (" +
      (identifiers.length > 0 ? getNodeImage(identifiers[0]) : "") +
      ": ";
    if (typeNode) {
      result += this.visitor.visit(typeNode, ctx);
    }
    result += ") {\n";

    const extensionMembers = getChildNodes(node, "extensionMember");
    if (extensionMembers.length > 0) {
      const members = extensionMembers.map(
        (m: CSTNode) => "  " + this.visitor.visit(m, ctx),
      );
      result += members.join("\n");
    }

    result += "\n}";

    return result;
  }

  visitExtensionMember(node: CSTNode, ctx: PrintContext): string {
    const modifierNodes = getChildNodes(node, "modifier");
    const modifiers = this.visitor.visitModifiers(modifierNodes, ctx);
    const defDefinition = getFirstChild(node, "defDefinition");
    const definition = defDefinition
      ? this.visitor.visit(defDefinition, ctx)
      : "";

    return modifiers ? modifiers + " " + definition : definition;
  }

  // Given definitions
  visitGivenDefinition(node: CSTNode, ctx: PrintContext): string {
    let result = "given";

    const identifiers = getChildNodes(node, "Identifier");
    if (identifiers.length > 0) {
      // Named given with potential parameters: given name[T](using ord: Type): Type
      result += " " + getNodeImage(identifiers[0]);

      const typeParameters = getFirstChild(node, "typeParameters");
      if (typeParameters) {
        result += this.visitor.visit(typeParameters, ctx);
      }

      const parameterLists = getFirstChild(node, "parameterLists");
      if (parameterLists) {
        result += this.visitor.visit(parameterLists, ctx);
      }

      const typeNode = getFirstChild(node, "type");
      if (typeNode) {
        result += ": " + this.visitor.visit(typeNode, ctx);
      }
    } else {
      // Anonymous given: given Type = expression
      const typeNode = getFirstChild(node, "type");
      if (typeNode) {
        result += " " + this.visitor.visit(typeNode, ctx);
      }
    }

    const equalsTokens = getChildNodes(node, "Equals");
    if (equalsTokens.length > 0) {
      const expression = getFirstChild(node, "expression");
      if (expression) {
        result += " = " + this.visitor.visit(expression, ctx);
      }
    }

    return result;
  }

  // Type definitions including opaque types
  visitTypeDefinition(node: CSTNode, ctx: PrintContext): string {
    let result = "";

    // Handle opaque types
    const opaqueTokens = getChildNodes(node, "Opaque");
    if (opaqueTokens.length > 0) {
      result += "opaque ";
    }

    const identifiers = getChildNodes(node, "Identifier");
    result +=
      "type " + (identifiers.length > 0 ? getNodeImage(identifiers[0]) : "");

    const typeParameters = getFirstChild(node, "typeParameters");
    if (typeParameters) {
      result += this.visitor.visit(typeParameters, ctx);
    }

    const typeNode = getFirstChild(node, "type");
    if (typeNode) {
      result += " = " + this.visitor.visit(typeNode, ctx);
    }

    return result;
  }

  // Export clauses and expressions
  visitExportClause(node: CSTNode, ctx: PrintContext): string {
    const exportExpression = getFirstChild(node, "exportExpression");
    return (
      "export " +
      (exportExpression ? this.visitor.visit(exportExpression, ctx) : "")
    );
  }

  visitExportExpression(node: CSTNode, ctx: PrintContext): string {
    let result = "";

    // Build the export path
    const identifiers = getChildNodes(node, "Identifier");
    const dots = getChildNodes(node, "Dot");
    const underscores = getChildNodes(node, "Underscore");
    const givens = getChildNodes(node, "Given");
    const leftBraces = getChildNodes(node, "LeftBrace");

    // Add first identifier
    if (identifiers.length > 0) {
      result = getNodeImage(identifiers[0]);
    }

    // Process remaining parts
    let identifierIndex = 1;
    for (let i = 0; i < dots.length; i++) {
      result += ".";

      // Check what follows this dot
      if (underscores.length > 0 && i === dots.length - 1) {
        // Wildcard export
        result += "_";
      } else if (givens.length > 0 && i === dots.length - 1) {
        // Given export
        result += "given";
      } else if (leftBraces.length > 0 && i === dots.length - 1) {
        // Multiple export selectors
        result += "{";
        const exportSelectors = getChildNodes(node, "exportSelector");
        if (exportSelectors.length > 0) {
          const selectors = exportSelectors.map((sel: CSTNode) =>
            this.visitor.visit(sel, ctx),
          );
          result += selectors.join(", ");
        }
        result += "}";
      } else if (identifierIndex < identifiers.length) {
        // Next identifier in path
        result += getNodeImage(identifiers[identifierIndex]);
        identifierIndex++;
      }
    }

    return result;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  visitExportSelector(node: CSTNode, _ctx: PrintContext): string {
    const underscores = getChildNodes(node, "Underscore");
    const identifiers = getChildNodes(node, "Identifier");
    const givens = getChildNodes(node, "Given");
    const arrows = getChildNodes(node, "Arrow");

    // Handle wildcard export
    if (underscores.length > 0 && identifiers.length === 0) {
      return "_";
    }

    // Handle given export
    if (givens.length > 0 && identifiers.length === 0) {
      return "given";
    }

    let result = "";

    // Handle regular identifiers
    if (identifiers.length > 0) {
      result = getNodeImage(identifiers[0]);
    }

    // Handle given with specific identifiers: given SpecificType
    if (givens.length > 0 && identifiers.length > 0) {
      result = "given " + getNodeImage(identifiers[0]);
    }

    if (arrows.length > 0) {
      result += " => ";
      if (underscores.length > 0) {
        result += "_";
      } else if (identifiers.length > 1) {
        result += getNodeImage(identifiers[1]);
      }
    }

    return result;
  }

  // Context function types
  visitContextFunctionType(node: CSTNode, ctx: PrintContext): string {
    let result = "";

    // Handle parenthesized types
    const leftParens = getChildNodes(node, "LeftParen");
    if (leftParens.length > 0) {
      const tupleType = getFirstChild(node, "tupleTypeOrParenthesized");
      if (tupleType) {
        result += "(" + this.visitor.visit(tupleType, ctx) + ")";
      }
    } else {
      // Handle simple types
      const simpleType = getFirstChild(node, "simpleType");
      if (simpleType) {
        result += this.visitor.visit(simpleType, ctx);
      }
    }

    const typeNode = getFirstChild(node, "type");
    if (typeNode) {
      result += " ?=> " + this.visitor.visit(typeNode, ctx);
    }
    return result;
  }

  // Inline and transparent modifiers
  visitInlineModifier(): string {
    return "inline";
  }

  visitTransparentModifier(): string {
    return "transparent";
  }

  // Using clauses
  visitUsingClause(node: CSTNode, ctx: PrintContext): string {
    let result = "using ";

    const identifiers = getChildNodes(node, "Identifier");
    if (identifiers.length > 0) {
      result += getNodeImage(identifiers[0]);
    }

    const colonTokens = getChildNodes(node, "Colon");
    if (colonTokens.length > 0) {
      const typeNode = getFirstChild(node, "type");
      if (typeNode) {
        result += ": " + this.visitor.visit(typeNode, ctx);
      }
    }

    return result;
  }
}
