import { Extension, Range } from '@codemirror/state';
import {
	ViewPlugin,
	DecorationSet,
	Decoration,
	EditorView,
	ViewUpdate,
	WidgetType
} from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { isCursorInRange } from '../util';

/** Code block node types in syntax tree */
const CODE_BLOCK_TYPES = ['FencedCode', 'CodeBlock'] as const;

/** Copy button icon SVGs (size controlled by CSS) */
const ICON_COPY = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
const ICON_CHECK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

/** Cache for code block metadata */
interface CodeBlockData {
	from: number;
	to: number;
	language: string | null;
	content: string;
}

/**
 * Code block extension with language label and copy button.
 * 
 * Features:
 * - Adds background styling to code blocks
 * - Shows language label + copy button when language is specified
 * - Hides markers when cursor is outside block
 * - Optimized with viewport-only rendering
 */
export const codeblock = (): Extension => [codeBlockPlugin, baseTheme];

/**
 * Widget for displaying language label and copy button.
 * Handles click events directly on the button element.
 */
class CodeBlockInfoWidget extends WidgetType {
	constructor(
		readonly data: CodeBlockData,
		readonly view: EditorView
	) {
		super();
	}

	eq(other: CodeBlockInfoWidget): boolean {
		return other.data.from === this.data.from &&
			other.data.language === this.data.language;
	}

	toDOM(): HTMLElement {
		const container = document.createElement('span');
		container.className = 'cm-code-block-info';

		// Only show language label if specified
		if (this.data.language) {
			const lang = document.createElement('span');
			lang.className = 'cm-code-block-lang';
			lang.textContent = this.data.language;
			container.append(lang);
		}

		const btn = document.createElement('button');
		btn.className = 'cm-code-block-copy-btn';
		btn.title = 'Copy';
		btn.innerHTML = ICON_COPY;

		// Direct click handler - more reliable than eventHandlers
		btn.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.handleCopy(btn);
		});

		// Prevent mousedown from affecting editor
		btn.addEventListener('mousedown', (e) => {
			e.preventDefault();
			e.stopPropagation();
		});

		container.append(btn);
		return container;
	}

	private handleCopy(btn: HTMLButtonElement): void {
		const content = getCodeContent(this.view, this.data.from, this.data.to);
		if (!content) return;

		navigator.clipboard.writeText(content).then(() => {
			btn.innerHTML = ICON_CHECK;
			setTimeout(() => {
				btn.innerHTML = ICON_COPY;
			}, 1500);
		});
	}

	// Ignore events to prevent editor focus changes
	ignoreEvent(): boolean {
		return true;
	}
}

/**
 * Extract language from code block node.
 */
function getLanguage(view: EditorView, node: any, offset: number): string | null {
	let lang: string | null = null;
	node.toTree().iterate({
		enter: ({ type, from, to }) => {
			if (type.name === 'CodeInfo') {
				lang = view.state.doc.sliceString(offset + from, offset + to).trim();
			}
		}
	});
	return lang;
}

/**
 * Extract code content (without fence markers).
 */
function getCodeContent(view: EditorView, from: number, to: number): string {
	const lines = view.state.doc.sliceString(from, to).split('\n');
	return lines.length >= 2 ? lines.slice(1, -1).join('\n') : '';
}

/**
 * Build decorations for visible code blocks.
 */
function buildDecorations(view: EditorView): { decorations: DecorationSet; blocks: Map<number, CodeBlockData> } {
	const decorations: Range<Decoration>[] = [];
	const blocks = new Map<number, CodeBlockData>();
	const seen = new Set<string>();

	for (const { from, to } of view.visibleRanges) {
		syntaxTree(view.state).iterate({
			from,
			to,
			enter: ({ type, from: nodeFrom, to: nodeTo, node }) => {
				if (!CODE_BLOCK_TYPES.includes(type.name as any)) return;

				const key = `${nodeFrom}:${nodeTo}`;
				if (seen.has(key)) return;
				seen.add(key);

				const inBlock = isCursorInRange(view.state, [nodeFrom, nodeTo]);
				if (inBlock) return;

				const language = getLanguage(view, node, nodeFrom);
				const startLine = view.state.doc.lineAt(nodeFrom);
				const endLine = view.state.doc.lineAt(nodeTo);

				for (let num = startLine.number; num <= endLine.number; num++) {
					const line = view.state.doc.line(num);
					const pos: string[] = ['cm-codeblock'];
					if (num === startLine.number) pos.push('cm-codeblock-begin');
					if (num === endLine.number) pos.push('cm-codeblock-end');

					decorations.push(
						Decoration.line({ class: pos.join(' ') }).range(line.from)
					);
				}

				// Info widget with copy button (always show, language label only if specified)
				const content = getCodeContent(view, nodeFrom, nodeTo);
				const data: CodeBlockData = { from: nodeFrom, to: nodeTo, language, content };
				blocks.set(nodeFrom, data);

				decorations.push(
					Decoration.widget({
						widget: new CodeBlockInfoWidget(data, view),
						side: 1
					}).range(startLine.to)
				);

				// Hide markers
				node.toTree().iterate({
					enter: ({ type: t, from: f, to: t2 }) => {
						if (t.name === 'CodeInfo' || t.name === 'CodeMark') {
							decorations.push(Decoration.replace({}).range(nodeFrom + f, nodeFrom + t2));
						}
					}
				});
			}
		});
	}

	return { decorations: Decoration.set(decorations, true), blocks };
}

/**
 * Code block plugin with optimized updates.
 */
class CodeBlockPluginClass {
	decorations: DecorationSet;
	blocks: Map<number, CodeBlockData>;
	private lastHead = -1;

	constructor(view: EditorView) {
		const result = buildDecorations(view);
		this.decorations = result.decorations;
		this.blocks = result.blocks;
		this.lastHead = view.state.selection.main.head;
	}

	update(update: ViewUpdate): void {
		const { docChanged, viewportChanged, selectionSet } = update;

		// Skip rebuild if cursor stayed on same line
		if (selectionSet && !docChanged && !viewportChanged) {
			const newHead = update.state.selection.main.head;
			const oldLine = update.startState.doc.lineAt(this.lastHead).number;
			const newLine = update.state.doc.lineAt(newHead).number;

			if (oldLine === newLine) {
				this.lastHead = newHead;
				return;
			}
		}

		if (docChanged || viewportChanged || selectionSet) {
			const result = buildDecorations(update.view);
			this.decorations = result.decorations;
			this.blocks = result.blocks;
			this.lastHead = update.state.selection.main.head;
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
		backgroundColor: 'var(--cm-codeblock-bg)'
	},
	'.cm-codeblock-begin': {
		borderTopLeftRadius: 'var(--cm-codeblock-radius)',
		borderTopRightRadius: 'var(--cm-codeblock-radius)',
		position: 'relative',
		boxShadow: 'inset 0 1px 0 var(--text-primary)'
	},
	'.cm-codeblock-end': {
		borderBottomLeftRadius: 'var(--cm-codeblock-radius)',
		borderBottomRightRadius: 'var(--cm-codeblock-radius)',
		boxShadow: 'inset 0 -1px 0 var(--text-primary)'
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
