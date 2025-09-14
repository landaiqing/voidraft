/**
 * Type-related visitor methods for handling type expressions, type parameters, and type systems
 */
import { getChildNodes, getFirstChild, getNodeImage } from "./utils";
import type { PrintContext, CSTNode } from "./utils";

export interface TypeVisitor {
  visit(node: CSTNode, ctx: PrintContext): string;
}

export class TypeVisitorMethods {
  private visitor: TypeVisitor;

  constructor(visitor: TypeVisitor) {
    this.visitor = visitor;
  }

  visitType(node: CSTNode, ctx: PrintContext): string {
    const matchType = getFirstChild(node, "matchType");
    return matchType ? this.visitor.visit(matchType, ctx) : "";
  }

  visitMatchType(node: CSTNode, ctx: PrintContext): string {
    const unionType = getFirstChild(node, "unionType");
    let result = unionType ? this.visitor.visit(unionType, ctx) : "";

    const matchTokens = getChildNodes(node, "Match");
    if (matchTokens.length > 0) {
      result += " match {";
      const matchTypeCases = getChildNodes(node, "matchTypeCase");
      if (matchTypeCases.length > 0) {
        for (const caseNode of matchTypeCases) {
          result += "\n  " + this.visitor.visit(caseNode, ctx);
        }
        result += "\n";
      }
      result += "}";
    }

    return result;
  }

  visitMatchTypeCase(node: CSTNode, ctx: PrintContext): string {
    const types = getChildNodes(node, "type");
    if (types.length >= 2) {
      const leftType = this.visitor.visit(types[0], ctx);
      const rightType = this.visitor.visit(types[1], ctx);
      return `case ${leftType} => ${rightType}`;
    }
    return "";
  }

  visitUnionType(node: CSTNode, ctx: PrintContext): string {
    const types = getChildNodes(node, "intersectionType");
    if (types.length === 1) {
      return this.visitor.visit(types[0], ctx);
    }

    const typeStrings = types.map((t: CSTNode) => this.visitor.visit(t, ctx));
    return typeStrings.join(" | ");
  }

  visitIntersectionType(node: CSTNode, ctx: PrintContext): string {
    const types = getChildNodes(node, "baseType");
    if (types.length === 1) {
      return this.visitor.visit(types[0], ctx);
    }

    const typeStrings = types.map((t: CSTNode) => this.visitor.visit(t, ctx));
    return typeStrings.join(" & ");
  }

