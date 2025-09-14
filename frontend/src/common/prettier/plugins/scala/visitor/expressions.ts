/**
 * Expression visitor methods for handling various expression types
 */
import {
  formatStringLiteral,
  getChildNodes,
  getFirstChild,
  createIndent,
  getNodeImage,
} from "./utils";
import type { PrintContext, CSTNode } from "./utils";

export interface ExpressionVisitor {
  visit(node: CSTNode, ctx: PrintContext): string;
}

export class ExpressionVisitorMethods {
  private visitor: ExpressionVisitor;

  constructor(visitor: ExpressionVisitor) {
    this.visitor = visitor;
  }

  visitExpression(node: CSTNode, ctx: PrintContext): string {
    // Handle PartialFunction literals: { case ... }
    const partialFunctionLiteral = getFirstChild(
      node,
      "partialFunctionLiteral",
    );
    if (partialFunctionLiteral) {
      return this.visitor.visit(partialFunctionLiteral, ctx);
    }

    // Handle lambda expressions with parameter list: (x: Int, y: Int) => x + y
    const parameterList = getFirstChild(node, "parameterList");
    const arrow = getChildNodes(node, "Arrow");
    if (parameterList && arrow.length > 0) {
      const expression = getFirstChild(node, "expression");
      return (
        this.visitor.visit(parameterList, ctx) +
        " => " +
        (expression ? this.visitor.visit(expression, ctx) : "")
      );
    }

    // Handle block lambda expressions: { x => ... }
    const leftBrace = getChildNodes(node, "LeftBrace");
    const identifier = getChildNodes(node, "Identifier");
    const arrowNodes = getChildNodes(node, "Arrow");

    if (
      leftBrace.length > 0 &&
      identifier.length > 0 &&
      arrowNodes.length > 0
    ) {
      let result = "{ " + getNodeImage(identifier[0]) + " =>";

      const statements: string[] = [];

      // Create nested context for lambda body
      const nestedCtx = {
        ...ctx,
        indentLevel: ctx.indentLevel + 1,
      };

      // Add statements (val/var/def definitions)
      const blockStatements = getChildNodes(node, "blockStatement");
      if (blockStatements.length > 0) {
        statements.push(
          ...blockStatements.map((stmt: CSTNode) =>
            this.visitor.visit(stmt, nestedCtx),
          ),
        );
      }

      // Add final expression
      const finalExpression = getFirstChild(node, "expression");
      if (finalExpression) {
        statements.push(this.visitor.visit(finalExpression, nestedCtx));
      }

      if (statements.length === 0) {
        result += " }";
      } else if (statements.length === 1) {
        // Single expression - keep on same line if short
        const stmt = statements[0];
        if (stmt.length < 50) {
          result += " " + stmt + " }";
        } else {
          const indent = createIndent(1, ctx);
          result += "\n" + indent + stmt + "\n}";
        }
      } else {
        // Multiple statements - use multiple lines
        const indent = createIndent(1, ctx);
        const indentedStmts = statements.map((stmt) => indent + stmt);
        result += "\n" + indentedStmts.join("\n") + "\n}";
      }

      return result;
    }

    // Handle polymorphic function literal: [T] => (x: T) => x
    const polymorphicFunctionLiteral = getFirstChild(
      node,
      "polymorphicFunctionLiteral",
    );
    if (polymorphicFunctionLiteral) {
      return this.visitor.visit(polymorphicFunctionLiteral, ctx);
    }

    // Handle simple lambda expressions: x => x * 2
    const simpleIdentifier = getChildNodes(node, "Identifier");
    const simpleArrow = getChildNodes(node, "Arrow");
    if (simpleIdentifier.length > 0 && simpleArrow.length > 0) {
      const expression = getFirstChild(node, "expression");
      return (
        getNodeImage(simpleIdentifier[0]) +
        " => " +
        (expression ? this.visitor.visit(expression, ctx) : "")
      );
    }

    // Handle assignmentOrInfixExpression
    const assignmentOrInfixExpression = getFirstChild(
      node,
      "assignmentOrInfixExpression",
    );
    if (assignmentOrInfixExpression) {
      return this.visitor.visit(assignmentOrInfixExpression, ctx);
    }

    // Handle regular expressions (fallback for older structure)
    const postfixExpressions = getChildNodes(node, "postfixExpression");
    if (postfixExpressions.length > 0) {
      let result = this.visitor.visit(postfixExpressions[0], ctx);

      const infixOperators = getChildNodes(node, "infixOperator");
      if (infixOperators.length > 0) {
        for (let i = 0; i < infixOperators.length; i++) {
          result +=
            " " +
            this.visitor.visit(infixOperators[i], ctx) +
            " " +
            (postfixExpressions[i + 1]
              ? this.visitor.visit(postfixExpressions[i + 1], ctx)
              : "");
        }
      }

      return result;
    }

    return "";
  }

