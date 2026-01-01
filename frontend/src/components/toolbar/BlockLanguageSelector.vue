<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick, shallowRef, readonly, effectScope, onScopeDispose } from 'vue';
import { useI18n } from 'vue-i18n';
import { useEditorStore } from '@/stores/editorStore';
import { type SupportedLanguage } from '@/views/editor/extensions/codeblock/types';
import { LANGUAGES, getAllSupportedLanguages } from '@/views/editor/extensions/codeblock/lang-parser/languages';
import { getActiveNoteBlock } from '@/views/editor/extensions/codeblock/state';
import { changeCurrentBlockLanguage } from '@/views/editor/extensions/codeblock/commands';

const { t } = useI18n();
const editorStore = useEditorStore(); 

// 组件状态
const showLanguageMenu = shallowRef(false);
const searchQuery = ref('');
const searchInputRef = ref<HTMLInputElement>();

// 优化语言数据处理
const languageData = computed(() => {
  const supportedLanguages = getAllSupportedLanguages();
  const names: Record<string, string> = {
    auto: 'Auto',
    text: 'Plain Text'
  };
  const aliases: Record<string, string> = {
    auto: 'auto',
    text: 'txt'
  };
  
  // 一次遍历完成所有映射
  LANGUAGES.forEach(lang => {
    names[lang.token] = lang.name;
    aliases[lang.token] = lang.name.toLowerCase();
  });
  
  return {
    supportedLanguages,
    names,
    aliases
  };
});

// 当前活动块的语言信息
const currentBlockLanguage = shallowRef<{ name: SupportedLanguage; auto: boolean }>({
  name: 'text',
  auto: false
});

// 事件监听器管理
let editorScope: ReturnType<typeof effectScope> | null = null;

// 更新当前块语言信息
const updateCurrentBlockLanguage = () => {
  if (!editorStore.currentEditor) {
    currentBlockLanguage.value = { name: 'text', auto: false };
    return;
  }

  try {
    const state = editorStore.currentEditor.state;
    const activeBlock = getActiveNoteBlock(state as any);
    if (activeBlock) {
      const newLanguage = {
        name: activeBlock.language.name as SupportedLanguage,
        auto: activeBlock.language.auto
      };
      
      // 只有当语言信息实际发生变化时才更新
      if (currentBlockLanguage.value.name !== newLanguage.name || 
          currentBlockLanguage.value.auto !== newLanguage.auto) {
        currentBlockLanguage.value = newLanguage;
      }
    } else {
      if (currentBlockLanguage.value.name !== 'text' || currentBlockLanguage.value.auto) {
        currentBlockLanguage.value = { name: 'text', auto: false };
      }
    }
  } catch (error) {
    console.warn('Failed to get active block language:', error);
    currentBlockLanguage.value = { name: 'text', auto: false };
  }
};

// 清理事件监听器
const cleanupEventListeners = () => {
  if (editorScope) {
    editorScope.stop();
    editorScope = null;
  }
};

// 设置事件监听器 - 使用 effectScope 管理
const setupEventListeners = (view: any) => {
  cleanupEventListeners();
  
  editorScope = effectScope();
  editorScope.run(() => {
    // 监听编辑器状态更新
    const updateListener = () => {
      // 使用 requestAnimationFrame 确保在下一帧更新
      requestAnimationFrame(() => {
        updateCurrentBlockLanguage();
      });
    };
    
    // 监听关键事件：光标位置变化、文档变化、焦点变化
    view.dom.addEventListener('click', updateListener);
    view.dom.addEventListener('keyup', updateListener);
    view.dom.addEventListener('keydown', updateListener);
    view.dom.addEventListener('focus', updateListener);
    view.dom.addEventListener('mouseup', updateListener);
    view.dom.addEventListener('selectionchange', updateListener);
    
    // 在 scope 销毁时清理
    onScopeDispose(() => {
      view.dom.removeEventListener('click', updateListener);
      view.dom.removeEventListener('keyup', updateListener);
      view.dom.removeEventListener('keydown', updateListener);
      view.dom.removeEventListener('focus', updateListener);
      view.dom.removeEventListener('mouseup', updateListener);
      view.dom.removeEventListener('selectionchange', updateListener);
    });
    
    // 立即更新一次当前状态
    updateCurrentBlockLanguage();
  });
};

