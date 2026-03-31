<template>
  <div class="settings-page">
    <SettingSection title="Development Test Page">
      <div class="dev-description">
        This page is only available in development environment for testing notification, badge, toast, and media services.
      </div>
    </SettingSection>

    <SettingSection title="Badge Service Test">
      <SettingItem title="Badge Text">
        <input
          v-model="badgeText"
          type="text"
          placeholder="Enter badge text (empty to remove)"
          class="select-input"
        />
      </SettingItem>
      <SettingItem title="Actions">
        <div class="button-group">
          <button @click="testBadge" class="test-button primary">
            Set Badge
          </button>
          <button @click="clearBadge" class="test-button">
            Clear Badge
          </button>
        </div>
      </SettingItem>
      <div v-if="badgeStatus" class="test-status" :class="badgeStatus.type">
        {{ badgeStatus.message }}
      </div>
    </SettingSection>

    <SettingSection title="Notification Service Test">
      <SettingItem title="Title">
        <input
          v-model="notificationTitle"
          type="text"
          placeholder="Notification title"
          class="select-input"
        />
      </SettingItem>
      <SettingItem title="Subtitle">
        <input
          v-model="notificationSubtitle"
          type="text"
          placeholder="Notification subtitle"
          class="select-input"
        />
      </SettingItem>
      <SettingItem title="Body">
        <textarea
          v-model="notificationBody"
          placeholder="Notification body text"
          class="select-input textarea-input"
          rows="3"
        ></textarea>
      </SettingItem>
      <SettingItem title="Actions">
        <div class="button-group">
          <button @click="testNotification" class="test-button primary">
            Send Test Notification
          </button>
          <button @click="testUpdateNotification" class="test-button">
            Test Update Notification
          </button>
        </div>
      </SettingItem>
      <div v-if="notificationStatus" class="test-status" :class="notificationStatus.type">
        {{ notificationStatus.message }}
      </div>
    </SettingSection>

    <SettingSection title="Toast Notification Test">
      <SettingItem title="Toast Message">
        <input
          v-model="toastMessage"
          type="text"
          placeholder="Enter toast message"
          class="select-input"
        />
      </SettingItem>
      <SettingItem title="Toast Title (Optional)">
        <input
          v-model="toastTitle"
          type="text"
          placeholder="Enter toast title"
          class="select-input"
        />
      </SettingItem>
      <SettingItem title="Position">
        <select v-model="toastPosition" class="select-input">
          <option value="top-right">Top Right</option>
          <option value="top-left">Top Left</option>
          <option value="top-center">Top Center</option>
          <option value="bottom-right">Bottom Right</option>
          <option value="bottom-left">Bottom Left</option>
          <option value="bottom-center">Bottom Center</option>
        </select>
      </SettingItem>
      <SettingItem title="Duration (ms)">
        <input
          v-model.number="toastDuration"
          type="number"
          min="0"
          step="500"
          placeholder="4000"
          class="select-input"
        />
      </SettingItem>
      <SettingItem title="Toast Types">
        <div class="button-group">
          <button @click="showToast('success')" class="test-button toast-success-btn">
            Success
          </button>
          <button @click="showToast('error')" class="test-button toast-error-btn">
            Error
          </button>
          <button @click="showToast('warning')" class="test-button toast-warning-btn">
            Warning
          </button>
          <button @click="showToast('info')" class="test-button toast-info-btn">
            Info
          </button>
        </div>
      </SettingItem>
      <SettingItem title="Quick Tests">
        <div class="button-group">
          <button @click="showMultipleToasts" class="test-button">
            Show Multiple Toasts
          </button>
          <button @click="clearAllToasts" class="test-button">
            Clear All Toasts
          </button>
        </div>
      </SettingItem>
    </SettingSection>

    <SettingSection title="Media Service Test">
      <div class="dev-description">
        This panel imports a real image through <code>MediaHTTPService.ImportImage</code> and renders the returned <code>/media/...</code> URL with a normal <code>&lt;img&gt;</code>. The backend now uses a stable <code>asset_id</code> index and date-based storage folders.
      </div>

      <SettingItem title="Select Image">
        <input
          ref="fileInputRef"
          type="file"
          accept="image/*"
          class="select-input file-input"
          @change="handleMediaFileChange"
        />
      </SettingItem>

      <SettingItem
        title="Selected File"
        :description="selectedFile ? `${selectedFile.name} (${formatFileSize(selectedFile.size)})` : 'No image selected yet'"
      >
        <div class="inline-note">
          {{ selectedFile ? (selectedFile.type || 'unknown mime') : 'Pick a local image file' }}
        </div>
      </SettingItem>

      <SettingItem title="Actions">
        <div class="button-group">
          <button
            @click="importSelectedImage"
            class="test-button primary"
            :disabled="!selectedFile || isMediaBusy"
          >
            Import Image
          </button>
          <button
            @click="() => reloadMediaItems()"
            class="test-button"
            :disabled="isMediaBusy"
          >
            Refresh List
          </button>
          <button
            @click="deleteSelectedImage"
            class="test-button danger"
            :disabled="!selectedImage || isMediaBusy"
          >
            Delete Selected
          </button>
        </div>
      </SettingItem>

      <div v-if="mediaStatus" class="test-status" :class="mediaStatus.type">
        {{ mediaStatus.message }}
      </div>

      <div class="media-debug-layout">
        <section class="media-panel">
          <div class="media-panel-header">
            <span>Imported Images</span>
            <span class="media-panel-count">{{ mediaItems.length }}</span>
          </div>

          <div v-if="!mediaItems.length" class="empty-state">
            No imported images yet.
          </div>

          <div v-else class="media-list">
            <button
              v-for="item in mediaItems"
              :key="item.id"
              class="media-list-item"
              :class="{ active: selectedImage?.id === item.id }"
              @click="selectImage(item)"
            >
              <div class="media-list-title">{{ item.filename }}</div>
              <div class="media-list-meta">{{ item.width }} x {{ item.height }}</div>
              <div class="media-list-meta">{{ formatFileSize(item.size) }}</div>
              <div class="media-list-meta">{{ item.relative_path }}</div>
            </button>
          </div>
        </section>

        <section class="media-panel preview-panel">
          <div class="media-panel-header">
            <span>Preview</span>
            <span class="media-panel-count">{{ selectedImage ? selectedImage.mime_type : 'none' }}</span>
          </div>

          <div v-if="selectedImage" class="media-preview-card">
            <img
              :src="selectedImage.url"
              :alt="selectedImage.filename"
              class="media-preview-image"
              @load="handlePreviewLoad"
              @error="handlePreviewError"
            />

            <div class="media-meta-grid">
              <div class="media-meta-row">
                <span class="media-meta-label">Asset ID</span>
                <code class="media-meta-value">{{ selectedImage.id }}</code>
              </div>
              <div class="media-meta-row">
                <span class="media-meta-label">URL</span>
                <code class="media-meta-value">{{ selectedImage.url }}</code>
              </div>
              <div class="media-meta-row">
                <span class="media-meta-label">Stored Name</span>
                <span class="media-meta-value">{{ selectedImage.filename }}</span>
              </div>
              <div class="media-meta-row">
                <span class="media-meta-label">Relative Path</span>
                <code class="media-meta-value">{{ selectedImage.relative_path }}</code>
              </div>
              <div class="media-meta-row">
                <span class="media-meta-label">Original Name</span>
                <span class="media-meta-value">{{ selectedImage.original_filename || '-' }}</span>
              </div>
              <div class="media-meta-row">
                <span class="media-meta-label">Size</span>
                <span class="media-meta-value">{{ formatFileSize(selectedImage.size) }}</span>
              </div>
              <div class="media-meta-row">
                <span class="media-meta-label">Dimensions</span>
                <span class="media-meta-value">{{ selectedImage.width }} x {{ selectedImage.height }}</span>
              </div>
              <div class="media-meta-row">
                <span class="media-meta-label">SHA256</span>
                <code class="media-meta-value">{{ selectedImage.sha256 }}</code>
              </div>
            </div>
          </div>

          <div v-else class="empty-state">
            Select one imported image to preview.
          </div>
        </section>
      </div>
    </SettingSection>

    <SettingSection title="Cleanup">
      <SettingItem title="Clear All">
        <button @click="clearAll" class="test-button danger">
          Clear All Test States
        </button>
      </SettingItem>
      <div v-if="clearStatus" class="test-status" :class="clearStatus.type">
        {{ clearStatus.message }}
      </div>
    </SettingSection>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import * as TestService from '@/../bindings/voidraft/internal/services/testservice';
