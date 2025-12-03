/**
 * Footnote plugin for CodeMirror.
 *
 * Features:
 * - Renders footnote references as superscript numbers/labels
 * - Renders inline footnotes as superscript numbers with embedded content
 * - Shows footnote content on hover (tooltip)
 * - Click to jump between reference and definition
 * - Hides syntax marks when cursor is outside
 */

import { Extension, RangeSetBuilder, EditorState } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import {
	ViewPlugin,
	DecorationSet,
	Decoration,
	EditorView,
	ViewUpdate,
	WidgetType,
	hoverTooltip,
	Tooltip,
} from '@codemirror/view';
import { checkRangeOverlap, invisibleDecoration, RangeTuple } from '../util';

// ============================================================================
// Types
// ============================================================================

interface FootnoteDefinition {
	id: string;
	content: string;
	from: number;
	to: number;
}

interface FootnoteReference {
	id: string;
	from: number;
	to: number;
	index: number;
}

interface InlineFootnoteInfo {
	content: string;
	from: number;
	to: number;
	index: number;
}

/**
 * Collected footnote data with O(1) lookup indexes.
 */
interface FootnoteData {
	definitions: Map<string, FootnoteDefinition>;
	references: FootnoteReference[];
	inlineFootnotes: InlineFootnoteInfo[];
	referencesByPos: Map<number, FootnoteReference>;
	inlineByPos: Map<number, InlineFootnoteInfo>;
	definitionByPos: Map<number, FootnoteDefinition>; // For position-based lookup
	firstRefById: Map<string, FootnoteReference>;
	// All footnote ranges for cursor detection
	allRanges: RangeTuple[];
}

// ============================================================================
// Footnote Collection (cached via closure)
// ============================================================================

let cachedData: FootnoteData | null = null;
let cachedDocLength = -1;

/**
 * Collect all footnote data from the document.
 */
function collectFootnotes(state: EditorState): FootnoteData {
	// Simple cache invalidation based on doc length
	if (cachedData && cachedDocLength === state.doc.length) {
		return cachedData;
	}

	const definitions = new Map<string, FootnoteDefinition>();
	const references: FootnoteReference[] = [];
	const inlineFootnotes: InlineFootnoteInfo[] = [];
	const referencesByPos = new Map<number, FootnoteReference>();
	const inlineByPos = new Map<number, InlineFootnoteInfo>();
	const definitionByPos = new Map<number, FootnoteDefinition>();
	const firstRefById = new Map<string, FootnoteReference>();
	const allRanges: RangeTuple[] = [];
	const seenIds = new Map<string, number>();
	let inlineIndex = 0;

	syntaxTree(state).iterate({
		enter: ({ type, from, to, node }) => {
			if (type.name === 'FootnoteDefinition') {
				const labelNode = node.getChild('FootnoteDefinitionLabel');
				const contentNode = node.getChild('FootnoteDefinitionContent');

				if (labelNode) {
					const id = state.sliceDoc(labelNode.from, labelNode.to);
					const content = contentNode
						? state.sliceDoc(contentNode.from, contentNode.to).trim()
						: '';

					const def: FootnoteDefinition = { id, content, from, to };
					definitions.set(id, def);
					definitionByPos.set(from, def);
					allRanges.push([from, to]);
				}
			} else if (type.name === 'FootnoteReference') {
				const labelNode = node.getChild('FootnoteReferenceLabel');

				if (labelNode) {
					const id = state.sliceDoc(labelNode.from, labelNode.to);

					if (!seenIds.has(id)) {
						seenIds.set(id, seenIds.size + 1);
					}

					const ref: FootnoteReference = {
						id,
						from,
						to,
						index: seenIds.get(id)!,
					};

					references.push(ref);
					referencesByPos.set(from, ref);
					allRanges.push([from, to]);

					if (!firstRefById.has(id)) {
						firstRefById.set(id, ref);
					}
				}
			} else if (type.name === 'InlineFootnote') {
				const contentNode = node.getChild('InlineFootnoteContent');

				if (contentNode) {
					const content = state.sliceDoc(contentNode.from, contentNode.to).trim();
					inlineIndex++;

					const info: InlineFootnoteInfo = {
						content,
						from,
						to,
						index: inlineIndex,
					};

					inlineFootnotes.push(info);
					inlineByPos.set(from, info);
					allRanges.push([from, to]);
				}
			}
		},
	});

	cachedData = {
		definitions,
		references,
		inlineFootnotes,
		referencesByPos,
		inlineByPos,
		definitionByPos,
		firstRefById,
		allRanges,
	};
	cachedDocLength = state.doc.length;

	return cachedData;
}

