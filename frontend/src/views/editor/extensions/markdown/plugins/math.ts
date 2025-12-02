/**
 * Math plugin for CodeMirror using KaTeX.
 * 
 * Features:
 * - Renders inline math $...$ as inline formula
 * - Renders block math $$...$$ as block formula
 * - Block math: lines remain, content hidden, formula overlays on top
 * - Shows source when cursor is inside
 */

import { Extension, Range } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import {
	ViewPlugin,
	DecorationSet,
	Decoration,
	EditorView,
	ViewUpdate,
	WidgetType
} from '@codemirror/view';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { isCursorInRange, invisibleDecoration } from '../util';

// ============================================================================
// Inline Math Widget
// ============================================================================

/**
 * Widget to display inline math formula.
 */
class InlineMathWidget extends WidgetType {
	private html: string;
	private error: string | null = null;

	constructor(readonly latex: string) {
		super();
		try {
			this.html = katex.renderToString(latex, {
				throwOnError: true,
				displayMode: false,
				output: 'html'
			});
		} catch (e) {
			this.error = e instanceof Error ? e.message : 'Render error';
			this.html = '';
		}
	}

	toDOM(): HTMLElement {
		const span = document.createElement('span');
		span.className = 'cm-inline-math';
		
		if (this.error) {
			span.textContent = this.latex;
			span.title = this.error;
		} else {
			span.innerHTML = this.html;
		}
		
		return span;
	}

	eq(other: InlineMathWidget): boolean {
		return this.latex === other.latex;
	}

	ignoreEvent(): boolean {
		return false;
	}
}

// ============================================================================
// Block Math Widget
// ============================================================================

/**
 * Widget to display block math formula.
 * Uses absolute positioning to overlay on source lines.
 */
class BlockMathWidget extends WidgetType {
	private html: string;
	private error: string | null = null;

	constructor(
		readonly latex: string,
		readonly lineCount: number = 1,
		readonly lineHeight: number = 22
	) {
		super();
		try {
			this.html = katex.renderToString(latex, {
				throwOnError: false,
				displayMode: true,
				output: 'html'
			});
		} catch (e) {
			this.error = e instanceof Error ? e.message : 'Render error';
			this.html = '';
		}
	}

	toDOM(): HTMLElement {
		const container = document.createElement('div');
		container.className = 'cm-block-math-container';
		// Set height to cover all source lines
		const height = this.lineCount * this.lineHeight;
		container.style.height = `${height}px`;
		
		const inner = document.createElement('div');
		inner.className = 'cm-block-math';
		
		if (this.error) {
			inner.textContent = this.latex;
			inner.title = this.error;
		} else {
			inner.innerHTML = this.html;
		}
		
		container.appendChild(inner);
		return container;
	}

	eq(other: BlockMathWidget): boolean {
		return this.latex === other.latex && this.lineCount === other.lineCount;
	}

	ignoreEvent(): boolean {
		return false;
	}
}

// ============================================================================
// Decorations
// ============================================================================

/**
 * Build decorations for math formulas.
 */
function buildDecorations(view: EditorView): DecorationSet {
	const decorations: Range<Decoration>[] = [];

	for (const { from, to } of view.visibleRanges) {
		syntaxTree(view.state).iterate({
			from,
			to,
			enter: ({ type, from: nodeFrom, to: nodeTo, node }) => {
				// Handle inline math
				if (type.name === 'InlineMath') {
					const cursorInRange = isCursorInRange(view.state, [nodeFrom, nodeTo]);
					const marks = node.getChildren('InlineMathMark');

					if (!cursorInRange && marks.length >= 2) {
						// Get latex content (without $ marks)
						const latex = view.state.sliceDoc(marks[0].to, marks[marks.length - 1].from);
						
						// Hide the entire syntax
						decorations.push(invisibleDecoration.range(nodeFrom, nodeTo));
						
						// Add widget at the end
						decorations.push(
							Decoration.widget({
								widget: new InlineMathWidget(latex),
								side: 1
							}).range(nodeTo)
						);
					}
				}

				// Handle block math ($$...$$)
				if (type.name === 'BlockMath') {
					const cursorInRange = isCursorInRange(view.state, [nodeFrom, nodeTo]);
					const marks = node.getChildren('BlockMathMark');

					if (!cursorInRange && marks.length >= 2) {
						// Get latex content (without $$ marks)
						const latex = view.state.sliceDoc(marks[0].to, marks[marks.length - 1].from).trim();
						
						// Calculate line info
						const startLine = view.state.doc.lineAt(nodeFrom);
						const endLine = view.state.doc.lineAt(nodeTo);
						const lineCount = endLine.number - startLine.number + 1;
						const lineHeight = view.defaultLineHeight;
						
						// Check if block math spans multiple lines
						const hasLineBreak = lineCount > 1;
						
						if (hasLineBreak) {
							// For multi-line: use line decorations to hide content
							for (let lineNum = startLine.number; lineNum <= endLine.number; lineNum++) {
								const line = view.state.doc.line(lineNum);
								decorations.push(
									Decoration.line({
										class: 'cm-block-math-line'
									}).range(line.from)
								);
							}
							
							// Add widget on the first line (positioned absolutely)
							decorations.push(
								Decoration.widget({
									widget: new BlockMathWidget(latex, lineCount, lineHeight),
									side: -1
								}).range(startLine.from)
							);
						} else {
							// Single line: make content transparent, overlay widget
							decorations.push(
								Decoration.mark({
									class: 'cm-block-math-content-hidden'
								}).range(nodeFrom, nodeTo)
							);
							
							// Add widget at the start (positioned absolutely)
							decorations.push(
								Decoration.widget({
									widget: new BlockMathWidget(latex, 1, lineHeight),
									side: -1
								}).range(nodeFrom)
							);
						}
					}
				}
			}
		});
	}

	return Decoration.set(decorations, true);
}

