import type {EditorView} from '@codemirror/view';
import {getNoteBlockFromPos} from '@/views/editor/extensions/codeblock/state';
import {IMAGE_BLOCK_LANGUAGE} from './constants';
import {moveImageItemInBlock} from './document';

const IMAGE_BLOCK_ITEM_SELECTOR = '.cm-image-block-item';
const IMAGE_BLOCK_DRAG_HANDLE_SELECTOR = '.cm-image-block-drag-handle';
const DROP_BEFORE_CLASS = 'is-drop-before';
const DROP_AFTER_CLASS = 'is-drop-after';
const DRAGGING_CLASS = 'is-dragging';
const ROW_GROUP_TOLERANCE = 8;

interface FrameLayout {
  frame: HTMLElement;
  index: number;
  rect: DOMRect;
}

interface RowLayout {
  entries: FrameLayout[];
  centerY: number;
}

interface DropPlacement {
  index: number;
  markerFrame: HTMLElement;
  markerSide: typeof DROP_BEFORE_CLASS | typeof DROP_AFTER_CLASS;
}

function getFrames(flow: HTMLElement): HTMLElement[] {
  return Array.from(flow.querySelectorAll<HTMLElement>(IMAGE_BLOCK_ITEM_SELECTOR));
}

function getFrameIndex(frame: HTMLElement): number | null {
  const index = Number(frame.dataset.itemIndex);
  return Number.isInteger(index) ? index : null;
}

function buildRows(frames: readonly HTMLElement[]): RowLayout[] {
  const rows: FrameLayout[][] = [];

  frames.forEach((frame, index) => {
    const rect = frame.getBoundingClientRect();
    const entry = {frame, index, rect};
    const currentRow = rows.at(-1);

    if (!currentRow || Math.abs(currentRow[0].rect.top - rect.top) > ROW_GROUP_TOLERANCE) {
      rows.push([entry]);
      return;
    }

    currentRow.push(entry);
  });

  return rows.map(entries => ({
    entries,
    centerY: entries.reduce((sum, entry) => sum + entry.rect.top + entry.rect.height / 2, 0) / entries.length,
  }));
}

function resolveDropPlacement(
  frames: readonly HTMLElement[],
  clientX: number,
  clientY: number,
): DropPlacement | null {
  if (frames.length === 0) {
    return null;
  }

  const rows = buildRows(frames);
  const targetRow = rows.reduce((closest, row) => {
    if (!closest) {
      return row;
    }

    return Math.abs(row.centerY - clientY) < Math.abs(closest.centerY - clientY) ? row : closest;
  }, rows[0] as RowLayout);

  const targetEntry = targetRow.entries.find(entry => clientX < entry.rect.left + entry.rect.width / 2);
  if (targetEntry) {
    return {
      index: targetEntry.index,
      markerFrame: targetEntry.frame,
      markerSide: DROP_BEFORE_CLASS,
    };
  }

  const lastEntry = targetRow.entries[targetRow.entries.length - 1];
  return {
    index: lastEntry.index + 1,
    markerFrame: lastEntry.frame,
    markerSide: DROP_AFTER_CLASS,
  };
}

function clearMarker(frame: HTMLElement | null, side: DropPlacement['markerSide'] | null) {
  if (!frame || !side) {
    return;
  }

  frame.classList.remove(side);
}

export function attachImageBlockDrag(
  flow: HTMLElement,
  view: EditorView,
  anchor: number,
): void {
  const frames = getFrames(flow);
  frames.forEach((frame, index) => {
    frame.dataset.itemIndex = String(index);
    frame.draggable = false;
    const handle = frame.querySelector<HTMLElement>(IMAGE_BLOCK_DRAG_HANDLE_SELECTOR);
    if (handle) {
      handle.draggable = true;
    }
  });

  let sourceIndex: number | null = null;
  let sourceFrame: HTMLElement | null = null;
  let dropPlacement: DropPlacement | null = null;

  const updatePlacement = (nextPlacement: DropPlacement | null) => {
    if (
      dropPlacement?.index === nextPlacement?.index
      && dropPlacement?.markerFrame === nextPlacement?.markerFrame
      && dropPlacement?.markerSide === nextPlacement?.markerSide
    ) {
      return;
    }

    clearMarker(dropPlacement?.markerFrame ?? null, dropPlacement?.markerSide ?? null);
    dropPlacement = nextPlacement;
    if (dropPlacement) {
      dropPlacement.markerFrame.classList.add(dropPlacement.markerSide);
    }
  };

  const resetDragState = () => {
    updatePlacement(null);
    sourceFrame?.classList.remove(DRAGGING_CLASS);
    sourceFrame = null;
    sourceIndex = null;
  };

  flow.addEventListener('dragstart', event => {
    const target = event.target as HTMLElement | null;
    const handle = target?.closest<HTMLElement>(IMAGE_BLOCK_DRAG_HANDLE_SELECTOR);
    const frame = handle?.closest<HTMLElement>(IMAGE_BLOCK_ITEM_SELECTOR);
    if (!frame || !flow.contains(frame)) {
      return;
    }
    if (!frame.classList.contains('is-selected') || frame.classList.contains('is-busy')) {
      event.preventDefault();
      return;
    }

    const index = getFrameIndex(frame);
    if (index === null) {
      return;
    }

    sourceIndex = index;
    sourceFrame = frame;
    frame.classList.add(DRAGGING_CLASS);

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(index));
    }
  });

  flow.addEventListener('dragover', event => {
    if (sourceIndex === null) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }

    updatePlacement(resolveDropPlacement(getFrames(flow), event.clientX, event.clientY));
  });

  flow.addEventListener('drop', event => {
    if (sourceIndex === null) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const currentSourceIndex = sourceIndex;
    const block = getNoteBlockFromPos(view.state, anchor);
    const placement = dropPlacement ?? resolveDropPlacement(getFrames(flow), event.clientX, event.clientY);
    resetDragState();

    if (!block || block.language.name !== IMAGE_BLOCK_LANGUAGE || !placement) {
      return;
    }

    moveImageItemInBlock(view, block, currentSourceIndex, placement.index);
  });

  flow.addEventListener('dragend', () => {
    resetDragState();
  });
}
