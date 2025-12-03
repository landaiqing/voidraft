import {
	Decoration,
	DecorationSet,
	EditorView,
	ViewPlugin,
	ViewUpdate,
	WidgetType
} from '@codemirror/view';
import { Range, RangeSetBuilder, EditorState } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import { checkRangeOverlap, RangeTuple } from '../util';

/** Bullet list marker pattern */
const BULLET_LIST_MARKER_RE = /^[-+*]$/;

/**
 * Lists plugin.
 *
 * Features:
 * - Custom bullet mark rendering (- → •)
 * - Interactive task list checkboxes
 */
export const lists = () => [listBulletPlugin, taskListPlugin, baseTheme];

// ============================================================================
// List Bullet Plugin
// ============================================================================

class ListBulletWidget extends WidgetType {
	constructor(readonly bullet: string) {
		super();
	}

	eq(other: ListBulletWidget): boolean {
		return other.bullet === this.bullet;
	}

	toDOM(): HTMLElement {
		const span = document.createElement('span');
		span.className = 'cm-list-bullet';
		span.textContent = '•';
		return span;
	}
}

/**
 * Collect all list mark ranges in visible viewport.
 */
function collectBulletRanges(view: EditorView): RangeTuple[] {
	const ranges: RangeTuple[] = [];
	const seen = new Set<number>();

	for (const { from, to } of view.visibleRanges) {
		syntaxTree(view.state).iterate({
			from,
			to,
			enter: ({ type, from: nodeFrom, to: nodeTo, node }) => {
				if (type.name !== 'ListMark') return;
				
				// Skip task list items
				const parent = node.parent;
				if (parent?.getChild('Task')) return;
				
				// Only bullet markers
				const text = view.state.sliceDoc(nodeFrom, nodeTo);
				if (!BULLET_LIST_MARKER_RE.test(text)) return;

				if (seen.has(nodeFrom)) return;
				seen.add(nodeFrom);
				ranges.push([nodeFrom, nodeTo]);
			}
		});
	}

	return ranges;
}

/**
 * Get which bullet the cursor is in (-1 if none).
 */
function getCursorBulletPos(ranges: RangeTuple[], selFrom: number, selTo: number): number {
	const selRange: RangeTuple = [selFrom, selTo];
	
	for (const range of ranges) {
		if (checkRangeOverlap(range, selRange)) {
			return range[0];
		}
	}
	return -1;
}

/**
 * Build list bullet decorations.
 */
function buildBulletDecorations(view: EditorView): DecorationSet {
	const builder = new RangeSetBuilder<Decoration>();
	const items: { from: number; to: number; bullet: string }[] = [];
	const { from: selFrom, to: selTo } = view.state.selection.main;
	const selRange: RangeTuple = [selFrom, selTo];
	const seen = new Set<number>();

	for (const { from, to } of view.visibleRanges) {
		syntaxTree(view.state).iterate({
			from,
			to,
			enter: ({ type, from: nodeFrom, to: nodeTo, node }) => {
				if (type.name !== 'ListMark') return;
				
				// Skip task list items
				const parent = node.parent;
				if (parent?.getChild('Task')) return;

				if (seen.has(nodeFrom)) return;
				seen.add(nodeFrom);

				// Skip if cursor is in this mark
				if (checkRangeOverlap([nodeFrom, nodeTo], selRange)) return;

				const bullet = view.state.sliceDoc(nodeFrom, nodeTo);
				if (BULLET_LIST_MARKER_RE.test(bullet)) {
					items.push({ from: nodeFrom, to: nodeTo, bullet });
				}
			}
		});
	}

	// Sort and add to builder
	items.sort((a, b) => a.from - b.from);
	
	for (const item of items) {
		builder.add(item.from, item.to, Decoration.replace({
			widget: new ListBulletWidget(item.bullet)
		}));
	}

	return builder.finish();
}

/**
 * List bullet plugin with optimized updates.
 */
