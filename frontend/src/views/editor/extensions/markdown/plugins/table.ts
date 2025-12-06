/**
 * Table handler and theme.
 */

import { Decoration, EditorView, WidgetType } from '@codemirror/view';
import { foldedRanges } from '@codemirror/language';
import { RangeTuple } from '../util';
import { SyntaxNode } from '@lezer/common';
import { BuildContext } from './types';
import DOMPurify from 'dompurify';

type CellAlign = 'left' | 'center' | 'right';
interface TableData { headers: string[]; alignments: CellAlign[]; rows: string[][]; }

const DECO_TABLE_LINE_HIDDEN = Decoration.line({ class: 'cm-table-line-hidden' });

const BOLD_STAR_RE = /\*\*(.+?)\*\*/g;
const BOLD_UNDER_RE = /__(.+?)__/g;
const ITALIC_STAR_RE = /\*([^*]+)\*/g;
const ITALIC_UNDER_RE = /(?<![a-zA-Z])_([^_]+)_(?![a-zA-Z])/g;
const CODE_RE = /`([^`]+)`/g;
const LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g;
const STRIKE_RE = /~~(.+?)~~/g;
const HTML_TAG_RE = /<[a-zA-Z][^>]*>|<\/[a-zA-Z][^>]*>/;

function renderInlineMarkdown(text: string): string {
	let html = text;
	if (HTML_TAG_RE.test(text)) {
		html = html.replace(BOLD_STAR_RE, '<strong>$1</strong>').replace(BOLD_UNDER_RE, '<strong>$1</strong>');
		html = html.replace(ITALIC_STAR_RE, '<em>$1</em>').replace(ITALIC_UNDER_RE, '<em>$1</em>');
		if (!html.includes('<code>')) html = html.replace(CODE_RE, '<code>$1</code>');
		html = html.replace(LINK_RE, '<a href="$2" target="_blank">$1</a>').replace(STRIKE_RE, '<del>$1</del>');
		html = DOMPurify.sanitize(html, { ADD_TAGS: ['code', 'strong', 'em', 'del', 'a'], ADD_ATTR: ['href', 'target'] });
	} else {
		html = html.replace(/</g, '&lt;').replace(/>/g, '&gt;');
		html = html.replace(BOLD_STAR_RE, '<strong>$1</strong>').replace(BOLD_UNDER_RE, '<strong>$1</strong>');
		html = html.replace(ITALIC_STAR_RE, '<em>$1</em>').replace(ITALIC_UNDER_RE, '<em>$1</em>');
		html = html.replace(CODE_RE, '<code>$1</code>');
		html = html.replace(LINK_RE, '<a href="$2" target="_blank">$1</a>').replace(STRIKE_RE, '<del>$1</del>');
	}
	return html;
}

function parseRowText(rowText: string): string[] {
	const cells: string[] = [];
	let start = 0, end = rowText.length;
	while (start < end && rowText.charCodeAt(start) <= 32) start++;
	while (end > start && rowText.charCodeAt(end - 1) <= 32) end--;
	if (start < end && rowText.charCodeAt(start) === 124) start++;
	if (end > start && rowText.charCodeAt(end - 1) === 124) end--;
	let cellStart = start;
	for (let i = start; i <= end; i++) {
		if (i === end || rowText.charCodeAt(i) === 124) {
			let cs = cellStart, ce = i;
			while (cs < ce && rowText.charCodeAt(cs) <= 32) cs++;
			while (ce > cs && rowText.charCodeAt(ce - 1) <= 32) ce--;
			cells.push(rowText.substring(cs, ce));
			cellStart = i + 1;
		}
	}
	return cells;
}

function parseAlignment(text: string): CellAlign {
	const len = text.length;
	if (len === 0) return 'left';
	let start = 0, end = len - 1;
	while (start < len && text.charCodeAt(start) === 32) start++;
	while (end > start && text.charCodeAt(end) === 32) end--;
	if (start > end) return 'left';
	const hasLeft = text.charCodeAt(start) === 58;
	const hasRight = text.charCodeAt(end) === 58;
	if (hasLeft && hasRight) return 'center';
	if (hasRight) return 'right';
	return 'left';
}

class TableWidget extends WidgetType {
	constructor(readonly data: TableData, readonly lineCount: number, readonly visualHeight: number, readonly contentWidth: number) { super(); }
	eq(other: TableWidget) {
		if (this.visualHeight !== other.visualHeight || this.contentWidth !== other.contentWidth) return false;
		if (this.data === other.data) return true;
		if (this.data.headers.length !== other.data.headers.length || this.data.rows.length !== other.data.rows.length) return false;
		for (let i = 0; i < this.data.headers.length; i++) if (this.data.headers[i] !== other.data.headers[i]) return false;
		for (let i = 0; i < this.data.rows.length; i++) {
			if (this.data.rows[i].length !== other.data.rows[i].length) return false;
			for (let j = 0; j < this.data.rows[i].length; j++) if (this.data.rows[i][j] !== other.data.rows[i][j]) return false;
		}
		return true;
	}
	toDOM(): HTMLElement {
		const container = document.createElement('div');
		container.className = 'cm-table-container';
		container.style.height = `${this.visualHeight}px`;
		const wrapper = document.createElement('div');
		wrapper.className = 'cm-table-wrapper';
		wrapper.style.maxWidth = `${this.contentWidth}px`;
		wrapper.style.maxHeight = `${this.visualHeight}px`;
		const headerRatio = 2 / this.lineCount, dataRowRatio = 1 / this.lineCount;
		const headerHeight = this.visualHeight * headerRatio, dataRowHeight = this.visualHeight * dataRowRatio;
		const headerCells = this.data.headers.map((h, i) => `<th class="cm-table-align-${this.data.alignments[i] || 'left'}" title="${h.replace(/"/g, '&quot;')}">${renderInlineMarkdown(h)}</th>`).join('');
		const bodyRows = this.data.rows.map(row => `<tr style="height:${dataRowHeight}px">${row.map((c, i) => `<td class="cm-table-align-${this.data.alignments[i] || 'left'}" title="${c.replace(/"/g, '&quot;')}">${renderInlineMarkdown(c)}</td>`).join('')}</tr>`).join('');
		wrapper.innerHTML = `<table class="cm-table"><thead><tr style="height:${headerHeight}px">${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>`;
		container.appendChild(wrapper);
		return container;
	}
	ignoreEvent() { return false; }
}

