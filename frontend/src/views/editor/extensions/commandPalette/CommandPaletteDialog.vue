<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useEditorStore } from "@/stores/editorStore";
import { commands, getCommandHandler } from "@/views/editor/keymap/commands";
import { getCommandKeyBindingLabels } from "@/views/editor/keymap/shortcut";
import { commandPaletteManager } from "./manager";

interface CommandItem {
    key: string;
    description: string;
    shortcuts: string[];
}

const props = defineProps<{
    portalTarget?: HTMLElement | null;
}>();

const { t, locale } = useI18n();
const editorStore = useEditorStore();
const managerState = commandPaletteManager.useState();

const dialogRef = ref<HTMLDivElement | null>(null);
const listRef = ref<HTMLDivElement | null>(null);
const inputRef = ref<HTMLInputElement | null>(null);
const query = ref("");
const activeIndex = ref(0);

const teleportTarget = computed<HTMLElement | string>(() => props.portalTarget ?? "body");
const isVisible = computed(() => managerState.value.visible);

const commandItems = computed<CommandItem[]>(() => {
    return Object.entries(commands)
        .map(([key, definition]) => ({
            key,
            description: t(definition.descriptionKey),
            shortcuts: getCommandKeyBindingLabels(key),
        }))
        .sort((left, right) => left.description.localeCompare(right.description, locale.value));
});

const filteredItems = computed<CommandItem[]>(() => {
    const keyword = normalizeSearchText(query.value);
    if (!keyword) {
        return commandItems.value;
    }

    return commandItems.value
        .map(item => ({
            item,
            score: getItemScore(item, keyword),
        }))
        .filter(entry => Number.isFinite(entry.score))
        .sort((left, right) => {
            if (left.score !== right.score) {
                return left.score - right.score;
            }

            return left.item.description.localeCompare(right.item.description, locale.value);
        })
        .map(entry => entry.item);
});

watch(isVisible, async (visible) => {
    if (!visible) {
        query.value = "";
        activeIndex.value = 0;
        document.removeEventListener("mousedown", handleClickOutside);
        return;
    }

    query.value = managerState.value.initialQuery;
    activeIndex.value = 0;
    await nextTick();
    inputRef.value?.focus();
    inputRef.value?.select();
    scrollActiveItemIntoView();
    document.addEventListener("mousedown", handleClickOutside);
});

watch(filteredItems, (items) => {
    if (items.length === 0) {
        activeIndex.value = 0;
        return;
    }

    if (activeIndex.value >= items.length) {
        activeIndex.value = 0;
    }

    nextTick(scrollActiveItemIntoView);
});

watch(activeIndex, () => {
    nextTick(scrollActiveItemIntoView);
});

onUnmounted(() => {
    document.removeEventListener("mousedown", handleClickOutside);
});

async function executeItem(item: CommandItem | undefined): Promise<void> {
    if (!item) {
        return;
    }

    const view = editorStore.currentEditor;
    const handler = getCommandHandler(item.key);
    if (!view || !handler) {
        return;
    }

    commandPaletteManager.hide();
    await nextTick();
    view.focus();
    requestAnimationFrame(() => {
        handler(view);
    });
}

function handleClose(): void {
    commandPaletteManager.hide();
}

function handleKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
        event.preventDefault();
        handleClose();
        return;
    }

    if (filteredItems.value.length === 0) {
        return;
    }

    if (event.key === "ArrowDown") {
        event.preventDefault();
        activeIndex.value = (activeIndex.value + 1) % filteredItems.value.length;
        return;
    }

    if (event.key === "ArrowUp") {
        event.preventDefault();
        activeIndex.value = (activeIndex.value - 1 + filteredItems.value.length) % filteredItems.value.length;
        return;
    }

    if (event.key === "Enter") {
        event.preventDefault();
        void executeItem(filteredItems.value[activeIndex.value]);
    }
}

function handleClickOutside(event: MouseEvent): void {
    if (dialogRef.value?.contains(event.target as Node)) {
        return;
    }

    handleClose();
}

function scrollActiveItemIntoView(): void {
    listRef.value?.querySelector<HTMLElement>(".list-item.active")?.scrollIntoView({ block: "nearest" });
}

function normalizeSearchText(value: string): string {
    return value.toLowerCase().replace(/[+\s_-]+/g, " ").trim();
}

