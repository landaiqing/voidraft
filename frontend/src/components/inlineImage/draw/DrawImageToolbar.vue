<script setup lang="ts">
import {computed} from 'vue';
import {useI18n} from 'vue-i18n';
import type {ToolMode} from './types';

const props = defineProps<{
  toolMode: ToolMode;
  brushColor: string;
  brushWidth: number;
  brushWidthOptions: number[];
  canUndo: boolean;
  canRedo: boolean;
  zoomLabel: string;
}>();

const emit = defineEmits<{
  'select-tool': [tool: ToolMode];
  'update:brush-color': [value: string];
  'update:brush-width': [value: number];
  undo: [];
  redo: [];
  'zoom-out': [];
  'zoom-in': [];
  'reset-zoom': [];
}>();

const {t} = useI18n();

const toolButtons = computed(() => [
  {
    id: 'select' as const,
    label: t('inlineImage.drawDialog.select'),
    path: 'M5 3L19 12L13 13.5L16.5 21L13.5 22L10 14.5L5 19V3Z',
  },
  {
    id: 'pan' as const,
    label: t('inlineImage.drawDialog.pan'),
    path: 'M19.98 14.82L19.35 19.28C19.21 20.27 18.36 21 17.37 21H11.21C10.68 21 9.92 20.79 9.55 20.41L5 15.62L5.83 14.78C6.07 14.54 6.41 14.43 6.75 14.5L10 15.24V4.5C10 3.67 10.67 3 11.5 3S13 3.67 13 4.5V10.5H13.91C14.22 10.5 14.53 10.57 14.8 10.71L18.89 12.75C19.66 13.14 20.1 13.97 19.98 14.82Z',
  },
  {
    id: 'pen' as const,
    label: t('inlineImage.drawDialog.pen'),
    path: 'M3 17.25V21H6.75L17.81 9.94L14.06 6.19L3 17.25M20.71 7.04C21.1 6.65 21.1 6 20.71 5.63L18.37 3.29C18 2.9 17.35 2.9 16.96 3.29L15.13 5.12L18.88 8.87L20.71 7.04Z',
  },
]);

const historyButtons = computed(() => [
  {
    id: 'undo' as const,
    label: t('inlineImage.drawDialog.undo'),
    path: 'M12.5 8C16.64 8 20 11.36 20 15.5C20 19.64 16.64 23 12.5 23C9.53 23 6.97 21.27 5.76 18.76L7.57 17.93C8.47 19.77 10.35 21 12.5 21C15.54 21 18 18.54 18 15.5C18 12.46 15.54 10 12.5 10H6.41L8.7 12.29L7.29 13.7L2.59 9L7.29 4.29L8.7 5.7L6.41 8H12.5Z',
    disabled: !props.canUndo,
    click: () => emit('undo'),
  },
  {
    id: 'redo' as const,
    label: t('inlineImage.drawDialog.redo'),
    path: 'M11.5 8C7.36 8 4 11.36 4 15.5C4 19.64 7.36 23 11.5 23C14.47 23 17.03 21.27 18.24 18.76L16.43 17.93C15.53 19.77 13.65 21 11.5 21C8.46 21 6 18.54 6 15.5C6 12.46 8.46 10 11.5 10H17.59L15.3 12.29L16.71 13.7L21.41 9L16.71 4.29L15.3 5.7L17.59 8H11.5Z',
    disabled: !props.canRedo,
    click: () => emit('redo'),
  },
]);

const zoomButtons = computed(() => [
  {
    id: 'zoomOut' as const,
    label: t('inlineImage.drawDialog.zoomOut'),
    path: 'M19 13H5V11H19V13Z',
    disabled: false,
    click: () => emit('zoom-out'),
  },
  {
    id: 'zoomIn' as const,
    label: t('inlineImage.drawDialog.zoomIn'),
    path: 'M19 13H13V19H11V13H5V11H11V5H13V11H19V13Z',
    disabled: false,
    click: () => emit('zoom-in'),
  },
]);

function onBrushColorChange(event: Event): void {
  emit('update:brush-color', (event.target as HTMLInputElement).value);
}

function onBrushWidthChange(event: Event): void {
  emit('update:brush-width', Number((event.target as HTMLSelectElement).value));
}
</script>

