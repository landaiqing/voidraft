import type { JavaNode } from "./printers/helpers.js";
declare const _default: {
    languages: {
        name: string;
        parsers: "java"[];
        group: string;
        tmScope: string;
        aceMode: string;
        codemirrorMode: string;
        codemirrorMimeType: string;
        extensions: string[];
        linguistLanguageId: number;
        vscodeLanguageIds: string[];
    }[];
    parsers: {
        java: {
            parse(text: string, options: import("./printers/helpers.js").JavaParserOptions): import("./printers/helpers.js").JavaNonTerminal;
            astFormat: string;
            hasPragma(text: string): boolean;
            locStart(node: JavaNode): number;
            locEnd(node: JavaNode): number;
        };
    };
    printers: {
        java: {
            print(path: import("prettier").AstPath<import("java-parser").ArrayInitializerCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").VariableInitializerListCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").BlockCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").BlockStatementsCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").LocalVariableDeclarationStatementCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").LocalVariableDeclarationCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").LabeledStatementCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").ExpressionStatementCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").IfStatementCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").AssertStatementCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").SwitchStatementCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").SwitchBlockCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").SwitchBlockStatementGroupCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").SwitchLabelCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").SwitchRuleCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").WhileStatementCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").DoStatementCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").BasicForStatementCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").StatementExpressionListCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").EnhancedForStatementCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").BreakStatementCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").ContinueStatementCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").ReturnStatementCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").ThrowStatementCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").SynchronizedStatementCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").TryStatementCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").CatchesCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").CatchClauseCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").CatchFormalParameterCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").CatchTypeCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").FinallyCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").TryWithResourcesStatementCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").ResourceSpecificationCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").ResourceListCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").YieldStatementCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").ForInitCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").ForUpdateCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").StatementCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").StatementWithoutTrailingSubstatementCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").ForStatementCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").BlockStatementCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").CaseConstantCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").CasePatternCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").EmptyStatementCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").StatementExpressionCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").LocalVariableTypeCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").ResourceCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").VariableAccessCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").ClassDeclarationCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").NormalClassDeclarationCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").TypeParametersCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").TypeParameterListCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").ClassExtendsCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").ClassImplementsCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").InterfaceTypeListCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").ClassBodyCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").ClassMemberDeclarationCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").FieldDeclarationCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").VariableDeclaratorListCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").VariableDeclaratorCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").VariableDeclaratorIdCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").UnannPrimitiveTypeWithOptionalDimsSuffixCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").UnannReferenceTypeCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").MethodDeclarationCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").MethodHeaderCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").MethodDeclaratorCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").ReceiverParameterCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").FormalParameterListCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").VariableParaRegularParameterCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").VariableArityParameterCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").ThrowsCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").ExceptionTypeListCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").StaticInitializerCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").ConstructorDeclarationCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").ConstructorDeclaratorCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").ConstructorBodyCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").UnqualifiedExplicitConstructorInvocationCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").QualifiedExplicitConstructorInvocationCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").EnumDeclarationCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").EnumBodyCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").EnumConstantListCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").EnumConstantCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").EnumBodyDeclarationsCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").RecordDeclarationCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").RecordHeaderCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").RecordComponentListCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").RecordComponentCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").VariableArityRecordComponentCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").RecordBodyCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").CompactConstructorDeclarationCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").UnannTypeCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").VariableInitializerCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").VariableModifierCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").UnannClassTypeCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").ClassBodyDeclarationCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").InstanceInitializerCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").ClassModifierCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").ClassPermitsCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").FieldModifierCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").MethodModifierCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").MethodBodyCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").ConstructorModifierCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").SimpleTypeNameCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").ExplicitConstructorInvocationCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").EnumConstantModifierCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").ExceptionTypeCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").FormalParameterCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").ResultCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").RecordBodyDeclarationCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").RecordComponentModifierCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").UnannClassOrInterfaceTypeCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").UnannInterfaceTypeCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").UnannPrimitiveTypeCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").UnannTypeVariableCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").LambdaExpressionCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").LambdaParametersCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").LambdaParametersWithBracesCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").ConciseLambdaParameterListCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").NormalLambdaParameterListCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").RegularLambdaParameterCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").ConditionalExpressionCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").BinaryExpressionCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").UnaryExpressionCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").UnaryExpressionNotPlusMinusCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").PrimaryCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").PrimarySuffixCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").FqnOrRefTypeCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").FqnOrRefTypePartFirstCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").FqnOrRefTypePartRestCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").FqnOrRefTypePartCommonCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").ParenthesisExpressionCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").PrimitiveCastExpressionCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").ReferenceTypeCastExpressionCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").UnqualifiedClassInstanceCreationExpressionCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").ClassOrInterfaceTypeToInstantiateCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").MethodInvocationSuffixCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").ArgumentListCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").ArrayCreationExpressionCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").ArrayCreationExpressionWithoutInitializerSuffixCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").ArrayCreationWithInitializerSuffixCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").DimExprsCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").DimExprCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").ClassLiteralSuffixCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").ArrayAccessSuffixCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").MethodReferenceSuffixCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").StringTemplateCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").TextBlockTemplateCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").RecordPatternCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").ComponentPatternListCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").GuardCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").TemplateCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").PatternCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").ExpressionCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").TypePatternCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").CastExpressionCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").TypeArgumentsOrDiamondCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").DiamondCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").ComponentPatternCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").MatchAllPatternCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").ConciseLambdaParameterCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").EmbeddedExpressionCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").LambdaBodyCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").LambdaParameterListCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").NormalLambdaParameterCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").LambdaParameterTypeCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").NewExpressionCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").PrimaryPrefixCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").TemplateArgumentCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").InterfaceDeclarationCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").NormalInterfaceDeclarationCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").InterfaceExtendsCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").InterfaceBodyCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").InterfaceMemberDeclarationCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").ConstantDeclarationCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").InterfaceMethodDeclarationCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").AnnotationInterfaceDeclarationCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").AnnotationInterfaceBodyCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").AnnotationInterfaceMemberDeclarationCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").AnnotationInterfaceElementDeclarationCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").DefaultValueCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").AnnotationCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").ElementValuePairListCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").ElementValuePairCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").ElementValueArrayInitializerCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").ElementValueListCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").ElementValueCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").AnnotationInterfaceElementModifierCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").ConstantModifierCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").InterfaceModifierCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").InterfacePermitsCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").InterfaceMethodModifierCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").LiteralCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").ShiftOperatorCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").BooleanLiteralCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").FloatingPointLiteralCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").IntegerLiteralCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").MethodNameCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").AmbiguousNameCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").TypeNameCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").TypeIdentifierCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").ExpressionNameCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").PackageNameCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").ModuleNameCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").PackageOrTypeNameCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").CompilationUnitCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").OrdinaryCompilationUnitCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").ModularCompilationUnitCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").PackageDeclarationCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").ImportDeclarationCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").TypeDeclarationCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").ModuleDeclarationCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").RequiresModuleDirectiveCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").ExportsModuleDirectiveCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").OpensModuleDirectiveCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").UsesModuleDirectiveCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").ProvidesModuleDirectiveCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").ModuleDirectiveCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").RequiresModifierCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").PackageModifierCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").PrimitiveTypeCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").ReferenceTypeCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").TypeVariableCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").DimsCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").TypeParameterCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").TypeBoundCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").AdditionalBoundCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").TypeArgumentsCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").TypeArgumentListCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").WildcardCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").WildcardBoundsCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").InterfaceTypeCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").ClassTypeCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").NumericTypeCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").ClassOrInterfaceTypeCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").FloatingPointTypeCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").IntegralTypeCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").TypeArgumentCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").TypeParameterModifierCstNode & {
                comments?: import("./comments.js").JavaComment[];
            }> | import("prettier").AstPath<import("java-parser").IToken & {
                comments?: import("./comments.js").JavaComment[];
            }>, options: import("prettier").ParserOptions<JavaNode>, print: (path: import("prettier").AstPath<JavaNode>) => import("prettier").Doc, args: unknown): import("prettier/doc.js").builders.Doc;
            hasPrettierIgnore(path: import("prettier").AstPath<JavaNode>): boolean;
            canAttachComment: typeof import("./comments.js").canAttachComment;
            isBlockComment(node: JavaNode): boolean;
            printComment(commentPath: import("prettier").AstPath<JavaNode>): string | import("prettier/doc.js").builders.Doc[];
            getCommentChildNodes(node: JavaNode): any[];
            handleComments: {
                ownLine: typeof import("./comments.js").handleLineComment;
                endOfLine: typeof import("./comments.js").handleLineComment;
                remaining: typeof import("./comments.js").handleRemainingComment;
            };
        };
    };
    options: {
        entrypoint: {
            type: "choice";
            category: string;
            default: string;
            choices: {
                value: string;
                description: string;
            }[];
            description: string;
        };
        arrowParens: {
            type: "choice";
            category: string;
            default: string;
            choices: {
                value: string;
                description: string;
            }[];
            description: string;
        };
        trailingComma: {
            type: "choice";
            category: string;
            default: string;
            choices: {
                value: string;
                description: string;
            }[];
            description: string;
        };
        experimentalOperatorPosition: {
            type: "choice";
            category: string;
            default: string;
            choices: {
                value: string;
                description: string;
            }[];
            description: string;
        };
    };
    defaultOptions: {
        arrowParens: "avoid";
    };
};
export default _default;
