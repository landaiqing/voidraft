import { Extension, RangeSetBuilder } from '@codemirror/state';
import {
	ViewPlugin,
	DecorationSet,
	Decoration,
	EditorView,
	ViewUpdate,
	WidgetType
} from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { checkRangeOverlap, invisibleDecoration, RangeTuple } from '../util';

/** Code block node types in syntax tree */
const CODE_BLOCK_TYPES = new Set(['FencedCode', 'CodeBlock']);

/** Copy button icon SVGs */
const ICON_COPY = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
const ICON_CHECK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

/** Pre-computed line decoration classes */
const LINE_DECO_NORMAL = Decoration.line({ class: 'cm-codeblock' });
const LINE_DECO_BEGIN = Decoration.line({ class: 'cm-codeblock cm-codeblock-begin' });
const LINE_DECO_END = Decoration.line({ class: 'cm-codeblock cm-codeblock-end' });
const LINE_DECO_SINGLE = Decoration.line({ class: 'cm-codeblock cm-codeblock-begin cm-codeblock-end' });

/** Code block metadata for widget */
interface CodeBlockMeta {
	from: number;
	to: number;
	language: string | null;
}

/**
 * Code block extension with language label and copy button.
 * 
 * Features:
 * - Adds background styling to code blocks
 * - Shows language label + copy button when language is specified
 * - Hides markers when cursor is outside block
 * - Optimized with viewport-only rendering and minimal rebuilds
 */
export const codeblock = (): Extension => [codeBlockPlugin, baseTheme];

/**
 * Widget for displaying language label and copy button.
 * Content is computed lazily on copy action.
 */
class CodeBlockInfoWidget extends WidgetType {
	constructor(readonly meta: CodeBlockMeta) {
		super();
	}

	eq(other: CodeBlockInfoWidget): boolean {
		return other.meta.from === this.meta.from &&
			other.meta.language === this.meta.language;
	}

	toDOM(view: EditorView): HTMLElement {
		const container = document.createElement('span');
		container.className = 'cm-code-block-info';

		if (this.meta.language) {
			const lang = document.createElement('span');
			lang.className = 'cm-code-block-lang';
			lang.textContent = this.meta.language;
			container.append(lang);
		}

		const btn = document.createElement('button');
		btn.className = 'cm-code-block-copy-btn';
		btn.title = 'Copy';
		btn.innerHTML = ICON_COPY;

		btn.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.copyContent(view, btn);
		});

		btn.addEventListener('mousedown', (e) => {
			e.preventDefault();
			e.stopPropagation();
		});

		container.append(btn);
		return container;
	}

	/** Lazy content extraction and copy */
	private copyContent(view: EditorView, btn: HTMLButtonElement): void {
		const { from, to } = this.meta;
		const text = view.state.doc.sliceString(from, to);
		const lines = text.split('\n');
		const content = lines.length >= 2 ? lines.slice(1, -1).join('\n') : '';
		
		if (!content) return;

		navigator.clipboard.writeText(content).then(() => {
			btn.innerHTML = ICON_CHECK;
			setTimeout(() => {
				btn.innerHTML = ICON_COPY;
			}, 1500);
		});
	}

	ignoreEvent(): boolean {
		return true;
	}
}

/** Parsed code block info from single tree traversal */
interface ParsedBlock {
	from: number;
	to: number;
	language: string | null;
	marks: RangeTuple[]; // CodeMark and CodeInfo positions to hide
}

/**
 * Parse a code block node in a single traversal.
 * Extracts language and mark positions together.
 */
function parseCodeBlock(view: EditorView, nodeFrom: number, nodeTo: number, node: any): ParsedBlock {
	let language: string | null = null;
	const marks: RangeTuple[] = [];

	node.toTree().iterate({
		enter: ({ type, from, to }) => {
			const absFrom = nodeFrom + from;
			const absTo = nodeFrom + to;
			
			if (type.name === 'CodeInfo') {
				language = view.state.doc.sliceString(absFrom, absTo).trim();
				marks.push([absFrom, absTo]);
			} else if (type.name === 'CodeMark') {
				marks.push([absFrom, absTo]);
			}
		}
	});

	return { from: nodeFrom, to: nodeTo, language, marks };
}

/**
 * Find which code block the cursor is in (returns block start position, or -1 if not in any).
 */
function getCursorBlockPosition(view: EditorView, blocks: RangeTuple[]): number {
	const { ranges } = view.state.selection;
	for (const sel of ranges) {
		const selRange: RangeTuple = [sel.from, sel.to];
		for (const block of blocks) {
			if (checkRangeOverlap(selRange, block)) {
				return block[0]; // Return the block's start position as identifier
			}
		}
	}
	return -1;
}

/**
 * Collect all code block ranges in visible viewport.
 */
function collectCodeBlockRanges(view: EditorView): RangeTuple[] {
	const ranges: RangeTuple[] = [];
	const seen = new Set<number>();

	for (const { from, to } of view.visibleRanges) {
		syntaxTree(view.state).iterate({
			from,
			to,
			enter: ({ type, from: nodeFrom, to: nodeTo }) => {
				if (!CODE_BLOCK_TYPES.has(type.name)) return;
				if (seen.has(nodeFrom)) return;
				seen.add(nodeFrom);
				ranges.push([nodeFrom, nodeTo]);
			}
		});
	}

	return ranges;
}

/**
 * Build decorations for visible code blocks.
 * Uses RangeSetBuilder for efficient sorted construction.
 */
