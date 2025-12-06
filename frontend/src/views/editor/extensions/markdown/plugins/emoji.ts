/**
 * Emoji handler and theme.
 */

import { Decoration, EditorView, WidgetType } from '@codemirror/view';
import { RangeTuple } from '../util';
import { SyntaxNode } from '@lezer/common';
import { BuildContext } from './types';
import { emojies } from '@/common/constant/emojies';

class EmojiWidget extends WidgetType {
	constructor(readonly emoji: string, readonly name: string) { super(); }
	eq(other: EmojiWidget) { return other.emoji === this.emoji; }
	toDOM(): HTMLElement {
		const span = document.createElement('span');
		span.className = 'cm-emoji';
		span.textContent = this.emoji;
		span.title = `:${this.name}:`;
		return span;
	}
}

/**
 * Handle Emoji node (:emoji:).
 */
export function handleEmoji(
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
	if (inCursor) return;

	const nameNode = node.getChild('EmojiName');
	if (!nameNode) return;
	const name = ctx.view.state.sliceDoc(nameNode.from, nameNode.to).toLowerCase();
	const emojiChar = emojies[name];
	if (emojiChar) {
		ctx.items.push({ from: nf, to: nt, deco: Decoration.replace({ widget: new EmojiWidget(emojiChar, name) }) });
	}
}

/**
 * Theme for emoji.
 */
export const emojiTheme = EditorView.baseTheme({
	'.cm-emoji': {
		cursor: 'default',
		fontSize: 'inherit',
		lineHeight: 'inherit'
	}
});
