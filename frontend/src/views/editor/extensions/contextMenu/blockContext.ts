import {EditorSelection, Transaction} from '@codemirror/state';
import type {Command, EditorView} from '@codemirror/view';
import {getNoteBlockFromPos} from '../codeblock/state';
import type {Block} from '../codeblock/types';
import type {MenuContext} from './menuSchema';

function containsPos(block: Block, pos: number): boolean {
  return block.range.from <= pos && pos <= block.range.to;
}

function getCurrentMenuBlock(view: EditorView, context: MenuContext): Block | null {
  if (context.targetPos === null) {
    return context.targetBlock;
  }

  return getNoteBlockFromPos(view.state, Math.min(context.targetPos, view.state.doc.length)) ?? null;
}

export function getMenuBlock(context: MenuContext): Block | null {
  return context.targetBlock;
}

export function runCommandInMenuBlock(command: Command) {
  return (view: EditorView, context: MenuContext): boolean => {
    const block = getCurrentMenuBlock(view, context);
    if (!block) {
      return false;
    }

    const currentHead = view.state.selection.main.head;
    if (!containsPos(block, currentHead)) {
      view.dispatch({
        selection: EditorSelection.cursor(block.content.from),
        annotations: [Transaction.addToHistory.of(false)],
      });
    }

    return command(view);
  };
}
