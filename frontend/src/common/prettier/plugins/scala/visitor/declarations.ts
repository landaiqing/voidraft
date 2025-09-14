/**
 * Declaration visitor methods for class, object, trait, method, and other definitions
 */
import {
  formatStatement,
  getPrintWidth,
  getChildNodes,
  getFirstChild,
  createIndent,
  getNodeImage,
} from "./utils";
import type { PrintContext, CSTNode } from "./utils";

export interface DeclarationVisitor {
  visit(node: CSTNode, ctx: PrintContext): string;
  visitModifiers(modifiers: CSTNode[], ctx: PrintContext): string;
  getIndentation(ctx: PrintContext): string;
}

export class DeclarationVisitorMethods {
  private visitor: DeclarationVisitor;

  constructor(visitor: DeclarationVisitor) {
    this.visitor = visitor;
  }

  visitClassDefinition(node: CSTNode, ctx: PrintContext): string {
    let result = "";

    // Add class keyword (don't duplicate if already handled by modifiers)
    const classToken = getFirstChild(node, "Class");
    if (classToken) {
      result += getNodeImage(classToken) + " ";
    }

    // Add class name
    const identifierToken = getFirstChild(node, "Identifier");
    if (identifierToken) {
      result += getNodeImage(identifierToken);
    }

    const typeParameters = getFirstChild(node, "typeParameters");
    if (typeParameters) {
      result += this.visitor.visit(typeParameters, ctx);
    }

    // Add constructor annotations
    const annotations = getChildNodes(node, "annotation");
    if (annotations.length > 0) {
      result +=
        " " +
        annotations
          .map((ann: CSTNode) => this.visitor.visit(ann, ctx))
          .join(" ");
    }

    const classParameters = getFirstChild(node, "classParameters");
    if (classParameters) {
      result += this.visitor.visit(classParameters, ctx);
    }

    const extendsClause = getFirstChild(node, "extendsClause");
    if (extendsClause) {
      result += " " + this.visitor.visit(extendsClause, ctx);
    }

    const classBody = getFirstChild(node, "classBody");
    if (classBody) {
      result += " " + this.visitor.visit(classBody, ctx);
    }

    return result;
  }

  visitObjectDefinition(node: CSTNode, ctx: PrintContext): string {
    const identifierToken = getFirstChild(node, "Identifier");
    let result =
      "object " + (identifierToken ? getNodeImage(identifierToken) : "");

    const extendsClause = getFirstChild(node, "extendsClause");
    if (extendsClause) {
      result += " " + this.visitor.visit(extendsClause, ctx);
    }

    const classBody = getFirstChild(node, "classBody");
    if (classBody) {
      result += " " + this.visitor.visit(classBody, ctx);
    }

    return result;
  }

  visitTraitDefinition(node: CSTNode, ctx: PrintContext): string {
    const identifier = getFirstChild(node, "Identifier");
    let result = "trait " + (identifier ? getNodeImage(identifier) : "");

    const typeParameters = getFirstChild(node, "typeParameters");
    if (typeParameters) {
      result += this.visitor.visit(typeParameters, ctx);
    }

    const extendsClause = getFirstChild(node, "extendsClause");
    if (extendsClause) {
      result += " " + this.visitor.visit(extendsClause, ctx);
    }

    const traitBody = getFirstChild(node, "classBody");
    if (traitBody) {
      result += " " + this.visitor.visit(traitBody, ctx);
    }

    return result;
  }