// ============================================================================
// Widgets
// ============================================================================

class FootnoteRefWidget extends WidgetType {
	constructor(
		readonly id: string,
		readonly index: number,
		readonly hasDefinition: boolean
	) {
		super();
	}

	toDOM(): HTMLElement {
		const span = document.createElement('span');
		span.className = 'cm-footnote-ref';
		span.textContent = `[${this.index}]`;
		span.dataset.footnoteId = this.id;

		if (!this.hasDefinition) {
			span.classList.add('cm-footnote-ref-undefined');
		}

		return span;
	}

	eq(other: FootnoteRefWidget): boolean {
		return this.id === other.id && this.index === other.index;
	}

	ignoreEvent(): boolean {
		return false;
	}
}

class InlineFootnoteWidget extends WidgetType {
	constructor(
		readonly content: string,
		readonly index: number
	) {
		super();
	}

	toDOM(): HTMLElement {
		const span = document.createElement('span');
		span.className = 'cm-inline-footnote-ref';
		span.textContent = `[${this.index}]`;
		span.dataset.footnoteContent = this.content;
		span.dataset.footnoteIndex = String(this.index);

		return span;
	}

	eq(other: InlineFootnoteWidget): boolean {
		return this.content === other.content && this.index === other.index;
	}

	ignoreEvent(): boolean {
		return false;
	}
}

class FootnoteDefLabelWidget extends WidgetType {
	constructor(readonly id: string) {
		super();
	}

	toDOM(): HTMLElement {
		const span = document.createElement('span');
		span.className = 'cm-footnote-def-label';
		span.textContent = `[${this.id}]`;
		span.dataset.footnoteId = this.id;
		return span;
	}

	eq(other: FootnoteDefLabelWidget): boolean {
		return this.id === other.id;
	}

	ignoreEvent(): boolean {
		return false;
	}
}

// ============================================================================
// Cursor Detection
// ============================================================================

/**
 * Get which footnote range the cursor is in (returns start position, -1 if none).
 */
function getCursorFootnotePos(ranges: RangeTuple[], selFrom: number, selTo: number): number {
	const selRange: RangeTuple = [selFrom, selTo];
	
	for (const range of ranges) {
		if (checkRangeOverlap(range, selRange)) {
			return range[0];
		}
	}
	return -1;
}

// ============================================================================
// Decorations
// ============================================================================

/**
 * Build decorations using RangeSetBuilder.
 */
