/**
 * Table plugin for CodeMirror.
 *
 * Features:
 * - Renders markdown tables as beautiful HTML tables
 * - Lines remain, content hidden, table overlays on top (same as math.ts)
 * - Shows source when cursor is inside
 * - Supports alignment (left, center, right)
 *
 * Table syntax tree structure from @lezer/markdown:
 * - Table (root)
 *   - TableHeader (first row)
 *     - TableDelimiter (|)
 *     - TableCell (content)
 *   - TableDelimiter (separator row |---|---|)
 *   - TableRow (data rows)
 *     - TableCell (content)
 */

import { Extension, Range } from '@codemirror/state';
import { syntaxTree, foldedRanges } from '@codemirror/language';
import {
	ViewPlugin,
	DecorationSet,
	Decoration,
	EditorView,
	ViewUpdate,
	WidgetType
} from '@codemirror/view';
import { SyntaxNode } from '@lezer/common';
import { isCursorInRange } from '../util';
import { LruCache } from '@/common/utils/lruCache';
import { generateContentHash } from '@/common/utils/hashUtils';
import DOMPurify from 'dompurify';

// ============================================================================
// Types and Interfaces
// ============================================================================

/** Cell alignment type */
type CellAlign = 'left' | 'center' | 'right';

/** Parsed table data */
interface TableData {
	headers: string[];
	alignments: CellAlign[];
	rows: string[][];
}

/** Table range info for tracking */
interface TableRange {
	from: number;
	to: number;
}

// ============================================================================
// Cache using LruCache from utils
// ============================================================================

/** LRU cache for parsed table data - keyed by position for fast lookup */
const tableCacheByPos = new LruCache<string, { hash: string; data: TableData }>(50);

/** LRU cache for inline markdown rendering */
const inlineRenderCache = new LruCache<string, string>(200);

/**
 * Get or parse table data with two-level caching.
 * First checks position, then verifies content hash only if position matches.
 * This avoids expensive hash computation on cache miss.
 */
function getCachedTableData(
	state: import('@codemirror/state').EditorState,
	tableNode: SyntaxNode
): TableData | null {
	const posKey = `${tableNode.from}-${tableNode.to}`;
	
	// First level: check if we have data for this position
	const cached = tableCacheByPos.get(posKey);
	if (cached) {
		// Second level: verify content hash matches (lazy hash computation)
		const content = state.sliceDoc(tableNode.from, tableNode.to);
		const contentHash = generateContentHash(content);
		if (cached.hash === contentHash) {
			return cached.data;
		}
	}
	
	// Cache miss - parse and cache
	const content = state.sliceDoc(tableNode.from, tableNode.to);
	const data = parseTableData(state, tableNode);
	if (data) {
		tableCacheByPos.set(posKey, {
			hash: generateContentHash(content),
			data
		});
	}
	return data;
}


// ============================================================================
// Parsing Functions (Optimized)
// ============================================================================

/**
 * Parse alignment from delimiter row.
 * Optimized: early returns, minimal string operations.
 */
function parseAlignment(delimiterText: string): CellAlign {
	const len = delimiterText.length;
	if (len === 0) return 'left';
	
	// Find first and last non-space characters
	let start = 0;
	let end = len - 1;
	while (start < len && delimiterText.charCodeAt(start) === 32) start++;
	while (end > start && delimiterText.charCodeAt(end) === 32) end--;
	
	if (start > end) return 'left';
	
	const hasLeftColon = delimiterText.charCodeAt(start) === 58; // ':'
	const hasRightColon = delimiterText.charCodeAt(end) === 58;

	if (hasLeftColon && hasRightColon) return 'center';
	if (hasRightColon) return 'right';
	return 'left';
}

/**
 * Parse a row text into cells by splitting on |
 * Optimized: single-pass parsing without multiple string operations.
 */
function parseRowText(rowText: string): string[] {
	const cells: string[] = [];
	const len = rowText.length;
	
	let start = 0;
	let end = len;
	
	// Skip leading whitespace
	while (start < len && rowText.charCodeAt(start) <= 32) start++;
	// Skip trailing whitespace
	while (end > start && rowText.charCodeAt(end - 1) <= 32) end--;
	
	// Skip leading |
	if (start < end && rowText.charCodeAt(start) === 124) start++;
	// Skip trailing |
	if (end > start && rowText.charCodeAt(end - 1) === 124) end--;
	
	// Parse cells in single pass
	let cellStart = start;
	for (let i = start; i <= end; i++) {
		if (i === end || rowText.charCodeAt(i) === 124) {
			// Extract and trim cell
			let cs = cellStart;
			let ce = i;
			while (cs < ce && rowText.charCodeAt(cs) <= 32) cs++;
			while (ce > cs && rowText.charCodeAt(ce - 1) <= 32) ce--;
			cells.push(rowText.substring(cs, ce));
			cellStart = i + 1;
		}
	}
	
	return cells;
}

