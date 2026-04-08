<script setup lang="ts">
import {computed} from 'vue';
import {useI18n} from 'vue-i18n';
import {useThemeStore} from '@/stores/themeStore';
import DrawImageFooter from './draw/DrawImageFooter.vue';
import DrawImageToolbar from './draw/DrawImageToolbar.vue';
import {useInlineImageDraw} from './draw/useInlineImageDraw';

const props = defineProps<{
  portalTarget?: HTMLElement | null;
}>();

const {t} = useI18n();
const themeStore = useThemeStore();
const {
  dialogRef,
  headerRef,
  contentRef,
  footerRef,
  stageRef,
  canvasRef,
  dialogStyle,
  isVisible,
  isLoading,
  isSaving,
  errorMessage,
  toolMode,
  brushColor,
  brushWidth,
  brushWidthOptions,
  zoomLabel,
  imageWidth,
  imageHeight,
  canUndo,
  canRedo,
  stagePaddingX,
  stagePaddingY,
  stageOverflow,
  stageCursor,
  setTool,
  undo,
  redo,
  zoomOut,
  zoomIn,
  resetZoom,
  handleWheel,
  onStageMouseDown,
  onStageScroll,
  saveImage,
  closeDialog,
  isStagePanning,
} = useInlineImageDraw();

const teleportTarget = computed<HTMLElement | string>(() => props.portalTarget ?? 'body');
const themedDialogStyle = computed(() => ({
  ...dialogStyle.value,
  '--inline-image-draw-stage-base': themeStore.isDarkMode ? '#181b20' : '#ffffff',
  '--inline-image-draw-stage-grid': themeStore.isDarkMode ? 'rgba(255, 255, 255, 0.06)' : 'rgba(224, 228, 233, 0.95)',
}));

function handleBrushColorUpdate(value: string): void {
  brushColor.value = value;
}

function handleBrushWidthUpdate(value: number): void {
  brushWidth.value = value;
}
</script>

<template>
  <Teleport :to="teleportTarget">
    <Transition name="inline-image-draw-dialog" appear>
      <template v-if="isVisible">
        <div class="inline-image-draw-overlay" @contextmenu.prevent>
          <div
            ref="dialogRef"
            class="inline-image-draw-dialog"
            :style="themedDialogStyle"
            tabindex="-1"
          >
            <div ref="headerRef" class="inline-image-draw-header">
              <DrawImageToolbar
                :tool-mode="toolMode"
                :brush-color="brushColor"
                :brush-width="brushWidth"
                :brush-width-options="brushWidthOptions"
                :can-undo="canUndo"
                :can-redo="canRedo"
                :zoom-label="zoomLabel"
                @select-tool="setTool"
                @update:brush-color="handleBrushColorUpdate"
                @update:brush-width="handleBrushWidthUpdate"
                @undo="undo"
                @redo="redo"
                @zoom-out="zoomOut"
                @zoom-in="zoomIn"
                @reset-zoom="resetZoom"
              />
            </div>

            <div ref="contentRef" class="inline-image-draw-content">
              <div
                ref="stageRef"
                class="inline-image-draw-stage"
                :class="{scrollable: stageOverflow === 'auto', panning: isStagePanning}"
                :style="{padding: `${stagePaddingY}px ${stagePaddingX}px`, cursor: stageCursor}"
                @wheel="handleWheel"
                @mousedown="onStageMouseDown"
                @scroll="onStageScroll"
              >
                <canvas ref="canvasRef"></canvas>
                <div v-if="isLoading" class="inline-image-draw-loading">{{ t('inlineImage.drawDialog.loading') }}</div>
              </div>
              <div v-if="errorMessage" class="inline-image-draw-error">{{ errorMessage }}</div>
            </div>

            <div ref="footerRef" class="inline-image-draw-footer">
              <DrawImageFooter
                :zoom-label="zoomLabel"
                :image-width="imageWidth"
                :image-height="imageHeight"
                :is-saving="isSaving"
                :is-loading="isLoading"
                @cancel="closeDialog"
                @save="saveImage"
              />
            </div>
          </div>
        </div>
      </template>
    </Transition>
  </Teleport>
