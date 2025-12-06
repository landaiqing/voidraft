/**
 * List handlers and theme.
 * Handles: ListMark (bullets), Task (checkboxes)
 */

import { Decoration, EditorView, WidgetType } from '@codemirror/view';
import { checkRangeOverlap, RangeTuple } from '../util';
import { SyntaxNode } from '@lezer/common';
import { BuildContext } from './types';

const BULLET_RE = /^[-+*]$/;

class ListBulletWidget extends WidgetType {
	constructor(readonly bullet: string) { super(); }
	eq(other: ListBulletWidget) { return other.bullet === this.bullet; }
	toDOM(): HTMLElement {
		const span = document.createElement('span');
		span.className = 'cm-list-bullet';
		span.textContent = '•';
		return span;
	}
}

class TaskCheckboxWidget extends WidgetType {
	constructor(readonly checked: boolean, readonly pos: number) { super(); }
	eq(other: TaskCheckboxWidget) { return other.checked === this.checked && other.pos === this.pos; }
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
			view.dispatch({ changes: { from: this.pos, to: this.pos + 1, insert: this.checked ? ' ' : 'x' } });
		});
		wrap.appendChild(checkbox);
		return wrap;
	}
	ignoreEvent() { return false; }
}

/**
 * Handle ListMark node (bullet markers).
 */
export function handleListMark(
	ctx: BuildContext,
	nf: number,
	nt: number,
	node: SyntaxNode,
	inCursor: boolean,
	ranges: RangeTuple[]
): void {
	const parent = node.parent;
	if (parent?.getChild('Task')) return;
	if (ctx.seen.has(nf)) return;
	ctx.seen.add(nf);
	ranges.push([nf, nt]);
	if (inCursor) return;

	const bullet = ctx.view.state.sliceDoc(nf, nt);
	if (BULLET_RE.test(bullet)) {
		ctx.items.push({ from: nf, to: nt, deco: Decoration.replace({ widget: new ListBulletWidget(bullet) }) });
	}
}

/**
 * Handle Task node (checkboxes).
 */
export function handleTask(
	ctx: BuildContext,
	nf: number,
	nt: number,
	node: SyntaxNode,
	ranges: RangeTuple[]
): void {
	const listItem = node.parent;
	if (!listItem || listItem.type.name !== 'ListItem') return;
	const listMark = listItem.getChild('ListMark');
	const taskMarker = node.getChild('TaskMarker');
	if (!listMark || !taskMarker) return;
	if (ctx.seen.has(listMark.from)) return;
	ctx.seen.add(listMark.from);
	ranges.push([listMark.from, taskMarker.to]);
	if (checkRangeOverlap([listMark.from, taskMarker.to], ctx.selRange)) return;

	const markerText = ctx.view.state.sliceDoc(taskMarker.from, taskMarker.to);
	const isChecked = markerText.length >= 2 && 'xX'.includes(markerText[1]);
	if (isChecked) {
		ctx.items.push({ from: nf, to: nt, deco: Decoration.mark({ class: 'cm-task-checked' }), priority: 0 });
	}
	ctx.items.push({ from: listMark.from, to: taskMarker.to, deco: Decoration.replace({ widget: new TaskCheckboxWidget(isChecked, taskMarker.from + 1) }), priority: 1 });
}

/**
 * Theme for lists.
 */
export const listTheme = EditorView.baseTheme({
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
