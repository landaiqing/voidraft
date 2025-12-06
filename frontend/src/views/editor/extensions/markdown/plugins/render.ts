import { Extension } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import {
	ViewPlugin,
	DecorationSet,
	Decoration,
	EditorView,
	ViewUpdate
} from '@codemirror/view';
import { SyntaxNodeRef } from '@lezer/common';
import { checkRangeOverlap, invisibleDecoration, RangeTuple } from '../util';
import { DecoItem } from './types';
import { blockState } from '@/views/editor/extensions/codeblock/state';
import { Block } from '@/views/editor/extensions/codeblock/types';

import { handleBlockquote } from './blockquote';
import { handleCodeBlock } from './code-block';
import { handleATXHeading, handleSetextHeading } from './heading';
import { handleHorizontalRule } from './horizontal-rule';
import { handleHighlight, handleInlineCode, handleEmphasis, handleInsert, handleScript } from './inline-styles';
import { handleURL } from './link';
import { handleListMark, handleTask } from './list';
import { handleFootnoteDefinition, handleFootnoteReference, handleInlineFootnote, processPendingFootnotes, FootnoteContext } from './footnote';
import { handleInlineMath, handleBlockMath } from './math';
import { handleEmoji } from './emoji';
import { handleTable } from './table';


interface BuildResult {
	decorations: DecorationSet;
	trackedRanges: RangeTuple[];
}

/**
 * Get markdown block ranges from visible ranges.
 * Only returns ranges that are within 'md' language blocks.
 */
function getMdBlockRanges(view: EditorView): { from: number; to: number }[] {
	const blocks = view.state.field(blockState, false);
	if (!blocks || blocks.length === 0) {
		// No blocks, treat entire document as md
		return view.visibleRanges.map(r => ({ from: r.from, to: r.to }));
	}

	// Filter md blocks
	const mdBlocks = blocks.filter((b: Block) => b.language.name === 'md');
	if (mdBlocks.length === 0) return [];

	// Intersect visible ranges with md block content ranges
	const result: { from: number; to: number }[] = [];
	for (const { from, to } of view.visibleRanges) {
		for (const block of mdBlocks) {
			const intersectFrom = Math.max(from, block.content.from);
			const intersectTo = Math.min(to, block.content.to);
			if (intersectFrom < intersectTo) {
				result.push({ from: intersectFrom, to: intersectTo });
			}
		}
	}
	return result;
}


function buildDecorationsAndRanges(view: EditorView): BuildResult {
	const { from: selFrom, to: selTo } = view.state.selection.main;
	
	// Create context with footnote extensions
	const ctx: FootnoteContext = {
		view,
		items: [],
		selRange: [selFrom, selTo],
		seen: new Set(),
		processedLines: new Set(),
		contentWidth: view.contentDOM.clientWidth - 10,
		lineHeight: view.defaultLineHeight,
		// Footnote state
		definitionIds: new Set(),
		pendingRefs: [],
		pendingInlines: [],
		seenIds: new Map(),
		inlineFootnoteIdx: 0
	};
	
	const trackedRanges: RangeTuple[] = [];

	// Only traverse md blocks (not other language blocks like js, py, etc.)
	const mdRanges = getMdBlockRanges(view);

	// Single traversal - dispatch to all handlers
	for (const { from, to } of mdRanges) {
		syntaxTree(view.state).iterate({
			from, to,
			enter: (nodeRef: SyntaxNodeRef) => {
				const { type, from: nf, to: nt, node } = nodeRef;
				const typeName = type.name;
				const inCursor = checkRangeOverlap([nf, nt], ctx.selRange);

				// Dispatch to handlers
				if (typeName === 'Blockquote') return handleBlockquote(ctx, nf, nt, node, inCursor, trackedRanges);
				if (typeName === 'FencedCode' || typeName === 'CodeBlock') return handleCodeBlock(ctx, nf, nt, node, inCursor, trackedRanges);
				if (typeName.startsWith('ATXHeading')) return handleATXHeading(ctx, nf, nt, node, inCursor, trackedRanges);
				if (typeName.startsWith('SetextHeading')) return handleSetextHeading(ctx, nf, nt, node, inCursor, trackedRanges);
				if (typeName === 'HorizontalRule') return handleHorizontalRule(ctx, nf, nt, inCursor, trackedRanges);
				if (typeName === 'Highlight') return handleHighlight(ctx, nf, nt, node, inCursor, trackedRanges);
				if (typeName === 'InlineCode') return handleInlineCode(ctx, nf, nt, inCursor, trackedRanges);
				if (typeName === 'Emphasis' || typeName === 'StrongEmphasis' || typeName === 'Strikethrough') return handleEmphasis(ctx, nf, nt, node, typeName, inCursor, trackedRanges);
				if (typeName === 'Insert') return handleInsert(ctx, nf, nt, node, inCursor, trackedRanges);
				if (typeName === 'Superscript' || typeName === 'Subscript') return handleScript(ctx, nf, nt, node, typeName, inCursor, trackedRanges);
				if (typeName === 'URL') return handleURL(ctx, nf, nt, node, trackedRanges);
				if (typeName === 'ListMark') return handleListMark(ctx, nf, nt, node, inCursor, trackedRanges);
				if (typeName === 'Task') return handleTask(ctx, nf, nt, node, trackedRanges);
				if (typeName === 'FootnoteDefinition') return handleFootnoteDefinition(ctx, nf, nt, node, inCursor, trackedRanges);
				if (typeName === 'FootnoteReference') return handleFootnoteReference(ctx, nf, nt, node, inCursor, trackedRanges);
				if (typeName === 'InlineFootnote') return handleInlineFootnote(ctx, nf, nt, node, inCursor, trackedRanges);
				if (typeName === 'InlineMath') return handleInlineMath(ctx, nf, nt, node, inCursor, trackedRanges);
				if (typeName === 'BlockMath') return handleBlockMath(ctx, nf, nt, node, inCursor, trackedRanges);
				if (typeName === 'Emoji') return handleEmoji(ctx, nf, nt, node, inCursor, trackedRanges);
				if (typeName === 'Table') return handleTable(ctx, nf, nt, node, inCursor, trackedRanges);
			}
		});
	}

	// Process pending footnotes
	processPendingFootnotes(ctx);

	// Sort and filter
	ctx.items.sort((a, b) => {
		if (a.from !== b.from) return a.from - b.from;
		if (a.to !== b.to) return a.to - b.to;
		return (a.priority || 0) - (b.priority || 0);
	});

	const result: DecoItem[] = [];
	let replaceMaxTo = -1;
	for (const item of ctx.items) {
		const isReplace = item.deco.spec?.widget !== undefined || item.deco === invisibleDecoration;
		if (item.from === item.to) {
			result.push(item);
		} else if (isReplace) {
			if (item.from >= replaceMaxTo) {
				result.push(item);
				replaceMaxTo = item.to;
			}
		} else {
			result.push(item);
		}
	}

	return {
		decorations: Decoration.set(result.map(r => r.deco.range(r.from, r.to)), true),
		trackedRanges
	};
}