function buildDecorations(view: EditorView): DecorationSet {
	const builder = new RangeSetBuilder<Decoration>();
	const items: { pos: number; endPos?: number; deco: Decoration; isWidget?: boolean; isReplace?: boolean }[] = [];
	const seen = new Set<number>();

	for (const { from, to } of view.visibleRanges) {
		syntaxTree(view.state).iterate({
			from,
			to,
			enter: ({ type, from: nodeFrom, to: nodeTo, node }) => {
				if (!CODE_BLOCK_TYPES.has(type.name)) return;
				if (seen.has(nodeFrom)) return;
				seen.add(nodeFrom);

				// Check if cursor is in this block
				const inBlock = checkRangeOverlap(
					[nodeFrom, nodeTo],
					[view.state.selection.main.from, view.state.selection.main.to]
				);
				if (inBlock) return;

				// Parse block in single traversal
				const block = parseCodeBlock(view, nodeFrom, nodeTo, node);
				const startLine = view.state.doc.lineAt(nodeFrom);
				const endLine = view.state.doc.lineAt(nodeTo);

				// Add line decorations
				for (let num = startLine.number; num <= endLine.number; num++) {
					const line = view.state.doc.line(num);
					let deco: Decoration;
					
					if (startLine.number === endLine.number) {
						deco = LINE_DECO_SINGLE;
					} else if (num === startLine.number) {
						deco = LINE_DECO_BEGIN;
					} else if (num === endLine.number) {
						deco = LINE_DECO_END;
					} else {
						deco = LINE_DECO_NORMAL;
					}
					
					items.push({ pos: line.from, deco });
				}

				// Add info widget
				const meta: CodeBlockMeta = {
					from: nodeFrom,
					to: nodeTo,
					language: block.language
				};
				items.push({
					pos: startLine.to,
					deco: Decoration.widget({
						widget: new CodeBlockInfoWidget(meta),
						side: 1
					}),
					isWidget: true
				});

				// Hide marks
				for (const [mFrom, mTo] of block.marks) {
					items.push({ pos: mFrom, endPos: mTo, deco: invisibleDecoration, isReplace: true });
				}
			}
		});
	}

	// Sort by position and add to builder
	items.sort((a, b) => {
		if (a.pos !== b.pos) return a.pos - b.pos;
		// Widgets should come after line decorations at same position
		return (a.isWidget ? 1 : 0) - (b.isWidget ? 1 : 0);
	});

	for (const item of items) {
		if (item.isReplace && item.endPos !== undefined) {
			builder.add(item.pos, item.endPos, item.deco);
		} else {
			builder.add(item.pos, item.pos, item.deco);
		}
	}

	return builder.finish();
}

/**
 * Code block plugin with optimized update detection.
 */
class CodeBlockPluginClass {
	decorations: DecorationSet;
	private blockRanges: RangeTuple[] = [];
	private cursorBlockPos = -1; // Which block the cursor is in (-1 = none)

	constructor(view: EditorView) {
		this.blockRanges = collectCodeBlockRanges(view);
		this.cursorBlockPos = getCursorBlockPosition(view, this.blockRanges);
		this.decorations = buildDecorations(view);
	}

	update(update: ViewUpdate): void {
		const { docChanged, viewportChanged, selectionSet } = update;

		// Always rebuild on doc or viewport change
		if (docChanged || viewportChanged) {
			this.blockRanges = collectCodeBlockRanges(update.view);
			this.cursorBlockPos = getCursorBlockPosition(update.view, this.blockRanges);
			this.decorations = buildDecorations(update.view);
			return;
		}

		// For selection changes, only rebuild if cursor moves to a different block
		if (selectionSet) {
			const newBlockPos = getCursorBlockPosition(update.view, this.blockRanges);
			
			if (newBlockPos !== this.cursorBlockPos) {
				this.cursorBlockPos = newBlockPos;
				this.decorations = buildDecorations(update.view);
			}
		}
	}
}

const codeBlockPlugin = ViewPlugin.fromClass(CodeBlockPluginClass, {
	decorations: (v) => v.decorations
});

/**
 * Base theme for code blocks.
 */
const baseTheme = EditorView.baseTheme({
	'.cm-codeblock': {
		backgroundColor: 'var(--cm-codeblock-bg)',
		fontFamily: 'inherit',
	},
	'.cm-codeblock-begin': {
		borderTopLeftRadius: 'var(--cm-codeblock-radius)',
		borderTopRightRadius: 'var(--cm-codeblock-radius)',
		position: 'relative',
	},
	'.cm-codeblock-end': {
		borderBottomLeftRadius: 'var(--cm-codeblock-radius)',
		borderBottomRightRadius: 'var(--cm-codeblock-radius)',
	},
	'.cm-code-block-info': {
		position: 'absolute',
		right: '8px',
		top: '50%',
		transform: 'translateY(-50%)',
		display: 'inline-flex',
		alignItems: 'center',
		gap: '0.5em',
		zIndex: '5',
		opacity: '0.5',
		transition: 'opacity 0.15s'
	},
	'.cm-code-block-info:hover': {
		opacity: '1'
	},
	'.cm-code-block-lang': {
		color: 'var(--cm-codeblock-lang, var(--cm-foreground))',
		textTransform: 'lowercase',
		userSelect: 'none'
	},
	'.cm-code-block-copy-btn': {
		display: 'inline-flex',
		alignItems: 'center',
		justifyContent: 'center',
		padding: '0.15em',
		border: 'none',
		borderRadius: '2px',
		background: 'transparent',
		color: 'var(--cm-codeblock-lang, var(--cm-foreground))',
		cursor: 'pointer',
		opacity: '0.7',
		transition: 'opacity 0.15s, background 0.15s'
	},
	'.cm-code-block-copy-btn:hover': {
		opacity: '1',
		background: 'rgba(128, 128, 128, 0.2)'
	},
	'.cm-code-block-copy-btn svg': {
		width: '1em',
		height: '1em'
	}
});