// ============================================================================
// Plugin
// ============================================================================

/**
 * Math plugin with optimized update detection.
 */
class MathPlugin {
	decorations: DecorationSet;
	private lastSelectionHead: number = -1;

	constructor(view: EditorView) {
		this.decorations = buildDecorations(view);
		this.lastSelectionHead = view.state.selection.main.head;
	}

	update(update: ViewUpdate) {
		if (update.docChanged || update.viewportChanged) {
			this.decorations = buildDecorations(update.view);
			this.lastSelectionHead = update.state.selection.main.head;
			return;
		}

		if (update.selectionSet) {
			const newHead = update.state.selection.main.head;
			if (newHead !== this.lastSelectionHead) {
				this.decorations = buildDecorations(update.view);
				this.lastSelectionHead = newHead;
			}
		}
	}
}

const mathPlugin = ViewPlugin.fromClass(
	MathPlugin,
	{
		decorations: (v) => v.decorations
	}
);

// ============================================================================
// Theme
// ============================================================================

/**
 * Base theme for math.
 */
const baseTheme = EditorView.baseTheme({
	// Inline math
	'.cm-inline-math': {
		display: 'inline',
		verticalAlign: 'baseline',
	},
	'.cm-inline-math .katex': {
		fontSize: 'inherit',
	},
	
	// Block math container - absolute positioned to overlay on source
	'.cm-block-math-container': {
		position: 'absolute',
		left: '0',
		right: '0',
		display: 'flex',
		justifyContent: 'center',
		alignItems: 'center',
		pointerEvents: 'none',
		zIndex: '1',
	},
	
	// Block math inner
	'.cm-block-math': {
		display: 'inline-block',
		textAlign: 'center',
		pointerEvents: 'auto',
	},
	'.cm-block-math .katex-display': {
		margin: '0',
	},
	'.cm-block-math .katex': {
		fontSize: '1.1em',
	},
	
	// Hidden line content for block math (text transparent but line preserved)
	// Use high specificity to override rainbow brackets and other plugins
	'.cm-line.cm-block-math-line': {
		color: 'transparent !important',
		caretColor: 'transparent',
	},
	'.cm-line.cm-block-math-line span': {
		color: 'transparent !important',
	},
	// Override rainbow brackets in hidden math lines
	'.cm-line.cm-block-math-line [class*="cm-rainbow-bracket"]': {
		color: 'transparent !important',
	},
	
	// Hidden content for single-line block math
	'.cm-block-math-content-hidden': {
		color: 'transparent !important',
	},
	'.cm-block-math-content-hidden span': {
		color: 'transparent !important',
	},
	'.cm-block-math-content-hidden [class*="cm-rainbow-bracket"]': {
		color: 'transparent !important',
	},
});

// ============================================================================
// Export
// ============================================================================

/**
 * Math extension.
 * 
 * Features:
 * - Parses inline math $...$ and block math $$...$$
 * - Renders formulas using KaTeX
 * - Block math preserves line structure, overlays rendered formula
 * - Shows source when cursor is inside
 */
export const math = (): Extension => [
	mathPlugin,
	baseTheme
];

export default math;

