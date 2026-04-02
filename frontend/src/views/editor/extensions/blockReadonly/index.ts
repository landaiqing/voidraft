import { Facet, Extension, EditorState } from '@codemirror/state';
import { Command } from '@codemirror/view';
import { blockState, getActiveNoteBlock } from '../codeblock/state';
import { changeCurrentBlockAccess } from '../codeblock/commands';
import { codeBlockEvent, LANGUAGE_CHANGE } from '../codeblock/annotation';

const readonlyRangeFilter = EditorState.changeFilter.of(transaction => {
  if (transaction.annotation(codeBlockEvent) === LANGUAGE_CHANGE) {
    return true;
  }

  const blocks = transaction.startState.field(blockState, false);
  if (!blocks?.length) {
    return true;
  }

  const protectedRanges: number[] = [];
  for (const block of blocks) {
    if (block.access !== 'read') {
      continue;
    }
    protectedRanges.push(block.range.from, block.range.to);
  }

  return protectedRanges.length > 0 ? protectedRanges : true;
});

export const blockReadonlyEnabledFacet = Facet.define<boolean, boolean>({
  combine: values => values.some(Boolean),
});

export function isActiveBlockReadonly(state: EditorState): boolean {
  return getActiveNoteBlock(state)?.access === 'read';
}

export const setActiveBlockReadOnlyCommand: Command = view =>
  changeCurrentBlockAccess(view.state, view.dispatch, 'read');

export const setActiveBlockWritableCommand: Command = view =>
  changeCurrentBlockAccess(view.state, view.dispatch, 'write');

/**
 * Block 只读扩展入口
 */
export function createBlockReadonlyExtension(): Extension {
  return [
    blockReadonlyEnabledFacet.of(true),
    readonlyRangeFilter,
  ];
}

export default createBlockReadonlyExtension;
