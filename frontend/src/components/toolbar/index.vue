<script setup lang="ts">
import {useEditorStore} from '@/stores/editor';

const editorStore = useEditorStore();
</script>

<template>
  <div class="toolbar-container">
    <div class="statistics">
      <span class="stat-item" title="行数">Ln: <span class="stat-value">{{
          editorStore.documentStats.lines
        }}</span></span>
      <span class="stat-item" title="字符数">Ch: <span class="stat-value">{{
          editorStore.documentStats.characters
        }}</span></span>
      <span class="stat-item" title="选中字符数" v-if="editorStore.documentStats.selectedCharacters > 0">
        Sel: <span class="stat-value">{{ editorStore.documentStats.selectedCharacters }}</span>
      </span>
    </div>
    <div class="actions">
      <span class="font-size" title="字体大小 (Ctrl+滚轮调整)">
        {{ editorStore.fontSize }}px
      </span>
      <span class="tab-settings">
        <label title="启用Tab键缩进" class="tab-toggle">
          <input type="checkbox" :checked="editorStore.enableTabIndent" @change="editorStore.toggleTabIndent"/>
          <span>Tab</span>
        </label>
        <span class="tab-size" title="Tab大小">
          <button class="tab-btn" @click="editorStore.decreaseTabSize" :disabled="editorStore.tabSize <= 2">-</button>
          <span>{{ editorStore.tabSize }}</span>
          <button class="tab-btn" @click="editorStore.increaseTabSize" :disabled="editorStore.tabSize >= 8">+</button>
        </span>
      </span>
      <span class="encoding">{{ editorStore.encoding }}</span>
      <button class="settings-btn" @click="editorStore.openSettings">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3"></circle>
          <path
              d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.toolbar-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: var(--bg-secondary);
  color: var(--text-secondary);
  padding: 0 12px;
  height: 28px;
  font-size: 12px;
  border-top: 1px solid var(--border-color);

  .statistics {
    display: flex;
    gap: 12px;

    .stat-item {
      color: var(--text-muted);

      .stat-value {
        color: #e0e0e0;
      }
    }
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 12px;

    .font-size {
      color: var(--text-muted);
      font-size: 11px;
      cursor: help;
    }

    .tab-settings {
      display: flex;
      align-items: center;
      gap: 6px;
      color: var(--text-muted);
      font-size: 11px;

      .tab-toggle {
        display: flex;
        align-items: center;
        gap: 3px;
        cursor: pointer;

        input {
          cursor: pointer;
        }
      }

      .tab-size {
        display: flex;
        align-items: center;
        gap: 2px;

        .tab-btn {
          background: none;
          border: none;
          color: var(--text-primary);
          cursor: pointer;
          padding: 0 3px;
          font-size: 12px;
          line-height: 1;

          &:disabled {
            color: var(--text-muted);
            opacity: 0.5;
            cursor: not-allowed;
          }
        }
      }
    }

    .encoding {
      color: var(--text-muted);
      font-size: 11px;
    }

    .settings-btn {
      background: none;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2px;

      &:hover {
        color: var(--text-primary);
      }
    }
  }
}
</style>
