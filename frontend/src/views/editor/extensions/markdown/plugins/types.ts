/**
 * Shared types for unified markdown plugin handlers.
 */

import { Decoration, EditorView } from '@codemirror/view';
import { RangeTuple } from '../util';
import { SyntaxNode } from '@lezer/common';

/** Decoration item to be added */
export interface DecoItem {
	from: number;
	to: number;
	deco: Decoration;
	priority?: number;
}

/** Shared build context passed to all handlers */
export interface BuildContext {
	view: EditorView;
	items: DecoItem[];
	selRange: RangeTuple;
	seen: Set<number>;
	processedLines: Set<number>;
	contentWidth: number;
	lineHeight: number;
}

/** Handler function type */
export type NodeHandler = (
	ctx: BuildContext,
	nf: number,
	nt: number,
	node: SyntaxNode,
	inCursor: boolean,
	ranges: RangeTuple[]
) => void | boolean;
