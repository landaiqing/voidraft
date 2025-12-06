/**
 * Unified theme - combines all markdown plugin themes.
 */

import { Extension } from '@codemirror/state';
import { blockquoteTheme } from './blockquote';
import { codeBlockTheme } from './code-block';
import { headingTheme } from './heading';
import { horizontalRuleTheme } from './horizontal-rule';
import { inlineStylesTheme } from './inline-styles';
import { linkTheme } from './link';
import { listTheme } from './list';
import { footnoteTheme } from './footnote';
import { mathTheme } from './math';
import { emojiTheme } from './emoji';
import { tableTheme } from './table';

/**
 * All markdown themes combined.
 */
export const Theme: Extension = [
	blockquoteTheme,
	codeBlockTheme,
	headingTheme,
	horizontalRuleTheme,
	inlineStylesTheme,
	linkTheme,
	listTheme,
	footnoteTheme,
	mathTheme,
	emojiTheme,
	tableTheme
];