function buildDecorations(view: EditorView, data: FootnoteData): DecorationSet {
	const builder = new RangeSetBuilder<Decoration>();
	const items: { pos: number; endPos?: number; deco: Decoration; priority?: number }[] = [];
	const { from: selFrom, to: selTo } = view.state.selection.main;
	const selRange: RangeTuple = [selFrom, selTo];

	for (const { from, to } of view.visibleRanges) {
		syntaxTree(view.state).iterate({
			from,
			to,
			enter: ({ type, from: nodeFrom, to: nodeTo, node }) => {
				const inCursor = checkRangeOverlap([nodeFrom, nodeTo], selRange);

				// Footnote References
				if (type.name === 'FootnoteReference') {
					const labelNode = node.getChild('FootnoteReferenceLabel');
					const marks = node.getChildren('FootnoteReferenceMark');

					if (!labelNode || marks.length < 2) return;

					const id = view.state.sliceDoc(labelNode.from, labelNode.to);
					const ref = data.referencesByPos.get(nodeFrom);

					if (!inCursor && ref && ref.id === id) {
						items.push({ pos: nodeFrom, endPos: nodeTo, deco: invisibleDecoration });
						items.push({
							pos: nodeTo,
							deco: Decoration.widget({
								widget: new FootnoteRefWidget(id, ref.index, data.definitions.has(id)),
								side: 1,
							}),
							priority: 1
						});
					}
				}

				// Footnote Definitions
				if (type.name === 'FootnoteDefinition') {
					const marks = node.getChildren('FootnoteDefinitionMark');
					const labelNode = node.getChild('FootnoteDefinitionLabel');

					if (!inCursor && marks.length >= 2 && labelNode) {
						const id = view.state.sliceDoc(labelNode.from, labelNode.to);
						
						items.push({ pos: marks[0].from, endPos: marks[1].to, deco: invisibleDecoration });
						items.push({
							pos: marks[1].to,
							deco: Decoration.widget({
								widget: new FootnoteDefLabelWidget(id),
								side: 1,
							}),
							priority: 1
						});
					}
				}

				// Inline Footnotes
				if (type.name === 'InlineFootnote') {
					const contentNode = node.getChild('InlineFootnoteContent');
					const marks = node.getChildren('InlineFootnoteMark');

					if (!contentNode || marks.length < 2) return;

					const inlineNote = data.inlineByPos.get(nodeFrom);

					if (!inCursor && inlineNote) {
						items.push({ pos: nodeFrom, endPos: nodeTo, deco: invisibleDecoration });
						items.push({
							pos: nodeTo,
							deco: Decoration.widget({
								widget: new InlineFootnoteWidget(inlineNote.content, inlineNote.index),
								side: 1,
							}),
							priority: 1
						});
					}
				}
			},
		});
	}

	// Sort by position, widgets after replace at same position
	items.sort((a, b) => {
		if (a.pos !== b.pos) return a.pos - b.pos;
		return (a.priority || 0) - (b.priority || 0);
	});

	for (const item of items) {
		if (item.endPos !== undefined) {
			builder.add(item.pos, item.endPos, item.deco);
		} else {
			builder.add(item.pos, item.pos, item.deco);
		}
	}

	return builder.finish();
}

// ============================================================================
// Plugin
// ============================================================================

class FootnotePlugin {
	decorations: DecorationSet;
	private data: FootnoteData;
	private cursorFootnotePos = -1;

	constructor(view: EditorView) {
		this.data = collectFootnotes(view.state);
		const { from, to } = view.state.selection.main;
		this.cursorFootnotePos = getCursorFootnotePos(this.data.allRanges, from, to);
		this.decorations = buildDecorations(view, this.data);
	}

	update(update: ViewUpdate) {
		const { docChanged, viewportChanged, selectionSet } = update;

		if (docChanged) {
			// Invalidate cache on doc change
			cachedData = null;
			this.data = collectFootnotes(update.state);
			const { from, to } = update.state.selection.main;
			this.cursorFootnotePos = getCursorFootnotePos(this.data.allRanges, from, to);
			this.decorations = buildDecorations(update.view, this.data);
			return;
		}

		if (viewportChanged) {
			this.decorations = buildDecorations(update.view, this.data);
			return;
		}

		if (selectionSet) {
			const { from, to } = update.state.selection.main;
			const newPos = getCursorFootnotePos(this.data.allRanges, from, to);

			if (newPos !== this.cursorFootnotePos) {
				this.cursorFootnotePos = newPos;
				this.decorations = buildDecorations(update.view, this.data);
			}
		}
	}
}