import * as MediaHTTPService from '@/../bindings/voidraft/internal/services/mediahttpservice';
import type { ImageAsset } from '@/../bindings/voidraft/internal/services/models';
import SettingSection from '../components/SettingSection.vue';
import SettingItem from '../components/SettingItem.vue';
import toast from '@/components/toast';
import type { ToastPosition, ToastType } from '@/components/toast/types';

type StatusState = {
  type: 'success' | 'error';
  message: string;
};

const badgeText = ref('');
const badgeStatus = ref<StatusState | null>(null);

const notificationTitle = ref('');
const notificationSubtitle = ref('');
const notificationBody = ref('');
const notificationStatus = ref<StatusState | null>(null);

const toastMessage = ref('This is a test toast notification!');
const toastTitle = ref('');
const toastPosition = ref<ToastPosition>('top-right');
const toastDuration = ref(4000);

const mediaStatus = ref<StatusState | null>(null);
const mediaItems = ref<ImageAsset[]>([]);
const selectedImage = ref<ImageAsset | null>(null);
const selectedFile = ref<File | null>(null);
const isMediaBusy = ref(false);
const fileInputRef = ref<HTMLInputElement | null>(null);

const clearStatus = ref<StatusState | null>(null);

const showStatus = (
  statusRef: { value: StatusState | null },
  type: StatusState['type'],
  message: string
) => {
  statusRef.value = { type, message };
  setTimeout(() => {
    statusRef.value = null;
  }, 5000);
};

