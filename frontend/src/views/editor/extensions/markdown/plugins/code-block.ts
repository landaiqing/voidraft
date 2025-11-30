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
import { codeblock as classes, codeblockEnhanced as enhancedClasses } from '../classes';

/** Code block node types in syntax tree */
const CODE_BLOCK_TYPES = ['FencedCode', 'CodeBlock'] as const;

/** Copy button icon SVGs (size controlled by CSS) */
const ICON_COPY = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
const ICON_CHECK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

/** Cache for code block metadata */
interface CodeBlockData {
	from: number;
	to: number;
	language: string;
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
 * Uses ignoreEvent: true to prevent editor focus changes.
 */
class CodeBlockInfoWidget extends WidgetType {
	constructor(readonly data: CodeBlockData) {
		super();
	}

	eq(other: CodeBlockInfoWidget): boolean {
		return other.data.from === this.data.from &&
			other.data.language === this.data.language;
	}

	toDOM(): HTMLElement {
		const container = document.createElement('span');
		container.className = enhancedClasses.info;
		container.dataset.codeFrom = String(this.data.from);

		// Language label
		const lang = document.createElement('span');
		lang.className = enhancedClasses.lang;
		lang.textContent = this.data.language;

		// Copy button
		const btn = document.createElement('button');
		btn.className = enhancedClasses.copyBtn;
		btn.title = 'Copy';
		btn.innerHTML = ICON_COPY;
		btn.dataset.codeContent = this.data.content;

		container.append(lang, btn);
		return container;
	}

	// Critical: ignore all events to prevent editor focus
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

				// Line decorations
				for (let num = startLine.number; num <= endLine.number; num++) {
					const line = view.state.doc.line(num);
					const pos: string[] = [];
					if (num === startLine.number) pos.push(classes.widgetBegin);
					if (num === endLine.number) pos.push(classes.widgetEnd);

					decorations.push(
						Decoration.line({
							class: `${classes.widget} ${pos.join(' ')}`.trim()
						}).range(line.from)
					);
				}

				// Info widget (only if language specified)
				if (language) {
					const content = getCodeContent(view, nodeFrom, nodeTo);
					const data: CodeBlockData = { from: nodeFrom, to: nodeTo, language, content };
					blocks.set(nodeFrom, data);

					decorations.push(
						Decoration.widget({
							widget: new CodeBlockInfoWidget(data),
							side: 1
						}).range(startLine.to)
					);
				}

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
 * Handle copy button click.
 */
function handleCopyClick(btn: HTMLButtonElement): void {
	const content = btn.dataset.codeContent;
	if (!content) return;

	navigator.clipboard.writeText(content).then(() => {
		btn.innerHTML = ICON_CHECK;
		setTimeout(() => {
			btn.innerHTML = ICON_COPY;
		}, 1500);
	});
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
	decorations: (v) => v.decorations,

	eventHandlers: {
		// Handle copy button clicks without triggering editor focus
		mousedown(e: MouseEvent, view: EditorView) {
			const target = e.target as HTMLElement;

			// Check if clicked on copy button or its SVG child
			const btn = target.closest(`.${enhancedClasses.copyBtn}`) as HTMLButtonElement;
			if (btn) {
				e.preventDefault();
				e.stopPropagation();
				handleCopyClick(btn);
				return true;
			}

			// Check if clicked on info container (language label)
			if (target.closest(`.${enhancedClasses.info}`)) {
				e.preventDefault();
				e.stopPropagation();
				return true;
			}

			return false;
		}
	}
});

/**
 * Base theme for code blocks.
 */
const baseTheme = EditorView.baseTheme({
	[`.${classes.widget}`]: {
		backgroundColor: 'var(--cm-codeblock-bg)'
	},
	[`.${classes.widgetBegin}`]: {
		borderTopLeftRadius: 'var(--cm-codeblock-radius)',
		borderTopRightRadius: 'var(--cm-codeblock-radius)',
		position: 'relative',
        borderTop: '1px solid var(--text-primary)'
	},
	[`.${classes.widgetEnd}`]: {
		borderBottomLeftRadius: 'var(--cm-codeblock-radius)',
		borderBottomRightRadius: 'var(--cm-codeblock-radius)',
        borderBottom: '1px solid var(--text-primary)'
	},
	// Info container
	[`.${enhancedClasses.info}`]: {
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
	[`.${enhancedClasses.info}:hover`]: {
		opacity: '1'
	},
	// Language label
	[`.${enhancedClasses.lang}`]: {
		color: 'var(--cm-codeblock-lang, var(--cm-foreground))',
		textTransform: 'lowercase',
		userSelect: 'none'
	},
	// Copy button
	[`.${enhancedClasses.copyBtn}`]: {
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
	[`.${enhancedClasses.copyBtn}:hover`]: {
		opacity: '1',
		background: 'rgba(128, 128, 128, 0.2)'
	},
	[`.${enhancedClasses.copyBtn} svg`]: {
		width: '1em',
		height: '1em'
	}
});
