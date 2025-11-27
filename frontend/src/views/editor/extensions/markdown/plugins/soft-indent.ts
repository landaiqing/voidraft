import {
	Annotation,
	Line,
	RangeSet,
	RangeSetBuilder,
	Extension
} from '@codemirror/state';
import {
	Decoration,
	EditorView,
	ViewPlugin,
	ViewUpdate,
	type DecorationSet
} from '@codemirror/view';

/**
 * Soft indent plugin for better visual alignment of list items and blockquotes.
 *
 * This plugin:
 * - Measures the width of list markers, blockquote markers, etc.
 * - Applies padding to align the content properly
 * - Updates dynamically as content changes
 */
export const softIndent = (): Extension => [softIndentPlugin];

interface IndentData {
	line: Line;
	indentWidth: number;
}

/**
 * Pattern to match content that needs soft indentation:
 * - Blockquote markers (> )
 * - List markers (-, *, +, 1., etc.)
 * - Task markers ([x] or [ ])
 */
const softIndentPattern = /^(> )*(\s*)?(([-*+]|\d+[.)])\s)?(\[.\]\s)?/;

const softIndentRefresh = Annotation.define<boolean>();

/**
 * Plugin to apply soft indentation.
 */
class SoftIndentPlugin {
	decorations: DecorationSet = Decoration.none;

	constructor(view: EditorView) {
		this.requestMeasure(view);
	}

	update(update: ViewUpdate) {
		if (update.docChanged || update.viewportChanged || update.selectionSet) {
			this.requestMeasure(update.view);
		}

		if (update.transactions.some((tr) => tr.annotation(softIndentRefresh))) {
			this.requestMeasure(update.view);
		}
	}

	requestMeasure(view: EditorView) {
		// Needs to run via requestMeasure since it measures and updates the DOM
		view.requestMeasure({
			read: (view) => this.measureIndents(view),
			write: (indents, view) => {
				this.applyIndents(indents, view);
			}
		});
	}

	/**
	 * Measure the indent width for each line that needs soft indentation.
	 */
	measureIndents(view: EditorView): IndentData[] {
		const indents: IndentData[] = [];

		// Loop through all visible lines
		for (const { from, to } of view.visibleRanges) {
			const start = view.state.doc.lineAt(from);
			const end = view.state.doc.lineAt(to);

			for (let i = start.number; i <= end.number; i++) {
				// Get current line object
				const line = view.state.doc.line(i);

				// Match the line's text with the indent pattern
				const text = view.state.sliceDoc(line.from, line.to);
				const matches = softIndentPattern.exec(text);
				if (!matches) continue;

				const nonContent = matches[0];
				if (!nonContent) continue;

				// Get indent width by measuring DOM coordinates
				const startCoords = view.coordsAtPos(line.from);
				const endCoords = view.coordsAtPos(line.from + nonContent.length);

				if (!startCoords || !endCoords) continue;

				const indentWidth = endCoords.left - startCoords.left;
				if (indentWidth <= 0) continue;

				indents.push({
					line,
					indentWidth
				});
			}
		}

		return indents;
	}

	/**
	 * Build decorations from indent data.
	 */
	buildDecorations(indents: IndentData[]): DecorationSet {
		const builder = new RangeSetBuilder<Decoration>();

		for (const { line, indentWidth } of indents) {
			const deco = Decoration.line({
				attributes: {
					style: `padding-inline-start: ${Math.ceil(
						indentWidth + 6
					)}px; text-indent: -${Math.ceil(indentWidth)}px;`
				}
			});

			builder.add(line.from, line.from, deco);
		}

		return builder.finish();
	}

	/**
	 * Apply new decorations and dispatch a transaction if needed.
	 */
	applyIndents(indents: IndentData[], view: EditorView) {
		const newDecos = this.buildDecorations(indents);
		let changed = false;

		for (const { from, to } of view.visibleRanges) {
			if (!RangeSet.eq([this.decorations], [newDecos], from, to)) {
				changed = true;
				break;
			}
		}

		if (changed) {
			queueMicrotask(() => {
				view.dispatch({ annotations: [softIndentRefresh.of(true)] });
			});
		}

		this.decorations = newDecos;
	}
}

const softIndentPlugin = ViewPlugin.fromClass(SoftIndentPlugin, {
	decorations: (v) => v.decorations
});

