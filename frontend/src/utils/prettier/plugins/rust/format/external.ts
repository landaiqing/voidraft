import { Attribute, AttributeOrDocComment, Comment, DocCommentAttribute, LocArray, MemberExpression, Node, SourceFile } from "jinx-rust";
import { PickProps } from "jinx-rust/utils";
import type { Doc, ParserOptions, Printer } from "prettier";
import { doc } from "prettier";
import { AssertTypesEq } from "../utils/common";

export type { Doc, ParserOptions, Plugin, Printer } from "prettier";


export const {
	join,
	line,
	softline,
	hardline,
	literalline,
	group,
	conditionalGroup,
	fill,
	lineSuffix,
	lineSuffixBoundary,
	cursor,
	breakParent,
	ifBreak,
	trim,
	indent,
	indentIfBreak,
	align,
	addAlignmentToDoc,
	markAsRoot,
	dedentToRoot,
	dedent,
	hardlineWithoutBreakParent,
	literallineWithoutBreakParent,
	label,
} = doc.builders;

export const {
	willBreak,
	traverseDoc,
	findInDoc,
	mapDoc,
	removeLines,
	stripTrailingHardline,
} = doc.utils;

// Fallback implementations for removed utils in prettier 3
export const isConcat = (doc: any): boolean => Array.isArray(doc);
export const getDocParts = (doc: any): any[] => Array.isArray(doc) ? doc : [doc];
export const propagateBreaks = (doc: any): any => doc;
export const normalizeParts = (parts: any[]): any[] => parts.flat();
export const normalizeDoc = (doc: any): any => doc;
export const cleanDoc = (doc: any): any => doc;
export const canBreak = (doc: any): boolean => {
	if (!doc) return false;
	if (typeof doc === 'string') return false;
	if (Array.isArray(doc)) return doc.some(canBreak);
	if (doc.type === 'group' || doc.type === 'fill') return true;
	return willBreak(doc);
};

export const Symbol_comments = Symbol.for("comments");

export interface CustomOptions extends ParserOptions<Node> {
	[Symbol_comments]: AnyComment[];
	rsParsedFile: SourceFile;
	commentSpans: Map<number, number>;
	printer: Printer<Node>;
	cursorNode: any;

	comments: Comment[];
	danglingAttributes: AttributeOrDocComment[];
	actuallyMethodNodes: WeakSet<MemberExpression>;
}

export type NodeWithComments<T extends Node> = T & { comments: AnyComment[] };
export interface MutatedComment extends Comment, PrettierCommentInfo {}
export interface MutatedAttribute extends Attribute, PrettierCommentInfo {}
export interface MutatedDocComment extends DocCommentAttribute, PrettierCommentInfo {}
export type AnyComment = MutatedComment | MutatedAttribute | MutatedDocComment;

type keyofDelimitedArrayProps<T> = T extends never ? never : keyof PickProps<T, LocArray<any, "()" | "[]" | "{}" | "<>">>;

__DEV__: AssertTypesEq<keyof typeof DCM, keyofDelimitedArrayProps<Node>>();

export enum DCM {
	"arguments" = "arguments",
	"parameters" = "parameters",
	"items" = "items",
	"properties" = "properties",
	"members" = "members",
	"body" = "body",
	"cases" = "cases",
	"typeArguments" = "typeArguments",
	"ltParameters" = "ltParameters",
	"generics" = "generics",
	"specifiers" = "specifiers",
	"rules" = "rules",
	"match" = "match",
	"transform" = "transform",
	"segments" = "segments",
}

export interface PrettierCommentInfo {
	trailing: boolean;
	leading: boolean;
	unignore: boolean;
	printed: boolean;
	placement: "ownLine" | "endOfLine" | "remaining";
	// nodeDescription?: any;
	marker?: DCM;
}

export interface AstPath<T = Node> {
	stack: (Node | string | number)[];
	callParent<R>(callback: (path: this) => R, count?: number): R;
	getName(): PropertyKey | null;
	getValue(): T;
	getNode(count?: number): T | null;
	getParentNode(count?: number): T | null;

	match(...predicates: ((node: Node, name: string | null, number: number | null) => boolean)[]): boolean;

	call<R>(callback: (path: AstPath, index: number, value: any) => R, ...props: (string | number)[]): R;
	each(callback: (path: AstPath, index: number, value: any) => void, ...props: (string | number)[]): void;
	map<R>(callback: (path: AstPath, index: number, value: any) => R, ...props: (string | number)[]): R[];
}
