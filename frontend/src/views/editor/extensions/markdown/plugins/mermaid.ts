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
import { isCursorInRange } from '../util';
import mermaid from 'mermaid';

/**
 * Mermaid diagram preview plugin.
 *
 * This plugin detects mermaid code blocks and renders them as SVG diagrams.
 * Features:
 * - Detects ```mermaid code blocks
 * - Renders mermaid diagrams as inline SVG
 * - Shows the original code when cursor is in the block
 * - Caches rendered diagrams for performance
 * - Supports theme switching (dark/light)
 * - Supports all mermaid diagram types (flowchart, sequence, etc.)
 */
export const mermaidPreview = (): Extension => [
	mermaidPlugin,
	baseTheme
];

// Current mermaid theme
let currentMermaidTheme: 'default' | 'dark' = 'default';
let mermaidInitialized = false;

/**
 * Detect the current theme from the DOM.
 */
function detectTheme(): 'default' | 'dark' {
	const dataTheme = document.documentElement.getAttribute('data-theme');

	if (dataTheme === 'light') {
		return 'default';
	}

	if (dataTheme === 'dark') {
		return 'dark';
	}

	// For 'auto', check system preference
	if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
		return 'dark';
	}

	return 'default';
}

/**
 * Initialize mermaid with the specified theme.
 */
function initMermaid(theme: 'default' | 'dark' = currentMermaidTheme) {
	mermaid.initialize({
		startOnLoad: false,
		theme,
		securityLevel: 'strict',
		flowchart: {
			htmlLabels: true,
			curve: 'basis'
		},
		sequence: {
			showSequenceNumbers: false
		},
		logLevel: 'error'
	});

	currentMermaidTheme = theme;
	mermaidInitialized = true;
}

/**
 * Information about a mermaid code block.
 */
interface MermaidBlockInfo {
	/** Start position of the code block */
	from: number;
	/** End position of the code block */
	to: number;
	/** The mermaid code content */
	code: string;
	/** Unique ID for rendering */
	id: string;
}

/**
 * Cache for rendered mermaid diagrams.
 * Key is `${theme}:${code}` to support theme-specific caching.
 */
const renderCache = new Map<string, string>();

/**
 * Generate cache key for a diagram.
 */
function getCacheKey(code: string): string {
	return `${currentMermaidTheme}:${code}`;
}

/**
 * Generate a unique ID for a mermaid diagram.
 */
let idCounter = 0;
function generateId(): string {
	return `mermaid-${Date.now()}-${idCounter++}`;
}

/**
 * Extract mermaid code blocks from the visible ranges.
 */
function extractMermaidBlocks(view: EditorView): MermaidBlockInfo[] {
	const blocks: MermaidBlockInfo[] = [];

	for (const { from, to } of view.visibleRanges) {
		syntaxTree(view.state).iterate({
			from,
			to,
			enter: (node) => {
				if (node.name !== 'FencedCode') return;

				// Check if this is a mermaid code block
				const codeInfoNode = node.node.getChild('CodeInfo');
				if (!codeInfoNode) return;

				const language = view.state.doc
					.sliceString(codeInfoNode.from, codeInfoNode.to)
					.trim()
					.toLowerCase();

				if (language !== 'mermaid') return;

				// Extract the code content
				const firstLine = view.state.doc.lineAt(node.from);
				const lastLine = view.state.doc.lineAt(node.to);
				const codeStart = firstLine.to + 1;
				const codeEnd = lastLine.from - 1;

				if (codeStart >= codeEnd) return;

				const code = view.state.doc.sliceString(codeStart, codeEnd).trim();

				if (code) {
					blocks.push({
						from: node.from,
						to: node.to,
						code,
						id: generateId()
					});
				}
			}
		});
	}

	return blocks;
}

/**
 * Mermaid preview widget that renders the diagram.
 */
class MermaidPreviewWidget extends WidgetType {
	private svg: string | null = null;
	private error: string | null = null;
	private rendering = false;

	constructor(
		readonly code: string,
		readonly blockId: string
	) {
		super();
		// Check cache first (theme-specific)
		const cached = renderCache.get(getCacheKey(code));
		if (cached) {
			this.svg = cached;
		}
	}

	eq(other: MermaidPreviewWidget): boolean {
		return other.code === this.code;
	}

	toDOM(view: EditorView): HTMLElement {
		const container = document.createElement('div');
		container.className = 'cm-mermaid-preview';

		if (this.svg) {
			// Use cached SVG
			container.innerHTML = this.svg;
			this.setupSvgStyles(container);
		} else if (this.error) {
			// Show error
			const errorEl = document.createElement('div');
			errorEl.className = 'cm-mermaid-error';
			errorEl.textContent = `Mermaid Error: ${this.error}`;
			container.appendChild(errorEl);
		} else {
			// Show loading and start rendering
			const loading = document.createElement('div');
			loading.className = 'cm-mermaid-loading';
			loading.textContent = 'Rendering diagram...';
			container.appendChild(loading);

			// Render asynchronously
			if (!this.rendering) {
				this.rendering = true;
				this.renderMermaid(container, view);
			}
		}

		return container;
	}

