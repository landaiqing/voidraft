/**
 * Math handlers and theme.
 * Handles: InlineMath, BlockMath
 */

import { Decoration, EditorView, WidgetType } from '@codemirror/view';
import { invisibleDecoration, RangeTuple } from '../util';
import { SyntaxNode } from '@lezer/common';
import { BuildContext } from './types';
import katex from 'katex';
import 'katex/dist/katex.min.css';

class InlineMathWidget extends WidgetType {
	constructor(readonly latex: string) { super(); }
	eq(other: InlineMathWidget) { return this.latex === other.latex; }
	toDOM(): HTMLElement {
		const span = document.createElement('span');
		span.className = 'cm-inline-math';
		try {
			span.innerHTML = katex.renderToString(this.latex, { throwOnError: true, displayMode: false, output: 'html' });
		} catch (e) {
			span.textContent = this.latex;
			span.title = e instanceof Error ? e.message : 'Render error';
		}
		return span;
	}
	ignoreEvent() { return false; }
}

class BlockMathWidget extends WidgetType {
	constructor(readonly latex: string, readonly lineCount: number, readonly lineHeight: number) { super(); }
	eq(other: BlockMathWidget) { return this.latex === other.latex && this.lineCount === other.lineCount; }
	toDOM(): HTMLElement {
		const container = document.createElement('div');
		container.className = 'cm-block-math-container';
		container.style.height = `${this.lineCount * this.lineHeight}px`;
		const inner = document.createElement('div');
		inner.className = 'cm-block-math';
		try {
			inner.innerHTML = katex.renderToString(this.latex, { throwOnError: false, displayMode: true, output: 'html' });
		} catch (e) {
			inner.textContent = this.latex;
			inner.title = e instanceof Error ? e.message : 'Render error';
		}
		container.appendChild(inner);
		return container;
	}
	ignoreEvent() { return false; }
}

const DECO_BLOCK_MATH_LINE = Decoration.line({ class: 'cm-block-math-line' });
const DECO_BLOCK_MATH_HIDDEN = Decoration.mark({ class: 'cm-block-math-content-hidden' });

/**
 * Handle InlineMath node ($...$).
 */
export function handleInlineMath(
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

	const marks = node.getChildren('InlineMathMark');
	if (marks.length >= 2) {
		const latex = ctx.view.state.sliceDoc(marks[0].to, marks[marks.length - 1].from);
		ctx.items.push({ from: nf, to: nt, deco: invisibleDecoration });
		ctx.items.push({ from: nt, to: nt, deco: Decoration.widget({ widget: new InlineMathWidget(latex), side: 1 }), priority: 1 });
	}
}

/**
 * Handle BlockMath node ($$...$$).
 */
export function handleBlockMath(
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

	const marks = node.getChildren('BlockMathMark');
	if (marks.length >= 2) {
		const latex = ctx.view.state.sliceDoc(marks[0].to, marks[marks.length - 1].from).trim();
		const startLine = ctx.view.state.doc.lineAt(nf);
		const endLine = ctx.view.state.doc.lineAt(nt);
		const lineCount = endLine.number - startLine.number + 1;
		if (lineCount > 1) {
			for (let num = startLine.number; num <= endLine.number; num++) {
				ctx.items.push({ from: ctx.view.state.doc.line(num).from, to: ctx.view.state.doc.line(num).from, deco: DECO_BLOCK_MATH_LINE });
			}
			ctx.items.push({ from: startLine.from, to: startLine.from, deco: Decoration.widget({ widget: new BlockMathWidget(latex, lineCount, ctx.lineHeight), side: -1 }), priority: -1 });
		} else {
			ctx.items.push({ from: nf, to: nt, deco: DECO_BLOCK_MATH_HIDDEN });
			ctx.items.push({ from: nf, to: nf, deco: Decoration.widget({ widget: new BlockMathWidget(latex, 1, ctx.lineHeight), side: -1 }), priority: -1 });
		}
	}
}

/**
 * Theme for math.
 */
export const mathTheme = EditorView.baseTheme({
	'.cm-inline-math': {
		display: 'inline',
		verticalAlign: 'baseline'
	},
	'.cm-inline-math .katex': {
		fontSize: 'inherit'
	},
	'.cm-block-math-container': {
		position: 'absolute',
		left: '0',
		right: '0',
		display: 'flex',
		justifyContent: 'center',
		alignItems: 'center',
		pointerEvents: 'none',
		zIndex: '1'
	},
	'.cm-block-math': {
		display: 'inline-block',
		textAlign: 'center',
		pointerEvents: 'auto'
	},
	'.cm-block-math .katex-display': {
		margin: '0'
	},
	'.cm-block-math .katex': {
		fontSize: '1.1em'
	},
	'.cm-line.cm-block-math-line': {
		color: 'transparent !important',
		caretColor: 'transparent'
	},
	'.cm-line.cm-block-math-line span': {
		color: 'transparent !important'
	},
	'.cm-line.cm-block-math-line [class*="cm-rainbow-bracket"]': {
		color: 'transparent !important'
	},
	'.cm-block-math-content-hidden': {
		color: 'transparent !important'
	},
	'.cm-block-math-content-hidden span': {
		color: 'transparent !important'
	},
	'.cm-block-math-content-hidden [class*="cm-rainbow-bracket"]': {
		color: 'transparent !important'
	}
});