const footnotePlugin = ViewPlugin.fromClass(FootnotePlugin, {
	decorations: (v) => v.decorations,
});

// ============================================================================
// Hover Tooltip
// ============================================================================

const footnoteHoverTooltip = hoverTooltip(
	(view, pos): Tooltip | null => {
		const data = collectFootnotes(view.state);

		// Check widget elements first
		const coords = view.coordsAtPos(pos);
		if (coords) {
			const target = document.elementFromPoint(coords.left, coords.top) as HTMLElement | null;

			if (target?.classList.contains('cm-footnote-ref')) {
				const id = target.dataset.footnoteId;
				if (id) {
					const def = data.definitions.get(id);
					if (def) {
						return {
							pos,
							above: true,
							arrow: true,
							create: () => createTooltipDom(id, def.content),
						};
					}
				}
			}

			if (target?.classList.contains('cm-inline-footnote-ref')) {
				const content = target.dataset.footnoteContent;
				const index = target.dataset.footnoteIndex;
				if (content && index) {
					return {
						pos,
						above: true,
						arrow: true,
						create: () => createInlineTooltipDom(parseInt(index), content),
					};
				}
			}
		}

		// Check by position using indexed data
		const ref = data.referencesByPos.get(pos);
		if (ref) {
			const def = data.definitions.get(ref.id);
			if (def) {
				return {
					pos: ref.to,
					above: true,
					arrow: true,
					create: () => createTooltipDom(ref.id, def.content),
				};
			}
		}

		const inline = data.inlineByPos.get(pos);
		if (inline) {
			return {
				pos: inline.to,
				above: true,
				arrow: true,
				create: () => createInlineTooltipDom(inline.index, inline.content),
			};
		}

		// Fallback: check if pos is within any footnote range
		for (const ref of data.references) {
			if (pos >= ref.from && pos <= ref.to) {
				const def = data.definitions.get(ref.id);
				if (def) {
					return {
						pos: ref.to,
						above: true,
						arrow: true,
						create: () => createTooltipDom(ref.id, def.content),
					};
				}
			}
		}

		for (const inline of data.inlineFootnotes) {
			if (pos >= inline.from && pos <= inline.to) {
				return {
					pos: inline.to,
					above: true,
					arrow: true,
					create: () => createInlineTooltipDom(inline.index, inline.content),
				};
			}
		}

		return null;
	},
	{ hoverTime: 300 }
);

function createTooltipDom(id: string, content: string): { dom: HTMLElement } {
	const dom = document.createElement('div');
	dom.className = 'cm-footnote-tooltip';

	const header = document.createElement('div');
	header.className = 'cm-footnote-tooltip-header';
	header.textContent = `[^${id}]`;

	const body = document.createElement('div');
	body.className = 'cm-footnote-tooltip-body';
	body.textContent = content || '(Empty footnote)';

	dom.appendChild(header);
	dom.appendChild(body);

	return { dom };
}

function createInlineTooltipDom(index: number, content: string): { dom: HTMLElement } {
	const dom = document.createElement('div');
	dom.className = 'cm-footnote-tooltip';

	const header = document.createElement('div');
	header.className = 'cm-footnote-tooltip-header';
	header.textContent = `Inline Footnote [${index}]`;

	const body = document.createElement('div');
	body.className = 'cm-footnote-tooltip-body';
	body.textContent = content || '(Empty footnote)';

	dom.appendChild(header);
	dom.appendChild(body);

	return { dom };
}

// ============================================================================
// Click Handler
// ============================================================================

