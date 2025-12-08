import type { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import type { KeyBindingCommand } from '../../../../../bindings/voidraft/internal/models/models';

export interface MenuContext {
  view: EditorView;
  event: MouseEvent;
  hasSelection: boolean;
  selectionText: string;
  isEditable: boolean;
}

export type MenuSchemaNode =
  | {
      id: string;
      type?: "action";
      labelKey: string;
      command?: (view: EditorView) => boolean;
      shortcutCommand?: KeyBindingCommand;
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
  formatShortcut: (command?: KeyBindingCommand) => string;
}

const menuRegistry: MenuSchemaNode[] = [];

export function createMenuContext(view: EditorView, event: MouseEvent): MenuContext {
  const { state } = view;
  const hasSelection = state.selection.ranges.some((range) => !range.empty);
  const selectionText = hasSelection
    ? state.sliceDoc(state.selection.main.from, state.selection.main.to)
    : "";
  const isEditable = !state.facet(EditorState.readOnly);

  return {
    view,
    event,
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
  const shortcut = options.formatShortcut(node.shortcutCommand);

  return {
    id: node.id,
    type: "action",
    label: options.translate(node.labelKey),
    shortcut: shortcut || undefined,
    disabled,
    command: node.command
  };
}
