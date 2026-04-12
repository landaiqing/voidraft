<script setup lang="ts">
import { computed, effectScope, onScopeDispose, onUnmounted, shallowRef, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useEditorStore } from "@/stores/editorStore";
import type { Block } from "@/views/editor/extensions/codeblock/types";
import { getActiveNoteBlock } from "@/views/editor/extensions/codeblock/state";
import { formatBlockCreatedAt } from "@/views/editor/extensions/codeblock/timestamp";
import { getLanguage } from "@/views/editor/extensions/codeblock/lang-parser/languages";

const editorStore = useEditorStore();
const { t, locale } = useI18n();

const activeBlock = shallowRef<Block | null>(null);
const createdAtLabel = shallowRef("");
const languageLabel = computed(() => {
    const languageName = activeBlock.value?.language.name;
    return languageName ? (getLanguage(languageName as any)?.name ?? languageName) : "";
});
const accessLabel = computed(() => {
    if (!activeBlock.value) {
        return "";
    }

    return t(activeBlock.value.access === "read" ? "blockTools.readonly" : "blockTools.writable");
});
const autoDetectLabel = computed(() => {
    if (!activeBlock.value) {
        return "";
    }

    return t(activeBlock.value.language.auto ? "blockTools.enabled" : "blockTools.disabled");
});

let cleanupListeners: (() => void)[] = [];
const editorScope = effectScope();

function resetState() {
    activeBlock.value = null;
    createdAtLabel.value = "";
}

function updateState() {
    const view = editorStore.currentEditor;
    if (!view) {
        resetState();
        return;
    }

    const block = getActiveNoteBlock(view.state as any) ?? null;
    activeBlock.value = block;
    createdAtLabel.value = formatBlockCreatedAt(block?.createdAt, undefined, locale.value);
}

function setupListeners(view: NonNullable<typeof editorStore.currentEditor>) {
    const handler = () => requestAnimationFrame(updateState);
    const events = ["click", "keyup", "keydown", "focus", "mouseup", "selectionchange"];

    events.forEach(event => view.dom.addEventListener(event, handler));

    return events.map(event => () => view.dom.removeEventListener(event, handler));
}

watch(
    () => editorStore.currentEditor,
    (view) => {
        editorScope.run(() => {
            cleanupListeners.forEach(cleanup => cleanup());
            cleanupListeners = [];

            if (!view) {
                resetState();
                return;
            }

            cleanupListeners = setupListeners(view);
            updateState();
        });
    },
    { immediate: true }
);

watch(locale, () => {
    updateState();
});

onScopeDispose(() => {
    cleanupListeners.forEach(cleanup => cleanup());
    cleanupListeners = [];
});

onUnmounted(() => {
    editorScope.stop();
});
</script>

<template>
    <div v-if="activeBlock" class="block-meta-tools">
        <div
            class="meta-anchor"
            :class="{ readonly: activeBlock.access === 'read' }"
            tabindex="0"
            :title="t('blockTools.blockInfo')"
        >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="9"/>
                <path d="M12 8h.01"/>
                <path d="M11 12h1v4h1"/>
            </svg>
        </div>

        <div class="meta-popover">
            <div class="meta-row">
                <span class="meta-label">{{ t('blockTools.language') }}</span>
                <span class="meta-value">{{ languageLabel }}</span>
            </div>
            <div class="meta-row">
                <span class="meta-label">{{ t('blockTools.access') }}</span>
                <span class="meta-value">{{ accessLabel }}</span>
            </div>
            <div class="meta-row">
                <span class="meta-label">{{ t('blockTools.autoDetect') }}</span>
                <span class="meta-value">{{ autoDetectLabel }}</span>
            </div>
            <div v-if="createdAtLabel" class="meta-row">
                <span class="meta-label">{{ t('blockTools.createdAt') }}</span>
                <span class="meta-value" :title="activeBlock.createdAt">{{ createdAtLabel }}</span>
            </div>
        </div>
    </div>
</template>

<style scoped lang="scss">
.block-meta-tools {
    display: flex;
    align-items: center;
    position: relative;
}

.meta-anchor {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    color: var(--text-muted);
    border-radius: 3px;
    cursor: default;
    transition: background-color 0.15s ease, color 0.15s ease;
}

.meta-anchor.readonly {
    color: #d19a66;
}

.block-meta-tools:hover .meta-anchor,
.block-meta-tools:focus-within .meta-anchor {
    background-color: var(--border-color);
    color: var(--text-secondary);
}

.meta-popover {
    position: absolute;
    right: 0;
    bottom: calc(100% + 6px);
    min-width: 220px;
    padding: 10px;
    border: 1px solid var(--border-color);
    border-radius: 3px;
    background-color: var(--bg-secondary);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    display: flex;
    flex-direction: column;
    gap: 6px;
    opacity: 0;
    pointer-events: none;
    transform: translateY(4px);
    transition: opacity 0.15s ease, transform 0.15s ease;
    z-index: 1000;
}

.block-meta-tools:hover .meta-popover,
.block-meta-tools:focus-within .meta-popover {
    opacity: 1;
    transform: translateY(0);
}

.meta-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}

.meta-label {
    color: var(--text-muted);
    font-size: 11px;
}

.meta-value {
    color: var(--text-primary);
    font-size: 12px;
    text-align: right;
}
</style>
