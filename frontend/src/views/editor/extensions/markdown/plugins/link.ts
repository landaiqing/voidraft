/**
 * Link handler with underline and clickable icon.
 */

import { Decoration, EditorView, WidgetType } from '@codemirror/view';
import { checkRangeOverlap, invisibleDecoration, RangeTuple } from '../util';
import { SyntaxNode } from '@lezer/common';
import { BuildContext } from './types';
import * as runtime from "@wailsio/runtime";

const BLACKLISTED_LINK_PARENTS = new Set(['Image', 'LinkReference']);

/** Link text decoration with underline */
const linkTextDecoration = Decoration.mark({ class: 'cm-md-link-text' });

/** Link icon widget - clickable to open URL */
class LinkIconWidget extends WidgetType {
	constructor(readonly url: string) { super(); }
	eq(other: LinkIconWidget) { return this.url === other.url; }
	toDOM(): HTMLElement {
		const span = document.createElement('span');
		span.className = 'cm-md-link-icon';
		span.textContent = '🔗';
		span.title = this.url;
		span.onmousedown = (e) => {
			e.preventDefault();
			e.stopPropagation();
			runtime.Browser.OpenURL(this.url);
		};
		return span;
	}
	ignoreEvent(e: Event) { return e.type === 'mousedown'; }
}

/**
 * Handle URL node (within Link).
 */
export function handleURL(
	ctx: BuildContext,
	nf: number,
	nt: number,
	node: SyntaxNode,
	ranges: RangeTuple[]
): void {
	const parent = node.parent;
	if (!parent || BLACKLISTED_LINK_PARENTS.has(parent.name)) return;
	if (ctx.seen.has(parent.from)) return;
	ctx.seen.add(parent.from);
	ranges.push([parent.from, parent.to]);
	if (checkRangeOverlap([parent.from, parent.to], ctx.selRange)) return;

	// Get link text node (content between first [ and ])
	const linkText = parent.getChild('LinkLabel');
	const marks = parent.getChildren('LinkMark');
	const linkTitle = parent.getChild('LinkTitle');
	const closeBracket = marks.find(m => ctx.view.state.sliceDoc(m.from, m.to) === ']');
	
	if (closeBracket && nf < closeBracket.from) return;

	// Get URL for the icon
	const url = ctx.view.state.sliceDoc(nf, nt);

	// Add underline decoration to link text
	if (linkText) {
		ctx.items.push({ from: linkText.from, to: linkText.to, deco: linkTextDecoration });
	}

	// Hide markdown syntax marks
	for (const m of marks) {
		ctx.items.push({ from: m.from, to: m.to, deco: invisibleDecoration });
	}
	
	// Hide URL
	ctx.items.push({ from: nf, to: nt, deco: invisibleDecoration });
	
	// Hide link title if present
	if (linkTitle) {
		ctx.items.push({ from: linkTitle.from, to: linkTitle.to, deco: invisibleDecoration });
	}

	// Add clickable icon widget after link text (at close bracket position)
	if (closeBracket) {
		ctx.items.push({
			from: closeBracket.from,
			to: closeBracket.from,
			deco: Decoration.widget({ widget: new LinkIconWidget(url), side: 1 }),
			priority: 1
		});
	}
}

/**
 * Theme for markdown links.
 */
export const linkTheme = EditorView.baseTheme({
	'.cm-md-link-text': {
		color: 'var(--cm-link-color, #0969da)',
		textDecoration: 'underline',
		textUnderlineOffset: '2px',
		cursor: 'text'
	},
	'.cm-md-link-icon': {
		cursor: 'pointer',
		marginLeft: '0.2em',
		opacity: '0.7',
		transition: 'opacity 0.15s ease',
		'&:hover': {
			opacity: '1'
		}
	}
});