// 监听编辑器状态变化
watch(
  () => editorStore.currentEditor,
  (newView) => {
    if (newView) {
      setupEventListeners(newView);
    } else {
      cleanupEventListeners();
    }
  },
  { immediate: true }
);

// 过滤后的语言列表 - 优化搜索性能
const filteredLanguages = computed(() => {
  const { supportedLanguages, names, aliases } = languageData.value;
  
  if (!searchQuery.value) {
    return supportedLanguages;
  }
  
  const query = searchQuery.value.toLowerCase();
  return supportedLanguages.filter(langId => {
    const name = names[langId];
    const alias = aliases[langId];
    return langId.toLowerCase().includes(query) ||
           (name && name.toLowerCase().includes(query)) ||
           (alias && alias.toLowerCase().includes(query));
  });
});

// 切换语言选择器显示状态
const toggleLanguageMenu = () => {
  showLanguageMenu.value = !showLanguageMenu.value;
  
  // 如果菜单打开，滚动到当前语言
  if (showLanguageMenu.value) {
    scrollToCurrentLanguage();
  }
};

// 关闭语言选择器
const closeLanguageMenu = () => {
  showLanguageMenu.value = false;
  searchQuery.value = '';
};

// 选择语言 - 优化性能
const selectLanguage = (languageId: SupportedLanguage) => {
  if (!editorStore.currentEditor) {
    closeLanguageMenu();
    return;
  }

  try {
    const view = editorStore.currentEditor;
    const state = view.state;
    const dispatch = view.dispatch;

    const [targetLanguage, autoDetect] = languageId === 'auto' 
      ? ['text', true] 
      : [languageId, false];

    // 使用修复后的函数来更改语言
    const success = changeCurrentBlockLanguage(state as any, dispatch, targetLanguage, autoDetect);
    
    if (success) {
      // 立即更新当前语言状态
      updateCurrentBlockLanguage();
    }

  } catch (error) {
    console.warn('Failed to change block language:', error);
  }

  closeLanguageMenu();
};

// 全局事件处理器 - 使用 effectScope 管理
const globalScope = effectScope();

// 点击外部关闭 - 只在菜单打开时处理
const handleClickOutside = (event: MouseEvent) => {
  if (!showLanguageMenu.value) return;
  
  const target = event.target as HTMLElement;
  if (!target.closest('.block-language-selector')) {
    closeLanguageMenu();
  }
};

// 键盘事件处理 - 只在菜单打开时处理
const handleKeydown = (event: KeyboardEvent) => {
  if (!showLanguageMenu.value) return;
  
  if (event.key === 'Escape') {
    closeLanguageMenu();
  }
};

// 在 setup 阶段就设置全局事件监听器
globalScope.run(() => {
  document.addEventListener('click', handleClickOutside);
  document.addEventListener('keydown', handleKeydown);
  
  onScopeDispose(() => {
    document.removeEventListener('click', handleClickOutside);
    document.removeEventListener('keydown', handleKeydown);
  });
});

onMounted(() => {
  // 立即更新一次当前语言状态
  updateCurrentBlockLanguage();
});

onUnmounted(() => {
  globalScope.stop();
  cleanupEventListeners();
});

// 优化计算属性
const languageDisplayInfo = computed(() => {
  const lang = currentBlockLanguage.value;
  const displayName = lang.auto ? `${lang.name} (auto)` : lang.name;
  const displayLanguage = lang.auto ? 'auto' : lang.name;
  
  return {
    name: displayName,
    language: displayLanguage
  };
});

// 滚动到当前选择的语言 - 优化性能
const scrollToCurrentLanguage = () => {
  nextTick(() => {
    const currentLang = languageDisplayInfo.value.language;
    const activeOption = document.querySelector(`.language-option[data-language="${currentLang}"]`) as HTMLElement;
    
    if (activeOption) {
      // 使用 scrollIntoView 进行平滑滚动
      activeOption.scrollIntoView({
        behavior: 'auto',
        block: 'nearest',
        inline: 'nearest'
      });
    }
  });
};
</script>