  visitPostfixExpression(node: CSTNode, ctx: PrintContext): string {
    const primaryExpression = getFirstChild(node, "primaryExpression");
    let result = primaryExpression
      ? this.visitor.visit(primaryExpression, ctx)
      : "";

    // Handle method calls and member access
    const dots = getChildNodes(node, "Dot");
    if (dots.length > 0) {
      const identifiers = getChildNodes(node, "Identifier");

      for (let i = 0; i < dots.length; i++) {
        result += ".";

        // Handle member access or method call
        // Identifiers after the first one correspond to members after dots
        if (identifiers.length > i) {
          result += getNodeImage(identifiers[i]);
        }

        // Add arguments if this is a method call
        const leftParens = getChildNodes(node, "LeftParen");
        if (leftParens.length > i) {
          result += "(";

          // Find expressions for this argument list
          const startIdx = i * 10; // Rough heuristic for argument grouping
          const expressions = getChildNodes(node, "expression");
          const relevantExpressions = expressions.slice(
            startIdx,
            startIdx + 10,
          );

          if (relevantExpressions.length > 0) {
            const args = relevantExpressions.map((e: CSTNode) =>
              this.visitor.visit(e, ctx),
            );
            result += args.join(", ");
          }

          result += ")";
        }
      }
    }

    // Handle type arguments
    const leftBrackets = getChildNodes(node, "LeftBracket");
    if (leftBrackets.length > 0) {
      result += "[";
      const types = getChildNodes(node, "type");
      if (types.length > 0) {
        const typeStrings = types.map((t: CSTNode) =>
          this.visitor.visit(t, ctx),
        );
        result += typeStrings.join(", ");
      }
      result += "]";
    }

    // Handle match expressions
    const matchTokens = getChildNodes(node, "Match");
    if (matchTokens.length > 0) {
      result += " match {\n";
      const caseClauses = getChildNodes(node, "caseClause");
      if (caseClauses.length > 0) {
        const cases = caseClauses.map(
          (c: CSTNode) => "  " + this.visitor.visit(c, ctx),
        );
        result += cases.join("\n");
        result += "\n";
      }
      result += "}";
    }

    // Handle method application without dot
    const methodLeftParens = getChildNodes(node, "LeftParen");
    const methodDots = getChildNodes(node, "Dot");
    if (methodLeftParens.length > 0 && methodDots.length === 0) {
      result += "(";
      const methodExpressions = getChildNodes(node, "expression");
      if (methodExpressions.length > 0) {
        const args = methodExpressions.map((e: CSTNode) =>
          this.visitor.visit(e, ctx),
        );
        result += args.join(", ");
      }
      result += ")";
    }

    // Handle block lambda expressions: method { param => ... }
    const leftBrace = getChildNodes(node, "LeftBrace");
    const arrowNodes = getChildNodes(node, "Arrow");
    const identifiers = getChildNodes(node, "Identifier");

    if (
      leftBrace.length > 0 &&
      arrowNodes.length > 0 &&
      identifiers.length > 1
    ) {
      // The lambda parameter is the second identifier (first is method name)
      const lambdaParam = getNodeImage(identifiers[1]);
      result += " { " + lambdaParam + " =>";

      // Create nested context for lambda body
      const nestedCtx = {
        ...ctx,
        indentLevel: ctx.indentLevel + 1,
      };

      // Process block statements
      const blockStatements = getChildNodes(node, "blockStatement");
      const statements: string[] = [];

      for (const stmt of blockStatements) {
        statements.push(this.visitor.visit(stmt, nestedCtx));
      }

      if (statements.length === 0) {
        result += " }";
      } else if (statements.length === 1) {
        // Single statement - keep on same line if short
        const stmt = statements[0];
        if (stmt.length < 50) {
          result += " " + stmt + " }";
        } else {
          const indent = createIndent(1, ctx);
          result += "\n" + indent + stmt + "\n}";
        }
      } else {
        // Multiple statements - use multiple lines
        const indent = createIndent(1, ctx);
        const indentedStmts = statements.map((stmt) => indent + stmt);
        result += "\n" + indentedStmts.join("\n") + "\n}";
      }
    }

    return result;
  }

