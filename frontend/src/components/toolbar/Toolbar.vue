<script setup lang="ts">
import {useEditorStore} from '@/stores/editorStore';
import {useConfigStore} from '@/stores/configStore';
import {useLogStore} from '@/stores/logStore';
import { useI18n } from 'vue-i18n';
import { ref } from 'vue';
import {SUPPORTED_LOCALES, setLocale, SupportedLocaleType} from '@/i18n';

const editorStore = useEditorStore();
const configStore = useConfigStore();
const logStore = useLogStore();
const { t, locale } = useI18n();

// 语言下拉菜单
const showLanguageMenu = ref(false);

// 切换语言
const changeLanguage = (localeCode: SupportedLocaleType) => {
  setLocale(localeCode);
  showLanguageMenu.value = false;
};

// 切换语言菜单显示
const toggleLanguageMenu = () => {
  showLanguageMenu.value = !showLanguageMenu.value;
};



</script>

<template>
  <div class="toolbar-container">
    <div class="statistics">
      <span class="stat-item" :title="t('toolbar.editor.lines')">{{ t('toolbar.editor.lines') }}: <span class="stat-value">{{
          editorStore.documentStats.lines
        }}</span></span>
      <span class="stat-item" :title="t('toolbar.editor.characters')">{{ t('toolbar.editor.characters') }}: <span class="stat-value">{{
          editorStore.documentStats.characters
        }}</span></span>
      <span class="stat-item" :title="t('toolbar.editor.selected')" v-if="editorStore.documentStats.selectedCharacters > 0">
        {{ t('toolbar.editor.selected') }}: <span class="stat-value">{{ editorStore.documentStats.selectedCharacters }}</span>
      </span>
      <span v-if="logStore.showLog && logStore.latestLog" class="log-item" :class="'log-' + logStore.latestLog.level"
            @click="logStore.hideCurrentLog()">
        {{ logStore.latestLog.message }}
      </span>
    </div>
    <div class="actions">
      <span class="font-size" :title="t('toolbar.fontSizeTooltip')" @click="configStore.resetFontSize">
        {{ configStore.config.fontSize }}px
      </span>
      <span class="tab-settings">
        <label :title="t('toolbar.tabLabel')" class="tab-toggle">
          <input type="checkbox" :checked="configStore.config.enableTabIndent" @change="configStore.toggleTabIndent"/>
          <span>{{ t('toolbar.tabLabel') }}</span>
        </label>
        <span class="tab-type" :title="t('toolbar.tabType.' + (configStore.config.tabType === 'spaces' ? 'spaces' : 'tab'))" @click="configStore.toggleTabType">
          {{ t('toolbar.tabType.' + (configStore.config.tabType === 'spaces' ? 'spaces' : 'tab')) }}
        </span>
        <span class="tab-size" title="Tab大小" v-if="configStore.config.tabType === 'spaces'">
          <button class="tab-btn" @click="configStore.decreaseTabSize" :disabled="configStore.config.tabSize <= configStore.MIN_TAB_SIZE">-</button>
          <span>{{ configStore.config.tabSize }}</span>
          <button class="tab-btn" @click="configStore.increaseTabSize" :disabled="configStore.config.tabSize >= configStore.MAX_TAB_SIZE">+</button>
        </span>
      </span>
      
      <!-- 语言切换按钮 -->
      <div class="selector-dropdown">
        <button class="selector-btn" @click="toggleLanguageMenu">
          {{ locale }}
          <span class="arrow">▲</span>
        </button>
        <div class="selector-menu" v-if="showLanguageMenu">
          <div 
            v-for="lang in SUPPORTED_LOCALES" 
            :key="lang.code" 
            class="selector-option"
            :class="{ active: locale === lang.code }"
            @click="changeLanguage(lang.code)"
          >
            {{ t(`languages.${lang.code}`) }}
          </div>
        </div>
      </div>
      
      <button class="settings-btn" :title="t('toolbar.settings')">
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
  user-select: none;

  .statistics {
    display: flex;
    gap: 12px;

    .stat-item {
      color: var(--text-muted);

      .stat-value {
        color: #e0e0e0;
      }
    }
    
    .log-item {
      cursor: default;
      font-size: 12px;
      transition: opacity 0.3s ease;
      
      &.log-info {
        color: rgba(177, 176, 176, 0.8);
      }
      
      &.log-warning {
        color: rgba(240, 230, 140, 0.8);
      }
      
      &.log-error {
        color: rgba(255, 107, 107, 0.8);
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
      
      .tab-type {
        cursor: pointer;
        padding: 0 3px;
        border-radius: 3px;
        background-color: rgba(255, 255, 255, 0.05);
        
        &:hover {
          background-color: rgba(255, 255, 255, 0.1);
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
    
    /* 通用下拉选择器样式 */
    .selector-dropdown {
      position: relative;
      
      .selector-btn {
        background: none;
        border: none;
        color: var(--text-muted);
        cursor: pointer;
        font-size: 11px;
        display: flex;
        align-items: center;
        gap: 2px;
        padding: 2px 4px;
        border-radius: 3px;
        
        &:hover {
          background-color: rgba(255, 255, 255, 0.05);
        }
        
        .arrow {
          font-size: 8px;
          margin-left: 2px;
        }
      }
      
      .selector-menu {
        position: absolute;
        bottom: 100%;
        right: 0;
        background-color: var(--bg-secondary);
        border: 1px solid var(--border-color);
        border-radius: 3px;
        margin-bottom: 4px;
        min-width: 120px;
        max-height: 200px;
        overflow-y: auto;
        z-index: 1000;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        
        .selector-option {
          padding: 4px 8px;
          cursor: pointer;
          font-size: 11px;
          white-space: nowrap;
          
          &:hover {
            background-color: var(--bg-hover);
          }
          
          &.active {
            color: #b5cea8;
          }
        }
      }
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
