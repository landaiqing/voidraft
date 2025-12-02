/**
 * Footnote plugin for CodeMirror.
 *
 * Features:
 * - Renders footnote references as superscript numbers/labels
 * - Renders inline footnotes as superscript numbers with embedded content
 * - Shows footnote content on hover (tooltip)
 * - Click to jump between reference and definition
 * - Hides syntax marks when cursor is outside
 *
 * Syntax (MultiMarkdown/PHP Markdown Extra):
 * - Reference: [^id] → renders as superscript
 * - Definition: [^id]: content
 * - Inline footnote: ^[content] → renders as superscript with embedded content
 */

import { Extension, Range, StateField, EditorState } from '@codemirror/state';
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
import { isCursorInRange, invisibleDecoration } from '../util';

// ============================================================================
// Types
// ============================================================================

/**
 * Information about a footnote definition.
 */
interface FootnoteDefinition {
	/** The footnote identifier (e.g., "1", "note") */
	id: string;
	/** The content of the footnote */
	content: string;
	/** Start position in document */
	from: number;
	/** End position in document */
	to: number;
}

/**
 * Information about a footnote reference.
 */
interface FootnoteReference {
	/** The footnote identifier */
	id: string;
	/** Start position in document */
	from: number;
	/** End position in document */
	to: number;
	/** Numeric index (1-based, for display) */
	index: number;
}

/**
 * Information about an inline footnote.
 */
interface InlineFootnoteInfo {
	/** The content of the inline footnote */
	content: string;
	/** Start position in document */
	from: number;
	/** End position in document */
	to: number;
	/** Numeric index (1-based, for display) */
	index: number;
}

/**
 * Collected footnote data from the document.
 * Uses Maps for O(1) lookup by position and id.
 */
interface FootnoteData {
	definitions: Map<string, FootnoteDefinition>;
	references: FootnoteReference[];
	inlineFootnotes: InlineFootnoteInfo[];
	// Index maps for O(1) lookup
	referencesByPos: Map<number, FootnoteReference>;
	inlineByPos: Map<number, InlineFootnoteInfo>;
	firstRefById: Map<string, FootnoteReference>;
}

// ============================================================================
// Footnote Collection
// ============================================================================

/**
 * Collect all footnote definitions, references, and inline footnotes from the document.
 * Builds index maps for O(1) lookup during decoration and tooltip handling.
 */
function collectFootnotes(state: EditorState): FootnoteData {
	const definitions = new Map<string, FootnoteDefinition>();
	const references: FootnoteReference[] = [];
	const inlineFootnotes: InlineFootnoteInfo[] = [];
	// Index maps for fast lookup
	const referencesByPos = new Map<number, FootnoteReference>();
	const inlineByPos = new Map<number, InlineFootnoteInfo>();
	const firstRefById = new Map<string, FootnoteReference>();
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

					definitions.set(id, { id, content, from, to });
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

					// Track first reference for each id
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
				}
			}
		},
	});

	return {
		definitions,
		references,
		inlineFootnotes,
		referencesByPos,
		inlineByPos,
		firstRefById,
	};
}

// ============================================================================
// State Field
// ============================================================================

/**
 * State field to track footnote data across the document.
 * This allows efficient lookup for tooltips and navigation.
 */
export const footnoteDataField = StateField.define<FootnoteData>({
	create(state) {
		return collectFootnotes(state);
	},
	update(value, tr) {
		if (tr.docChanged) {
			return collectFootnotes(tr.state);
		}
		return value;
	},
});

// ============================================================================
// Widget
// ============================================================================

/**
 * Widget to display footnote reference as superscript.
 */
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

/**
 * Widget to display inline footnote as superscript.
 */
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

/**
 * Widget to display footnote definition label.
 */
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
// Decorations
// ============================================================================

/**
 * Build decorations for footnote references and inline footnotes.
 */
