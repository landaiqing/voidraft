/**
 * Blockquote handler and theme.
 */

import { Decoration, EditorView } from '@codemirror/view';
import { invisibleDecoration, RangeTuple } from '../util';
import { SyntaxNode } from '@lezer/common';
import { BuildContext } from './types';

const DECO_BLOCKQUOTE_LINE = Decoration.line({ class: 'cm-blockquote' });

/**
 * Handle Blockquote node.
 */
export function handleBlockquote(
	ctx: BuildContext,
	nf: number,
	nt: number,
	node: SyntaxNode,
	inCursor: boolean,
	ranges: RangeTuple[]
): boolean {
	if (ctx.seen.has(nf)) return false;
	ctx.seen.add(nf);
	ranges.push([nf, nt]);
	if (inCursor) return false;

	const startLine = ctx.view.state.doc.lineAt(nf).number;
	const endLine = ctx.view.state.doc.lineAt(nt).number;
	for (let i = startLine; i <= endLine; i++) {
		if (!ctx.processedLines.has(i)) {
			ctx.processedLines.add(i);
			ctx.items.push({ from: ctx.view.state.doc.line(i).from, to: ctx.view.state.doc.line(i).from, deco: DECO_BLOCKQUOTE_LINE });
		}
	}

	// Use TreeCursor to traverse all descendant QuoteMarks
	// getChildren() only returns direct children, but QuoteMarks may be nested
	// deeper in the syntax tree (e.g., in nested blockquotes for empty lines)
	// cursor.next() is the official Lezer API for depth-first tree traversal
	const cursor = node.cursor();
	while (cursor.next() && cursor.to <= nt) {
		if (cursor.name === 'QuoteMark') {
			ctx.items.push({ from: cursor.from, to: cursor.to, deco: invisibleDecoration });
		}
	}
	return false;
}

/**
 * Theme for blockquotes.
 */
export const blockquoteTheme = EditorView.baseTheme({
	'.cm-blockquote': {
		borderLeft: '4px solid var(--cm-blockquote-border, #ccc)',
		color: 'var(--cm-blockquote-color, #666)'
	}
});
