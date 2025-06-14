<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { ref, onMounted, watch } from 'vue';
import { useConfigStore } from '@/stores/configStore';
import { useEditorStore } from '@/stores/editorStore';
import { useErrorHandler } from '@/utils/errorHandler';
import * as runtime from '@wailsio/runtime';
import { useRouter } from 'vue-router';

const editorStore = useEditorStore();
const configStore = useConfigStore();
const { safeCall } = useErrorHandler();
const { t, locale } = useI18n();
const router = useRouter();

// 语言下拉菜单
const showLanguageMenu = ref(false);

const supportedLanguages = [
  { code: 'zh-CN', name: '简体中文' },
  { code: 'en-US', name: 'English' }
];

const toggleLanguageMenu = () => {
  showLanguageMenu.value = !showLanguageMenu.value;
};

const closeLanguageMenu = () => {
  showLanguageMenu.value = false;
};

const changeLanguage = async (langCode: string) => {
  await safeCall(() => configStore.setLanguage(langCode as any), 'language.changeFailed');
  closeLanguageMenu();
};

// 设置窗口置顶
const setWindowAlwaysOnTop = async (isTop: boolean) => {
  await safeCall(async () => {
    await runtime.Window.SetAlwaysOnTop(isTop);
  }, 'window.setTopFailed');
};

// 切换窗口置顶
const toggleAlwaysOnTop = async () => {
  await safeCall(async () => {
    await configStore.toggleAlwaysOnTop();
    // 使用Window.SetAlwaysOnTop方法设置窗口置顶状态
    await runtime.Window.SetAlwaysOnTop(configStore.config.general.alwaysOnTop);
  }, 'config.alwaysOnTopFailed');
};

// 跳转到设置页面
const goToSettings = () => {
  router.push('/settings');
};

const isLoaded = ref(false);

onMounted(() => {
  isLoaded.value = true;
});

// 监听置顶设置变化
watch(
  () => configStore.config.general.alwaysOnTop,
  async (newValue) => {
    if (!isLoaded.value) return;
    await runtime.Window.SetAlwaysOnTop(newValue);
  }
);

// 在组件加载完成后应用置顶设置
watch(isLoaded, async (newLoaded) => {
  if (newLoaded && configStore.config.general.alwaysOnTop) {
    await setWindowAlwaysOnTop(true);
  }
});
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
    </div>
    <div class="actions">
      <span class="font-size" :title="t('toolbar.fontSizeTooltip')" @click="() => configStore.resetFontSize()">
        {{ configStore.config.editing.fontSize }}px
      </span>
      <span class="tab-settings">
        <label :title="t('toolbar.tabLabel')" class="tab-toggle">
          <input type="checkbox" :checked="configStore.config.editing.enableTabIndent" @change="() => configStore.toggleTabIndent()"/>
          <span>{{ t('toolbar.tabLabel') }}</span>
        </label>
        <span class="tab-type" :title="t('toolbar.tabType.' + (configStore.config.editing.tabType === 'spaces' ? 'spaces' : 'tab'))" @click="() => configStore.toggleTabType()">
          {{ t('toolbar.tabType.' + (configStore.config.editing.tabType === 'spaces' ? 'spaces' : 'tab')) }}
        </span>
        <span class="tab-size" title="Tab大小" v-if="configStore.config.editing.tabType === 'spaces'">
          <button class="tab-btn" @click="() => configStore.decreaseTabSize()" :disabled="configStore.config.editing.tabSize <= configStore.tabSize.min">-</button>
          <span>{{ configStore.config.editing.tabSize }}</span>
          <button class="tab-btn" @click="() => configStore.increaseTabSize()" :disabled="configStore.config.editing.tabSize >= configStore.tabSize.max">+</button>
        </span>
      </span>

      <!-- 窗口置顶图标按钮 -->
      <div 
        class="pin-button" 
        :class="{ 'active': configStore.config.general.alwaysOnTop }"
        :title="t('toolbar.alwaysOnTop')"
        @click="toggleAlwaysOnTop"
      >
        <svg class="pin-icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg">
          <path d="M557.44 104.96l361.6 361.6-60.16 64-26.88-33.92-181.12 181.12L617.6 832l-60.16 60.16-181.12-184.32-211.2 211.2-60.16-60.16 211.2-211.2-181.12-181.12 60.16-60.16 151.04-30.08 181.12-181.12-30.72-30.08 64-60.16zM587.52 256L387.84 455.04l-120.32 23.68 277.76 277.76 23.68-120.32L768 436.48z" />
        </svg>
      </div>
      
      <!-- 语言切换按钮 -->
      <div class="selector-dropdown">
        <button class="selector-btn" @click="toggleLanguageMenu">
          {{ locale }}
          <span class="arrow">▲</span>
        </button>
        <div class="selector-menu" v-if="showLanguageMenu">
          <div 
            v-for="lang in supportedLanguages" 
            :key="lang.code" 
            class="selector-option"
            :class="{ active: locale === lang.code }"
            @click="changeLanguage(lang.code)"
          >
            {{ t(`languages.${lang.code}`) }}
          </div>
        </div>
      </div>
      
      <button class="settings-btn" :title="t('toolbar.settings')" @click="goToSettings">
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
        color: var(--text-secondary);
        font-weight: 500;
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
        background-color: var(--border-color);
        opacity: 0.6;
        
        &:hover {
          opacity: 1;
          background-color: var(--border-color);
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
    
    /* 窗口置顶图标按钮样式 */
    .pin-button {
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      padding: 2px;
      border-radius: 3px;
      transition: all 0.2s ease;
      
      &:hover {
        background-color: var(--border-color);
        opacity: 0.8;
      }
      
      &.active {
        background-color: rgba(181, 206, 168, 0.2);
        
        .pin-icon {
          fill: #b5cea8;
        }
      }
      
      .pin-icon {
        width: 14px;
        height: 14px;
        fill: var(--text-muted);
        transition: fill 0.2s ease;
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
          background-color: var(--border-color);
          opacity: 0.8;
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
            background-color: var(--border-color);
            opacity: 0.8;
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
        color: var(--text-secondary);
      }
    }
  }
}
</style>