const testBadge = async () => {
  try {
    await TestService.TestBadge(badgeText.value);
    showStatus(badgeStatus, 'success', `Badge ${badgeText.value ? 'set to: ' + badgeText.value : 'cleared'} successfully`);
  } catch (error: any) {
    showStatus(badgeStatus, 'error', `Failed to set badge: ${error.message || error}`);
  }
};

const clearBadge = async () => {
  try {
    await TestService.TestBadge('');
    badgeText.value = '';
    showStatus(badgeStatus, 'success', 'Badge cleared successfully');
  } catch (error: any) {
    showStatus(badgeStatus, 'error', `Failed to clear badge: ${error.message || error}`);
  }
};

const testNotification = async () => {
  try {
    await TestService.TestNotification(
      notificationTitle.value,
      notificationSubtitle.value,
      notificationBody.value
    );
    showStatus(notificationStatus, 'success', 'Notification sent successfully');
  } catch (error: any) {
    showStatus(notificationStatus, 'error', `Failed to send notification: ${error.message || error}`);
  }
};

const testUpdateNotification = async () => {
  try {
    await TestService.TestUpdateNotification();
    showStatus(notificationStatus, 'success', 'Update notification sent successfully (badge + notification)');
  } catch (error: any) {
    showStatus(notificationStatus, 'error', `Failed to send update notification: ${error.message || error}`);
  }
};

const clearAll = async () => {
  try {
    await TestService.ClearAll();
    badgeText.value = '';
    notificationTitle.value = '';
    notificationSubtitle.value = '';
    notificationBody.value = '';
    mediaStatus.value = null;
    clearSelectedFile();
    showStatus(clearStatus, 'success', 'All test states cleared successfully');
  } catch (error: any) {
    showStatus(clearStatus, 'error', `Failed to clear test states: ${error.message || error}`);
  }
};

const showToast = (type: ToastType) => {
  const message = toastMessage.value || `This is a ${type} toast notification!`;
  const title = toastTitle.value || undefined;

  const options = {
    position: toastPosition.value,
    duration: toastDuration.value,
  };

  switch (type) {
    case 'success':
      toast.success(message, title, options);
      break;
    case 'error':
      toast.error(message, title, options);
      break;
    case 'warning':
      toast.warning(message, title, options);
      break;
    case 'info':
      toast.info(message, title, options);
      break;
  }
};

const showMultipleToasts = () => {
  const positions: ToastPosition[] = ['top-right', 'top-left', 'bottom-right', 'bottom-left'];
  const types: ToastType[] = ['success', 'error', 'warning', 'info'];

  positions.forEach((position, index) => {
    setTimeout(() => {
      const type = types[index % types.length];
      toast.show({
        type,
        message: `Toast from ${position}`,
        title: `${type.charAt(0).toUpperCase() + type.slice(1)} Toast`,
        position,
        duration: 5000,
      });
    }, index * 200);
  });
};

const clearAllToasts = () => {
  toast.clear();
};

const handleMediaFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement | null;
  selectedFile.value = target?.files?.[0] ?? null;
};

