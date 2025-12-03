import { Extension, RangeSetBuilder } from '@codemirror/state';
import {
	ViewPlugin,
	DecorationSet,
	Decoration,
	EditorView,
	ViewUpdate,
	WidgetType
} from '@codemirror/view';
import { checkRangeOverlap, RangeTuple } from '../util';
import { emojies } from '@/common/constant/emojies';

/**
 * Emoji plugin that converts :emoji_name: to actual emoji characters.
 *
 * Features:
 * - Detects emoji patterns like :smile:, :heart:, etc.
 * - Replaces them with actual emoji characters
 * - Shows the original text when cursor is nearby
 * - Optimized with cached matches and minimal rebuilds
 */
export const emoji = (): Extension => [emojiPlugin, baseTheme];

/** Non-global regex for matchAll (more efficient than global with lastIndex reset) */
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
 * Cached emoji match.
 */
interface EmojiMatch {
	from: number;
	to: number;
	name: string;
	emoji: string;
}

/**
 * Find all emoji matches in visible ranges.
 */
function findAllEmojiMatches(view: EditorView): EmojiMatch[] {
	const matches: EmojiMatch[] = [];
	const doc = view.state.doc;

	for (const { from, to } of view.visibleRanges) {
		const text = doc.sliceString(from, to);
		let match: RegExpExecArray | null;
		
		EMOJI_REGEX.lastIndex = 0;
		while ((match = EMOJI_REGEX.exec(text)) !== null) {
			const name = match[1].toLowerCase();
			const emojiChar = emojies[name];

			if (emojiChar) {
				matches.push({
					from: from + match.index,
					to: from + match.index + match[0].length,
					name,
					emoji: emojiChar
				});
			}
		}
	}

	return matches;
}

/**
 * Get which emoji the cursor is in (-1 if none).
 */
function getCursorEmojiIndex(matches: EmojiMatch[], selFrom: number, selTo: number): number {
	const selRange: RangeTuple = [selFrom, selTo];
	
	for (let i = 0; i < matches.length; i++) {
		if (checkRangeOverlap([matches[i].from, matches[i].to], selRange)) {
			return i;
		}
	}
	return -1;
}

/**
 * Build decorations from cached matches.
 */
function buildDecorations(matches: EmojiMatch[], selFrom: number, selTo: number): DecorationSet {
	const builder = new RangeSetBuilder<Decoration>();
	const selRange: RangeTuple = [selFrom, selTo];

	for (const match of matches) {
		// Skip if cursor overlaps this emoji
		if (checkRangeOverlap([match.from, match.to], selRange)) {
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

	return builder.finish();
}

/**
 * Emoji plugin with cached matches and optimized updates.
 */
class EmojiPlugin {
	decorations: DecorationSet;
	private matches: EmojiMatch[] = [];
	private cursorEmojiIdx = -1;

	constructor(view: EditorView) {
		this.matches = findAllEmojiMatches(view);
		const { from, to } = view.state.selection.main;
		this.cursorEmojiIdx = getCursorEmojiIndex(this.matches, from, to);
		this.decorations = buildDecorations(this.matches, from, to);
	}

	update(update: ViewUpdate) {
		const { docChanged, viewportChanged, selectionSet } = update;

		// Rebuild matches on doc or viewport change
		if (docChanged || viewportChanged) {
			this.matches = findAllEmojiMatches(update.view);
			const { from, to } = update.state.selection.main;
			this.cursorEmojiIdx = getCursorEmojiIndex(this.matches, from, to);
			this.decorations = buildDecorations(this.matches, from, to);
			return;
		}

		// For selection changes, only rebuild if cursor enters/leaves an emoji
		if (selectionSet) {
			const { from, to } = update.state.selection.main;
			const newIdx = getCursorEmojiIndex(this.matches, from, to);

			if (newIdx !== this.cursorEmojiIdx) {
				this.cursorEmojiIdx = newIdx;
				this.decorations = buildDecorations(this.matches, from, to);
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
