import {
	Decoration,
	DecorationSet,
	EditorView,
	ViewPlugin,
	ViewUpdate,
	WidgetType
} from '@codemirror/view';
import { Range, StateField, Transaction } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import { isCursorInRange } from '../util';

/**
 * Pattern for bullet list markers.
 */
const BULLET_LIST_MARKER_RE = /^[-+*]$/;

/**
 * Lists plugin.
 *
 * Features:
 * - Custom bullet mark rendering (- → •)
 * - Interactive task list checkboxes
 */
export const lists = () => [listBulletPlugin, taskListField, baseTheme];

// ============================================================================
// List Bullet Plugin
// ============================================================================

/**
 * Widget to render list bullet mark.
 */
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
 * Build list bullet decorations.
 */
function buildListBulletDecorations(view: EditorView): DecorationSet {
	const decorations: Range<Decoration>[] = [];

	for (const { from, to } of view.visibleRanges) {
		syntaxTree(view.state).iterate({
			from,
			to,
			enter: ({ type, from: nodeFrom, to: nodeTo, node }) => {
				if (type.name !== 'ListMark') return;

				// Skip if this is part of a task list (has Task sibling)
				const parent = node.parent;
				if (parent) {
					const task = parent.getChild('Task');
					if (task) return;
				}

				// Skip if cursor is in this range
				if (isCursorInRange(view.state, [nodeFrom, nodeTo])) return;

				const listMark = view.state.sliceDoc(nodeFrom, nodeTo);
				if (BULLET_LIST_MARKER_RE.test(listMark)) {
					decorations.push(
						Decoration.replace({
							widget: new ListBulletWidget(listMark)
						}).range(nodeFrom, nodeTo)
					);
				}
			}
		});
	}

	return Decoration.set(decorations, true);
}

/**
 * List bullet plugin.
 */
class ListBulletPlugin {
	decorations: DecorationSet;
	private lastSelectionHead: number = -1;

	constructor(view: EditorView) {
		this.decorations = buildListBulletDecorations(view);
		this.lastSelectionHead = view.state.selection.main.head;
	}

	update(update: ViewUpdate) {
		if (update.docChanged || update.viewportChanged) {
			this.decorations = buildListBulletDecorations(update.view);
			this.lastSelectionHead = update.state.selection.main.head;
			return;
		}

		if (update.selectionSet) {
			const newHead = update.state.selection.main.head;
			const oldLine = update.startState.doc.lineAt(this.lastSelectionHead);
			const newLine = update.state.doc.lineAt(newHead);

			if (oldLine.number !== newLine.number) {
				this.decorations = buildListBulletDecorations(update.view);
			}
			this.lastSelectionHead = newHead;
		}
	}
}

const listBulletPlugin = ViewPlugin.fromClass(ListBulletPlugin, {
	decorations: (v) => v.decorations
});

// ============================================================================
// Task List Plugin (using StateField to avoid flickering)
// ============================================================================

/**
 * Widget to render checkbox for a task list item.
 */
class TaskCheckboxWidget extends WidgetType {
	constructor(
		readonly checked: boolean,
		readonly pos: number // Position of the checkbox character in document
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

		// Handle click directly in the widget
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
 * Build task list decorations from state.
 */
function buildTaskListDecorations(state: import('@codemirror/state').EditorState): DecorationSet {
	const decorations: Range<Decoration>[] = [];

	syntaxTree(state).iterate({
		enter: ({ type, from: taskFrom, to: taskTo, node }) => {
			if (type.name !== 'Task') return;

			const listItem = node.parent;
			if (!listItem || listItem.type.name !== 'ListItem') return;

			const listMark = listItem.getChild('ListMark');
			const taskMarker = node.getChild('TaskMarker');

			if (!listMark || !taskMarker) return;

			const replaceFrom = listMark.from;
			const replaceTo = taskMarker.to;

			// Check if cursor is in this range
			if (isCursorInRange(state, [replaceFrom, replaceTo])) return;

			// Check if task is checked - position of x or space is taskMarker.from + 1
			const markerText = state.sliceDoc(taskMarker.from, taskMarker.to);
			const isChecked = markerText.length >= 2 && 'xX'.includes(markerText[1]);
			const checkboxPos = taskMarker.from + 1; // Position of the x or space

			if (isChecked) {
				decorations.push(
					Decoration.mark({ class: 'cm-task-checked' }).range(taskFrom, taskTo)
				);
			}

			// Replace "- [x]" or "- [ ]" with checkbox widget
			decorations.push(
				Decoration.replace({
					widget: new TaskCheckboxWidget(isChecked, checkboxPos)
				}).range(replaceFrom, replaceTo)
			);
		}
	});

	return Decoration.set(decorations, true);
}

/**
 * Task list StateField - uses incremental updates to avoid flickering.
 */
const taskListField = StateField.define<DecorationSet>({
	create(state) {
		return buildTaskListDecorations(state);
	},

	update(value, tr: Transaction) {
		// Only rebuild when document or selection changes
		if (tr.docChanged || tr.selection) {
			return buildTaskListDecorations(tr.state);
		}
		return value;
	},

	provide(field) {
		return EditorView.decorations.from(field);
	}
});

// ============================================================================
// Theme
// ============================================================================

/**
 * Base theme for lists.
 */
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