function isInFoldedRange(view: EditorView, from: number, to: number): boolean {
	const folded = foldedRanges(view.state);
	const cursor = folded.iter();
	while (cursor.value) {
		if (cursor.from < to && cursor.to > from) return true;
		cursor.next();
	}
	return false;
}

/**
 * Handle Table node.
 */
export function handleTable(
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
	if (isInFoldedRange(ctx.view, nf, nt) || inCursor) return;

	const headerNode = node.getChild('TableHeader');
	if (!headerNode) return;
	const headers: string[] = [];
	const alignments: CellAlign[] = [];
	const rows: string[][] = [];
	const headerCells = headerNode.getChildren('TableCell');
	if (headerCells.length > 0) {
		for (const cell of headerCells) headers.push(ctx.view.state.sliceDoc(cell.from, cell.to).trim());
	} else {
		headers.push(...parseRowText(ctx.view.state.sliceDoc(headerNode.from, headerNode.to)));
	}
	if (headers.length === 0) return;
	let child = node.firstChild;
	while (child) {
		if (child.type.name === 'TableDelimiter') {
			const delimText = ctx.view.state.sliceDoc(child.from, child.to);
			if (delimText.includes('-')) {
				for (const part of parseRowText(delimText)) if (part.includes('-')) alignments.push(parseAlignment(part));
				break;
			}
		}
		child = child.nextSibling;
	}
	while (alignments.length < headers.length) alignments.push('left');
	for (const rowNode of node.getChildren('TableRow')) {
		const rowData: string[] = [];
		const cells = rowNode.getChildren('TableCell');
		if (cells.length > 0) { for (const cell of cells) rowData.push(ctx.view.state.sliceDoc(cell.from, cell.to).trim()); }
		else { rowData.push(...parseRowText(ctx.view.state.sliceDoc(rowNode.from, rowNode.to))); }
		while (rowData.length < headers.length) rowData.push('');
		rows.push(rowData);
	}
	const startLine = ctx.view.state.doc.lineAt(nf);
	const endLine = ctx.view.state.doc.lineAt(nt);
	const lineCount = endLine.number - startLine.number + 1;
	const startBlock = ctx.view.lineBlockAt(nf);
	const endBlock = ctx.view.lineBlockAt(nt);
	const visualHeight = endBlock.bottom - startBlock.top;
	for (let num = startLine.number; num <= endLine.number; num++) {
		ctx.items.push({ from: ctx.view.state.doc.line(num).from, to: ctx.view.state.doc.line(num).from, deco: DECO_TABLE_LINE_HIDDEN });
	}
	ctx.items.push({ from: startLine.from, to: startLine.from, deco: Decoration.widget({ widget: new TableWidget({ headers, alignments, rows }, lineCount, visualHeight, ctx.contentWidth), side: -1 }), priority: -1 });
}

