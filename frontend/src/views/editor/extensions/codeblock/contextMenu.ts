import type { MenuSchemaNode } from "../contextMenu/menuSchema";
import { getMenuBlock, runCommandInMenuBlock } from "../contextMenu/blockContext";
import { openMoveBlockDialogFromContext } from "../blockMove";
import {
    canFoldBlock,
    isBlockFolded,
    foldBlockCommand,
    unfoldBlockCommand,
} from "./fold";

export const codeBlockMenuNodes: MenuSchemaNode[] = [
    {
        id: "move-block-to-document",
        labelKey: "blockTools.moveBlock",
        command: (view, context) => {
            const blockCommand = runCommandInMenuBlock((commandView) => openMoveBlockDialogFromContext(commandView, context));
            return blockCommand(view, context);
        },
        visible: context => Boolean(getMenuBlock(context)),
        enabled: context => Boolean(getMenuBlock(context)),
    },
    {
        id: "fold-block",
        labelKey: "blockTools.foldBlock",
        command: runCommandInMenuBlock(foldBlockCommand),
        visible: context => {
            const block = getMenuBlock(context);
            return Boolean(block) && canFoldBlock(context.view.state, block) && !isBlockFolded(context.view.state, block);
        },
        enabled: context => {
            const block = getMenuBlock(context);
            return Boolean(block) && canFoldBlock(context.view.state, block) && !isBlockFolded(context.view.state, block);
        },
    },
    {
        id: "unfold-block",
        labelKey: "blockTools.unfoldBlock",
        command: runCommandInMenuBlock(unfoldBlockCommand),
        visible: context => {
            const block = getMenuBlock(context);
            return Boolean(block) && isBlockFolded(context.view.state, block);
        },
        enabled: context => {
            const block = getMenuBlock(context);
            return Boolean(block) && isBlockFolded(context.view.state, block);
        },
    },
];