const importSelectedImage = async () => {
  if (!selectedFile.value) {
    showStatus(mediaStatus, 'error', 'Choose one image file first');
    return;
  }

  isMediaBusy.value = true;
  try {
    const dataURL = await readFileAsDataURL(selectedFile.value);
    const result = await MediaHTTPService.ImportImage({
      filename: selectedFile.value.name,
      mime_type: selectedFile.value.type || undefined,
      data_base64: dataURL,
    });
    if (!result) {
      throw new Error('ImportImage returned no asset');
    }

    await reloadMediaItems(result.id);
    clearSelectedFile();
    showStatus(mediaStatus, 'success', `Imported ${result.filename} as asset ${result.id.slice(0, 12)} and ready to render from ${result.url}`);
  } catch (error: any) {
    showStatus(mediaStatus, 'error', `Failed to import image: ${error.message || error}`);
  } finally {
    isMediaBusy.value = false;
  }
};

const reloadMediaItems = async (preferredAssetID?: string) => {
  isMediaBusy.value = true;
  try {
    const result = await MediaHTTPService.ListImages();
    const items = (result || []).filter((item): item is ImageAsset => item !== null);
    mediaItems.value = items;

    if (items.length === 0) {
      selectedImage.value = null;
      return;
    }

    if (preferredAssetID) {
      selectedImage.value = items.find(item => item.id === preferredAssetID) || items[0];
      return;
    }

    if (selectedImage.value) {
      selectedImage.value = items.find(item => item.id === selectedImage.value?.id) || items[0];
      return;
    }

    selectedImage.value = items[0];
  } catch (error: any) {
    showStatus(mediaStatus, 'error', `Failed to load images: ${error.message || error}`);
  } finally {
    isMediaBusy.value = false;
  }
};

const deleteSelectedImage = async () => {
  if (!selectedImage.value) {
    showStatus(mediaStatus, 'error', 'Select one imported image first');
    return;
  }

  isMediaBusy.value = true;
  try {
    const current = selectedImage.value;
    const result = await MediaHTTPService.DeleteImage(current.id);
    if (!result?.deleted) {
      throw new Error(`DeleteImage reported deleted=false for ${current.id}`);
    }

    await reloadMediaItems();
    showStatus(mediaStatus, 'success', `Deleted ${current.filename}`);
  } catch (error: any) {
    showStatus(mediaStatus, 'error', `Failed to delete image: ${error.message || error}`);
  } finally {
    isMediaBusy.value = false;
  }
};

const selectImage = (item: ImageAsset) => {
  selectedImage.value = item;
};

const handlePreviewLoad = () => {
  if (!selectedImage.value) {
    return;
  }
  showStatus(mediaStatus, 'success', `Rendered image successfully from ${selectedImage.value.url}`);
};

const handlePreviewError = () => {
  if (!selectedImage.value) {
    return;
  }
  showStatus(mediaStatus, 'error', `Image render failed for ${selectedImage.value.url}`);
};

const clearSelectedFile = () => {
  selectedFile.value = null;
  if (fileInputRef.value) {
    fileInputRef.value.value = '';
  }
};

const formatFileSize = (size: number) => {
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
};

const readFileAsDataURL = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });
};

onMounted(() => {
  void reloadMediaItems();
});
</script>

<style scoped lang="scss">
.dev-description {
  color: var(--settings-text-secondary);
  font-size: 12px;
  line-height: 1.4;
  padding: 8px 0;

  code {
    font-family: 'Monocraft', monospace;
    font-size: 11px;
    color: var(--settings-text);
  }
}

.select-input {
  padding: 6px 8px;
  border: 1px solid var(--settings-input-border);
  border-radius: 4px;
  background-color: var(--settings-input-bg);
  color: var(--settings-text);
  font-size: 12px;
  width: 180px;

  &:focus {
    outline: none;
    border-color: #4a9eff;
    box-shadow: 0 0 0 2px rgba(74, 158, 255, 0.2);
  }

  &.textarea-input {
    min-height: 60px;
    resize: vertical;
    font-family: inherit;
    line-height: 1.4;
  }

  &.file-input {
    width: 220px;
    padding: 4px;
  }
}

