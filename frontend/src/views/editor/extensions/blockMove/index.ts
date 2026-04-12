import { EditorState } from "@codemirror/state";
import type { Command, EditorView } from "@codemirror/view";
import { useDocumentStore } from "@/stores/documentStore";
import { useEditorStore } from "@/stores/editorStore";
import { useEditorStateStore } from "@/stores/editorStateStore";
import { useConfigStore } from "@/stores/configStore";
import { useTabStore } from "@/stores/tabStore";
import type { MenuContext } from "../contextMenu/menuSchema";
import { blockState, getActiveNoteBlock, getNoteBlockFromPos } from "../codeblock/state";
import type { Block, EditorOptions } from "../codeblock/types";
import { computeDeleteBlockChange } from "../codeblock/commands";
import { getBlocksFromString } from "../codeblock/parser";
import { moveBlockManager } from "./manager";

function getDefaultBlockOptions(): EditorOptions {
    const configStore = useConfigStore();
    return {
        defaultBlockToken: configStore.config.editing.defaultBlockLanguage || "text",
        defaultBlockAutoDetect: configStore.config.editing.defaultBlockAutoDetect !== false,
        defaultBlockAccess: "write",
    };
}

function normalizeBlockForDocument(text: string, insertAtDocumentStart = false): string {
    if (insertAtDocumentStart) {
        return text.startsWith("\n∞∞∞") ? text.slice(1) : text;
    }

    return text.startsWith("∞∞∞") ? `\n${text}` : text;
}

function applyTextChange(
    content: string,
    change: { from: number; to: number; insert: string }
): string {
    return `${content.slice(0, change.from)}${change.insert}${content.slice(change.to)}`;
}

function shouldReplaceDocumentContent(content: string): boolean {
    const state = EditorState.create({ doc: content });
    const blocks = getBlocksFromString(state);
    if (blocks.length !== 1) {
        return false;
    }

    const block = blocks[0];
    if (!block) {
        return false;
    }

    return content.slice(block.content.from, block.content.to).trim().length === 0;
}

function getInsertedSelection(content: string): number {
    const state = EditorState.create({ doc: content });
    const [block] = getBlocksFromString(state);
    return block?.content.from ?? content.length;
}

function resolveCurrentBlock(view: EditorView, sourceBlock: Block): Block | null {
    const blocks = view.state.field(blockState, false) ?? [];
    const matchedBlock = blocks.find(block =>
        block.range.from === sourceBlock.range.from && block.range.to === sourceBlock.range.to
    );

    if (matchedBlock) {
        return matchedBlock;
    }

    return getNoteBlockFromPos(view.state, sourceBlock.content.from)
        ?? getActiveNoteBlock(view.state)
        ?? null;
}

async function persistDocumentContent(
    documentId: number,
    content: string,
    selection?: number,
): Promise<void> {
    const editorStore = useEditorStore();
    const documentStore = useDocumentStore();
    const editorStateStore = useEditorStateStore();
    const snapshot = await editorStore.getDocumentSnapshot(documentId);

    if (!snapshot) {
        throw new Error(`Document ${documentId} not found`);
    }

    if (snapshot.hasCachedEditor) {
        editorStore.applyDocumentContent(documentId, content, { selection });
        await editorStore.saveDirtyEditor(documentId);
        return;
    }

    if (selection !== undefined) {
        editorStateStore.saveCursorPosition(documentId, selection);
    }

    await documentStore.saveDocument(documentId, content, snapshot.baseUpdatedAt);
}

async function switchToDocument(documentId: number): Promise<void> {
    const documentStore = useDocumentStore();
    const editorStore = useEditorStore();
    const tabStore = useTabStore();

    const success = await documentStore.openDocument(documentId);
    if (!success) {
        throw new Error(`Failed to open document ${documentId}`);
    }

    await editorStore.switchToEditor(documentId);

    if (documentStore.currentDocument && tabStore.isTabsEnabled) {
        tabStore.addOrActivateTab(documentStore.currentDocument);
    }
}

function resolveDialogPosition(
    view: EditorView,
    block: Block,
    anchor?: { x: number; y: number } | null,
): { x: number; y: number } | null {
    if (anchor) {
        return anchor;
    }

    const coords = view.coordsAtPos(block.content.from)
        ?? view.coordsAtPos(view.state.selection.main.head);

    if (!coords) {
        return null;
    }

    return {
        x: coords.left,
        y: coords.bottom + 8,
    };
}

export const openMoveBlockDialogCommand: Command = (view) => {
    return openMoveBlockDialogFromContext(view);
};

export function openMoveBlockDialogFromContext(view: EditorView, context?: MenuContext): boolean {
    const documentStore = useDocumentStore();
    const block = getActiveNoteBlock(view.state);
    const sourceDocumentId = documentStore.currentDocumentId;

    if (!block || !sourceDocumentId) {
        return false;
    }

    moveBlockManager.show(
        view,
        block,
        sourceDocumentId,
        resolveDialogPosition(view, block, context ? { x: context.event.clientX, y: context.event.clientY } : null),
    );
    return true;
}

export async function moveBlockToDocument(targetDocumentId: number): Promise<boolean> {
    const documentStore = useDocumentStore();
    const state = moveBlockManager.useState().value;

    if (!state.sourceView || !state.sourceBlock || !state.sourceDocumentId) {
        return false;
    }

    if (targetDocumentId === state.sourceDocumentId) {
        return false;
    }

    const sourceView = state.sourceView as EditorView;
    const currentBlock = resolveCurrentBlock(sourceView, state.sourceBlock);
    if (!currentBlock) {
        return false;
    }

    const sourceContent = sourceView.state.doc.toString();
    const movedBlockText = sourceView.state.doc.sliceString(currentBlock.range.from, currentBlock.range.to);
    const deleteSpec = computeDeleteBlockChange(sourceView.state, currentBlock, getDefaultBlockOptions());
    const nextSourceContent = applyTextChange(sourceContent, deleteSpec.changes);

    const targetSnapshot = await useEditorStore().getDocumentSnapshot(targetDocumentId);
    if (!targetSnapshot) {
        return false;
    }

    const replaceTargetContent = shouldReplaceDocumentContent(targetSnapshot.content);
    const normalizedBlockText = normalizeBlockForDocument(movedBlockText, replaceTargetContent);
    const nextTargetContent = replaceTargetContent
        ? normalizedBlockText
        : `${targetSnapshot.content}${normalizedBlockText}`;
    const targetSelection = (replaceTargetContent ? 0 : targetSnapshot.content.length)
        + getInsertedSelection(normalizedBlockText);

    await persistDocumentContent(targetDocumentId, nextTargetContent, targetSelection);
    await persistDocumentContent(state.sourceDocumentId, nextSourceContent, deleteSpec.selection);
    await switchToDocument(targetDocumentId);

    moveBlockManager.hide({ focusSourceView: false });
    return Boolean(documentStore.currentDocumentId === targetDocumentId);
}

export async function moveBlockToNewDocument(title: string): Promise<number | null> {
    const documentStore = useDocumentStore();
    const newDocument = await documentStore.createNewDocument(title);
    if (!newDocument?.id) {
        return null;
    }

    const moved = await moveBlockToDocument(newDocument.id);
    return moved ? newDocument.id : null;
}
