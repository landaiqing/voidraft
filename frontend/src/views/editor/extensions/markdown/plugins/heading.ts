/**
 * Heading handler and theme.
 */

import { Decoration, EditorView } from '@codemirror/view';
import { RangeTuple } from '../util';
import { SyntaxNode } from '@lezer/common';
import { BuildContext } from './types';

const DECO_HEADING_HIDDEN = Decoration.mark({ class: 'cm-heading-mark-hidden' });

/**
 * Handle ATXHeading node (# Heading).
 */
export function handleATXHeading(
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

	const header = node.firstChild;
	if (header && header.type.name === 'HeaderMark') {
		ctx.items.push({ from: header.from, to: Math.min(header.to + 1, nt), deco: DECO_HEADING_HIDDEN });
	}
}

/**
 * Handle SetextHeading node (underline style).
 */
export function handleSetextHeading(
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

	const headerMarks = node.getChildren('HeaderMark');
	for (const mark of headerMarks) {
		ctx.items.push({ from: mark.from, to: mark.to, deco: DECO_HEADING_HIDDEN });
	}
}

/**
 * Theme for headings.
 */
export const headingTheme = EditorView.baseTheme({
	'.cm-heading-mark-hidden': {
		fontSize: '0'
	}
});