</template>

<style scoped>
.inline-image-draw-dialog-enter-active,
.inline-image-draw-dialog-leave-active {
  transition: opacity 180ms ease;
}

.inline-image-draw-dialog-enter-active .inline-image-draw-dialog,
.inline-image-draw-dialog-leave-active .inline-image-draw-dialog {
  transition:
    transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1),
    opacity 220ms ease,
    box-shadow 220ms ease;
}

.inline-image-draw-dialog-enter-from,
.inline-image-draw-dialog-leave-to {
  opacity: 0;
}

.inline-image-draw-dialog-enter-from .inline-image-draw-dialog,
.inline-image-draw-dialog-leave-to .inline-image-draw-dialog {
  opacity: 0;
  transform: translateY(10px) scale(0.97);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.14);
}

.inline-image-draw-overlay {
  position: absolute;
  inset: 0;
  padding: 20px 28px 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.22);
  z-index: 100;
  box-sizing: border-box;
}

.inline-image-draw-dialog {
  display: flex;
  flex-direction: column;
  max-width: calc(100vw - 56px);
  max-height: calc(100vh - 56px);
  --inline-image-draw-stage-base: #ffffff;
  --inline-image-draw-stage-grid: rgba(224, 228, 233, 0.95);
  background: var(--settings-card-bg, #fff);
  color: var(--text-primary, #111);
  border: 1px solid var(--border-color, rgba(0, 0, 0, 0.1));
  box-shadow: 0 20px 48px rgba(0, 0, 0, 0.22);
  overflow: hidden;
  container-type: inline-size;
  font-family: var(--inline-image-draw-font-family, var(--voidraft-font-mono, system-ui, -apple-system, sans-serif));
  font-weight: var(--inline-image-draw-font-weight, 400);
  line-height: var(--inline-image-draw-line-height, 1.5);
}

.inline-image-draw-dialog button,
.inline-image-draw-dialog select,
.inline-image-draw-dialog input {
  font: inherit;
}

.inline-image-draw-header,
.inline-image-draw-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  background: var(--settings-card-bg, #fff);
  border-bottom: 1px solid var(--border-color, rgba(0, 0, 0, 0.08));
  flex-shrink: 0;
}

.inline-image-draw-footer {
  border-top: 1px solid var(--border-color, rgba(0, 0, 0, 0.08));
  border-bottom: none;
}

.inline-image-draw-content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--inline-image-draw-stage-base);
}

.inline-image-draw-stage {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--inline-image-draw-stage-base);
  background-image:
    linear-gradient(45deg, var(--inline-image-draw-stage-grid) 25%, transparent 25%),
    linear-gradient(-45deg, var(--inline-image-draw-stage-grid) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, var(--inline-image-draw-stage-grid) 75%),
    linear-gradient(-45deg, transparent 75%, var(--inline-image-draw-stage-grid) 75%);
  background-size: 16px 16px;
  background-position: 0 0, 0 8px, 8px -8px, -8px 0;
  box-sizing: border-box;
}

.inline-image-draw-stage.scrollable {
  overflow: auto;
  align-items: flex-start;
  justify-content: flex-start;
}

.inline-image-draw-stage canvas {
  display: block;
}

@container (max-width: 760px) {
  .inline-image-draw-header,
  .inline-image-draw-footer {
    padding: 8px 10px;
  }
}

@container (max-width: 640px) {
  .inline-image-draw-footer {
    align-items: stretch;
  }
}

.inline-image-draw-loading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.08);
  color: var(--text-primary, #111);
  font-size: 13px;
}

.inline-image-draw-error {
  padding: 10px 14px;
  border-top: 1px solid rgba(220, 38, 38, 0.18);
  color: #dc2626;
  background: rgba(220, 38, 38, 0.08);
  font-size: 12px;
}

@media (max-width: 980px) {
  .inline-image-draw-overlay {
    padding: 16px;
  }

  .inline-image-draw-dialog {
    max-width: calc(100vw - 32px);
    max-height: calc(100vh - 32px);
  }
}
</style>
