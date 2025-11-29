import { Extension } from '@codemirror/state';
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

/**
 * Enhanced code block plugin with copy button and language label.
 *
 * This plugin adds:
 * - Language label display in the top-right corner
 * - Copy to clipboard button
 * - Enhanced visual styling for code blocks
 */
export const codeblockEnhanced = (): Extension => [
	codeBlockEnhancedPlugin,
	enhancedTheme
];

/**
 * Widget for code block info bar (language + copy button).
 */
class CodeBlockInfoWidget extends WidgetType {
	constructor(
		readonly language: string,
		readonly code: string
	) {
		super();
	}

	eq(other: CodeBlockInfoWidget) {
		return other.language === this.language && other.code === this.code;
	}

	toDOM(): HTMLElement {
		const container = document.createElement('div');
		container.className = 'cm-code-block-info';

		// Language label
		if (this.language) {
			const langLabel = document.createElement('span');
			langLabel.className = 'cm-code-block-lang';
			langLabel.textContent = this.language.toUpperCase();
			container.appendChild(langLabel);
		}

		// Copy button
		const copyButton = document.createElement('button');
		copyButton.className = 'cm-code-block-copy-btn';
		copyButton.title = 'Copy';
		copyButton.innerHTML = `
			<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" 
				fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
				<path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
			</svg>
		`;

		copyButton.onclick = async (e) => {
			e.preventDefault();
			e.stopPropagation();
			try {
				await navigator.clipboard.writeText(this.code);
				// Visual feedback
				copyButton.innerHTML = `
					<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" 
						fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<polyline points="20 6 9 17 4 12"/>
					</svg>
				`;
				setTimeout(() => {
					copyButton.innerHTML = `
						<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" 
							fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
							<path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
						</svg>
					`;
				}, 2000);
			} catch (err) {
				console.error('Failed to copy code:', err);
			}
		};

		container.appendChild(copyButton);
		return container;
	}

	ignoreEvent(): boolean {
		return true;
	}
}

/**
 * Plugin to add enhanced code block features.
 */
class CodeBlockEnhancedPlugin {
	decorations: DecorationSet;

	constructor(view: EditorView) {
		this.decorations = this.buildDecorations(view);
	}

	update(update: ViewUpdate) {
		if (update.docChanged || update.viewportChanged || update.selectionSet) {
			this.decorations = this.buildDecorations(update.view);
		}
	}

	private buildDecorations(view: EditorView): DecorationSet {
		const widgets: Array<ReturnType<Decoration['range']>> = [];

		for (const { from, to } of view.visibleRanges) {
			syntaxTree(view.state).iterate({
				from,
				to,
				enter: (node) => {
					if (node.name !== 'FencedCode') return;

					// Skip if cursor is in this code block
					if (isCursorInRange(view.state, [node.from, node.to])) return;

					// Extract language
					let language = '';
					const codeInfoNode = node.node.getChild('CodeInfo');
					if (codeInfoNode) {
						language = view.state.doc
							.sliceString(codeInfoNode.from, codeInfoNode.to)
							.trim();
					}

					// Extract code content (excluding fence markers)
					const firstLine = view.state.doc.lineAt(node.from);
					const lastLine = view.state.doc.lineAt(node.to);
					const codeStart = firstLine.to + 1;
					const codeEnd = lastLine.from - 1;
					const code = view.state.doc.sliceString(codeStart, codeEnd);

					// Add info widget at the first line
					const infoWidget = Decoration.widget({
						widget: new CodeBlockInfoWidget(language, code),
						side: 1
					});
					widgets.push(infoWidget.range(firstLine.to));
				}
			});
		}

		return Decoration.set(widgets, true);
	}
}

const codeBlockEnhancedPlugin = ViewPlugin.fromClass(CodeBlockEnhancedPlugin, {
	decorations: (v) => v.decorations
});

/**
 * Enhanced theme for code blocks.
 * Uses CSS variables from variables.css for consistent theming.
 */
const enhancedTheme = EditorView.baseTheme({
	'.cm-code-block-info': {
		float: 'right',
		display: 'flex',
		alignItems: 'center',
		gap: '0.4rem',
		padding: '0.15rem 0.3rem',
		opacity: '0.6',
		transition: 'opacity 0.15s ease'
	},
	'.cm-code-block-info:hover': {
		opacity: '1'
	},
	'.cm-code-block-lang': {
		fontFamily: 'var(--voidraft-font-mono)',
		fontSize: '0.7rem',
		fontWeight: '500',
		letterSpacing: '0.02em',
		color: 'var(--cm-codeblock-lang-color)'
	},
	'.cm-code-block-copy-btn': {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		border: 'none',
		backgroundColor: 'transparent',
		borderRadius: '0.2rem',
		cursor: 'pointer',
		color: 'var(--cm-codeblock-btn-color)',
		transition: 'background-color 0.15s ease, color 0.15s ease'
	},
	'.cm-code-block-copy-btn:hover': {
		// backgroundColor: 'var(--cm-codeblock-btn-hover-bg)',
		color: 'var(--cm-codeblock-btn-hover-color)'
	},
	'.cm-code-block-copy-btn svg': {
		width: '14px',
		height: '14px'
	}
});