.button-group {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.inline-note {
  text-align: right;
  font-size: 11px;
  color: var(--settings-text-secondary);
  max-width: 220px;
  word-break: break-word;
}

.test-button {
  padding: 6px 12px;
  border: 1px solid var(--settings-border);
  border-radius: 4px;
  background-color: var(--settings-card-bg);
  color: var(--settings-text);
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s ease;

  &:hover {
    background-color: var(--settings-hover);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  &.primary {
    background-color: #4a9eff;
    color: white;
    border-color: #4a9eff;

    &:hover {
      background-color: #3a8eef;
      border-color: #3a8eef;
    }
  }

  &.danger {
    background-color: var(--text-danger);
    color: white;
    border-color: var(--text-danger);

    &:hover {
      opacity: 0.9;
    }
  }

  &.toast-success-btn {
    background-color: #16a34a;
    color: white;
    border-color: #16a34a;

    &:hover {
      background-color: #15803d;
      border-color: #15803d;
    }
  }

  &.toast-error-btn {
    background-color: #dc2626;
    color: white;
    border-color: #dc2626;

    &:hover {
      background-color: #b91c1c;
      border-color: #b91c1c;
    }
  }

  &.toast-warning-btn {
    background-color: #f59e0b;
    color: white;
    border-color: #f59e0b;

    &:hover {
      background-color: #d97706;
      border-color: #d97706;
    }
  }

  &.toast-info-btn {
    background-color: #3b82f6;
    color: white;
    border-color: #3b82f6;

    &:hover {
      background-color: #2563eb;
      border-color: #2563eb;
    }
  }
}

.test-status {
  margin-top: 12px;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  border: 1px solid;

  &.success {
    background-color: rgba(34, 197, 94, 0.1);
    color: #16a34a;
    border-color: rgba(34, 197, 94, 0.2);
  }

  &.error {
    background-color: rgba(239, 68, 68, 0.1);
    color: #dc2626;
    border-color: rgba(239, 68, 68, 0.2);
  }
}

.media-debug-layout {
  display: grid;
  grid-template-columns: minmax(260px, 320px) minmax(0, 1fr);
  gap: 16px;
  margin-top: 16px;
  align-items: start;
}

.media-panel {
  border: 1px solid var(--settings-border);
  border-radius: 8px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.02), rgba(0, 0, 0, 0.04));
  overflow: hidden;
}

.media-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid var(--settings-border);
  font-size: 12px;
  font-weight: 600;
  color: var(--settings-text);
}

.media-panel-count {
  font-size: 11px;
  color: var(--settings-text-secondary);
}

.media-list {
  display: flex;
  flex-direction: column;
  max-height: 420px;
  overflow: auto;
}

.media-list-item {
  border: none;
  border-bottom: 1px solid var(--settings-border);
  background: transparent;
  color: inherit;
  text-align: left;
  padding: 12px;
  cursor: pointer;
  transition: background-color 0.15s ease;

  &:hover {
    background-color: var(--settings-hover);
  }

  &.active {
    background-color: rgba(74, 158, 255, 0.12);
  }

  &:last-child {
    border-bottom: none;
  }
}

.media-list-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--settings-text);
  margin-bottom: 4px;
  word-break: break-all;
}

.media-list-meta {
  font-size: 11px;
  color: var(--settings-text-secondary);
  line-height: 1.4;
  word-break: break-all;
}

.preview-panel {
  min-height: 420px;
}

.media-preview-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 14px;
}

.media-preview-image {
  display: block;
  width: 100%;
  max-height: 360px;
  object-fit: contain;
  border-radius: 8px;
  background:
    linear-gradient(45deg, rgba(255, 255, 255, 0.05) 25%, transparent 25%),
    linear-gradient(-45deg, rgba(255, 255, 255, 0.05) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, rgba(255, 255, 255, 0.05) 75%),
    linear-gradient(-45deg, transparent 75%, rgba(255, 255, 255, 0.05) 75%);
  background-size: 18px 18px;
  background-position: 0 0, 0 9px, 9px -9px, -9px 0;
  border: 1px solid var(--settings-border);
}

.media-meta-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.media-meta-row {
  display: grid;
  grid-template-columns: 110px minmax(0, 1fr);
  gap: 10px;
  align-items: start;
}

.media-meta-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--settings-text-secondary);
}

.media-meta-value {
  font-size: 11px;
  color: var(--settings-text);
  word-break: break-all;
}

.empty-state {
  padding: 18px 14px;
  font-size: 12px;
  color: var(--settings-text-secondary);
}

@media (max-width: 980px) {
  .media-debug-layout {
    grid-template-columns: 1fr;
  }

  .preview-panel {
    min-height: 0;
  }
}
</style>
