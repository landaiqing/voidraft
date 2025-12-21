import type {MenuSchemaNode} from '../contextMenu/menuSchema';
import {getActiveNoteBlock} from '../codeblock/state';
import {blockImageEnabledFacet, copyBlockImageCommand} from './index';


export const blockImageMenuNodes: MenuSchemaNode[] = [
  {
    id: 'copy-block-image',
    labelKey: 'extensions.blockImage.copyMenu',
    command: copyBlockImageCommand,
    visible: context =>
      context.view.state.facet(blockImageEnabledFacet) &&
      Boolean(getActiveNoteBlock(context.view.state)),
    enabled: context =>
      context.view.state.facet(blockImageEnabledFacet) &&
      Boolean(getActiveNoteBlock(context.view.state)),
  },
];

