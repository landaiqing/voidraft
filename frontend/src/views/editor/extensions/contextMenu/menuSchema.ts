import type {Command, EditorView} from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import {getNoteBlockFromPos} from '../codeblock/state';
import type {Block} from '../codeblock/types';
import {CONTEXT_MENU_BLOCK_ANCHOR_DATASET, CONTEXT_MENU_BLOCK_ANCHOR_SELECTOR} from './constants';
import { KeyBindingName } from '@/../bindings/voidraft/internal/models/models';

export interface MenuContext {
  view: EditorView;
  event: MouseEvent;
  targetPos: number | null;
  targetBlock: Block | null;
  hasSelection: boolean;
  selectionText: string;
  isEditable: boolean;
}

export type MenuCommand = (view: EditorView, context: MenuContext) => boolean;

export type MenuSchemaNode =
  | {
      id: string;
      type?: "action";
      labelKey: string;
      command?: Command | MenuCommand;
      keyBindingName?: KeyBindingName;
      visible?: (context: MenuContext) => boolean;
      enabled?: (context: MenuContext) => boolean;
    }
  | {
      id: string;
      type: "separator";
      visible?: (context: MenuContext) => boolean;
    };

export interface RenderMenuItem {
  id: string;
  type: "action" | "separator";
  label?: string;
  shortcut?: string;
  disabled?: boolean;
  command?: (view: EditorView) => boolean;
}

interface MenuBuildOptions {
  translate: (key: string) => string;
  formatShortcut: (keyBindingKey?: KeyBindingName) => string;
}

const menuRegistry: MenuSchemaNode[] = [];

function getAnchorPosFromTarget(target: EventTarget | null): number | null {
  if (!(target instanceof HTMLElement)) {
    return null;
  }

  const anchor = target.closest<HTMLElement>(CONTEXT_MENU_BLOCK_ANCHOR_SELECTOR)?.dataset[CONTEXT_MENU_BLOCK_ANCHOR_DATASET];
  if (!anchor) {
    return null;
  }

  const pos = Number(anchor);
  return Number.isInteger(pos) && pos >= 0 ? pos : null;
}

function getTargetPos(view: EditorView, event: MouseEvent): number | null {
  const anchorPos = getAnchorPosFromTarget(event.target);
  if (anchorPos !== null) {
    return anchorPos;
  }

  const posAtCoords = view.posAtCoords({
    x: event.clientX,
    y: event.clientY,
  });
  if (posAtCoords !== null) {
    return posAtCoords;
  }

  if (!(event.target instanceof Node) || !view.dom.contains(event.target)) {
    return null;
  }

  try {
    return view.posAtDOM(event.target, 0);
  } catch {
    return null;
  }
}

export function createMenuContext(view: EditorView, event: MouseEvent): MenuContext {
  const { state } = view;
  const targetPos = getTargetPos(view, event);
  const hasSelection = state.selection.ranges.some((range) => !range.empty);
  const selectionText = hasSelection
    ? state.sliceDoc(state.selection.main.from, state.selection.main.to)
    : "";
  const isEditable = !state.facet(EditorState.readOnly);

  return {
    view,
    event,
    targetPos,
    targetBlock: targetPos !== null ? getNoteBlockFromPos(state, targetPos) ?? null : null,
    hasSelection,
    selectionText,
    isEditable
  };
}

export function registerMenuNodes(nodes: MenuSchemaNode[]): void {
  menuRegistry.push(...nodes);
}

export function buildRegisteredMenu(
  context: MenuContext,
  options: MenuBuildOptions
): RenderMenuItem[] {
  return menuRegistry
    .map((node) => convertNode(node, context, options))
    .filter((item): item is RenderMenuItem => Boolean(item));
}

function convertNode(
  node: MenuSchemaNode,
  context: MenuContext,
  options: MenuBuildOptions
): RenderMenuItem | null {
  if (node.visible && !node.visible(context)) {
    return null;
  }

  if (node.type === "separator") {
    return {
      id: node.id,
      type: "separator"
    };
  }

  const disabled = node.enabled ? !node.enabled(context) : false;
  const shortcut = options.formatShortcut(node.keyBindingName);
  const command = node.command
    ? (view: EditorView) => (node.command as (view: EditorView, context: MenuContext) => boolean)(view, context)
    : undefined;

  return {
    id: node.id,
    type: "action",
    label: options.translate(node.labelKey),
    shortcut: shortcut || undefined,
    disabled,
    command
  };
}
