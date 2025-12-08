<script setup lang="ts">
import {computed, nextTick, onUnmounted, ref, watch} from 'vue';
import {translatorManager} from './manager';
import {useTranslationStore} from '@/stores/translationStore';

const props = defineProps<{
  portalTarget?: HTMLElement | null;
}>();

const state = translatorManager.useState();
const translationStore = useTranslationStore();

const dialogRef = ref<HTMLDivElement | null>(null);
const adjustedPosition = ref({ x: 0, y: 0 });

const isVisible = computed(() => state.value.visible);
const sourceText = computed(() => state.value.sourceText);
const position = computed(() => state.value.position);
const teleportTarget = computed<HTMLElement | string>(() => props.portalTarget ?? 'body');

const sourceLangSelector = ref('');
const targetLangSelector = ref('');
const translatorSelector = ref('');
const translatedText = ref('');
const isLoading = ref(false);

const isDragging = ref(false);
const dragStart = ref({ x: 0, y: 0 });

// 监听可见性变化
watch(isVisible, async (visible) => {
  if (visible) {
    adjustedPosition.value = { ...position.value };
    await nextTick();
    adjustDialogPosition();
    await initializeTranslation();
    await nextTick();
    document.addEventListener('mousedown', handleClickOutside);
  } else {
    document.removeEventListener('mousedown', handleClickOutside);
    isDragging.value = false;
  }
});

// 清理
onUnmounted(() => {
  document.removeEventListener('mousedown', handleClickOutside);
});

const dialogStyle = computed(() => ({
  left: `${adjustedPosition.value.x}px`,
  top: `${adjustedPosition.value.y}px`
}));

const availableLanguages = computed(() => {
  const languageMap = translationStore.translatorLanguages[translatorSelector.value];
  if (!languageMap) return [];
  return Object.entries(languageMap).map(([code, info]: [string, any]) => ({
    code,
    name: info.Name || info.name || code
  }));
});

const availableTranslators = computed(() => translationStore.translators);

function adjustDialogPosition() {
  const dialogEl = dialogRef.value;
  const container = props.portalTarget;
  if (!dialogEl || !container) return;

  const containerRect = container.getBoundingClientRect();
  const dialogRect = dialogEl.getBoundingClientRect();
  
  let x = adjustedPosition.value.x;
  let y = adjustedPosition.value.y;

  // 限制在容器范围内
  x = Math.max(containerRect.left, Math.min(x, containerRect.right - dialogRect.width - 8));
  y = Math.max(containerRect.top, Math.min(y, containerRect.bottom - dialogRect.height - 8));

  adjustedPosition.value = { x, y };
}

function clampPosition(x: number, y: number) {
  const container = props.portalTarget;
  const dialogEl = dialogRef.value;
  if (!container || !dialogEl) return { x, y };

  const containerRect = container.getBoundingClientRect();
  const dialogRect = dialogEl.getBoundingClientRect();

  return {
    x: Math.max(containerRect.left, Math.min(x, containerRect.right - dialogRect.width)),
    y: Math.max(containerRect.top, Math.min(y, containerRect.bottom - dialogRect.height))
  };
}

async function initializeTranslation() {
  isLoading.value = true;
  translatedText.value = '';

  try {
    await loadTranslators();
    await translate();
  } catch (error) {
    console.error('Failed to initialize translation:', error);
    isLoading.value = false;
  }
}

async function loadTranslators() {
  const translators = translationStore.translators;
  if (translators.length > 0) {
    translatorSelector.value = translators[0];
  }
  resetLanguageSelectors();
}

function resetLanguageSelectors() {
  const languageMap = translationStore.translatorLanguages[translatorSelector.value];
  if (!languageMap) return;

  const languages = Object.keys(languageMap);
  if (languages.length > 0) {
    sourceLangSelector.value = languages[0];
    targetLangSelector.value = languages[0];
  }
}

function handleTranslatorChange() {
  resetLanguageSelectors();
  translate();
}