  visitPrimaryExpression(node: CSTNode, ctx: PrintContext): string {
    const literal = getFirstChild(node, "literal");
    if (literal) {
      return this.visitor.visit(literal, ctx);
    }

    const identifier = getFirstChild(node, "Identifier");
    if (identifier) {
      return getNodeImage(identifier);
    }

    const thisToken = getChildNodes(node, "This");
    if (thisToken.length > 0) {
      return "this";
    }

    const partialFunctionLiteral = getFirstChild(
      node,
      "partialFunctionLiteral",
    );
    if (partialFunctionLiteral) {
      return this.visitor.visit(partialFunctionLiteral, ctx);
    }

    const newExpression = getFirstChild(node, "newExpression");
    if (newExpression) {
      return this.visitor.visit(newExpression, ctx);
    }

    const forExpression = getFirstChild(node, "forExpression");
    if (forExpression) {
      return this.visitor.visit(forExpression, ctx);
    }

    const ifExpression = getFirstChild(node, "ifExpression");
    if (ifExpression) {
      return this.visitor.visit(ifExpression, ctx);
    }

    const whileExpression = getFirstChild(node, "whileExpression");
    if (whileExpression) {
      return this.visitor.visit(whileExpression, ctx);
    }

    const tryExpression = getFirstChild(node, "tryExpression");
    if (tryExpression) {
      return this.visitor.visit(tryExpression, ctx);
    }

    const exclamation = getChildNodes(node, "Exclamation");
    if (exclamation.length > 0) {
      // Handle negation operator
      const postfixExpression = getFirstChild(node, "postfixExpression");
      if (postfixExpression) {
        const result = this.visitor.visit(postfixExpression, ctx);
        return "!" + result;
      }
      return "!";
    }

    const bitwiseTilde = getChildNodes(node, "BitwiseTilde");
    if (bitwiseTilde.length > 0) {
      // Handle bitwise complement operator
      const postfixExpression = getFirstChild(node, "postfixExpression");
      return (
        "~" +
        (postfixExpression ? this.visitor.visit(postfixExpression, ctx) : "")
      );
    }

    const leftParen = getChildNodes(node, "LeftParen");
    if (leftParen.length > 0) {
      const expression = getFirstChild(node, "expression");
      const assignmentOrInfixExpression = getFirstChild(
        node,
        "assignmentOrInfixExpression",
      );

      // Try expression first, then assignmentOrInfixExpression
      const content = expression
        ? this.visitor.visit(expression, ctx)
        : assignmentOrInfixExpression
          ? this.visitor.visit(assignmentOrInfixExpression, ctx)
          : "";

      return "(" + content + ")";
    }

    const blockExpression = getFirstChild(node, "blockExpression");
    if (blockExpression) {
      return this.visitor.visit(blockExpression, ctx);
    }

    const quoteExpression = getFirstChild(node, "quoteExpression");
    if (quoteExpression) {
      return this.visitor.visit(quoteExpression, ctx);
    }

    const spliceExpression = getFirstChild(node, "spliceExpression");
    if (spliceExpression) {
      return this.visitor.visit(spliceExpression, ctx);
    }

    return "";
  }

