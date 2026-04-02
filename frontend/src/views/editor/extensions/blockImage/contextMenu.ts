import type {MenuSchemaNode} from '../contextMenu/menuSchema';
import {getMenuBlock, runCommandInMenuBlock} from '../contextMenu/blockContext';
import {blockImageEnabledFacet, copyBlockImageCommand} from './index';


export const blockImageMenuNodes: MenuSchemaNode[] = [
  {
    id: 'copy-block-image',
    labelKey: 'extensions.blockImage.copyMenu',
    command: runCommandInMenuBlock(copyBlockImageCommand),
    visible: context =>
      context.view.state.facet(blockImageEnabledFacet) &&
      Boolean(getMenuBlock(context)),
    enabled: context =>
      context.view.state.facet(blockImageEnabledFacet) &&
      Boolean(getMenuBlock(context)),
  },
];