function buildDecorations(view: EditorView): DecorationSet {
	const decorations: Range<Decoration>[] = [];
	const data = view.state.field(footnoteDataField);

	for (const { from, to } of view.visibleRanges) {
		syntaxTree(view.state).iterate({
			from,
			to,
			enter: ({ type, from: nodeFrom, to: nodeTo, node }) => {
				// Handle footnote references
				if (type.name === 'FootnoteReference') {
					const cursorInRange = isCursorInRange(view.state, [nodeFrom, nodeTo]);
					const labelNode = node.getChild('FootnoteReferenceLabel');
					const marks = node.getChildren('FootnoteReferenceMark');

					if (!labelNode || marks.length < 2) return;

					const id = view.state.sliceDoc(labelNode.from, labelNode.to);
					const ref = data.referencesByPos.get(nodeFrom);

					if (!cursorInRange && ref && ref.id === id) {
						// Hide the entire syntax and show widget
						decorations.push(invisibleDecoration.range(nodeFrom, nodeTo));

						// Add widget at the end
						const widget = new FootnoteRefWidget(
							id,
							ref.index,
							data.definitions.has(id)
						);
						decorations.push(
							Decoration.widget({
								widget,
								side: 1,
							}).range(nodeTo)
						);
					}
				}

				// Handle footnote definitions
				if (type.name === 'FootnoteDefinition') {
					const cursorInRange = isCursorInRange(view.state, [nodeFrom, nodeTo]);
					const marks = node.getChildren('FootnoteDefinitionMark');
					const labelNode = node.getChild('FootnoteDefinitionLabel');

					if (!cursorInRange && marks.length >= 2 && labelNode) {
						const id = view.state.sliceDoc(labelNode.from, labelNode.to);
						
						// Hide the entire [^id]: part
						decorations.push(invisibleDecoration.range(marks[0].from, marks[1].to));

						// Add widget to show [id]
						const widget = new FootnoteDefLabelWidget(id);
						decorations.push(
							Decoration.widget({
								widget,
								side: 1,
							}).range(marks[1].to)
						);
					}
				}

				// Handle inline footnotes
				if (type.name === 'InlineFootnote') {
					const cursorInRange = isCursorInRange(view.state, [nodeFrom, nodeTo]);
					const contentNode = node.getChild('InlineFootnoteContent');
					const marks = node.getChildren('InlineFootnoteMark');

					if (!contentNode || marks.length < 2) return;

					const inlineNote = data.inlineByPos.get(nodeFrom);

					if (!cursorInRange && inlineNote) {
						// Hide the entire syntax and show widget
						decorations.push(invisibleDecoration.range(nodeFrom, nodeTo));

						// Add widget at the end
						const widget = new InlineFootnoteWidget(
							inlineNote.content,
							inlineNote.index
						);
						decorations.push(
							Decoration.widget({
								widget,
								side: 1,
							}).range(nodeTo)
						);
					}
				}
			},
		});
	}

	return Decoration.set(decorations, true);
}

// ============================================================================
// Plugin Class
// ============================================================================

/**
 * Footnote view plugin with optimized update detection.
 */