const footnoteClickHandler = EditorView.domEventHandlers({
	mousedown(event, view) {
		const target = event.target as HTMLElement;

		// Click on footnote reference → jump to definition
		if (target.classList.contains('cm-footnote-ref')) {
			const id = target.dataset.footnoteId;
			if (id) {
				const data = collectFootnotes(view.state);
				const def = data.definitions.get(id);
				if (def) {
					event.preventDefault();
					setTimeout(() => {
						view.dispatch({
							selection: { anchor: def.from },
							scrollIntoView: true,
						});
						view.focus();
					}, 0);
					return true;
				}
			}
		}

		// Click on definition label → jump to first reference
		if (target.classList.contains('cm-footnote-def-label')) {
			const id = target.dataset.footnoteId;
			if (id) {
				const data = collectFootnotes(view.state);
				const firstRef = data.firstRefById.get(id);
				if (firstRef) {
					event.preventDefault();
					setTimeout(() => {
						view.dispatch({
							selection: { anchor: firstRef.from },
							scrollIntoView: true,
						});
						view.focus();
					}, 0);
					return true;
				}
			}
		}

		return false;
	},
});

// ============================================================================
// Theme
// ============================================================================

const baseTheme = EditorView.baseTheme({
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
		borderRadius: '3px',
		cursor: 'pointer',
		transition: 'all 0.15s ease',
		textDecoration: 'none',
	},
	'.cm-footnote-ref:hover': {
		color: 'var(--cm-footnote-hover-color, #1557b0)',
		backgroundColor: 'var(--cm-footnote-hover-bg, rgba(26, 115, 232, 0.2))',
	},
	'.cm-footnote-ref-undefined': {
		color: 'var(--cm-footnote-undefined-color, #d93025)',
		backgroundColor: 'var(--cm-footnote-undefined-bg, rgba(217, 48, 37, 0.1))',
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
		borderRadius: '3px',
		cursor: 'pointer',
		transition: 'all 0.15s ease',
		textDecoration: 'none',
	},
	'.cm-inline-footnote-ref:hover': {
		color: 'var(--cm-inline-footnote-hover-color, #d35400)',
		backgroundColor: 'var(--cm-inline-footnote-hover-bg, rgba(230, 126, 34, 0.2))',
	},

	'.cm-footnote-def-label': {
		color: 'var(--cm-footnote-def-color, #1a73e8)',
		fontWeight: '600',
		cursor: 'pointer',
	},
	'.cm-footnote-def-label:hover': {
		textDecoration: 'underline',
	},

	'.cm-footnote-tooltip': {
		maxWidth: '400px',
		padding: '0',
		backgroundColor: 'var(--bg-secondary)',
		border: '1px solid var(--border-color)',
		boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
		overflow: 'hidden',
	},
	'.cm-footnote-tooltip-header': {
		padding: '6px 12px',
		fontSize: '0.8em',
		fontWeight: '600',
		fontFamily: 'monospace',
		color: 'var(--cm-footnote-color, #1a73e8)',
		backgroundColor: 'var(--bg-tertiary, rgba(0, 0, 0, 0.05))',
		borderBottom: '1px solid var(--border-color)',
	},
	'.cm-footnote-tooltip-body': {
		padding: '10px 12px',
		fontSize: '0.9em',
		lineHeight: '1.5',
		color: 'var(--text-primary)',
		whiteSpace: 'pre-wrap',
		wordBreak: 'break-word',
	},

	'.cm-tooltip:has(.cm-footnote-tooltip)': {
		animation: 'cm-footnote-fade-in 0.15s ease-out',
	},
	'@keyframes cm-footnote-fade-in': {
		from: { opacity: '0', transform: 'translateY(4px)' },
		to: { opacity: '1', transform: 'translateY(0)' },
	},
});

// ============================================================================
// Export
// ============================================================================

/**
 * Footnote extension.
 */
export const footnote = (): Extension => [
	footnotePlugin,
	footnoteHoverTooltip,
	footnoteClickHandler,
	baseTheme,
];

export default footnote;

/**
 * Get footnote data for external use.
 */
export function getFootnoteData(state: EditorState): FootnoteData {
	return collectFootnotes(state);
}