function swapLanguages() {
  const temp = sourceLangSelector.value;
  sourceLangSelector.value = targetLangSelector.value;
  targetLangSelector.value = temp;
  translate();
}

async function translate() {
  const sourceLang = sourceLangSelector.value;
  const targetLang = targetLangSelector.value;
  const translatorType = translatorSelector.value;

  if (!sourceLang || !targetLang || !translatorType) {
    return;
  }

  isLoading.value = true;
  translatedText.value = '';

  try {
    const result = await translationStore.translateText(
      sourceText.value,
      sourceLang,
      targetLang,
      translatorType
    );

    translatedText.value = result.translatedText || result.error || '';
  } catch (err) {
    console.error('Translation failed:', err);
    translatedText.value = 'Translation failed';
  } finally {
    isLoading.value = false;
  }
}

function startDrag(e: MouseEvent) {
  const target = e.target as HTMLElement;
  if (target.closest('select, button')) return;
  
  e.preventDefault();
  e.stopPropagation();
  
  const rect = dialogRef.value!.getBoundingClientRect();
  dragStart.value = {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  };
  
  isDragging.value = true;
  document.addEventListener('mousemove', onDrag);
  document.addEventListener('mouseup', endDrag);
}

function onDrag(e: MouseEvent) {
  adjustedPosition.value = clampPosition(
      e.clientX - dragStart.value.x,
      e.clientY - dragStart.value.y
  );
}

function endDrag(e: MouseEvent) {
  e.stopPropagation();
  isDragging.value = false;
  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('mouseup', endDrag);
}

async function copyToClipboard() {
  try {
    await navigator.clipboard.writeText(translatedText.value);
  } catch (error) {
    console.error('Failed to copy text:', error);
  }
}

function handleClickOutside(e: MouseEvent) {
  if (isDragging.value) return;
  if (dialogRef.value?.contains(e.target as Node)) return;
  translatorManager.hide();
}
</script>

<template>
  <Teleport :to="teleportTarget">
    <template v-if="isVisible">
      <div
        ref="dialogRef"
        class="cm-translation-tooltip"
        :class="{ 'cm-translation-dragging': isDragging }"
        :style="dialogStyle"
        @mousedown="startDrag"
        @keydown.esc="translatorManager.hide"
        @contextmenu.prevent
        tabindex="-1"
      >
        <div class="cm-translation-header">
          <div class="cm-translation-controls">
            <select
              v-model="sourceLangSelector"
              class="cm-translation-select"
              @change="translate"
              @mousedown.stop
            >
              <option v-for="lang in availableLanguages" :key="lang.code" :value="lang.code">
                {{ lang.name }}
              </option>
            </select>
            
            <button class="cm-translation-swap" @click="swapLanguages" @mousedown.stop title="交换语言">
              <svg viewBox="0 0 24 24" width="11" height="11">
                <path fill="currentColor" d="M7.5 21L3 16.5L7.5 12L9 13.5L7 15.5H15V13H17V17.5H7L9 19.5L7.5 21M16.5 3L21 7.5L16.5 12L15 10.5L17 8.5H9V11H7V6.5H17L15 4.5L16.5 3Z"/>
              </svg>
            </button>
            
            <select
              v-model="targetLangSelector"
              class="cm-translation-select"
              @change="translate"
              @mousedown.stop
            >
              <option v-for="lang in availableLanguages" :key="lang.code" :value="lang.code">
                {{ lang.name }}
              </option>
            </select>
            
            <select
              v-model="translatorSelector"
              class="cm-translation-select"
              @change="handleTranslatorChange"
              @mousedown.stop
            >
              <option v-for="translator in availableTranslators" :key="translator" :value="translator">
                {{ translator }}
              </option>
            </select>
          </div>
        </div>
        
        <div class="cm-translation-scroll-container">
          <div v-if="isLoading" class="cm-translation-loading">
            Translation...
          </div>
          
          <div v-else class="cm-translation-result">
            <div class="cm-translation-result-wrapper">
              <button
                v-if="translatedText"
                class="cm-translation-copy-btn"
                @click="copyToClipboard"
                @mousedown.stop
                title="Copy"
              >
                <svg viewBox="0 0 24 24">
                  <path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                </svg>
              </button>
              <div class="cm-translation-target">{{ translatedText }}</div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </Teleport>