class MarkdownRenderPlugin {
	decorations: DecorationSet;
	private trackedRanges: RangeTuple[] = [];
	private lastSelFrom = -1;
	private lastSelTo = -1;
	private lastWidth = 0;

	constructor(view: EditorView) {
		const result = buildDecorationsAndRanges(view);
		this.decorations = result.decorations;
		this.trackedRanges = result.trackedRanges;
		const { from, to } = view.state.selection.main;
		this.lastSelFrom = from;
		this.lastSelTo = to;
		this.lastWidth = view.contentDOM.clientWidth;
	}

	update(update: ViewUpdate) {
		const { docChanged, viewportChanged, selectionSet, geometryChanged } = update;
		const widthChanged = Math.abs(update.view.contentDOM.clientWidth - this.lastWidth) > 1;
		if (widthChanged) this.lastWidth = update.view.contentDOM.clientWidth;

		// Full rebuild for structural changes
		if (docChanged || viewportChanged || geometryChanged || widthChanged) {
			const result = buildDecorationsAndRanges(update.view);
			this.decorations = result.decorations;
			this.trackedRanges = result.trackedRanges;
			const { from, to } = update.state.selection.main;
			this.lastSelFrom = from;
			this.lastSelTo = to;
			return;
		}

		// Selection change handling with fine-grained detection
		if (selectionSet) {
			const { from, to } = update.state.selection.main;
			const isPointCursor = from === to;
			const wasPointCursor = this.lastSelFrom === this.lastSelTo;

			// Optimization: Point cursor moving within same tracked range - no rebuild needed
			if (isPointCursor && wasPointCursor) {
				const oldRange = this.findContainingRange(this.lastSelFrom);
				const newRange = this.findContainingRange(from);
				
				if (this.rangeSame(oldRange, newRange)) {
					this.lastSelFrom = from;
					this.lastSelTo = to;
					return;
				}
			}

			// Check if overlapping ranges changed
			const oldOverlaps = this.getOverlappingRanges(this.lastSelFrom, this.lastSelTo);
			const newOverlaps = this.getOverlappingRanges(from, to);
			
			this.lastSelFrom = from;
			this.lastSelTo = to;
			
			if (!this.rangesSame(oldOverlaps, newOverlaps)) {
				const result = buildDecorationsAndRanges(update.view);
				this.decorations = result.decorations;
				this.trackedRanges = result.trackedRanges;
			}
		}
	}

	private findContainingRange(pos: number): RangeTuple | null {
		for (const range of this.trackedRanges) {
			if (pos >= range[0] && pos <= range[1]) return range;
		}
		return null;
	}

	private rangeSame(a: RangeTuple | null, b: RangeTuple | null): boolean {
		if (a === null && b === null) return true;
		if (a === null || b === null) return false;
		return a[0] === b[0] && a[1] === b[1];
	}

	private getOverlappingRanges(from: number, to: number): RangeTuple[] {
		const selRange: RangeTuple = [from, to];
		return this.trackedRanges.filter(r => checkRangeOverlap(r, selRange));
	}

	private rangesSame(a: RangeTuple[], b: RangeTuple[]): boolean {
		if (a.length !== b.length) return false;
		for (let i = 0; i < a.length; i++) {
			if (a[i][0] !== b[i][0] || a[i][1] !== b[i][1]) return false;
		}
		return true;
	}
}

const renderPlugin = ViewPlugin.fromClass(MarkdownRenderPlugin, {
	decorations: (v) => v.decorations
});

export const render = (): Extension => [renderPlugin];