<template>
  <div class="block-language-selector">
    <button 
      class="language-btn" 
      :title="t('toolbar.blockLanguage')"
      @click="toggleLanguageMenu"
    >
      <span class="language-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="16 18 22 12 16 6"></polyline>
          <polyline points="8 6 2 12 8 18"></polyline>
        </svg>
      </span>
      <span class="language-name">{{ languageDisplayInfo.name }}</span>
      <span class="arrow" :class="{ 'open': showLanguageMenu }">▲</span>
    </button>
    
    <div class="language-menu" v-if="showLanguageMenu">
      <!-- 搜索框 -->
      <div class="search-container">
        <input 
          ref="searchInputRef"
          v-model="searchQuery"
          type="text" 
          class="search-input"
          :placeholder="t('toolbar.searchLanguage')"
          @keydown.stop
        />
        <svg class="search-icon" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <path d="m21 21-4.35-4.35"></path>
        </svg>
      </div>
      
      <!-- 语言列表 -->
      <div class="language-list">
        <div 
          v-for="language in filteredLanguages" 
          :key="language"
          class="language-option"
          :class="{ 'active': languageDisplayInfo.language === language }"
          :data-language="language"
          @click="selectLanguage(language)"
        >
          <span class="language-name">{{ languageData.names[language] || language }}</span>
          <span class="language-alias">{{ language }}</span>
        </div>
        
        <!-- 无结果提示 -->
        <div v-if="filteredLanguages.length === 0" class="no-results">
          {{ t('toolbar.noLanguageFound') }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.block-language-selector {
  position: relative;
  
      .language-btn {
      background: none;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      font-size: 11px;
      display: flex;
      align-items: center;
      gap: 3px;
      padding: 2px 4px;
      border-radius: 3px;
      
      &:hover {
        background-color: var(--border-color);
        opacity: 0.8;
      }
      
      .language-icon {
        display: flex;
        align-items: center;
      }
      
      .language-name {
        max-width: 100px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      
      .arrow {
        font-size: 8px;
        margin-left: 2px;
        transition: transform 0.2s ease;
        
        &.open {
          transform: rotate(180deg);
        }
      }
    }
  
  .language-menu {
    position: absolute;
    bottom: 100%;
    right: 0;
    background-color: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 3px;
    margin-bottom: 4px;
    width: 220px;
    max-height: 280px;
    z-index: 1000;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    overflow: hidden;
    
          .search-container {
        position: relative;
        padding: 8px;
        border-bottom: 1px solid var(--border-color);
        
        .search-input {
          width: 100%;
          box-sizing: border-box;
          background-color: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: 2px;
          padding: 5px 8px 5px 26px;
          font-size: 11px;
          color: var(--text-primary);
          outline: none;
          line-height: 1.2;
          
          &:focus {
            border-color: var(--text-muted);
          }
          
          &::placeholder {
            color: var(--text-muted);
          }
        }
        
        .search-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted);
          pointer-events: none;
        }
      }
    
          .language-list {
        max-height: 200px;
        overflow-y: auto;
        
        .language-option {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 8px;
          cursor: pointer;
          font-size: 11px;
          
          &:hover {
            background-color: var(--border-color);
            opacity: 0.8;
          }
          
          &.active {
            background-color: var(--selection-bg);
            color: var(--selection-text);
            
            .language-alias {
              color: var(--selection-text);
              opacity: 0.7;
            }
          }
          
          .language-name {
            font-weight: normal;
          }
          
          .language-alias {
            font-size: 10px;
            color: var(--text-muted);
            opacity: 0.6;
          }
        }
        
        .no-results {
          padding: 12px 8px;
          text-align: center;
          color: var(--text-muted);
          font-size: 11px;
        }
      }
  }
}

/* 自定义滚动条 */
.language-list::-webkit-scrollbar {
  width: 4px;
}

.language-list::-webkit-scrollbar-track {
  background: transparent;
}

.language-list::-webkit-scrollbar-thumb {
  background-color: var(--border-color);
  border-radius: 2px;
  
  &:hover {
    background-color: var(--text-muted);
  }
}
</style>