</template>

<style scoped>
.cm-translation-tooltip {
  position: fixed;
  background: var(--settings-card-bg, #fff);
  color: var(--text-primary, #333);
  border: 1px solid var(--border-color, rgba(0, 0, 0, 0.1));
  border-radius: 6px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3), 0 0 1px rgba(0, 0, 0, 0.2);
  padding: 6px;
  max-width: 240px;
  max-height: 180px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: var(--voidraft-font-mono, system-ui, -apple-system, sans-serif), serif;
  font-size: 10px;
  user-select: none;
  cursor: grab;
  z-index: 10000;
  outline: none;
}

.cm-translation-dragging {
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15), 0 0 1px rgba(0, 0, 0, 0.2);
  z-index: 10001;
  cursor: grabbing !important;
}

.cm-translation-header {
  margin-bottom: 6px;
  flex-shrink: 0;
}

.cm-translation-controls {
  display: flex;
  align-items: center;
  gap: 3px;
  flex-wrap: nowrap;
}

.cm-translation-select {
  padding: 2px 3px;
  border-radius: 4px;
  border: 1px solid var(--border-color, rgba(0, 0, 0, 0.12));
  background: var(--bg-primary, #f8f8f8);
  font-size: 10px;
  color: var(--text-primary, #333);
  flex: 1;
  min-width: 0;
  max-width: 65px;
  height: 20px;
  cursor: pointer;
}

.cm-translation-select:focus {
  outline: none;
  border-color: var(--border-color, rgba(66, 133, 244, 0.5));
}

.cm-translation-swap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: 1px solid var(--border-color, rgba(0, 0, 0, 0.12));
  background: var(--bg-primary, transparent);
  color: var(--text-muted, #666);
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
  transition: all 0.15s ease;
}

.cm-translation-swap:hover {
  background: var(--bg-hover, rgba(66, 133, 244, 0.08));
  border-color: var(--border-color, rgba(66, 133, 244, 0.3));
}

.cm-translation-scroll-container {
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.cm-translation-scroll-container::-webkit-scrollbar {
  width: 4px;
}

.cm-translation-scroll-container::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.15);
  border-radius: 2px;
}

.cm-translation-scroll-container::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.25);
}

.cm-translation-result {
  display: flex;
  flex-direction: column;
}

.cm-translation-result-wrapper {
  position: relative;
  width: 100%;
}

.cm-translation-copy-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 3px;
  border: 1px solid var(--border-color, rgba(0, 0, 0, 0.1));
  background: var(--bg-primary, rgba(255, 255, 255, 0.9));
  color: var(--text-muted, #666);
  cursor: pointer;
  padding: 0;
  position: absolute;
  top: 3px;
  right: 3px;
  z-index: 2;
  opacity: 0.6;
  transition: all 0.15s ease;
}

.cm-translation-copy-btn:hover {
  background: var(--bg-hover, rgba(66, 133, 244, 0.1));
  opacity: 1;
  transform: scale(1.05);
}

.cm-translation-copy-btn svg {
  width: 11px;
  height: 11px;
}

.cm-translation-target {
  padding: 5px;
  padding-right: 24px;
  background: var(--bg-primary, rgba(66, 133, 244, 0.03));
  color: var(--text-primary, #333);
  border-radius: 4px;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.4;
  min-height: 32px;
}

.cm-translation-loading {
  padding: 6px;
  text-align: center;
  color: var(--text-muted, #666);
  font-size: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-height: 32px;
}

.cm-translation-loading::before {
  content: '';
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid var(--text-muted, rgba(0, 0, 0, 0.2));
  border-top-color: var(--text-muted, #666);
  animation: cm-translation-spin 0.8s linear infinite;
}

@keyframes cm-translation-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>