/**
 * Parse table data from syntax tree node.
 * 
 * Table syntax tree structure from @lezer/markdown:
 * - Table (root)
 *   - TableHeader (contains TableCell children)
 *   - TableDelimiter (the |---|---| line)
 *   - TableRow (contains TableCell children)
 */
function parseTableData(state: import('@codemirror/state').EditorState, tableNode: SyntaxNode): TableData | null {
	const headers: string[] = [];
	const alignments: CellAlign[] = [];
	const rows: string[][] = [];

	// Get TableHeader
	const headerNode = tableNode.getChild('TableHeader');
	if (!headerNode) return null;

	// Get TableCell children from header
	const headerCells = headerNode.getChildren('TableCell');
	
	if (headerCells.length > 0) {
		// Parse from TableCell nodes
		for (const cell of headerCells) {
			const text = state.sliceDoc(cell.from, cell.to).trim();
			headers.push(text);
		}
	} else {
		// Fallback: parse the entire header row text
		const headerText = state.sliceDoc(headerNode.from, headerNode.to);
		const parsedHeaders = parseRowText(headerText);
		headers.push(...parsedHeaders);
	}

	if (headers.length === 0) return null;

	// Find delimiter row to get alignments
	// The delimiter is a direct child of Table
	let child = tableNode.firstChild;
	while (child) {
		if (child.type.name === 'TableDelimiter') {
			const delimText = state.sliceDoc(child.from, child.to);
			// Check if this contains --- (alignment row)
			if (delimText.includes('-')) {
				const parts = parseRowText(delimText);
				for (const part of parts) {
					if (part.includes('-')) {
						alignments.push(parseAlignment(part));
					}
				}
				break;
			}
		}
		child = child.nextSibling;
	}

	// Fill missing alignments with 'left'
	while (alignments.length < headers.length) {
		alignments.push('left');
	}

	// Parse data rows
	const rowNodes = tableNode.getChildren('TableRow');
	
	for (const rowNode of rowNodes) {
		const rowData: string[] = [];
		const cells = rowNode.getChildren('TableCell');
		
		if (cells.length > 0) {
			// Parse from TableCell nodes
			for (const cell of cells) {
				const text = state.sliceDoc(cell.from, cell.to).trim();
				rowData.push(text);
			}
		} else {
			// Fallback: parse the entire row text
			const rowText = state.sliceDoc(rowNode.from, rowNode.to);
			const parsedCells = parseRowText(rowText);
			rowData.push(...parsedCells);
		}
		
		// Fill missing cells with empty string
		while (rowData.length < headers.length) {
			rowData.push('');
		}
		rows.push(rowData);
	}

	return { headers, alignments, rows };
}


