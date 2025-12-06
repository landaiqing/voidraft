/**
 * Horizontal rule handler and theme.
 */

import { Decoration, EditorView, WidgetType } from '@codemirror/view';
import { RangeTuple } from '../util';
import { BuildContext } from './types';

class HorizontalRuleWidget extends WidgetType {
	toDOM(): HTMLElement {
		const span = document.createElement('span');
		span.className = 'cm-horizontal-rule-widget';
		const hr = document.createElement('hr');
		hr.className = 'cm-horizontal-rule';
		span.appendChild(hr);
		return span;
	}
	eq() { return true; }
	ignoreEvent() { return false; }
}

const hrWidget = new HorizontalRuleWidget();

/**
 * Handle HorizontalRule node.
 */
export function handleHorizontalRule(
	ctx: BuildContext,
	nf: number,
	nt: number,
	inCursor: boolean,
	ranges: RangeTuple[]
): void {
	if (ctx.seen.has(nf)) return;
	ctx.seen.add(nf);
	ranges.push([nf, nt]);
	if (!inCursor) {
		ctx.items.push({ from: nf, to: nt, deco: Decoration.replace({ widget: hrWidget }) });
	}
}

/**
 * Theme for horizontal rules.
 */
export const horizontalRuleTheme = EditorView.baseTheme({
	'.cm-horizontal-rule-widget': {
		display: 'inline-block',
		width: '100%',
		verticalAlign: 'middle'
	},
	'.cm-horizontal-rule': {
		width: '100%',
		height: '0',
		border: 'none',
		borderTop: '2px solid var(--cm-hr-color, rgba(128, 128, 128, 0.3))',
		margin: '0.5em 0'
	}
});