<template>
  <div class="inline-image-draw-toolbar">
    <div class="inline-image-draw-toolbar__side inline-image-draw-toolbar__side--left">
      <div class="inline-image-draw-toolbar__group">
        <button
          v-for="tool in toolButtons"
          :key="tool.id"
          class="tool-button"
          :class="{active: toolMode === tool.id}"
          type="button"
          :title="tool.label"
          @click="emit('select-tool', tool.id)"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" :d="tool.path" />
          </svg>
        </button>
      </div>

      <div class="inline-image-draw-toolbar__group">
        <label class="color-input" :title="t('inlineImage.drawDialog.color')">
          <input :value="brushColor" type="color" @input="onBrushColorChange" />
        </label>
        <select class="width-select" :value="brushWidth" :title="t('inlineImage.drawDialog.strokeWidth')" @change="onBrushWidthChange">
          <option v-for="option in brushWidthOptions" :key="option" :value="option">
            {{ option }} px
          </option>
        </select>
      </div>
    </div>

    <div class="inline-image-draw-toolbar__side inline-image-draw-toolbar__side--right">
      <div class="inline-image-draw-toolbar__group">
        <div class="inline-image-draw-toolbar__cluster">
          <button
            v-for="action in historyButtons"
            :key="action.id"
            class="tool-button"
            type="button"
            :disabled="action.disabled"
            :title="action.label"
            @click="action.click"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path fill="currentColor" :d="action.path" />
            </svg>
          </button>
        </div>

        <div class="inline-image-draw-toolbar__cluster">
          <button
            v-for="action in zoomButtons"
            :key="action.id"
            class="tool-button"
            type="button"
            :disabled="action.disabled"
            :title="action.label"
            @click="action.click"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path fill="currentColor" :d="action.path" />
            </svg>
          </button>
          <div class="zoom-pill">{{ zoomLabel }}</div>
          <button
            class="tool-button"
            type="button"
            :title="t('inlineImage.drawDialog.resetZoom')"
            @click="emit('reset-zoom')"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path fill="currentColor" d="M4 4H10V6H6V10H4V4M14 4H20V10H18V6H14V4M18 14H20V20H14V18H18V14M4 14H6V18H10V20H4V14Z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.inline-image-draw-toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 16px;
  width: 100%;
  min-width: 0;
}

.inline-image-draw-toolbar__side {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  flex-wrap: nowrap;
}

.inline-image-draw-toolbar__side--left {
  justify-content: flex-start;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
}

.inline-image-draw-toolbar__side--right {
  justify-content: flex-end;
  justify-self: end;
  flex-shrink: 0;
}

.inline-image-draw-toolbar__side--left::-webkit-scrollbar {
  display: none;
}

.inline-image-draw-toolbar__group {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex-wrap: nowrap;
}

.inline-image-draw-toolbar__cluster {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: nowrap;
}

.tool-button,
.width-select,
.color-input,
.zoom-pill {
  height: 30px;
  border: 1px solid var(--border-color, rgba(0, 0, 0, 0.12));
  background: var(--bg-primary, #fff);
  color: var(--text-primary, #111);
  box-sizing: border-box;
  transition: background-color 0.15s ease, border-color 0.15s ease, opacity 0.15s ease;
}

.tool-button,
.color-input {
  width: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  cursor: pointer;
}

.tool-button svg {
  width: 16px;
  height: 16px;
}

.tool-button:hover,
.width-select:hover,
.color-input:hover {
  background: var(--bg-hover, rgba(0, 0, 0, 0.04));
}

.tool-button.active {
  border-color: var(--search-focus-border, #4a9eff);
  background: rgba(74, 158, 255, 0.12);
  color: var(--search-focus-border, #4a9eff);
}

.tool-button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.width-select {
  min-width: 78px;
  padding: 0 8px;
  font-size: 12px;
}

.color-input {
  overflow: hidden;
}

.color-input input {
  width: 100%;
  height: 100%;
  border: none;
  padding: 0;
  background: transparent;
  cursor: pointer;
}

.zoom-pill {
  min-width: 58px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
  color: var(--text-secondary, #666);
  font-size: 12px;
}

@container (max-width: 820px) {
  .inline-image-draw-toolbar {
    gap: 10px;
  }

  .inline-image-draw-toolbar__side,
  .inline-image-draw-toolbar__group,
  .inline-image-draw-toolbar__cluster {
    gap: 6px;
  }

  .tool-button,
  .width-select,
  .color-input,
  .zoom-pill {
    height: 28px;
  }

  .tool-button,
  .color-input {
    width: 28px;
  }

  .width-select {
    min-width: 68px;
    padding: 0 6px;
  }

  .zoom-pill {
    min-width: 52px;
    padding: 0 6px;
  }
}

@container (max-width: 660px) {
  .inline-image-draw-toolbar {
    gap: 8px;
  }

  .zoom-pill {
    display: none;
  }

  .width-select {
    min-width: 60px;
    max-width: 60px;
  }
}

</style>
