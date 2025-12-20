/**
 * Code block handler and theme.
 */

import { Decoration, EditorView, WidgetType } from '@codemirror/view';
import { invisibleDecoration, RangeTuple } from '../util';
import { SyntaxNode } from '@lezer/common';
import { BuildContext } from './types';

const DECO_CODEBLOCK_LINE = Decoration.line({ class: 'cm-codeblock' });
const DECO_CODEBLOCK_BEGIN = Decoration.line({ class: 'cm-codeblock cm-codeblock-begin' });
const DECO_CODEBLOCK_END = Decoration.line({ class: 'cm-codeblock cm-codeblock-end' });
const DECO_CODEBLOCK_SINGLE = Decoration.line({ class: 'cm-codeblock cm-codeblock-begin cm-codeblock-end' });

const ICON_COPY = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
const ICON_CHECK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

class CodeBlockInfoWidget extends WidgetType {
	constructor(readonly from: number, readonly to: number, readonly language: string | null) { super(); }
	eq(other: CodeBlockInfoWidget) { return other.from === this.from && other.language === this.language; }
	toDOM(view: EditorView): HTMLElement {
		const container = document.createElement('span');
		container.className = 'cm-code-block-info';
		if (this.language) {
			const lang = document.createElement('span');
			lang.className = 'cm-code-block-lang';
			lang.textContent = this.language;
			container.append(lang);
		}
		const btn = document.createElement('button');
		btn.className = 'cm-code-block-copy-btn';
		btn.title = 'Copy';
		btn.innerHTML = ICON_COPY;
		btn.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();
			const text = view.state.doc.sliceString(this.from, this.to);
			const lines = text.split('\n');
			const content = lines.length >= 2 ? lines.slice(1, -1).join('\n') : '';
			if (content) {
				navigator.clipboard.writeText(content).then(() => {
					btn.innerHTML = ICON_CHECK;
					setTimeout(() => { btn.innerHTML = ICON_COPY; }, 1500);
				});
			}
		});
		btn.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); });
		container.append(btn);
		return container;
	}
	ignoreEvent() { return true; }
}

/**
 * Handle FencedCode / CodeBlock node.
 */
export function handleCodeBlock(
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
	
	// When cursor/selection is in this code block, don't add any decorations
	// This allows the selection background to be visible
	if (inCursor) return;

	const startLine = ctx.view.state.doc.lineAt(nf);
	const endLine = ctx.view.state.doc.lineAt(nt);
	
	// Add background decorations for each line
	for (let num = startLine.number; num <= endLine.number; num++) {
		const line = ctx.view.state.doc.line(num);
		let deco = DECO_CODEBLOCK_LINE;
		if (startLine.number === endLine.number) deco = DECO_CODEBLOCK_SINGLE;
		else if (num === startLine.number) deco = DECO_CODEBLOCK_BEGIN;
		else if (num === endLine.number) deco = DECO_CODEBLOCK_END;
		ctx.items.push({ from: line.from, to: line.from, deco });
	}
	
	// Add language info widget and hide code marks
	const codeInfo = node.getChild('CodeInfo');
	const codeMarks = node.getChildren('CodeMark');
	const language = codeInfo ? ctx.view.state.doc.sliceString(codeInfo.from, codeInfo.to).trim() : null;
	ctx.items.push({ from: startLine.to, to: startLine.to, deco: Decoration.widget({ widget: new CodeBlockInfoWidget(nf, nt, language), side: 1 }), priority: 1 });
	if (codeInfo) ctx.items.push({ from: codeInfo.from, to: codeInfo.to, deco: invisibleDecoration });
	for (const mark of codeMarks) ctx.items.push({ from: mark.from, to: mark.to, deco: invisibleDecoration });
}

/**
 * Theme for code blocks.
 */
export const codeBlockTheme = EditorView.baseTheme({
	'.cm-codeblock': {
		backgroundColor: 'var(--cm-codeblock-bg)',
		fontFamily: 'inherit'
	},
	'.cm-codeblock-begin': {
		borderTopLeftRadius: 'var(--cm-codeblock-radius)',
		borderTopRightRadius: 'var(--cm-codeblock-radius)',
		position: 'relative'
	},
	'.cm-codeblock-end': {
		borderBottomLeftRadius: 'var(--cm-codeblock-radius)',
		borderBottomRightRadius: 'var(--cm-codeblock-radius)'
	},
	'.cm-code-block-info': {
		position: 'absolute',
		right: '8px',
		top: '50%',
		transform: 'translateY(-50%)',
		display: 'inline-flex',
		alignItems: 'center',
		gap: '0.5em',
		zIndex: '5',
		opacity: '0.5',
		transition: 'opacity 0.15s'
	},
	'.cm-code-block-info:hover': { opacity: '1' },
	'.cm-code-block-lang': {
		color: 'var(--cm-codeblock-lang, var(--cm-foreground))',
		textTransform: 'lowercase',
		userSelect: 'none'
	},
	'.cm-code-block-copy-btn': {
		display: 'inline-flex',
		alignItems: 'center',
		justifyContent: 'center',
		padding: '0.15em',
		border: 'none',
		borderRadius: '2px',
		background: 'transparent',
		color: 'var(--cm-codeblock-lang, var(--cm-foreground))',
		cursor: 'pointer',
		opacity: '0.7',
		transition: 'opacity 0.15s, background 0.15s'
	},
	'.cm-code-block-copy-btn:hover': { opacity: '1', background: 'rgba(128, 128, 128, 0.2)' },
	'.cm-code-block-copy-btn svg': { width: '1em', height: '1em' }
});