class FootnotePlugin {
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

const footnotePlugin = ViewPlugin.fromClass(FootnotePlugin, {
	decorations: (v) => v.decorations,
});

// ============================================================================
// Hover Tooltip
// ============================================================================

/**
 * Hover tooltip that shows footnote content.
 */
const footnoteHoverTooltip = hoverTooltip(
	(view, pos): Tooltip | null => {
		const data = view.state.field(footnoteDataField);

		// Check if hovering over a footnote reference widget
		const target = document.elementFromPoint(
			view.coordsAtPos(pos)?.left ?? 0,
			view.coordsAtPos(pos)?.top ?? 0
		) as HTMLElement | null;

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

		// Check if hovering over an inline footnote widget
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

		// Check if position is within a footnote reference node
		let foundId: string | null = null;
		let foundPos: number = pos;
		let foundInlineContent: string | null = null;
		let foundInlineIndex: number | null = null;

		syntaxTree(view.state).iterate({
			from: pos,
			to: pos,
			enter: ({ type, from, to, node }) => {
				if (type.name === 'FootnoteReference') {
					const labelNode = node.getChild('FootnoteReferenceLabel');
					if (labelNode && pos >= from && pos <= to) {
						foundId = view.state.sliceDoc(labelNode.from, labelNode.to);
						foundPos = to;
					}
				} else if (type.name === 'InlineFootnote') {
					const contentNode = node.getChild('InlineFootnoteContent');
					if (contentNode && pos >= from && pos <= to) {
						foundInlineContent = view.state.sliceDoc(contentNode.from, contentNode.to);
						const inlineNote = data.inlineByPos.get(from);
						if (inlineNote) {
							foundInlineIndex = inlineNote.index;
						}
						foundPos = to;
					}
				}
			},
		});

		if (foundId) {
			const def = data.definitions.get(foundId);
			if (def) {
				const tooltipId = foundId;
				const tooltipPos = foundPos;
				return {
					pos: tooltipPos,
					above: true,
					arrow: true,
					create: () => createTooltipDom(tooltipId, def.content),
				};
			}
		}

		if (foundInlineContent && foundInlineIndex !== null) {
			const tooltipContent = foundInlineContent;
			const tooltipIndex = foundInlineIndex;
			const tooltipPos = foundPos;
			return {
				pos: tooltipPos,
				above: true,
				arrow: true,
				create: () => createInlineTooltipDom(tooltipIndex, tooltipContent),
			};
		}

		return null;
	},
	{ hoverTime: 300 }
);

/**
 * Create tooltip DOM element for regular footnote.
 */
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

/**
 * Create tooltip DOM element for inline footnote.
 */
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

/**
 * Click handler for footnote navigation.
 * Uses mousedown to intercept before editor moves cursor.
 * - Click on reference → jump to definition
 * - Click on definition label → jump to first reference
 */
const footnoteClickHandler = EditorView.domEventHandlers({
	mousedown(event, view) {
		const target = event.target as HTMLElement;

		// Handle click on footnote reference widget
		if (target.classList.contains('cm-footnote-ref')) {
			const id = target.dataset.footnoteId;
			if (id) {
				const data = view.state.field(footnoteDataField);
				const def = data.definitions.get(id);
				if (def) {
					// Prevent default to stop cursor from moving to widget position
					event.preventDefault();
					// Use setTimeout to dispatch after mousedown completes
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

		// Handle click on definition label
		if (target.classList.contains('cm-footnote-def-label')) {
			const pos = view.posAtDOM(target);
			if (pos !== null) {
				const data = view.state.field(footnoteDataField);

				// Find which definition this belongs to
				for (const [id, def] of data.definitions) {
					if (pos >= def.from && pos <= def.to) {
						// O(1) lookup for first reference
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
						break;
					}
				}
			}
		}

		return false;
	},
});

// ============================================================================
// Theme
// ============================================================================

/**
 * Base theme for footnotes.
 */
const baseTheme = EditorView.baseTheme({
	// Footnote reference (superscript)
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

	// Inline footnote reference (superscript) - uses distinct color
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

	// Footnote definition label
	'.cm-footnote-def-label': {
		color: 'var(--cm-footnote-def-color, #1a73e8)',
		fontWeight: '600',
		cursor: 'pointer',
	},
	'.cm-footnote-def-label:hover': {
		textDecoration: 'underline',
	},

	// Tooltip
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

	// Tooltip animation
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
 *
 * Features:
 * - Parses footnote references [^id] and definitions [^id]: content
 * - Parses inline footnotes ^[content]
 * - Renders references and inline footnotes as superscript numbers
 * - Shows definition/content on hover
 * - Click to navigate between reference and definition
 */
export const footnote = (): Extension => [
	footnoteDataField,
	footnotePlugin,
	footnoteHoverTooltip,
	footnoteClickHandler,
	baseTheme,
];

export default footnote;

