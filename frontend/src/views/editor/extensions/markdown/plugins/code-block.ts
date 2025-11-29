import { Extension, Range } from '@codemirror/state';
import {
	ViewPlugin,
	DecorationSet,
	Decoration,
	EditorView,
	ViewUpdate
} from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { isCursorInRange } from '../util';
import { codeblock as classes } from '../classes';

/**
 * Code block types to match in the syntax tree.
 */
const CODE_BLOCK_TYPES = ['FencedCode', 'CodeBlock'] as const;

/**
 * Code block plugin with optimized decoration building.
 *
 * This plugin:
 * - Adds styling to code blocks (begin/end markers)
 * - Hides code markers and language info when cursor is outside
 */
export const codeblock = (): Extension => [codeBlockPlugin, baseTheme];

/**
 * Build code block decorations.
 * Uses array + Decoration.set() for automatic sorting.
 */
function buildCodeBlockDecorations(view: EditorView): DecorationSet {
	const decorations: Range<Decoration>[] = [];
	const visited = new Set<string>();

	// Process only visible ranges
	for (const { from, to } of view.visibleRanges) {
		syntaxTree(view.state).iterate({
			from,
			to,
			enter: ({ type, from: nodeFrom, to: nodeTo, node }) => {
				if (!CODE_BLOCK_TYPES.includes(type.name as typeof CODE_BLOCK_TYPES[number])) {
					return;
				}

				// Avoid processing the same code block multiple times
				const key = `${nodeFrom}:${nodeTo}`;
				if (visited.has(key)) return;
				visited.add(key);

				const cursorInBlock = isCursorInRange(view.state, [nodeFrom, nodeTo]);

				// Add line decorations for each line in the code block
				const startLine = view.state.doc.lineAt(nodeFrom);
				const endLine = view.state.doc.lineAt(nodeTo);

				for (let lineNum = startLine.number; lineNum <= endLine.number; lineNum++) {
					const line = view.state.doc.line(lineNum);

					// Determine line position class
					let positionClass = '';
					if (lineNum === startLine.number) {
						positionClass = classes.widgetBegin;
					} else if (lineNum === endLine.number) {
						positionClass = classes.widgetEnd;
					}

					decorations.push(
						Decoration.line({
							class: `${classes.widget} ${positionClass}`.trim()
						}).range(line.from)
					);
				}

				// Hide code markers when cursor is outside the block
				if (!cursorInBlock) {
					const codeBlock = node.toTree();
					codeBlock.iterate({
						enter: ({ type: childType, from: childFrom, to: childTo }) => {
							if (childType.name === 'CodeInfo' || childType.name === 'CodeMark') {
								decorations.push(
									Decoration.replace({}).range(
										nodeFrom + childFrom,
										nodeFrom + childTo
									)
								);
							}
						}
					});
				}
			}
		});
	}

	// Use Decoration.set with sort=true to handle unsorted ranges
	return Decoration.set(decorations, true);
}

/**
 * Code block plugin class with optimized update detection.
 */
class CodeBlockPlugin {
	decorations: DecorationSet;
	private lastSelection: number = -1;

	constructor(view: EditorView) {
		this.decorations = buildCodeBlockDecorations(view);
		this.lastSelection = view.state.selection.main.head;
	}

	update(update: ViewUpdate) {
		const docChanged = update.docChanged;
		const viewportChanged = update.viewportChanged;
		const selectionChanged = update.selectionSet;

		// Optimization: check if selection moved to a different line
		if (selectionChanged && !docChanged && !viewportChanged) {
			const newHead = update.state.selection.main.head;
			const oldHead = this.lastSelection;

			const oldLine = update.startState.doc.lineAt(oldHead);
			const newLine = update.state.doc.lineAt(newHead);

			if (oldLine.number === newLine.number) {
				this.lastSelection = newHead;
				return;
			}
		}

		if (docChanged || viewportChanged || selectionChanged) {
			this.decorations = buildCodeBlockDecorations(update.view);
			this.lastSelection = update.state.selection.main.head;
		}
	}
}

const codeBlockPlugin = ViewPlugin.fromClass(CodeBlockPlugin, {
	decorations: (v) => v.decorations
});

/**
 * Base theme for code blocks.
 */
const baseTheme = EditorView.baseTheme({
	[`.${classes.widget}`]: {
		backgroundColor: 'var(--cm-codeblock-bg, rgba(128, 128, 128, 0.1))'
	},
	[`.${classes.widgetBegin}`]: {
		borderRadius: '5px 5px 0 0'
	},
	[`.${classes.widgetEnd}`]: {
		borderRadius: '0 0 5px 5px'
	}
});