function scoreCandidate(candidate: string, keyword: string): number {
    if (!candidate) {
        return Number.POSITIVE_INFINITY;
    }

    const normalized = normalizeSearchText(candidate);
    const compact = normalized.replace(/\s+/g, "");
    const compactKeyword = keyword.replace(/\s+/g, "");

    if (normalized === keyword || compact === compactKeyword) {
        return 0;
    }

    if (normalized.startsWith(keyword) || compact.startsWith(compactKeyword)) {
        return 1;
    }

    const normalIndex = normalized.indexOf(keyword);
    if (normalIndex >= 0) {
        return 10 + normalIndex;
    }

    const compactIndex = compact.indexOf(compactKeyword);
    if (compactIndex >= 0) {
        return 20 + compactIndex;
    }

    return Number.POSITIVE_INFINITY;
}

function getItemScore(item: CommandItem, keyword: string): number {
    return Math.min(
        scoreCandidate(item.description, keyword),
        scoreCandidate(item.key, keyword),
        ...item.shortcuts.map(shortcut => scoreCandidate(shortcut, keyword)),
    );
}
</script>

<template>
    <Teleport :to="teleportTarget">
        <Transition name="command-palette-panel">
            <div
                v-if="isVisible"
                ref="dialogRef"
                class="command-palette"
                role="dialog"
                aria-modal="false"
                @contextmenu.prevent
            >
                <div class="input-box">
                    <input
                        ref="inputRef"
                        v-model="query"
                        class="main-input"
                        type="text"
                        :placeholder="t('commandPalette.placeholder')"
                        @keydown="handleKeydown"
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
                        <circle cx="11" cy="11" r="8" />
                        <path d="m21 21-4.35-4.35" />
                    </svg>
                </div>

                <div ref="listRef" class="item-list">
                    <button
                        v-for="(item, index) in filteredItems"
                        :key="item.key"
                        class="list-item"
                        :class="{ active: index === activeIndex }"
                        type="button"
                        @mouseenter="activeIndex = index"
                        @click="executeItem(item)"
                    >
                        <div class="item-main">
                            <div class="item-title">{{ item.description }}</div>
                            <div class="item-key">{{ item.key }}</div>
                        </div>
                        <div v-if="item.shortcuts.length > 0" class="item-shortcuts">
                            <span
                                v-for="shortcut in item.shortcuts.slice(0, 2)"
                                :key="shortcut"
                                class="shortcut-chip"
                            >
                                {{ shortcut }}
                            </span>
                        </div>
                    </button>

                    <div v-if="filteredItems.length === 0" class="empty-state">
                        {{ t('commandPalette.noResult') }}
                    </div>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>

<style scoped lang="scss">
.command-palette-panel-enter-active,
.command-palette-panel-leave-active {
    transition: opacity 0.15s ease, transform 0.15s ease;
}

.command-palette-panel-enter-from,
.command-palette-panel-leave-to {
    opacity: 0;
    transform: translate(-50%, -8px);
}

.command-palette {
    position: absolute;
    top: 12px;
    left: 50%;
    transform: translateX(-50%);
    width: min(560px, calc(100% - 24px));
    max-height: min(420px, calc(100% - 24px));
    display: flex;
    flex-direction: column;
    background-color: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 3px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    overflow: hidden;
    z-index: 10002;
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
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    border: none;
    border-bottom: 1px solid var(--border-color);
    background: transparent;
    color: inherit;
    text-align: left;
    padding: 10px;
    cursor: pointer;
}

.list-item:hover,
.list-item.active {
    background-color: var(--selection-bg);
}

.list-item:hover .item-title,
.list-item:hover .item-key,
.list-item.active .item-title,
.list-item.active .item-key {
    color: var(--selection-text);
}

.item-main {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
    flex: 1;
}

.item-title {
    font-size: 13px;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.item-key {
    font-size: 11px;
    color: var(--text-muted);
    opacity: 0.7;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.item-shortcuts {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    justify-content: flex-end;
}

.shortcut-chip {
    font-size: 11px;
    color: var(--text-muted);
    background-color: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 2px;
    padding: 2px 6px;
    white-space: nowrap;
}

.list-item:hover .shortcut-chip,
.list-item.active .shortcut-chip {
    color: var(--selection-text);
    border-color: color-mix(in srgb, var(--selection-text) 24%, transparent);
    background-color: color-mix(in srgb, var(--selection-bg) 82%, var(--bg-primary));
}

.empty-state {
    padding: 18px 10px;
    text-align: center;
    font-size: 12px;
    color: var(--text-muted);
}
</style>
