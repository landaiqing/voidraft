/**
 * Footnote handlers and theme.
 * Handles: FootnoteDefinition, FootnoteReference, InlineFootnote
 */

import { Decoration, EditorView, WidgetType } from '@codemirror/view';
import { invisibleDecoration, RangeTuple } from '../util';
import { SyntaxNode } from '@lezer/common';
import { BuildContext } from './types';

/** Extended context for footnotes */
export interface FootnoteContext extends BuildContext {
	definitionIds: Set<string>;
	pendingRefs: { from: number; to: number; id: string; index: number }[];
	pendingInlines: { from: number; to: number; index: number }[];
	seenIds: Map<string, number>;
	inlineFootnoteIdx: number;
}

class FootnoteRefWidget extends WidgetType {
	constructor(readonly index: number, readonly hasDefinition: boolean) { super(); }
	eq(other: FootnoteRefWidget) { return this.index === other.index && this.hasDefinition === other.hasDefinition; }
	toDOM(): HTMLElement {
		const span = document.createElement('span');
		span.className = 'cm-footnote-ref';
		span.textContent = `[${this.index}]`;
		if (!this.hasDefinition) span.classList.add('cm-footnote-ref-undefined');
		return span;
	}
	ignoreEvent() { return false; }
}

class InlineFootnoteWidget extends WidgetType {
	constructor(readonly index: number) { super(); }
	eq(other: InlineFootnoteWidget) { return this.index === other.index; }
	toDOM(): HTMLElement {
		const span = document.createElement('span');
		span.className = 'cm-inline-footnote-ref';
		span.textContent = `[${this.index}]`;
		return span;
	}
	ignoreEvent() { return false; }
}

class FootnoteDefLabelWidget extends WidgetType {
	constructor(readonly id: string) { super(); }
	eq(other: FootnoteDefLabelWidget) { return this.id === other.id; }
	toDOM(): HTMLElement {
		const span = document.createElement('span');
		span.className = 'cm-footnote-def-label';
		span.textContent = `[${this.id}]`;
		return span;
	}
	ignoreEvent() { return false; }
}

/**
 * Handle FootnoteDefinition node.
 */
export function handleFootnoteDefinition(
	ctx: FootnoteContext,
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

	const marks = node.getChildren('FootnoteDefinitionMark');
	const labelNode = node.getChild('FootnoteDefinitionLabel');
	if (marks.length >= 2 && labelNode) {
		const id = ctx.view.state.sliceDoc(labelNode.from, labelNode.to);
		ctx.definitionIds.add(id);
		ctx.items.push({ from: marks[0].from, to: marks[1].to, deco: invisibleDecoration });
		ctx.items.push({ from: marks[1].to, to: marks[1].to, deco: Decoration.widget({ widget: new FootnoteDefLabelWidget(id), side: 1 }), priority: 1 });
	}
}

/**
 * Handle FootnoteReference node.
 */
export function handleFootnoteReference(
	ctx: FootnoteContext,
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

	const labelNode = node.getChild('FootnoteReferenceLabel');
	const marks = node.getChildren('FootnoteReferenceMark');
	if (labelNode && marks.length >= 2) {
		const id = ctx.view.state.sliceDoc(labelNode.from, labelNode.to);
		if (!ctx.seenIds.has(id)) ctx.seenIds.set(id, ctx.seenIds.size + 1);
		ctx.pendingRefs.push({ from: nf, to: nt, id, index: ctx.seenIds.get(id)! });
	}
}

/**
 * Handle InlineFootnote node.
 */
export function handleInlineFootnote(
	ctx: FootnoteContext,
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

	const contentNode = node.getChild('InlineFootnoteContent');
	const marks = node.getChildren('InlineFootnoteMark');
	if (contentNode && marks.length >= 2) {
		ctx.inlineFootnoteIdx++;
		ctx.pendingInlines.push({ from: nf, to: nt, index: ctx.inlineFootnoteIdx });
	}
}

/**
 * Process pending footnote refs after all definitions are collected.
 */
export function processPendingFootnotes(ctx: FootnoteContext): void {
	for (const ref of ctx.pendingRefs) {
		ctx.items.push({ from: ref.from, to: ref.to, deco: invisibleDecoration });
		ctx.items.push({ from: ref.to, to: ref.to, deco: Decoration.widget({ widget: new FootnoteRefWidget(ref.index, ctx.definitionIds.has(ref.id)), side: 1 }), priority: 1 });
	}
	for (const inline of ctx.pendingInlines) {
		ctx.items.push({ from: inline.from, to: inline.to, deco: invisibleDecoration });
		ctx.items.push({ from: inline.to, to: inline.to, deco: Decoration.widget({ widget: new InlineFootnoteWidget(inline.index), side: 1 }), priority: 1 });
	}
}

/**
 * Theme for footnotes.
 */
export const footnoteTheme = EditorView.baseTheme({
	'.cm-footnote-ref': {
		display: 'inline-flex',
		alignItems: 'center',
		justifyContent: 'center',
		minWidth: '1em',
		height: '1.2em',
		padding: '0 0.25em',
		marginLeft: '1px',
		fontSize: '0.75em',
		fontWeight: '500',
		lineHeight: '1',
		verticalAlign: 'super',
		color: 'var(--cm-footnote-color, #1a73e8)',
		backgroundColor: 'var(--cm-footnote-bg, rgba(26, 115, 232, 0.1))',
		borderRadius: '3px'
	},
	'.cm-footnote-ref-undefined': {
		color: 'var(--cm-footnote-undefined-color, #d93025)',
		backgroundColor: 'var(--cm-footnote-undefined-bg, rgba(217, 48, 37, 0.1))'
	},
	'.cm-inline-footnote-ref': {
		display: 'inline-flex',
		alignItems: 'center',
		justifyContent: 'center',
		minWidth: '1em',
		height: '1.2em',
		padding: '0 0.25em',
		marginLeft: '1px',
		fontSize: '0.75em',
		fontWeight: '500',
		lineHeight: '1',
		verticalAlign: 'super',
		color: 'var(--cm-inline-footnote-color, #e67e22)',
		backgroundColor: 'var(--cm-inline-footnote-bg, rgba(230, 126, 34, 0.1))',
		borderRadius: '3px'
	},
	'.cm-footnote-def-label': {
		color: 'var(--cm-footnote-def-color, #1a73e8)',
		fontWeight: '600'
	}
});