class ListBulletPlugin {
	decorations: DecorationSet;
	private bulletRanges: RangeTuple[] = [];
	private cursorBulletPos = -1;

	constructor(view: EditorView) {
		this.bulletRanges = collectBulletRanges(view);
		const { from, to } = view.state.selection.main;
		this.cursorBulletPos = getCursorBulletPos(this.bulletRanges, from, to);
		this.decorations = buildBulletDecorations(view);
	}

	update(update: ViewUpdate) {
		const { docChanged, viewportChanged, selectionSet } = update;

		if (docChanged || viewportChanged) {
			this.bulletRanges = collectBulletRanges(update.view);
			const { from, to } = update.state.selection.main;
			this.cursorBulletPos = getCursorBulletPos(this.bulletRanges, from, to);
			this.decorations = buildBulletDecorations(update.view);
			return;
		}

		if (selectionSet) {
			const { from, to } = update.state.selection.main;
			const newPos = getCursorBulletPos(this.bulletRanges, from, to);

			if (newPos !== this.cursorBulletPos) {
				this.cursorBulletPos = newPos;
				this.decorations = buildBulletDecorations(update.view);
			}
		}
	}
}

const listBulletPlugin = ViewPlugin.fromClass(ListBulletPlugin, {
	decorations: (v) => v.decorations
});

// ============================================================================
// Task List Plugin
// ============================================================================

class TaskCheckboxWidget extends WidgetType {
	constructor(
		readonly checked: boolean,
		readonly pos: number
	) {
		super();
	}

	eq(other: TaskCheckboxWidget): boolean {
		return other.checked === this.checked && other.pos === this.pos;
	}

	toDOM(view: EditorView): HTMLElement {
		const wrap = document.createElement('span');
		wrap.setAttribute('aria-hidden', 'true');
		wrap.className = 'cm-task-checkbox';

		const checkbox = document.createElement('input');
		checkbox.type = 'checkbox';
		checkbox.checked = this.checked;
		checkbox.tabIndex = -1;

		checkbox.addEventListener('mousedown', (e) => {
			e.preventDefault();
			e.stopPropagation();

			const newValue = !this.checked;
			view.dispatch({
				changes: {
					from: this.pos,
					to: this.pos + 1,
					insert: newValue ? 'x' : ' '
				}
			});
		});

		wrap.appendChild(checkbox);
		return wrap;
	}

	ignoreEvent(): boolean {
		return false;
	}
}

/**
 * Collect all task ranges in visible viewport.
 */
function collectTaskRanges(view: EditorView): RangeTuple[] {
	const ranges: RangeTuple[] = [];
	const seen = new Set<number>();

	for (const { from, to } of view.visibleRanges) {
		syntaxTree(view.state).iterate({
			from,
			to,
			enter: ({ type, from: nodeFrom, to: nodeTo, node }) => {
				if (type.name !== 'Task') return;
				
				const listItem = node.parent;
				if (!listItem || listItem.type.name !== 'ListItem') return;
				
				const listMark = listItem.getChild('ListMark');
				if (!listMark) return;

				if (seen.has(listMark.from)) return;
				seen.add(listMark.from);
				
				// Track the full range from ListMark to TaskMarker
				const taskMarker = node.getChild('TaskMarker');
				if (taskMarker) {
					ranges.push([listMark.from, taskMarker.to]);
				}
			}
		});
	}

	return ranges;
}

/**
 * Get which task the cursor is in (-1 if none).
 */
function getCursorTaskPos(ranges: RangeTuple[], selFrom: number, selTo: number): number {
	const selRange: RangeTuple = [selFrom, selTo];
	
	for (const range of ranges) {
		if (checkRangeOverlap(range, selRange)) {
			return range[0];
		}
	}
	return -1;
}

/**
 * Build task list decorations.
 */
