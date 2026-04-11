<script setup lang="ts">
import {useI18n} from 'vue-i18n';

defineProps<{
  zoomLabel: string;
  imageWidth: number;
  imageHeight: number;
  isSaving: boolean;
  isLoading: boolean;
}>();

const emit = defineEmits<{
  cancel: [];
  save: [];
}>();

const {t} = useI18n();
</script>

<template>
  <div class="inline-image-draw-footer-inner">
    <div class="inline-image-draw-footer-inner__meta">
      <span>{{ t('inlineImage.drawDialog.zoom') }} {{ zoomLabel }}</span>
      <span>{{ imageWidth }} × {{ imageHeight }}</span>
    </div>

    <div class="inline-image-draw-footer-inner__actions">
      <button class="secondary-button" type="button" :disabled="isSaving" @click="emit('cancel')">
        {{ t('inlineImage.drawDialog.cancel') }}
      </button>
      <button class="primary-button" type="button" :disabled="isLoading || isSaving" @click="emit('save')">
        {{ isSaving ? t('inlineImage.drawDialog.saving') : t('inlineImage.drawDialog.save') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.inline-image-draw-footer-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
}

.inline-image-draw-footer-inner__meta,
.inline-image-draw-footer-inner__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.inline-image-draw-footer-inner__meta {
  color: var(--text-secondary, #666);
  font-size: 12px;
}

.secondary-button,
.primary-button {
  height: 30px;
  padding: 0 14px;
  border: 1px solid var(--border-color, rgba(0, 0, 0, 0.12));
  background: var(--bg-primary, #fff);
  color: var(--text-primary, #111);
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease, opacity 0.15s ease;
}

.secondary-button:hover,
.primary-button:hover {
  background: var(--bg-hover, rgba(0, 0, 0, 0.04));
}

.primary-button {
  background: var(--search-focus-border, #4a9eff);
  border-color: var(--search-focus-border, #4a9eff);
  color: #fff;
}

.primary-button:hover {
  background: #3d90ef;
  border-color: #3d90ef;
}

.secondary-button:disabled,
.primary-button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

@container (max-width: 640px) {
  .inline-image-draw-footer-inner {
    flex-wrap: wrap;
  }

  .inline-image-draw-footer-inner__meta,
  .inline-image-draw-footer-inner__actions {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
