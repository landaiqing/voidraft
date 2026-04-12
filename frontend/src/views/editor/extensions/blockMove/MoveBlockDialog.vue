<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import type { Document } from "@/../bindings/voidraft/internal/models/ent/models";
import { useDocumentStore } from "@/stores/documentStore";
import { formatDateTime } from "@/common/utils/formatter";
import { validateDocumentTitle } from "@/common/utils/validation";
import toast from "@/components/toast";
import { moveBlockToDocument, moveBlockToNewDocument } from "./index";
import { moveBlockManager } from "./manager";

interface DocumentItem extends Document {
    isCreateOption?: boolean;
}

const props = defineProps<{
    portalTarget?: HTMLElement | null;
}>();

const { t, locale } = useI18n();
const documentStore = useDocumentStore();
const managerState = moveBlockManager.useState();

const inputRef = ref<HTMLInputElement | null>(null);
const dialogRef = ref<HTMLDivElement | null>(null);
const searchQuery = ref("");
const documentList = ref<Document[]>([]);
const isMoving = ref(false);
const adjustedPosition = ref({ x: 0, y: 0 });

const MAX_TITLE_LENGTH = 50;
const teleportTarget = computed<HTMLElement | string>(() => props.portalTarget ?? "body");
const sourceDocumentId = computed(() => managerState.value.sourceDocumentId);
const isVisible = computed(() => managerState.value.visible);
const anchorPosition = computed(() => managerState.value.position);
const dialogStyle = computed(() => ({
    left: `${adjustedPosition.value.x}px`,
    top: `${adjustedPosition.value.y}px`,
}));

const filteredItems = computed<DocumentItem[]>(() => {
    const items = documentList.value.filter(doc => doc.id !== sourceDocumentId.value);
    const query = searchQuery.value.trim();

    if (!query) {
        return items;
    }

    const filtered = items.filter(doc =>
        (doc.title || "").toLowerCase().includes(query.toLowerCase())
    );
    const exactMatch = items.some(doc => (doc.title || "").toLowerCase() === query.toLowerCase());

    if (!exactMatch) {
        return [
            {
                id: -1,
                title: query,
                isCreateOption: true,
            } as DocumentItem,
            ...filtered,
        ];
    }

    return filtered;
});

watch(isVisible, async (visible) => {
    if (!visible) {
        searchQuery.value = "";
        documentList.value = [];
        isMoving.value = false;
        document.removeEventListener("mousedown", handleClickOutside);
        return;
    }

    documentList.value = await documentStore.getDocumentList();
    adjustedPosition.value = anchorPosition.value ?? getDefaultPosition();
    await nextTick();
    adjustDialogPosition();
    inputRef.value?.focus();
    inputRef.value?.select();
    document.addEventListener("mousedown", handleClickOutside);
});

onUnmounted(() => {
    document.removeEventListener("mousedown", handleClickOutside);
});

async function handleSelect(item: DocumentItem): Promise<void> {
    if (isMoving.value) {
        return;
    }

    try {
        isMoving.value = true;

        if (item.isCreateOption) {
            const title = item.title?.trim() || searchQuery.value.trim();
            const error = validateDocumentTitle(title, MAX_TITLE_LENGTH);
            if (error) {
                toast.error(error);
                return;
            }

            const documentId = await moveBlockToNewDocument(title);
            if (!documentId) {
                throw new Error(t("blockMove.moveFailed"));
            }
        } else {
            if (item.id === undefined) {
                return;
            }

            const moved = await moveBlockToDocument(item.id);
            if (!moved) {
                throw new Error(t("blockMove.moveFailed"));
            }
        }

        toast.success(t("blockMove.moveSuccess"));
    } catch (error) {
        toast.error(error instanceof Error ? error.message : t("blockMove.moveFailed"));
    } finally {
        isMoving.value = false;
    }
}

function handleClose(): void {
    if (isMoving.value) {
        return;
    }

    moveBlockManager.hide();
}

function getContainerRect(): DOMRect | Pick<DOMRect, "left" | "top" | "right" | "bottom"> {
    return props.portalTarget?.getBoundingClientRect() ?? {
        left: 8,
        top: 8,
        right: window.innerWidth - 8,
        bottom: window.innerHeight - 8,
    };
}

function getDefaultPosition(): { x: number; y: number } {
    const rect = getContainerRect();

    return {
        x: rect.left + 24,
        y: rect.top + 24,
    };
}