  visitContextFunctionType(node: CSTNode, ctx: PrintContext): string {
    let result = "";

    // Handle parenthesized types
    const leftParen = getChildNodes(node, "LeftParen");
    if (leftParen.length > 0) {
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

    const type = getFirstChild(node, "type");
    if (type) {
      result += " ?=> " + this.visitor.visit(type, ctx);
    }
    return result;
  }

  visitBaseType(node: CSTNode, ctx: PrintContext): string {
    // Handle type lambda: [X] =>> F[X]
    const typeLambda = getFirstChild(node, "typeLambda");
    if (typeLambda) {
      return this.visitor.visit(typeLambda, ctx);
    }

    // Handle polymorphic function type: [T] => T => T
    const polymorphicFunctionType = getFirstChild(
      node,
      "polymorphicFunctionType",
    );
    if (polymorphicFunctionType) {
      return this.visitor.visit(polymorphicFunctionType, ctx);
    }

    // Handle context function type: String ?=> Int
    const contextFunctionType = getFirstChild(node, "contextFunctionType");
    if (contextFunctionType) {
      return this.visitor.visit(contextFunctionType, ctx);
    }

    // Handle dependent function type: (x: Int) => Vector[x.type]
    const dependentFunctionType = getFirstChild(node, "dependentFunctionType");
    if (dependentFunctionType) {
      return this.visitor.visit(dependentFunctionType, ctx);
    }

    // Handle parenthesized types or tuple types: (String | Int) or (A, B)
    const leftParen = getChildNodes(node, "LeftParen");
    const tupleType = getFirstChild(node, "tupleTypeOrParenthesized");
    if (leftParen.length > 0 && tupleType) {
      return "(" + this.visitor.visit(tupleType, ctx) + ")";
    }

    // Handle simple types with array notation
    const simpleType = getFirstChild(node, "simpleType");
    let result = "";

    if (simpleType) {
      result = this.visitor.visit(simpleType, ctx);
    } else {
      // Handle direct token cases like Array, List, etc.
      if ("children" in node && node.children) {
        const children = node.children;
        for (const [key, tokens] of Object.entries(children)) {
          if (
            Array.isArray(tokens) &&
            tokens.length > 0 &&
            "image" in tokens[0]
          ) {
            // Check if this is a type name token (not brackets or keywords)
            if (
              !["LeftBracket", "RightBracket", "typeArgument"].includes(key)
            ) {
              result = getNodeImage(tokens[0]);
              break;
            }
          }
        }
      }
    }

    if (!result) {
      return "";
    }

    // Handle array types like Array[String]
    const leftBrackets = getChildNodes(node, "LeftBracket");
    const typeArguments = getChildNodes(node, "typeArgument");
    for (let i = 0; i < leftBrackets.length && i < typeArguments.length; i++) {
      result += "[" + this.visitor.visit(typeArguments[i], ctx) + "]";
    }

    return result;
  }

  visitTupleTypeOrParenthesized(node: CSTNode, ctx: PrintContext): string {
    const types = getChildNodes(node, "type");
    if (types.length === 1) {
      return this.visitor.visit(types[0], ctx);
    }

    const typeStrings = types.map((t: CSTNode) => this.visitor.visit(t, ctx));
    return typeStrings.join(", ");
  }

  visitSimpleType(node: CSTNode, ctx: PrintContext): string {
    const qualifiedId = getFirstChild(node, "qualifiedIdentifier");
    if (!qualifiedId) {
      return "";
    }
    let result = this.visitor.visit(qualifiedId, ctx);

    // Handle type parameters like List[Int] or Kind Projector like Map[String, *]
    const leftBrackets = getChildNodes(node, "LeftBracket");
    if (leftBrackets.length > 0) {
      const typeArgs = getChildNodes(node, "typeArgument");
      const typeStrings = typeArgs.map((t: CSTNode) =>
        this.visitor.visit(t, ctx),
      );
      result += "[" + typeStrings.join(", ") + "]";
    }

    return result;
  }

  visitTypeArgument(node: CSTNode, ctx: PrintContext): string {
    // Handle Kind Projector notation: *
    const star = getChildNodes(node, "Star");
    if (star.length > 0) {
      return "*";
    }

    // Handle regular type
    const type = getFirstChild(node, "type");
    if (type) {
      return this.visitor.visit(type, ctx);
    }

    // Handle type argument union structure
    const typeArgumentUnion = getFirstChild(node, "typeArgumentUnion");
    if (typeArgumentUnion) {
      return this.visitor.visit(typeArgumentUnion, ctx);
    }

    // Handle direct type tokens like Array[t] within type arguments
    if ("children" in node && node.children) {
      const children = node.children;
      let result = "";

      // Find the type name token
      for (const [key, tokens] of Object.entries(children)) {
        if (
          Array.isArray(tokens) &&
          tokens.length > 0 &&
          "image" in tokens[0]
        ) {
          if (!["LeftBracket", "RightBracket", "typeArgument"].includes(key)) {
            result = getNodeImage(tokens[0]);
            break;
          }
        }
      }

      if (result) {
        // Handle type parameters like Array[t] within type arguments
        const leftBrackets = getChildNodes(node, "LeftBracket");
        const typeArguments = getChildNodes(node, "typeArgument");
        for (
          let i = 0;
          i < leftBrackets.length && i < typeArguments.length;
          i++
        ) {
          result += "[" + this.visitor.visit(typeArguments[i], ctx) + "]";
        }
        return result;
      }
    }

    return "";
  }

  visitTypeLambda(node: CSTNode, ctx: PrintContext): string {
    let result = "[";

    const parameters = getChildNodes(node, "typeLambdaParameter");
    if (parameters.length > 0) {
      const parameterStrings = parameters.map((param: CSTNode) =>
        this.visitor.visit(param, ctx),
      );
      result += parameterStrings.join(", ");
    }

    result += "] =>> ";
    const type = getFirstChild(node, "type");
    if (type) {
      result += this.visitor.visit(type, ctx);
    }

    return result;
  }

  visitTypeLambdaParameter(node: CSTNode, ctx: PrintContext): string {
    let result = "";

    // Add variance annotation if present
    const plus = getChildNodes(node, "Plus");
    const minus = getChildNodes(node, "Minus");
    if (plus.length > 0) {
      result += "+";
    } else if (minus.length > 0) {
      result += "-";
    }

    const identifiers = getChildNodes(node, "Identifier");
    if (identifiers.length > 0) {
      result += getNodeImage(identifiers[0]);
    }

    const subtypeOf = getChildNodes(node, "SubtypeOf");
    const supertypeOf = getChildNodes(node, "SupertypeOf");
    const type = getFirstChild(node, "type");

    if (subtypeOf.length > 0 && type) {
      result += " <: " + this.visitor.visit(type, ctx);
    } else if (supertypeOf.length > 0 && type) {
      result += " >: " + this.visitor.visit(type, ctx);
    }

    return result;
  }

  visitDependentFunctionType(node: CSTNode, ctx: PrintContext): string {
    let result = "(";

    const parameters = getChildNodes(node, "dependentParameter");
    if (parameters.length > 0) {
      const parameterStrings = parameters.map((param: CSTNode) =>
        this.visitor.visit(param, ctx),
      );
      result += parameterStrings.join(", ");
    }

    result += ") => ";
    const type = getFirstChild(node, "type");
    if (type) {
      result += this.visitor.visit(type, ctx);
    }

    return result;
  }

  visitDependentParameter(node: CSTNode, ctx: PrintContext): string {
    const identifiers = getChildNodes(node, "Identifier");
    if (identifiers.length === 0) {
      return "";
    }

    let result = getNodeImage(identifiers[0]);
    const type = getFirstChild(node, "type");
    if (type) {
      result += ": " + this.visitor.visit(type, ctx);
    }
    return result;
  }

  visitPolymorphicFunctionType(node: CSTNode, ctx: PrintContext): string {
    let result = "[";

    const parameters = getChildNodes(node, "polymorphicTypeParameter");
    if (parameters.length > 0) {
      const parameterStrings = parameters.map((param: CSTNode) =>
        this.visitor.visit(param, ctx),
      );
      result += parameterStrings.join(", ");
    }

    result += "] => ";
    const type = getFirstChild(node, "type");
    if (type) {
      result += this.visitor.visit(type, ctx);
    }

    return result;
  }

  visitPolymorphicTypeParameter(node: CSTNode, ctx: PrintContext): string {
    let result = "";

    // Handle variance annotation
    const plus = getChildNodes(node, "Plus");
    const minus = getChildNodes(node, "Minus");
    if (plus.length > 0) {
      result += "+";
    } else if (minus.length > 0) {
      result += "-";
    }

    const identifiers = getChildNodes(node, "Identifier");
    if (identifiers.length > 0) {
      result += getNodeImage(identifiers[0]);
    }

    // Handle type bounds
    const subtypeOf = getChildNodes(node, "SubtypeOf");
    const supertypeOf = getChildNodes(node, "SupertypeOf");
    const type = getFirstChild(node, "type");

    if (subtypeOf.length > 0 && type) {
      result += " <: " + this.visitor.visit(type, ctx);
    }
    if (supertypeOf.length > 0 && type) {
      result += " >: " + this.visitor.visit(type, ctx);
    }

    return result;
  }

  visitTypeArgumentUnion(node: CSTNode, ctx: PrintContext): string {
    const typeArgumentIntersections = getChildNodes(
      node,
      "typeArgumentIntersection",
    );

    if (typeArgumentIntersections.length === 1) {
      return this.visitor.visit(typeArgumentIntersections[0], ctx);
    }

    // Handle union types with | operator
    if (typeArgumentIntersections.length > 1) {
      const typeStrings = typeArgumentIntersections.map((t: CSTNode) =>
        this.visitor.visit(t, ctx),
      );
      return typeStrings.join(" | ");
    }

    return "";
  }

  visitTypeArgumentIntersection(node: CSTNode, ctx: PrintContext): string {
    const typeArgumentSimples = getChildNodes(node, "typeArgumentSimple");

    if (typeArgumentSimples.length === 1) {
      return this.visitor.visit(typeArgumentSimples[0], ctx);
    }

    // Handle intersection types with & operator
    if (typeArgumentSimples.length > 1) {
      const typeStrings = typeArgumentSimples.map((t: CSTNode) =>
        this.visitor.visit(t, ctx),
      );
      return typeStrings.join(" & ");
    }

    return "";
  }

  visitTypeArgumentSimple(node: CSTNode, ctx: PrintContext): string {
    const qualifiedIdentifier = getFirstChild(node, "qualifiedIdentifier");
    if (qualifiedIdentifier) {
      let result = this.visitor.visit(qualifiedIdentifier, ctx);

      // Handle type parameters like List[*] within type arguments
      const leftBrackets = getChildNodes(node, "LeftBracket");
      if (leftBrackets.length > 0) {
        const typeArgs = getChildNodes(node, "typeArgument");
        const typeStrings = typeArgs.map((t: CSTNode) =>
          this.visitor.visit(t, ctx),
        );
        result += "[" + typeStrings.join(", ") + "]";
      }

      return result;
    }

    // Handle simple type structures like List[*]
    const simpleType = getFirstChild(node, "simpleType");
    if (simpleType) {
      return this.visitor.visit(simpleType, ctx);
    }

    // Handle base type structures
    const baseType = getFirstChild(node, "baseType");
    if (baseType) {
      return this.visitor.visit(baseType, ctx);
    }

    // Handle other type argument patterns
    const identifier = getFirstChild(node, "Identifier");
    if (identifier) {
      return getNodeImage(identifier);
    }

    return "";
  }
}
