<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/views/editor/extensions/codeblock/types';

const { t } = useI18n();

// 组件状态
const showLanguageMenu = ref(false);
const searchQuery = ref('');
const searchInputRef = ref<HTMLInputElement>();

// 语言别名映射
const LANGUAGE_ALIASES: Record<SupportedLanguage, string> = {
  text: 'txt',
  javascript: 'js',
  typescript: 'ts',
  python: 'py',
  html: 'htm',
  css: '',
  json: '',
  markdown: 'md',
  shell: 'sh',
  sql: '',
  yaml: 'yml',
  xml: '',
  php: '',
  java: '',
  cpp: 'c++',
  c: '',
  go: '',
  rust: 'rs',
  ruby: 'rb'
};

// 当前选中的语言
const currentLanguage = ref<SupportedLanguage>('javascript');

// 过滤后的语言列表
const filteredLanguages = computed(() => {
  if (!searchQuery.value) {
    return SUPPORTED_LANGUAGES;
  }
  
  const query = searchQuery.value.toLowerCase();
  return SUPPORTED_LANGUAGES.filter(langId => {
    const alias = LANGUAGE_ALIASES[langId];
    return langId.toLowerCase().includes(query) ||
           (alias && alias.toLowerCase().includes(query));
  });
});

// 切换语言选择器显示状态
const toggleLanguageMenu = () => {
  showLanguageMenu.value = !showLanguageMenu.value;
};

// 关闭语言选择器
const closeLanguageMenu = () => {
  showLanguageMenu.value = false;
  searchQuery.value = '';
};

// 选择语言
const selectLanguage = (languageId: SupportedLanguage) => {
  currentLanguage.value = languageId;
  closeLanguageMenu();
  // TODO: 这里后续需要调用实际的语言设置功能
  console.log('Selected language:', languageId);
};

// 点击外部关闭
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as HTMLElement;
  if (!target.closest('.block-language-selector')) {
    closeLanguageMenu();
  }
};

// 键盘事件处理
const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    closeLanguageMenu();
  }
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
  document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
  document.removeEventListener('keydown', handleKeydown);
});

// 获取当前语言的显示名称
const getCurrentLanguageName = computed(() => {
  return currentLanguage.value;
});
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
      <span class="language-name">{{ getCurrentLanguageName }}</span>
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
          :class="{ 'active': currentLanguage === language }"
          @click="selectLanguage(language)"
        >
          <span class="language-name">{{ language }}</span>
          <span class="language-alias" v-if="LANGUAGE_ALIASES[language]">{{ LANGUAGE_ALIASES[language] }}</span>
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
        max-width: 60px;
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
            background-color: rgba(181, 206, 168, 0.1);
            color: #b5cea8;
            
            .language-alias {
              color: rgba(181, 206, 168, 0.7);
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