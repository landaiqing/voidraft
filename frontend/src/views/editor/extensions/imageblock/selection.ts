import {StateEffect, StateField} from '@codemirror/state';
import {getBlockFromPos} from '@/views/editor/extensions/codeblock/parser';
import type {Block} from '@/views/editor/extensions/codeblock/types';
import {IMAGE_BLOCK_LANGUAGE} from './constants';
import type {ImageBlockSelection} from './types';

export const setImageBlockSelection = StateEffect.define<ImageBlockSelection>({
  map(value, changes) {
    return {
      ...value,
      anchor: changes.mapPos(value.anchor, 1),
    };
  },
});

export const clearImageBlockSelection = StateEffect.define<void>();

export const imageBlockSelectionField = StateField.define<ImageBlockSelection | null>({
  create: () => null,
  update(value, transaction) {
    if (value) {
      value = {
        ...value,
        anchor: transaction.changes.mapPos(value.anchor, 1),
      };
    }

    for (const effect of transaction.effects) {
      if (effect.is(clearImageBlockSelection)) {
        return null;
      }
      if (effect.is(setImageBlockSelection)) {
        return effect.value;
      }
    }

    if (transaction.selection) {
      return null;
    }

    if (!value) {
      return null;
    }

    const block = getBlockFromPos(transaction.state, value.anchor);
    if (!block || block.language.name !== IMAGE_BLOCK_LANGUAGE) {
      return null;
    }

    return value;
  },
});

export function getSelectedImageBlock(state: Parameters<typeof getBlockFromPos>[0]): { block: Block; itemIndex: number | null } | null {
  const selection = state.field(imageBlockSelectionField, false);
  if (!selection) {
    return null;
  }

  const block = getBlockFromPos(state, selection.anchor);
  if (!block || block.language.name !== IMAGE_BLOCK_LANGUAGE) {
    return null;
  }

  return {
    block,
    itemIndex: selection.itemIndex,
  };
}