  visitAssignmentOrInfixExpression(node: CSTNode, ctx: PrintContext): string {
    const postfixExpressions = getChildNodes(node, "postfixExpression");
    let result =
      postfixExpressions.length > 0
        ? this.visitor.visit(postfixExpressions[0], ctx)
        : "";

    // Handle assignment operators (including named arguments)
    const equals = getChildNodes(node, "Equals");
    const plusEquals = getChildNodes(node, "PlusEquals");
    const minusEquals = getChildNodes(node, "MinusEquals");
    const starEquals = getChildNodes(node, "StarEquals");
    const slashEquals = getChildNodes(node, "SlashEquals");
    const percentEquals = getChildNodes(node, "PercentEquals");
    const sbtAssign = getChildNodes(node, "SbtAssign");

    const operator =
      equals[0] ||
      plusEquals[0] ||
      minusEquals[0] ||
      starEquals[0] ||
      slashEquals[0] ||
      percentEquals[0] ||
      sbtAssign[0];

    if (operator) {
      result += " " + getNodeImage(operator) + " ";
      const expressions = getChildNodes(node, "expression");
      if (expressions.length > 0) {
        result += this.visitor.visit(expressions[0], ctx);
      }
    }

    // Handle infix operators
    const infixOperators = getChildNodes(node, "infixOperator");
    if (infixOperators.length > 0) {
      for (let i = 0; i < infixOperators.length; i++) {
        result += " " + this.visitor.visit(infixOperators[i], ctx) + " ";
        if (postfixExpressions.length > i + 1) {
          result += this.visitor.visit(postfixExpressions[i + 1], ctx);
        }
      }
    }

    return result;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  visitInfixOperator(node: CSTNode, _ctx: PrintContext): string {
    // Handle all possible infix operators
    const operators = [
      "Plus",
      "Minus",
      "Star",
      "Slash",
      "Percent",
      "DoubleStar",
      "LeftShift",
      "RightShift",
      "UnsignedRightShift",
      "BitwiseAnd",
      "BitwiseOr",
      "BitwiseXor",
      "EqualsEquals",
      "NotEquals",
      "LessThan",
      "LessThanOrEqual",
      "GreaterThan",
      "GreaterThanOrEqual",
      "LogicalAnd",
      "LogicalOr",
      "DoublePercent",
      "Ask",
      "To",
      "Until",
      "PrependOp",
      "AppendOp",
      "ConcatOp",
      "RightArrow",
    ];

    for (const op of operators) {
      const tokens = getChildNodes(node, op);
      if (tokens.length > 0) {
        return getNodeImage(tokens[0]);
      }
    }

    // Fallback to identifier for custom operators
    const identifiers = getChildNodes(node, "Identifier");
    if (identifiers.length > 0) {
      return getNodeImage(identifiers[0]);
    }

    return "";
  }

  visitLiteral(node: CSTNode, ctx: PrintContext): string {
    // Handle all possible literal types
    const literalTypes = [
      "StringLiteral",
      "InterpolatedStringLiteral",
      "IntegerLiteral",
      "NumberLiteral",
      "FloatLiteral",
      "BooleanLiteral",
      "True",
      "False",
      "CharLiteral",
      "NullLiteral",
      "Null",
      "ScientificNumber",
    ];

    for (const literalType of literalTypes) {
      const tokens = getChildNodes(node, literalType);
      if (tokens.length > 0) {
        const tokenImage = getNodeImage(tokens[0]);

        // Apply singleQuote formatting to string literals
        if (tokenImage.startsWith('"') || tokenImage.startsWith("'")) {
          return formatStringLiteral(tokenImage, ctx);
        }

        return tokenImage;
      }
    }

    return "";
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  visitQualifiedIdentifier(node: CSTNode, _ctx: PrintContext): string {
    const identifiers = getChildNodes(node, "Identifier");
    if (identifiers.length === 0) {
      return "";
    }

    let result = getNodeImage(identifiers[0]);

    const dots = getChildNodes(node, "Dot");
    if (dots.length > 0) {
      // Handle mixed identifiers and type keywords
      const types = getChildNodes(node, "Type");

      for (let i = 0; i < dots.length; i++) {
        result += ".";

        // Determine which token comes next (identifier or type keyword)
        if (i + 1 < identifiers.length) {
          result += getNodeImage(identifiers[i + 1]);
        } else if (types.length > 0) {
          // Use the type keyword (e.g., "type" for .type syntax)
          result += getNodeImage(types[0]);
        }
      }
    }

    return result;
  }

  visitNewExpression(node: CSTNode, ctx: PrintContext): string {
    const typeNode = getFirstChild(node, "type");
    let result = "new " + (typeNode ? this.visitor.visit(typeNode, ctx) : "");

    const leftParens = getChildNodes(node, "LeftParen");
    if (leftParens.length > 0) {
      result += "(";
      const expressions = getChildNodes(node, "expression");
      if (expressions.length > 0) {
        const args = expressions.map((e: CSTNode) =>
          this.visitor.visit(e, ctx),
        );
        result += args.join(", ");
      }
      result += ")";
    }

    return result;
  }

  visitIfExpression(node: CSTNode, ctx: PrintContext): string {
    const expressions = getChildNodes(node, "expression");
    if (expressions.length < 2) {
      return "if";
    }

    let result = "if (";
    result += this.visitor.visit(expressions[0], ctx);
    result += ") ";
    result += this.visitor.visit(expressions[1], ctx);

    const elseTokens = getChildNodes(node, "Else");
    if (elseTokens.length > 0 && expressions.length > 2) {
      result += " else ";
      result += this.visitor.visit(expressions[2], ctx);
    }

    return result;
  }

  visitWhileExpression(node: CSTNode, ctx: PrintContext): string {
    const expressions = getChildNodes(node, "expression");
    if (expressions.length < 2) {
      return "while";
    }

    let result = "while (";
    result += this.visitor.visit(expressions[0], ctx);
    result += ") ";
    result += this.visitor.visit(expressions[1], ctx);

    return result;
  }

  visitTryExpression(node: CSTNode, ctx: PrintContext): string {
    const expressions = getChildNodes(node, "expression");
    if (expressions.length === 0) {
      return "try";
    }

    let result = "try ";
    result += this.visitor.visit(expressions[0], ctx);

    const catchTokens = getChildNodes(node, "Catch");
    if (catchTokens.length > 0) {
      result += " catch {\n";
      const caseClauses = getChildNodes(node, "caseClause");
      if (caseClauses.length > 0) {
        const cases = caseClauses.map(
          (c: CSTNode) => "  " + this.visitor.visit(c, ctx),
        );
        result += cases.join("\n");
      }
      result += "\n}";
    }

    const finallyTokens = getChildNodes(node, "Finally");
    if (finallyTokens.length > 0) {
      result += " finally ";
      // If there's a catch block, expression[1] is the finally expression
      // Otherwise, expression[1] would be the finally expression (no catch)
      const finallyExprIndex = catchTokens.length > 0 ? 1 : 1;
      if (expressions.length > finallyExprIndex) {
        result += this.visitor.visit(expressions[finallyExprIndex], ctx);
      }
    }

    return result;
  }

  visitForExpression(node: CSTNode, ctx: PrintContext): string {
    let result = "for ";

    const leftParens = getChildNodes(node, "LeftParen");
    const leftBraces = getChildNodes(node, "LeftBrace");
    const generators = getChildNodes(node, "generator");

    if (leftParens.length > 0) {
      result += "(";
      if (generators.length > 0) {
        const gens = generators.map((g: CSTNode) => this.visitor.visit(g, ctx));
        result += gens.join("; ");
      }
      result += ")";
    } else if (leftBraces.length > 0) {
      result += "{\n";
      if (generators.length > 0) {
        const gens = generators.map(
          (g: CSTNode) => "  " + this.visitor.visit(g, ctx),
        );
        result += gens.join("\n");
      }
      result += "\n}";
    }

    const yieldTokens = getChildNodes(node, "Yield");
    if (yieldTokens.length > 0) {
      result += " yield ";
    } else {
      result += " ";
    }

    const expressions = getChildNodes(node, "expression");
    if (expressions.length > 0) {
      result += this.visitor.visit(expressions[0], ctx);
    }

    return result;
  }

  visitGenerator(node: CSTNode, ctx: PrintContext): string {
    const patterns = getChildNodes(node, "pattern");
    const expressions = getChildNodes(node, "expression");

    if (patterns.length === 0 || expressions.length === 0) {
      return "";
    }

    let result = this.visitor.visit(patterns[0], ctx);
    result += " <- " + this.visitor.visit(expressions[0], ctx);

    const ifTokens = getChildNodes(node, "If");
    if (ifTokens.length > 0) {
      for (let i = 0; i < ifTokens.length; i++) {
        if (expressions.length > i + 1) {
          result += " if " + this.visitor.visit(expressions[i + 1], ctx);
        }
      }
    }

    return result;
  }

  visitCaseClause(node: CSTNode, ctx: PrintContext): string {
    const patterns = getChildNodes(node, "pattern");
    const expressions = getChildNodes(node, "expression");

    if (patterns.length === 0) {
      return "case";
    }

    let result = "case " + this.visitor.visit(patterns[0], ctx);

    const ifTokens = getChildNodes(node, "If");
    if (ifTokens.length > 0 && expressions.length > 0) {
      result += " if " + this.visitor.visit(expressions[0], ctx);
    }

    const expressionIndex = ifTokens.length > 0 ? 1 : 0;
    if (expressions.length > expressionIndex) {
      result += " => " + this.visitor.visit(expressions[expressionIndex], ctx);
    }

    return result;
  }

  visitBlockExpression(node: CSTNode, ctx: PrintContext): string {
    const blockStatements = getChildNodes(node, "blockStatement");
    const expressions = getChildNodes(node, "expression");

    if (blockStatements.length === 0 && expressions.length === 0) {
      return "{}";
    }

    let result = "{\n";
    const statements: string[] = [];

    // Create nested context for block contents
    const nestedCtx = {
      ...ctx,
      indentLevel: ctx.indentLevel + 1,
    };

    if (blockStatements.length > 0) {
      statements.push(
        ...blockStatements.map((stmt: CSTNode) =>
          this.visitor.visit(stmt, nestedCtx),
        ),
      );
    }

    if (expressions.length > 0) {
      statements.push(this.visitor.visit(expressions[0], nestedCtx));
    }

    const indent = createIndent(1, ctx);
    result += statements.map((stmt) => indent + stmt).join("\n");

    result += "\n}";
    return result;
  }

  visitPartialFunctionLiteral(node: CSTNode, ctx: PrintContext): string {
    const caseClauses = getChildNodes(node, "caseClause");

    if (caseClauses.length === 0) {
      return "{}";
    }

    // Single case - try to format on one line if short
    if (caseClauses.length === 1) {
      const caseStr = this.visitor.visit(caseClauses[0], ctx);
      if (caseStr.length < 50) {
        return `{ ${caseStr} }`;
      }
    }

    // Multi-line format for long cases or multiple cases
    let result = "{\n";
    const cases = caseClauses.map(
      (c: CSTNode) => "  " + this.visitor.visit(c, ctx),
    );
    result += cases.join("\n");
    result += "\n}";
    return result;
  }

  visitAssignmentStatement(node: CSTNode, ctx: PrintContext): string {
    const identifiers = getChildNodes(node, "Identifier");
    if (identifiers.length === 0) {
      return "";
    }

    let result = getNodeImage(identifiers[0]);

    // Find the assignment operator
    const equals = getChildNodes(node, "Equals");
    const plusEquals = getChildNodes(node, "PlusEquals");
    const minusEquals = getChildNodes(node, "MinusEquals");
    const starEquals = getChildNodes(node, "StarEquals");
    const slashEquals = getChildNodes(node, "SlashEquals");
    const percentEquals = getChildNodes(node, "PercentEquals");
    const sbtAssign = getChildNodes(node, "SbtAssign");

    const operator =
      equals[0] ||
      plusEquals[0] ||
      minusEquals[0] ||
      starEquals[0] ||
      slashEquals[0] ||
      percentEquals[0] ||
      sbtAssign[0];

    if (operator) {
      result += " " + getNodeImage(operator) + " ";
      const expressions = getChildNodes(node, "expression");
      if (expressions.length > 0) {
        result += this.visitor.visit(expressions[0], ctx);
      }
    }

    return result;
  }
}