function buildTaskDecorations(view: EditorView): DecorationSet {
	const builder = new RangeSetBuilder<Decoration>();
	const items: { from: number; to: number; deco: Decoration; priority: number }[] = [];
	const { from: selFrom, to: selTo } = view.state.selection.main;
	const selRange: RangeTuple = [selFrom, selTo];
	const seen = new Set<number>();

	for (const { from, to } of view.visibleRanges) {
		syntaxTree(view.state).iterate({
			from,
			to,
			enter: ({ type, from: taskFrom, to: taskTo, node }) => {
				if (type.name !== 'Task') return;

				const listItem = node.parent;
				if (!listItem || listItem.type.name !== 'ListItem') return;

				const listMark = listItem.getChild('ListMark');
				const taskMarker = node.getChild('TaskMarker');
				if (!listMark || !taskMarker) return;

				if (seen.has(listMark.from)) return;
				seen.add(listMark.from);

				const replaceFrom = listMark.from;
				const replaceTo = taskMarker.to;

				// Skip if cursor is in this range
				if (checkRangeOverlap([replaceFrom, replaceTo], selRange)) return;

				// Check if task is checked
				const markerText = view.state.sliceDoc(taskMarker.from, taskMarker.to);
				const isChecked = markerText.length >= 2 && 'xX'.includes(markerText[1]);
				const checkboxPos = taskMarker.from + 1;

				// Add strikethrough for checked items
				if (isChecked) {
					items.push({
						from: taskFrom,
						to: taskTo,
						deco: Decoration.mark({ class: 'cm-task-checked' }),
						priority: 0
					});
				}

				// Replace "- [x]" or "- [ ]" with checkbox widget
				items.push({
					from: replaceFrom,
					to: replaceTo,
					deco: Decoration.replace({
						widget: new TaskCheckboxWidget(isChecked, checkboxPos)
					}),
					priority: 1
				});
			}
		});
	}

	// Sort by position, then priority
	items.sort((a, b) => {
		if (a.from !== b.from) return a.from - b.from;
		return a.priority - b.priority;
	});
	
	for (const item of items) {
		builder.add(item.from, item.to, item.deco);
	}

	return builder.finish();
}

/**
 * Task list plugin with optimized updates.
 */
class TaskListPlugin {
	decorations: DecorationSet;
	private taskRanges: RangeTuple[] = [];
	private cursorTaskPos = -1;

	constructor(view: EditorView) {
		this.taskRanges = collectTaskRanges(view);
		const { from, to } = view.state.selection.main;
		this.cursorTaskPos = getCursorTaskPos(this.taskRanges, from, to);
		this.decorations = buildTaskDecorations(view);
	}

	update(update: ViewUpdate) {
		const { docChanged, viewportChanged, selectionSet } = update;

		if (docChanged || viewportChanged) {
			this.taskRanges = collectTaskRanges(update.view);
			const { from, to } = update.state.selection.main;
			this.cursorTaskPos = getCursorTaskPos(this.taskRanges, from, to);
			this.decorations = buildTaskDecorations(update.view);
			return;
		}

		if (selectionSet) {
			const { from, to } = update.state.selection.main;
			const newPos = getCursorTaskPos(this.taskRanges, from, to);

			if (newPos !== this.cursorTaskPos) {
				this.cursorTaskPos = newPos;
				this.decorations = buildTaskDecorations(update.view);
			}
		}
	}
}

const taskListPlugin = ViewPlugin.fromClass(TaskListPlugin, {
	decorations: (v) => v.decorations
});

// ============================================================================
// Theme
// ============================================================================

const baseTheme = EditorView.baseTheme({
	'.cm-list-bullet': {
		color: 'var(--cm-list-bullet-color, inherit)'
	},
	'.cm-task-checked': {
		textDecoration: 'line-through',
		opacity: '0.6'
	},
	'.cm-task-checkbox': {
		display: 'inline-block',
		verticalAlign: 'baseline'
	},
	'.cm-task-checkbox input': {
		cursor: 'pointer',
		margin: '0',
		width: '1em',
		height: '1em',
		position: 'relative',
		top: '0.1em'
	}
});
