import { Extension, RangeSetBuilder } from '@codemirror/state';
import {
	ViewPlugin,
	DecorationSet,
	Decoration,
	EditorView,
	ViewUpdate,
	WidgetType
} from '@codemirror/view';
import { isCursorInRange } from '../util';
import { emojies } from '@/common/constant/emojies';

/**
 * Emoji plugin that converts :emoji_name: to actual emoji characters.
 *
 * Features:
 * - Detects emoji patterns like :smile:, :heart:, etc.
 * - Replaces them with actual emoji characters
 * - Shows the original text when cursor is nearby
 * - Uses RangeSetBuilder for optimal performance
 * - Supports 1900+ emojis from the comprehensive emoji dictionary
 */
export const emoji = (): Extension => [emojiPlugin, baseTheme];

/**
 * Emoji regex pattern for matching :emoji_name: syntax.
 */
const EMOJI_REGEX = /:([a-z0-9_+\-]+):/gi;

/**
 * Emoji widget with optimized rendering.
 */
class EmojiWidget extends WidgetType {
	constructor(
		readonly emoji: string,
		readonly name: string
	) {
		super();
	}

	eq(other: EmojiWidget): boolean {
		return other.emoji === this.emoji;
	}

	toDOM(): HTMLElement {
		const span = document.createElement('span');
		span.className = 'cm-emoji';
		span.textContent = this.emoji;
		span.title = `:${this.name}:`;
		return span;
	}
}

/**
 * Match result for emoji patterns.
 */
interface EmojiMatch {
	from: number;
	to: number;
	name: string;
	emoji: string;
}

/**
 * Find all emoji matches in a text range.
 */
function findEmojiMatches(text: string, offset: number): EmojiMatch[] {
	const matches: EmojiMatch[] = [];
	let match: RegExpExecArray | null;

	// Reset regex state
	EMOJI_REGEX.lastIndex = 0;

	while ((match = EMOJI_REGEX.exec(text)) !== null) {
		const name = match[1].toLowerCase();
		const emoji = emojies[name];

		if (emoji) {
			matches.push({
				from: offset + match.index,
				to: offset + match.index + match[0].length,
				name,
				emoji
			});
		}
	}

	return matches;
}

/**
 * Build emoji decorations using RangeSetBuilder.
 */
function buildEmojiDecorations(view: EditorView): DecorationSet {
	const builder = new RangeSetBuilder<Decoration>();
	const doc = view.state.doc;

	for (const { from, to } of view.visibleRanges) {
		const text = doc.sliceString(from, to);
		const matches = findEmojiMatches(text, from);

		for (const match of matches) {
			// Skip if cursor is in this range
			if (isCursorInRange(view.state, [match.from, match.to])) {
				continue;
			}

			builder.add(
				match.from,
				match.to,
				Decoration.replace({
					widget: new EmojiWidget(match.emoji, match.name)
				})
			);
		}
	}

	return builder.finish();
}

/**
 * Emoji plugin with optimized update detection.
 */
class EmojiPlugin {
	decorations: DecorationSet;
	private lastSelectionHead: number = -1;

	constructor(view: EditorView) {
		this.decorations = buildEmojiDecorations(view);
		this.lastSelectionHead = view.state.selection.main.head;
	}

	update(update: ViewUpdate) {
		// Always rebuild on doc or viewport change
		if (update.docChanged || update.viewportChanged) {
			this.decorations = buildEmojiDecorations(update.view);
			this.lastSelectionHead = update.state.selection.main.head;
			return;
		}

		// For selection changes, check if we moved significantly
		if (update.selectionSet) {
			const newHead = update.state.selection.main.head;

			// Only rebuild if cursor moved to a different position
			if (newHead !== this.lastSelectionHead) {
				this.decorations = buildEmojiDecorations(update.view);
				this.lastSelectionHead = newHead;
			}
		}
	}
}

const emojiPlugin = ViewPlugin.fromClass(EmojiPlugin, {
	decorations: (v) => v.decorations
});

/**
 * Base theme for emoji.
 */
const baseTheme = EditorView.baseTheme({
	'.cm-emoji': {
		fontSize: '1.2em',
		lineHeight: '1',
		verticalAlign: 'middle',
		cursor: 'default'
	}
});

/**
 * Get all available emoji names.
 */
export function getEmojiNames(): string[] {
	return Object.keys(emojies);
}

/**
 * Get emoji by name.
 */
export function getEmoji(name: string): string | undefined {
	return emojies[name.toLowerCase()];
}
