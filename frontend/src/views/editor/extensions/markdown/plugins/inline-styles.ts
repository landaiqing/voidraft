/**
 * Inline styles handlers and theme.
 * Handles: Highlight, InlineCode, Emphasis, StrongEmphasis, Strikethrough, Insert, Superscript, Subscript
 */

import { Decoration, EditorView } from '@codemirror/view';
import { invisibleDecoration, RangeTuple } from '../util';
import { SyntaxNode } from '@lezer/common';
import { BuildContext } from './types';

const DECO_HIGHLIGHT = Decoration.mark({ class: 'cm-highlight' });
const DECO_INLINE_CODE = Decoration.mark({ class: 'cm-inline-code' });
const DECO_INSERT = Decoration.mark({ class: 'cm-insert' });
const DECO_SUPERSCRIPT = Decoration.mark({ class: 'cm-superscript' });
const DECO_SUBSCRIPT = Decoration.mark({ class: 'cm-subscript' });

const MARK_TYPES: Record<string, string> = {
	'Emphasis': 'EmphasisMark',
	'StrongEmphasis': 'EmphasisMark',
	'Strikethrough': 'StrikethroughMark'
};

/**
 * Handle Highlight node (==text==).
 */
export function handleHighlight(
	ctx: BuildContext,
	nf: number,
	nt: number,
	node: SyntaxNode,
	inCursor: boolean,
	ranges: RangeTuple[]
): void {
	if (ctx.seen.has(nf)) return;
	ctx.seen.add(nf);
	ranges.push([nf, nt]);
	if (inCursor) return;

	const marks = node.getChildren('HighlightMark');
	if (marks.length >= 2) {
		ctx.items.push({ from: marks[0].from, to: marks[0].to, deco: invisibleDecoration });
		if (marks[0].to < marks[marks.length - 1].from) {
			ctx.items.push({ from: marks[0].to, to: marks[marks.length - 1].from, deco: DECO_HIGHLIGHT });
		}
		ctx.items.push({ from: marks[marks.length - 1].from, to: marks[marks.length - 1].to, deco: invisibleDecoration });
	}
}

/**
 * Handle InlineCode node (`code`).
 */
export function handleInlineCode(
	ctx: BuildContext,
	nf: number,
	nt: number,
	inCursor: boolean,
	ranges: RangeTuple[]
): void {
	if (ctx.seen.has(nf)) return;
	ctx.seen.add(nf);
	ranges.push([nf, nt]);
	if (inCursor) return;

	const text = ctx.view.state.doc.sliceString(nf, nt);
	let i = 0; while (i < text.length && text[i] === '`') i++;
	let j = text.length - 1; while (j >= 0 && text[j] === '`') j--;
	const codeStart = nf + i, codeEnd = nf + j + 1;
	if (nf < codeStart) ctx.items.push({ from: nf, to: codeStart, deco: invisibleDecoration });
	if (codeStart < codeEnd) ctx.items.push({ from: codeStart, to: codeEnd, deco: DECO_INLINE_CODE });
	if (codeEnd < nt) ctx.items.push({ from: codeEnd, to: nt, deco: invisibleDecoration });
}

/**
 * Handle Emphasis, StrongEmphasis, Strikethrough nodes.
 */
export function handleEmphasis(
	ctx: BuildContext,
	nf: number,
	nt: number,
	node: SyntaxNode,
	typeName: string,
	inCursor: boolean,
	ranges: RangeTuple[]
): void {
	if (ctx.seen.has(nf)) return;
	ctx.seen.add(nf);
	ranges.push([nf, nt]);
	if (inCursor) return;

	const markType = MARK_TYPES[typeName];
	if (markType) {
		const marks = node.getChildren(markType);
		for (const mark of marks) {
			ctx.items.push({ from: mark.from, to: mark.to, deco: invisibleDecoration });
		}
	}
}

/**
 * Handle Insert node (++text++).
 */
export function handleInsert(
	ctx: BuildContext,
	nf: number,
	nt: number,
	node: SyntaxNode,
	inCursor: boolean,
	ranges: RangeTuple[]
): void {
	if (ctx.seen.has(nf)) return;
	ctx.seen.add(nf);
	ranges.push([nf, nt]);
	if (inCursor) return;

	const marks = node.getChildren('InsertMark');
	if (marks.length >= 2) {
		ctx.items.push({ from: marks[0].from, to: marks[0].to, deco: invisibleDecoration });
		if (marks[0].to < marks[marks.length - 1].from) {
			ctx.items.push({ from: marks[0].to, to: marks[marks.length - 1].from, deco: DECO_INSERT });
		}
		ctx.items.push({ from: marks[marks.length - 1].from, to: marks[marks.length - 1].to, deco: invisibleDecoration });
	}
}

/**
 * Handle Superscript / Subscript nodes.
 */
export function handleScript(
	ctx: BuildContext,
	nf: number,
	nt: number,
	node: SyntaxNode,
	typeName: string,
	inCursor: boolean,
	ranges: RangeTuple[]
): void {
	if (ctx.seen.has(nf)) return;
	ctx.seen.add(nf);
	ranges.push([nf, nt]);
	if (inCursor) return;

	const isSuper = typeName === 'Superscript';
	const markName = isSuper ? 'SuperscriptMark' : 'SubscriptMark';
	const marks = node.getChildren(markName);
	if (marks.length >= 2) {
		ctx.items.push({ from: marks[0].from, to: marks[0].to, deco: invisibleDecoration });
		if (marks[0].to < marks[marks.length - 1].from) {
			ctx.items.push({ from: marks[0].to, to: marks[marks.length - 1].from, deco: isSuper ? DECO_SUPERSCRIPT : DECO_SUBSCRIPT });
		}
		ctx.items.push({ from: marks[marks.length - 1].from, to: marks[marks.length - 1].to, deco: invisibleDecoration });
	}
}

/**
 * Theme for inline styles.
 */
export const inlineStylesTheme = EditorView.baseTheme({
	'.cm-highlight': {
		backgroundColor: 'var(--cm-highlight-background, rgba(255, 235, 59, 0.4))',
		borderRadius: '2px'
	},
	'.cm-inline-code': {
		backgroundColor: 'var(--cm-inline-code-bg)',
		borderRadius: '0.25rem',
		padding: '0.1rem 0.3rem',
		fontFamily: 'var(--voidraft-font-mono)'
	},
	'.cm-insert': {
		textDecoration: 'underline'
	},
	'.cm-superscript': {
		verticalAlign: 'super',
		fontSize: '0.75em',
		color: 'inherit'
	},
	'.cm-subscript': {
		verticalAlign: 'sub',
		fontSize: '0.75em',
		color: 'inherit'
	}
});