	private async renderMermaid(container: HTMLElement, view: EditorView) {
		// Ensure mermaid is initialized with current theme
		const theme = detectTheme();
		if (!mermaidInitialized || currentMermaidTheme !== theme) {
			initMermaid(theme);
		}

		try {
			const { svg } = await mermaid.render(this.blockId, this.code);

			// Cache the result with theme-specific key
			renderCache.set(getCacheKey(this.code), svg);
			this.svg = svg;

			// Update the container
			container.innerHTML = svg;
			container.classList.remove('cm-mermaid-loading');
			this.setupSvgStyles(container);

			// Trigger a re-render to update decorations
			view.dispatch({});
		} catch (err) {
			this.error = err instanceof Error ? err.message : String(err);

			// Clear the loading state and show error
			container.innerHTML = '';
			const errorEl = document.createElement('div');
			errorEl.className = 'cm-mermaid-error';
			errorEl.textContent = `Mermaid Error: ${this.error}`;
			container.appendChild(errorEl);
		}
	}

	private setupSvgStyles(container: HTMLElement) {
		const svg = container.querySelector('svg');
		if (svg) {
			svg.style.maxWidth = '100%';
			svg.style.height = 'auto';
			svg.removeAttribute('height');
		}
	}

	ignoreEvent(): boolean {
		return true;
	}
}

/**
 * Build decorations for mermaid code blocks.
 */
function buildMermaidDecorations(view: EditorView): DecorationSet {
	const decorations: Range<Decoration>[] = [];
	const blocks = extractMermaidBlocks(view);

	for (const block of blocks) {
		// Skip if cursor is in this code block
		if (isCursorInRange(view.state, [block.from, block.to])) {
			continue;
		}

		// Add preview widget after the code block
		decorations.push(
			Decoration.widget({
				widget: new MermaidPreviewWidget(block.code, block.id),
				side: 1
			}).range(block.to)
		);
	}

	return Decoration.set(decorations, true);
}

/**
 * Track the last known theme for change detection.
 */
let lastTheme: 'default' | 'dark' = detectTheme();

/**
 * Mermaid preview plugin class.
 */
class MermaidPreviewPlugin {
	decorations: DecorationSet;
	private lastSelectionHead: number = -1;

	constructor(view: EditorView) {
		// Initialize mermaid with detected theme
		lastTheme = detectTheme();
		initMermaid(lastTheme);
		this.decorations = buildMermaidDecorations(view);
		this.lastSelectionHead = view.state.selection.main.head;
	}

	update(update: ViewUpdate) {
		// Check if theme changed
		const currentTheme = detectTheme();
		if (currentTheme !== lastTheme) {
			lastTheme = currentTheme;
			// Theme changed, clear cache and reinitialize
			renderCache.clear();
			initMermaid(currentTheme);
			this.decorations = buildMermaidDecorations(update.view);
			this.lastSelectionHead = update.state.selection.main.head;
			return;
		}

		if (update.docChanged || update.viewportChanged) {
			this.decorations = buildMermaidDecorations(update.view);
			this.lastSelectionHead = update.state.selection.main.head;
			return;
		}

		if (update.selectionSet) {
			const newHead = update.state.selection.main.head;
			if (newHead !== this.lastSelectionHead) {
				this.decorations = buildMermaidDecorations(update.view);
				this.lastSelectionHead = newHead;
			}
		}
	}
}

const mermaidPlugin = ViewPlugin.fromClass(MermaidPreviewPlugin, {
	decorations: (v) => v.decorations
});

/**
 * Base theme for mermaid preview.
 */
const baseTheme = EditorView.baseTheme({
	'.cm-mermaid-preview': {
		display: 'block',
		backgroundColor: 'var(--cm-mermaid-bg, rgba(128, 128, 128, 0.05))',
		borderRadius: '0.5rem',
		overflow: 'auto',
		textAlign: 'center'
	},
	'.cm-mermaid-preview svg': {
		maxWidth: '100%',
		height: 'auto'
	},
	'.cm-mermaid-loading': {
		color: 'var(--cm-foreground)',
		opacity: '0.6',
		fontStyle: 'italic',
	},
	'.cm-mermaid-error': {
		color: 'var(--cm-error, #ef4444)',
		backgroundColor: 'var(--cm-error-bg, rgba(239, 68, 68, 0.1))',
		borderRadius: '0.25rem',
		fontSize: '0.875rem',
		textAlign: 'left',
		fontFamily: 'var(--voidraft-font-mono)',
		whiteSpace: 'pre-wrap',
		wordBreak: 'break-word'
	}
});

/**
 * Clear the mermaid render cache.
 * Call this when theme changes to re-render diagrams.
 */
export function clearMermaidCache(): void {
	renderCache.clear();
}

/**
 * Update mermaid theme based on current system theme.
 * Call this when the application theme changes.
 */
export function refreshMermaidTheme(): void {
	const theme = detectTheme();
	if (theme !== currentMermaidTheme) {
		renderCache.clear();
		initMermaid(theme);
	}
}

/**
 * Force refresh all mermaid diagrams.
 * Clears cache and reinitializes with current theme.
 */
export function forceRefreshMermaid(): void {
	renderCache.clear();
	initMermaid(detectTheme());
}