/**
 * Theme for tables.
 */
export const tableTheme = EditorView.baseTheme({
	'.cm-table-container': {
		position: 'absolute',
		display: 'flex',
		justifyContent: 'flex-start',
		alignItems: 'flex-start',
		pointerEvents: 'none',
		zIndex: '2',
		overflow: 'hidden'
	},
	'.cm-table-wrapper': {
		display: 'inline-block',
		pointerEvents: 'auto',
		backgroundColor: 'var(--bg-primary)',
		overflowX: 'auto',
		overflowY: 'auto'
	},
	'.cm-table': {
		borderCollapse: 'separate',
		borderSpacing: '0',
		fontSize: 'inherit',
		fontFamily: 'inherit',
		lineHeight: 'inherit',
		backgroundColor: 'var(--cm-table-bg)',
		border: 'none',
		boxShadow: 'inset 0 0 0 1px var(--cm-table-border)',
		color: 'var(--text-primary) !important'
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
		whiteSpace: 'nowrap',
		overflow: 'hidden',
		textOverflow: 'ellipsis',
		maxWidth: '300px'
	},
	'.cm-table td': { boxShadow: '-1px 0 0 var(--cm-table-border), 0 1px 0 var(--cm-table-border)' },
	'.cm-table td:first-child': { boxShadow: '0 1px 0 var(--cm-table-border)' },
	'.cm-table tbody tr:last-child td': { boxShadow: '-1px 0 0 var(--cm-table-border)' },
	'.cm-table tbody tr:last-child td:first-child': { boxShadow: 'none' },
	'.cm-table th': {
		backgroundColor: 'var(--cm-table-header-bg)',
		fontWeight: '600',
		boxShadow: '-1px 0 0 var(--cm-table-border), 0 1px 0 var(--cm-table-border)'
	},
	'.cm-table th:first-child': { boxShadow: '0 1px 0 var(--cm-table-border)' },
	'.cm-table tbody tr:hover': { backgroundColor: 'var(--cm-table-row-hover)' },
	'.cm-table th.cm-table-align-left, .cm-table td.cm-table-align-left': { textAlign: 'left' },
	'.cm-table th.cm-table-align-center, .cm-table td.cm-table-align-center': { textAlign: 'center' },
	'.cm-table th.cm-table-align-right, .cm-table td.cm-table-align-right': { textAlign: 'right' },
	'.cm-table code': {
		backgroundColor: 'var(--cm-inline-code-bg, var(--bg-hover))',
		padding: '1px 4px',
		borderRadius: '3px',
		fontSize: 'inherit',
		fontFamily: 'var(--voidraft-font-mono)'
	},
	'.cm-table a': { color: 'var(--selection-text)', textDecoration: 'none' },
	'.cm-table a:hover': { textDecoration: 'underline' },
	'.cm-line.cm-table-line-hidden': { color: 'transparent !important', caretColor: 'transparent' },
	'.cm-line.cm-table-line-hidden span': { color: 'transparent !important' },
	'.cm-line.cm-table-line-hidden [class*="cm-rainbow-bracket"]': { color: 'transparent !important' }
});