// Pre-compiled regex patterns for better performance
const BOLD_STAR_RE = /\*\*(.+?)\*\*/g;
const BOLD_UNDER_RE = /__(.+?)__/g;
const ITALIC_STAR_RE = /\*([^*]+)\*/g;
const ITALIC_UNDER_RE = /(?<![a-zA-Z])_([^_]+)_(?![a-zA-Z])/g;
const CODE_RE = /`([^`]+)`/g;
const LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g;
const STRIKE_RE = /~~(.+?)~~/g;

// Regex to detect HTML tags (opening, closing, or self-closing)
const HTML_TAG_RE = /<[a-zA-Z][^>]*>|<\/[a-zA-Z][^>]*>/;

/**
 * Sanitize HTML content with DOMPurify.
 */
function sanitizeHTML(html: string): string {
	return DOMPurify.sanitize(html, {
		ADD_TAGS: ['code', 'strong', 'em', 'del', 'a', 'img', 'br', 'span'],
		ADD_ATTR: ['href', 'target', 'src', 'alt', 'class', 'style'],
		ALLOW_DATA_ATTR: true
	});
}

/**
 * Convert inline markdown syntax to HTML.
 * Handles: **bold**, *italic*, `code`, [link](url), ~~strikethrough~~, and HTML tags
 * Optimized with pre-compiled regex and LRU caching.
 */
function renderInlineMarkdown(text: string): string {
	// Check cache first
	const cached = inlineRenderCache.get(text);
	if (cached !== undefined) return cached;
	
	let html = text;
	
	// Check if text contains HTML tags
	const hasHTMLTags = HTML_TAG_RE.test(text);
	
	if (hasHTMLTags) {
		// If contains HTML tags, process markdown first without escaping < >
		// Bold: **text** or __text__
		html = html.replace(BOLD_STAR_RE, '<strong>$1</strong>');
		html = html.replace(BOLD_UNDER_RE, '<strong>$1</strong>');
		
		// Italic: *text* or _text_ (but not inside words for _)
		html = html.replace(ITALIC_STAR_RE, '<em>$1</em>');
		html = html.replace(ITALIC_UNDER_RE, '<em>$1</em>');
		
		// Inline code: `code` - but don't double-process if already has <code>
		if (!html.includes('<code>')) {
			html = html.replace(CODE_RE, '<code>$1</code>');
		}
		
		// Links: [text](url)
		html = html.replace(LINK_RE, '<a href="$2" target="_blank">$1</a>');
		
		// Strikethrough: ~~text~~
		html = html.replace(STRIKE_RE, '<del>$1</del>');
		
		// Sanitize HTML for security
		html = sanitizeHTML(html);
	} else {
		// No HTML tags - escape < > and process markdown
		html = html.replace(/</g, '&lt;').replace(/>/g, '&gt;');
		
		// Bold: **text** or __text__
		html = html.replace(BOLD_STAR_RE, '<strong>$1</strong>');
		html = html.replace(BOLD_UNDER_RE, '<strong>$1</strong>');
		
		// Italic: *text* or _text_ (but not inside words for _)
		html = html.replace(ITALIC_STAR_RE, '<em>$1</em>');
		html = html.replace(ITALIC_UNDER_RE, '<em>$1</em>');
		
		// Inline code: `code`
		html = html.replace(CODE_RE, '<code>$1</code>');
		
		// Links: [text](url)
		html = html.replace(LINK_RE, '<a href="$2" target="_blank">$1</a>');
		
		// Strikethrough: ~~text~~
		html = html.replace(STRIKE_RE, '<del>$1</del>');
	}
	
	// Cache result using LRU cache
	inlineRenderCache.set(text, html);
	
	return html;
}


/**
 * Widget to display rendered table.
 * Uses absolute positioning to overlay on source lines.
 * Optimized with innerHTML for faster DOM creation.
 */
class TableWidget extends WidgetType {
	// Cache the generated HTML to avoid regenerating on each toDOM call
	private cachedHTML: string | null = null;

	constructor(
		readonly tableData: TableData,
		readonly lineCount: number,
		readonly lineHeight: number,
		readonly visualHeight: number,
		readonly contentWidth: number
	) {
		super();
	}

	/**
	 * Build table HTML string (much faster than DOM API for large tables).
	 */
	private buildTableHTML(): string {
		if (this.cachedHTML) return this.cachedHTML;

		// Calculate row heights
		const headerRatio = 2 / this.lineCount;
		const dataRowRatio = 1 / this.lineCount;
		const headerHeight = this.visualHeight * headerRatio;
		const dataRowHeight = this.visualHeight * dataRowRatio;

		// Build header cells
		const headerCells = this.tableData.headers.map((header, idx) => {
			const align = this.tableData.alignments[idx] || 'left';
			const escapedTitle = header.replace(/"/g, '&quot;');
			return `<th class="cm-table-align-${align}" title="${escapedTitle}">${renderInlineMarkdown(header)}</th>`;
		}).join('');

		// Build body rows
		const bodyRows = this.tableData.rows.map(row => {
			const cells = row.map((cell, idx) => {
				const align = this.tableData.alignments[idx] || 'left';
				const escapedTitle = cell.replace(/"/g, '&quot;');
				return `<td class="cm-table-align-${align}" title="${escapedTitle}">${renderInlineMarkdown(cell)}</td>`;
			}).join('');
			return `<tr style="height:${dataRowHeight}px">${cells}</tr>`;
		}).join('');

		this.cachedHTML = `<table class="cm-table"><thead><tr style="height:${headerHeight}px">${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>`;
		return this.cachedHTML;
	}

	toDOM(): HTMLElement {
		const container = document.createElement('div');
		container.className = 'cm-table-container';
		container.style.height = `${this.visualHeight}px`;

		const tableWrapper = document.createElement('div');
		tableWrapper.className = 'cm-table-wrapper';
		tableWrapper.style.maxWidth = `${this.contentWidth}px`;
		tableWrapper.style.maxHeight = `${this.visualHeight}px`;

		// Use innerHTML for faster DOM creation (single parse vs many createElement calls)
		tableWrapper.innerHTML = this.buildTableHTML();

		container.appendChild(tableWrapper);
		return container;
	}

	eq(other: TableWidget): boolean {
		// Quick dimension checks first (most likely to differ)
		if (this.visualHeight !== other.visualHeight ||
			this.contentWidth !== other.contentWidth ||
			this.lineCount !== other.lineCount) {
			return false;
		}
		
		// Use reference equality for tableData if same object
		if (this.tableData === other.tableData) return true;
		
		// Quick length checks
		const headers1 = this.tableData.headers;
		const headers2 = other.tableData.headers;
		const rows1 = this.tableData.rows;
		const rows2 = other.tableData.rows;
		
		if (headers1.length !== headers2.length || rows1.length !== rows2.length) {
			return false;
		}

		// Compare headers (usually short)
		for (let i = 0, len = headers1.length; i < len; i++) {
			if (headers1[i] !== headers2[i]) return false;
		}

		// Compare rows
		for (let i = 0, rowLen = rows1.length; i < rowLen; i++) {
			const row1 = rows1[i];
			const row2 = rows2[i];
			if (row1.length !== row2.length) return false;
			for (let j = 0, cellLen = row1.length; j < cellLen; j++) {
				if (row1[j] !== row2[j]) return false;
			}
		}

		return true;
	}

	ignoreEvent(): boolean {
		return false;
	}
}

// ============================================================================
// Decorations
// ============================================================================

/**
 * Check if a range overlaps with any folded region.
 */
function isInFoldedRange(view: EditorView, from: number, to: number): boolean {
	const folded = foldedRanges(view.state);
	const cursor = folded.iter();
	while (cursor.value) {
		// Check if ranges overlap
		if (cursor.from < to && cursor.to > from) {
			return true;
		}
		cursor.next();
	}
	return false;
}

/** Result of building decorations - includes both decorations and table ranges */
interface BuildResult {
	decorations: DecorationSet;
	tableRanges: TableRange[];
}

/**
 * Build decorations for tables and collect table ranges in a single pass.
 * Optimized: single syntax tree traversal instead of two separate ones.
 */
function buildDecorationsAndRanges(view: EditorView): BuildResult {
	const decorations: Range<Decoration>[] = [];
	const tableRanges: TableRange[] = [];
	const contentWidth = view.contentDOM.clientWidth - 10;
	const lineHeight = view.defaultLineHeight;

	// Pre-create the line decoration to reuse (same class for all hidden lines)
	const hiddenLineDecoration = Decoration.line({ class: 'cm-table-line-hidden' });

	for (const { from, to } of view.visibleRanges) {
		syntaxTree(view.state).iterate({
			from,
			to,
			enter: ({ type, from: nodeFrom, to: nodeTo, node }) => {
				if (type.name !== 'Table') return;

				// Always collect table ranges for selection tracking
				tableRanges.push({ from: nodeFrom, to: nodeTo });

				// Skip rendering if table is in a folded region
				if (isInFoldedRange(view, nodeFrom, nodeTo)) return;

				// Skip rendering if cursor/selection is in table range
				if (isCursorInRange(view.state, [nodeFrom, nodeTo])) return;

				// Get cached or parse table data
				const tableData = getCachedTableData(view.state, node);
				if (!tableData) return;

				// Calculate line info
				const startLine = view.state.doc.lineAt(nodeFrom);
				const endLine = view.state.doc.lineAt(nodeTo);
				const lineCount = endLine.number - startLine.number + 1;

				// Get visual height using lineBlockAt (includes wrapped lines)
				const startBlock = view.lineBlockAt(nodeFrom);
				const endBlock = view.lineBlockAt(nodeTo);
				const visualHeight = endBlock.bottom - startBlock.top;

				// Add line decorations to hide content (reuse decoration object)
				for (let lineNum = startLine.number; lineNum <= endLine.number; lineNum++) {
					const line = view.state.doc.line(lineNum);
					decorations.push(hiddenLineDecoration.range(line.from));
				}

				// Add widget on the first line (positioned absolutely)
				decorations.push(
					Decoration.widget({
						widget: new TableWidget(tableData, lineCount, lineHeight, visualHeight, contentWidth),
						side: -1
					}).range(startLine.from)
				);
			}
		});
	}

	return {
		decorations: Decoration.set(decorations, true),
		tableRanges
	};
}

// ============================================================================
// Plugin
// ============================================================================

/**
 * Find which table the selection is in (if any).
 * Returns table index or -1 if not in any table.
 * Optimized: early exit on first match.
 */
function findSelectionTableIndex(
	selectionRanges: readonly { from: number; to: number }[],
	tableRanges: TableRange[]
): number {
	// Early exit if no tables
	if (tableRanges.length === 0) return -1;
	
	for (const sel of selectionRanges) {
		const selFrom = sel.from;
		const selTo = sel.to;
		for (let i = 0; i < tableRanges.length; i++) {
			const table = tableRanges[i];
			// Inline overlap check (avoid function call overhead)
			if (selFrom <= table.to && table.from <= selTo) {
				return i;
			}
		}
	}
	return -1;
}

/**
 * Table plugin with optimized update detection.
 * 
 * Performance optimizations:
 * - Single syntax tree traversal (buildDecorationsAndRanges)
 * - Tracks table ranges to minimize unnecessary rebuilds
 * - Only rebuilds when selection enters/exits table OR switches between tables
 * - Detects both cursor position AND selection range changes
 */
class TablePlugin {
	decorations: DecorationSet;
	private tableRanges: TableRange[] = [];
	private lastContentWidth: number = 0;
	// Track last selection state for comparison
	private lastSelectionFrom: number = -1;
	private lastSelectionTo: number = -1;
	// Track which table the selection is in (-1 = not in any table)
	private lastTableIndex: number = -1;

	constructor(view: EditorView) {
		const result = buildDecorationsAndRanges(view);
		this.decorations = result.decorations;
		this.tableRanges = result.tableRanges;
		this.lastContentWidth = view.contentDOM.clientWidth;
		// Initialize selection tracking
		const mainSel = view.state.selection.main;
		this.lastSelectionFrom = mainSel.from;
		this.lastSelectionTo = mainSel.to;
		this.lastTableIndex = findSelectionTableIndex(view.state.selection.ranges, this.tableRanges);
	}

	update(update: ViewUpdate) {
		const view = update.view;
		const currentContentWidth = view.contentDOM.clientWidth;
		
		// Check if content width changed (requires rebuild for proper sizing)
		const widthChanged = Math.abs(currentContentWidth - this.lastContentWidth) > 1;
		if (widthChanged) {
			this.lastContentWidth = currentContentWidth;
		}

		// Full rebuild needed for:
		// - Document changes (table content may have changed)
		// - Viewport changes (new tables may be visible)
		// - Geometry changes (folding, line height changes)
		// - Width changes (table needs resizing)
		if (update.docChanged || update.viewportChanged || update.geometryChanged || widthChanged) {
			const result = buildDecorationsAndRanges(view);
			this.decorations = result.decorations;
			this.tableRanges = result.tableRanges;
			// Update selection tracking
			const mainSel = update.state.selection.main;
			this.lastSelectionFrom = mainSel.from;
			this.lastSelectionTo = mainSel.to;
			this.lastTableIndex = findSelectionTableIndex(update.state.selection.ranges, this.tableRanges);
			return;
		}

		// For selection changes, check if selection moved in/out of a table OR between tables
		if (update.selectionSet) {
			const mainSel = update.state.selection.main;
			const selectionChanged = mainSel.from !== this.lastSelectionFrom || 
			                         mainSel.to !== this.lastSelectionTo;
			
			if (selectionChanged) {
				// Find which table (if any) the selection is now in
				const currentTableIndex = findSelectionTableIndex(update.state.selection.ranges, this.tableRanges);
				
				// Rebuild if selection moved to a different table (including in/out)
				if (currentTableIndex !== this.lastTableIndex) {
					const result = buildDecorationsAndRanges(view);
					this.decorations = result.decorations;
					this.tableRanges = result.tableRanges;
					// Re-check after rebuild (table ranges may have changed)
					this.lastTableIndex = findSelectionTableIndex(update.state.selection.ranges, this.tableRanges);
				} else {
					this.lastTableIndex = currentTableIndex;
				}
				
				// Update tracking state
				this.lastSelectionFrom = mainSel.from;
				this.lastSelectionTo = mainSel.to;
			}
		}
	}
}

const tablePlugin = ViewPlugin.fromClass(
	TablePlugin,
	{
		decorations: (v) => v.decorations
	}
);

// ============================================================================
// Theme
// ============================================================================

/**
 * Base theme for tables.
 */
const baseTheme = EditorView.baseTheme({
	// Table container - same as math.ts
	'.cm-table-container': {
		position: 'absolute',
		display: 'flex',
		justifyContent: 'flex-start',
		alignItems: 'flex-start',
		pointerEvents: 'none',
		zIndex: '2',
        overflow: 'hidden',
	},

	// Table wrapper - scrollable when needed
	'.cm-table-wrapper': {
		display: 'inline-block',
		pointerEvents: 'auto',
		backgroundColor: 'var(--bg-primary)',
		overflowX: 'auto',
		overflowY: 'auto',
	},

	// Table styles - use inset box-shadow for outer border (not clipped by overflow)
	'.cm-table': {
		borderCollapse: 'separate',
		borderSpacing: '0',
		fontSize: 'inherit',
		fontFamily: 'inherit',
		lineHeight: 'inherit',
		backgroundColor: 'var(--cm-table-bg)',
		border: 'none',
		boxShadow: 'inset 0 0 0 1px var(--cm-table-border)',
		color: 'var(--text-primary) !important',
	},

	'.cm-table th, .cm-table td': {
		padding: '0 8px',
		border: 'none',
		color: 'inherit !important',
		verticalAlign: 'middle',
		boxSizing: 'border-box',
		fontSize: 'inherit',
		fontFamily: 'inherit',
		lineHeight: 'inherit',
		// Prevent text wrapping to maintain row height
		whiteSpace: 'nowrap',
		overflow: 'hidden',
		textOverflow: 'ellipsis',
		maxWidth: '300px',
	},

	// Data cells: left divider + bottom divider
	'.cm-table td': {
		boxShadow: '-1px 0 0 var(--cm-table-border), 0 1px 0 var(--cm-table-border)',
	},

	// First column data cells: only bottom divider
	'.cm-table td:first-child': {
		boxShadow: '0 1px 0 var(--cm-table-border)',
	},

	// Last row data cells: only left divider (no bottom)
	'.cm-table tbody tr:last-child td': {
		boxShadow: '-1px 0 0 var(--cm-table-border)',
	},

	// Last row first column: no dividers
	'.cm-table tbody tr:last-child td:first-child': {
		boxShadow: 'none',
	},

	'.cm-table th': {
		backgroundColor: 'var(--cm-table-header-bg)',
		fontWeight: '600',
		// Header cells: left divider + bottom divider
		boxShadow: '-1px 0 0 var(--cm-table-border), 0 1px 0 var(--cm-table-border)',
	},

	'.cm-table th:first-child': {
		// First header cell: only bottom divider
		boxShadow: '0 1px 0 var(--cm-table-border)',
	},

	'.cm-table tbody tr:hover': {
		backgroundColor: 'var(--cm-table-row-hover)',
	},

	// Alignment classes - use higher specificity to override default
	'.cm-table th.cm-table-align-left, .cm-table td.cm-table-align-left': {
		textAlign: 'left',
	},

	'.cm-table th.cm-table-align-center, .cm-table td.cm-table-align-center': {
		textAlign: 'center',
	},

	'.cm-table th.cm-table-align-right, .cm-table td.cm-table-align-right': {
		textAlign: 'right',
	},

	// Inline elements in table cells
	'.cm-table code': {
		backgroundColor: 'var(--cm-inline-code-bg, var(--bg-hover))',
		padding: '1px 4px',
		borderRadius: '3px',
		fontSize: 'inherit',
		fontFamily: 'var(--voidraft-font-mono)',
	},

	'.cm-table a': {
		color: 'var(--selection-text)',
		textDecoration: 'none',
	},

	'.cm-table a:hover': {
		textDecoration: 'underline',
	},

	// Hidden line content for table (text transparent but line preserved)
	// Use high specificity to override rainbow brackets and other plugins
	'.cm-line.cm-table-line-hidden': {
		color: 'transparent !important',
		caretColor: 'transparent',
	},
	'.cm-line.cm-table-line-hidden span': {
		color: 'transparent !important',
	},
	// Override rainbow brackets in hidden table lines
	'.cm-line.cm-table-line-hidden [class*="cm-rainbow-bracket"]': {
		color: 'transparent !important',
	},
});


/**
 * Table extension.
 *
 * Features:
 * - Parses markdown tables using syntax tree
 * - Renders tables as beautiful HTML tables
 * - Table preserves line structure, overlays rendered table
 * - Shows source when cursor is inside
 */
export const table = (): Extension => [
	tablePlugin,
	baseTheme
];

export default table;