function adjustDialogPosition(): void {
    const dialogEl = dialogRef.value;
    if (!dialogEl) {
        return;
    }

    const rect = getContainerRect();
    const dialogRect = dialogEl.getBoundingClientRect();
    const anchor = anchorPosition.value ?? getDefaultPosition();
    const margin = 8;

    let x = anchor.x;
    let y = anchor.y;

    if (x + dialogRect.width > rect.right - margin) {
        x = rect.right - dialogRect.width - margin;
    }

    if (y + dialogRect.height > rect.bottom - margin) {
        y = anchor.y - dialogRect.height - 12;
    }

    adjustedPosition.value = {
        x: Math.max(rect.left + margin, x),
        y: Math.max(rect.top + margin, y),
    };
}

function handleEnter(): void {
    if (filteredItems.value.length > 0) {
        void handleSelect(filteredItems.value[0]);
    }
}

function handleClickOutside(event: MouseEvent): void {
    if (dialogRef.value?.contains(event.target as Node)) {
        return;
    }

    handleClose();
}
</script>

<template>
    <Teleport :to="teleportTarget">
        <Transition name="move-block-panel">
            <div
                v-if="isVisible"
                ref="dialogRef"
                class="move-block-dialog"
                :style="dialogStyle"
                role="dialog"
                aria-modal="false"
                @contextmenu.prevent
            >
                <div class="input-box">
                    <input
                        ref="inputRef"
                        v-model="searchQuery"
                        class="main-input"
                        type="text"
                        :placeholder="t('blockMove.searchPlaceholder')"
                        :maxlength="MAX_TITLE_LENGTH"
                        :disabled="isMoving"
                        @keydown.enter="handleEnter"
                        @keydown.esc.stop.prevent="handleClose"
                    />
                    <svg
                        class="input-icon"
                        xmlns="http://www.w3.org/2000/svg"
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <circle cx="11" cy="11" r="8"/>
                        <path d="m21 21-4.35-4.35"/>
                    </svg>
                </div>

                <div class="item-list">
                    <button
                        v-for="item in filteredItems"
                        :key="`${item.id}-${item.title}`"
                        class="list-item"
                        type="button"
                        :disabled="isMoving"
                        @click="handleSelect(item)"
                    >
                        <div v-if="item.isCreateOption" class="create-option">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            >
                                <path d="M5 12h14"/>
                                <path d="M12 5v14"/>
                            </svg>
                            <span class="create-title">
                                {{ t('blockMove.createAndMove', { title: item.title }) }}
                            </span>
                        </div>

                        <div v-else class="document-option">
                            <div class="document-title">{{ item.title }}</div>
                            <div class="document-date">
                                {{ formatDateTime(item.updated_at, { locale }) }}
                            </div>
                        </div>
                    </button>

                    <div v-if="filteredItems.length === 0" class="empty-state">
                        {{ t("blockMove.noDocumentFound") }}
                    </div>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>

<style scoped lang="scss">
.move-block-panel-enter-active,
.move-block-panel-leave-active {
    transition: opacity 0.15s ease, transform 0.15s ease;
}

.move-block-panel-enter-from,
.move-block-panel-leave-to {
    opacity: 0;
    transform: translateY(8px);
}

.move-block-dialog {
    position: fixed;
    width: min(340px, calc(100vw - 24px));
    max-height: min(420px, calc(100vh - 24px));
    display: flex;
    flex-direction: column;
    background-color: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 3px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    overflow: hidden;
    z-index: 10001;
}

.input-box {
    position: relative;
    padding: 10px;
    border-bottom: 1px solid var(--border-color);
}

.main-input {
    width: 100%;
    box-sizing: border-box;
    background-color: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 2px;
    color: var(--text-primary);
    font-size: 12px;
    padding: 6px 10px 6px 30px;
    outline: none;
}

.main-input:focus {
    border-color: var(--text-muted);
}

.main-input::placeholder {
    color: var(--text-muted);
}

.input-icon {
    position: absolute;
    left: 16px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-muted);
    pointer-events: none;
}

.item-list {
    overflow-y: auto;
    flex: 1;
    min-height: 0;
}

.list-item {
    width: 100%;
    border: none;
    background: transparent;
    color: inherit;
    text-align: left;
    cursor: pointer;
    padding: 0;
    border-bottom: 1px solid var(--border-color);
}

.list-item:hover:not(:disabled) {
    background-color: var(--bg-hover);
}

.list-item:disabled {
    opacity: 0.6;
    cursor: wait;
}

.create-option,
.document-option {
    display: flex;
    padding: 10px;
}

.create-option {
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--text-primary);
}

.create-option svg {
    flex-shrink: 0;
    color: var(--text-muted);
}

.document-option {
    flex-direction: column;
    gap: 3px;
}

.create-title,
.document-title {
    font-size: 13px;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.document-date {
    font-size: 11px;
    color: var(--text-muted);
    opacity: 0.6;
}

.empty-state {
    padding: 18px 10px;
    text-align: center;
    font-size: 12px;
    color: var(--text-muted);
}
</style>