  visitEnumDefinition(node: CSTNode, ctx: PrintContext): string {
    const identifierToken = getFirstChild(node, "Identifier");
    let result =
      "enum " + (identifierToken ? getNodeImage(identifierToken) : "");

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
    const identifierToken = getFirstChild(node, "Identifier");
    let result =
      "case " + (identifierToken ? getNodeImage(identifierToken) : "");

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

  visitExtensionDefinition(node: CSTNode, ctx: PrintContext): string {
    let result = "extension";

    const typeParameters = getFirstChild(node, "typeParameters");
    if (typeParameters) {
      result += this.visitor.visit(typeParameters, ctx);
    }

    const identifierToken = getFirstChild(node, "Identifier");
    const typeNode = getFirstChild(node, "type");
    result +=
      " (" + (identifierToken ? getNodeImage(identifierToken) : "") + ": ";
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

  visitValDefinition(node: CSTNode, ctx: PrintContext): string {
    let result = "val ";

    // Handle pattern or identifier
    const pattern = getFirstChild(node, "pattern");
    const identifierToken = getFirstChild(node, "Identifier");

    if (pattern) {
      result += this.visitor.visit(pattern, ctx);
    } else if (identifierToken) {
      result += getNodeImage(identifierToken);
    }

    const colonToken = getFirstChild(node, "Colon");
    if (colonToken) {
      const typeNode = getFirstChild(node, "type");
      if (typeNode) {
        result += ": " + this.visitor.visit(typeNode, ctx);
      }
    }

    const equalsToken = getFirstChild(node, "Equals");
    if (equalsToken) {
      const expression = getFirstChild(node, "expression");
      if (expression) {
        result += " = " + this.visitor.visit(expression, ctx);
      }
    }

    return formatStatement(result, ctx);
  }

  visitVarDefinition(node: CSTNode, ctx: PrintContext): string {
    const identifierToken = getFirstChild(node, "Identifier");
    let result =
      "var " + (identifierToken ? getNodeImage(identifierToken) : "");

    const colonToken = getFirstChild(node, "Colon");
    if (colonToken) {
      const typeNode = getFirstChild(node, "type");
      if (typeNode) {
        result += ": " + this.visitor.visit(typeNode, ctx);
      }
    }

    const expression = getFirstChild(node, "expression");
    if (expression) {
      result += " = " + this.visitor.visit(expression, ctx);
    }

    return formatStatement(result, ctx);
  }

  visitDefDefinition(node: CSTNode, ctx: PrintContext): string {
    let result = "def ";

    const identifierToken = getFirstChild(node, "Identifier");
    const thisToken = getFirstChild(node, "This");

    if (identifierToken) {
      result += getNodeImage(identifierToken);
    } else if (thisToken) {
      result += "this";
    }

    const typeParameters = getFirstChild(node, "typeParameters");
    if (typeParameters) {
      result += this.visitor.visit(typeParameters, ctx);
    }

    const parameterLists = getFirstChild(node, "parameterLists");
    if (parameterLists) {
      result += this.visitor.visit(parameterLists, ctx);
    }

    const colonToken = getFirstChild(node, "Colon");
    if (colonToken) {
      const typeNode = getFirstChild(node, "type");
      if (typeNode) {
        result += ": " + this.visitor.visit(typeNode, ctx);
      }
    }

    const equalsToken = getFirstChild(node, "Equals");
    if (equalsToken) {
      const expression = getFirstChild(node, "expression");
      if (expression) {
        result += " = " + this.visitor.visit(expression, ctx);
      }
      return formatStatement(result, ctx);
    }

    return result;
  }

  visitGivenDefinition(node: CSTNode, ctx: PrintContext): string {
    let result = "given";

    const identifierToken = getFirstChild(node, "Identifier");
    if (identifierToken) {
      // Named given with potential parameters: given name[T](using ord: Type): Type
      result += " " + getNodeImage(identifierToken);

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

    const equalsToken = getFirstChild(node, "Equals");
    if (equalsToken) {
      const expression = getFirstChild(node, "expression");
      if (expression) {
        result += " = " + this.visitor.visit(expression, ctx);
      }
    }

    return result;
  }

  visitTypeDefinition(node: CSTNode, ctx: PrintContext): string {
    let result = "";

    // Handle opaque types
    const opaqueToken = getFirstChild(node, "Opaque");
    if (opaqueToken) {
      result += "opaque ";
    }

    const identifierToken = getFirstChild(node, "Identifier");
    result += "type " + (identifierToken ? getNodeImage(identifierToken) : "");

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

  visitAuxiliaryConstructor(node: CSTNode, ctx: PrintContext): string {
    let result = "def this";

    // CST uses "parameterList" (singular) for auxiliary constructors
    const parameterList = getFirstChild(node, "parameterList");
    if (parameterList) {
      result += this.visitor.visit(parameterList, ctx);
    }

    const expression = getFirstChild(node, "expression");
    if (expression) {
      result += " = " + this.visitor.visit(expression, ctx);
    }

    return result;
  }

  visitClassParameters(node: CSTNode, ctx: PrintContext): string {
    const params = getChildNodes(node, "classParameter");
    if (params.length === 0) {
      return "()";
    }

    const paramStrings = params.map((p: CSTNode) => this.visitor.visit(p, ctx));
    const printWidth = getPrintWidth(ctx);

    // Check if single line is appropriate
    const singleLine = `(${paramStrings.join(", ")})`;
    // Use single line if it fits within printWidth and is reasonably short
    if (
      params.length === 1 &&
      singleLine.length <= Math.min(printWidth * 0.6, 40)
    ) {
      return singleLine;
    }

    // Use multi-line format for multiple parameters or long single parameter
    const indent = this.visitor.getIndentation(ctx);

    // Format each parameter on its own line without trailing comma for class parameters
    const indentedParams = paramStrings.map((param: string) => indent + param);
    return `(\n${indentedParams.join(",\n")}\n)`;
  }

  visitClassParameter(node: CSTNode, ctx: PrintContext): string {
    let result = "";

    const modifierNodes = getChildNodes(node, "modifier");
    if (modifierNodes.length > 0) {
      const modifiers = this.visitor.visitModifiers(modifierNodes, ctx);
      result += modifiers + " ";
    }

    const valToken = getFirstChild(node, "Val");
    const varToken = getFirstChild(node, "Var");

    if (valToken) {
      result += "val ";
    } else if (varToken) {
      result += "var ";
    }

    const identifierToken = getFirstChild(node, "Identifier");
    if (identifierToken) {
      result += getNodeImage(identifierToken);
    }
    result += ": ";

    const typeNode = getFirstChild(node, "type");
    if (typeNode) {
      result += this.visitor.visit(typeNode, ctx);
    }

    const equalsToken = getFirstChild(node, "Equals");
    if (equalsToken) {
      const expression = getFirstChild(node, "expression");
      if (expression) {
        result += " = " + this.visitor.visit(expression, ctx);
      }
    }

    return result;
  }

  visitParameterLists(node: CSTNode, ctx: PrintContext): string {
    const parameterLists = getChildNodes(node, "parameterList");
    return parameterLists
      .map((list: CSTNode) => this.visitor.visit(list, ctx))
      .join("");
  }

  visitParameterList(node: CSTNode, ctx: PrintContext): string {
    const params = getChildNodes(node, "parameter");
    if (params.length === 0) {
      return "()";
    }

    const paramStrings = params.map((p: CSTNode) => this.visitor.visit(p, ctx));
    return "(" + paramStrings.join(", ") + ")";
  }

  visitParameter(node: CSTNode, ctx: PrintContext): string {
    let result = "";

    const usingToken = getFirstChild(node, "Using");
    const implicitToken = getFirstChild(node, "Implicit");

    if (usingToken) {
      result += "using ";
    } else if (implicitToken) {
      result += "implicit ";
    }

    const identifierToken = getFirstChild(node, "Identifier");
    if (identifierToken) {
      result += getNodeImage(identifierToken);
    }
    result += ": ";

    const typeNode = getFirstChild(node, "type");
    if (typeNode) {
      result += this.visitor.visit(typeNode, ctx);
    }

    const equalsToken = getFirstChild(node, "Equals");
    if (equalsToken) {
      const expression = getFirstChild(node, "expression");
      if (expression) {
        result += " = " + this.visitor.visit(expression, ctx);
      }
    }

    return result;
  }

  visitTypeParameters(node: CSTNode, ctx: PrintContext): string {
    const params = getChildNodes(node, "typeParameter");
    if (params.length === 0) {
      return "";
    }

    const paramStrings = params.map((p: CSTNode) => this.visitor.visit(p, ctx));
    return "[" + paramStrings.join(", ") + "]";
  }

  visitTypeParameter(node: CSTNode, ctx: PrintContext): string {
    let result = "";

    // Handle variance annotations
    const plusToken = getFirstChild(node, "Plus");
    const minusToken = getFirstChild(node, "Minus");

    if (plusToken) {
      result += "+";
    } else if (minusToken) {
      result += "-";
    }

    const identifierToken = getFirstChild(node, "Identifier");
    if (identifierToken) {
      result += getNodeImage(identifierToken);
    }

    // Add bounds
    const subtypeOfToken = getFirstChild(node, "SubtypeOf");
    const supertypeOfToken = getFirstChild(node, "SupertypeOf");
    const typeNodes = getChildNodes(node, "type");

    if (subtypeOfToken && typeNodes.length > 0) {
      result += " <: " + this.visitor.visit(typeNodes[0], ctx);
    }
    if (supertypeOfToken && typeNodes.length > 1) {
      result += " >: " + this.visitor.visit(typeNodes[1], ctx);
    } else if (supertypeOfToken && typeNodes.length === 1 && !subtypeOfToken) {
      result += " >: " + this.visitor.visit(typeNodes[0], ctx);
    }

    return result;
  }

  visitExtendsClause(node: CSTNode, ctx: PrintContext): string {
    const typeNodes = getChildNodes(node, "type");
    if (typeNodes.length === 0) {
      return "";
    }

    let result = "extends " + this.visitor.visit(typeNodes[0], ctx);

    const withToken = getFirstChild(node, "With");
    if (withToken && typeNodes.length > 1) {
      const withTypes = typeNodes
        .slice(1)
        .map((t: CSTNode) => this.visitor.visit(t, ctx));
      result += " with " + withTypes.join(" with ");
    }

    return result;
  }

  visitClassBody(node: CSTNode, ctx: PrintContext): string {
    const classMembers = getChildNodes(node, "classMember");
    if (classMembers.length === 0) {
      return "{}";
    }

    // Increase indent level for class members
    const nestedCtx = {
      ...ctx,
      indentLevel: ctx.indentLevel + 1,
    };

    const members = classMembers.map((m: CSTNode) =>
      this.visitor.visit(m, nestedCtx),
    );

    const indent = createIndent(1, ctx);
    return "{\n" + members.map((m: string) => indent + m).join("\n") + "\n}";
  }

  visitClassMember(node: CSTNode, ctx: PrintContext): string {
    // Handle different types of class members
    const defDefinition = getFirstChild(node, "defDefinition");
    if (defDefinition) {
      return this.visitor.visit(defDefinition, ctx);
    }

    const auxiliaryConstructor = getFirstChild(node, "auxiliaryConstructor");
    if (auxiliaryConstructor) {
      return this.visitor.visit(auxiliaryConstructor, ctx);
    }

    const valDefinition = getFirstChild(node, "valDefinition");
    if (valDefinition) {
      return this.visitor.visit(valDefinition, ctx);
    }

    const varDefinition = getFirstChild(node, "varDefinition");
    if (varDefinition) {
      return this.visitor.visit(varDefinition, ctx);
    }

    const classDefinition = getFirstChild(node, "classDefinition");
    if (classDefinition) {
      return this.visitor.visit(classDefinition, ctx);
    }

    const objectDefinition = getFirstChild(node, "objectDefinition");
    if (objectDefinition) {
      return this.visitor.visit(objectDefinition, ctx);
    }

    const traitDefinition = getFirstChild(node, "traitDefinition");
    if (traitDefinition) {
      return this.visitor.visit(traitDefinition, ctx);
    }

    const typeDefinition = getFirstChild(node, "typeDefinition");
    if (typeDefinition) {
      return this.visitor.visit(typeDefinition, ctx);
    }

    const definition = getFirstChild(node, "definition");
    if (definition) {
      return this.visitor.visit(definition, ctx);
    }

    return "";
  }
}
