import type { MenuContext, MenuSchemaNode } from '../contextMenu/menuSchema';
import {getMenuBlock as getTargetMenuBlock, runCommandInMenuBlock} from '../contextMenu/blockContext';
import {
  blockReadonlyEnabledFacet,
  setActiveBlockReadOnlyCommand,
  setActiveBlockWritableCommand,
} from './index';

function getMenuBlock(context: MenuContext) {
  return getTargetMenuBlock(context);
}

function isReadonlyExtensionEnabled(context: MenuContext) {
  return context.view.state.facet(blockReadonlyEnabledFacet);
}

export const blockReadonlyMenuNodes: MenuSchemaNode[] = [
  {
    id: 'set-block-readonly',
    labelKey: 'extensions.blockReadonly.markReadonly',
    command: runCommandInMenuBlock(setActiveBlockReadOnlyCommand),
    visible: context =>
      isReadonlyExtensionEnabled(context) &&
      Boolean(getMenuBlock(context)?.delimiter.to),
    enabled: context => {
      const block = getMenuBlock(context);
      return Boolean(block?.delimiter.to) && block?.access !== 'read';
    },
  },
  {
    id: 'set-block-writable',
    labelKey: 'extensions.blockReadonly.markWritable',
    command: runCommandInMenuBlock(setActiveBlockWritableCommand),
    visible: context =>
      isReadonlyExtensionEnabled(context) &&
      Boolean(getMenuBlock(context)?.delimiter.to),
    enabled: context => {
      const block = getMenuBlock(context);
      return Boolean(block?.delimiter.to) && block?.access !== 'write';
    },
  },
];
