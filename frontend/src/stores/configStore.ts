import { defineStore } from 'pinia';
import { ref } from 'vue';
import { EditorConfig, TabType } from '@/types/config';

// 字体大小范围
const MIN_FONT_SIZE = 12;
const MAX_FONT_SIZE = 28;
const DEFAULT_FONT_SIZE = 13;

// Tab设置
const DEFAULT_TAB_SIZE = 4;
const MIN_TAB_SIZE = 2;
const MAX_TAB_SIZE = 8;

export const useConfigStore = defineStore('config', () => {
  // 配置状态
  const config = ref<EditorConfig>({
    fontSize: DEFAULT_FONT_SIZE,
    encoding: 'UTF-8',
    enableTabIndent: true,
    tabSize: DEFAULT_TAB_SIZE,
    tabType: 'spaces'
  });

  // 字体缩放
  function increaseFontSize() {
    if (config.value.fontSize < MAX_FONT_SIZE) {
      config.value.fontSize += 1;
    }
  }

  // 字体缩小
  function decreaseFontSize() {
    if (config.value.fontSize > MIN_FONT_SIZE) {
      config.value.fontSize -= 1;
    }
  }

  // 重置字体大小
  function resetFontSize() {
    config.value.fontSize = DEFAULT_FONT_SIZE;
  }

  // 设置编码
  function setEncoding(newEncoding: string) {
    config.value.encoding = newEncoding;
  }

  // Tab相关方法
  function toggleTabIndent() {
    config.value.enableTabIndent = !config.value.enableTabIndent;
  }

  // 增加Tab大小
  function increaseTabSize() {
    if (config.value.tabSize < MAX_TAB_SIZE) {
      config.value.tabSize += 1;
    }
  }

  // 减少Tab大小
  function decreaseTabSize() {
    if (config.value.tabSize > MIN_TAB_SIZE) {
      config.value.tabSize -= 1;
    }
  }
  
  // 切换Tab类型（空格或制表符）
  function toggleTabType() {
    config.value.tabType = config.value.tabType === 'spaces' ? 'tab' : 'spaces';
  }

  // 设置按钮操作
  function openSettings() {
    console.log('打开设置面板');
    // 此处可以实现设置面板的逻辑
  }

  return {
    // 状态
    config,
    
    // 常量
    MIN_FONT_SIZE,
    MAX_FONT_SIZE,
    DEFAULT_FONT_SIZE,
    MIN_TAB_SIZE,
    MAX_TAB_SIZE,
    
    // 方法
    setEncoding,
    openSettings,
    increaseFontSize,
    decreaseFontSize,
    resetFontSize,
    toggleTabIndent,
    increaseTabSize,
    decreaseTabSize,
    toggleTabType
  };
}, {
  persist: {
    key: 'editor-config',
    storage: localStorage
  }
}); 