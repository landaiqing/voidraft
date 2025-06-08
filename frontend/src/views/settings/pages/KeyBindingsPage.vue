<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { ref } from 'vue';
import SettingSection from '../components/SettingSection.vue';

const { t } = useI18n();

interface KeyBinding {
  id: string;
  name: string;
  keys: string[];
  isEditing: boolean;
}

// 示例快捷键列表（仅用于界面展示）
const keyBindings = ref<KeyBinding[]>([
  { id: 'save', name: '保存文档', keys: ['Ctrl', 'S'], isEditing: false },
  { id: 'new', name: '新建文档', keys: ['Ctrl', 'N'], isEditing: false },
  { id: 'open', name: '打开文档', keys: ['Ctrl', 'O'], isEditing: false },
  { id: 'find', name: '查找', keys: ['Ctrl', 'F'], isEditing: false },
  { id: 'replace', name: '替换', keys: ['Ctrl', 'H'], isEditing: false },
]);

// 切换编辑状态
const toggleEdit = (binding: KeyBinding) => {
  // 先关闭其他所有编辑中的项
  keyBindings.value.forEach(item => {
    if (item.id !== binding.id) {
      item.isEditing = false;
    }
  });
  
  // 切换当前项
  binding.isEditing = !binding.isEditing;
};

// 编辑模式下按键事件处理
const handleKeyDown = (event: KeyboardEvent, binding: KeyBinding) => {
  if (!binding.isEditing) return;
  
  event.preventDefault();
  event.stopPropagation();
  
  const newKeys: string[] = [];
  if (event.ctrlKey) newKeys.push('Ctrl');
  if (event.shiftKey) newKeys.push('Shift');
  if (event.altKey) newKeys.push('Alt');
  
  // 获取按键
  let keyName = event.key;
  if (keyName === ' ') keyName = 'Space';
  if (keyName.length === 1) keyName = keyName.toUpperCase();
  
  // 如果有修饰键，就添加主键
  if (event.ctrlKey || event.shiftKey || event.altKey) {
    if (!['Control', 'Shift', 'Alt'].includes(keyName)) {
      newKeys.push(keyName);
    }
  } else {
    // 没有修饰键，直接使用主键
    newKeys.push(keyName);
  }
  
  // 唯一按键，不增加空字段
  if (newKeys.length > 0) {
    binding.keys = [...new Set(newKeys)];
  }
  
  // 完成编辑
  binding.isEditing = false;
};
</script>

<template>
  <div class="settings-page">
    <SettingSection :title="t('settings.keyBindings')">
      <div class="key-bindings-container">
        <div class="key-bindings-header">
          <div class="command-col">命令</div>
          <div class="keybinding-col">快捷键</div>
          <div class="action-col">操作</div>
        </div>
        
        <div
          v-for="binding in keyBindings"
          :key="binding.id"
          class="key-binding-row"
          :class="{ 'is-editing': binding.isEditing }"
          @keydown="(e) => handleKeyDown(e, binding)"
          tabindex="0"
        >
          <div class="command-col">{{ binding.name }}</div>
          <div class="keybinding-col" :class="{ 'is-editing': binding.isEditing }">
            <template v-if="binding.isEditing">
              按下快捷键...
            </template>
            <template v-else>
              <span 
                v-for="(key, index) in binding.keys" 
                :key="index"
                class="key-badge"
              >
                {{ key }}
              </span>
            </template>
          </div>
          <div class="action-col">
            <button 
              class="edit-button"
              @click="toggleEdit(binding)"
            >
              {{ binding.isEditing ? '取消' : '编辑' }}
            </button>
          </div>
        </div>
      </div>
    </SettingSection>
  </div>
</template>

<style scoped lang="scss">
.settings-page {
  max-width: 800px;
  padding-bottom: 48px;
}

.key-bindings-container {
  padding: 10px 16px;
  
  .key-bindings-header {
    display: flex;
    padding: 0 0 10px 0;
    border-bottom: 1px solid var(--settings-border);
    color: var(--text-muted);
    font-size: 13px;
    font-weight: 500;
  }
  
  .key-binding-row {
    display: flex;
    padding: 14px 0;
    border-bottom: 1px solid var(--settings-border);
    align-items: center;
    transition: background-color 0.2s ease;
    
    &:focus {
      outline: none;
    }
    
    &:hover {
      background-color: var(--settings-hover);
    }
    
    &.is-editing {
      background-color: rgba(74, 158, 255, 0.1);
    }
  }
  
  .command-col {
    flex: 1;
    padding-right: 10px;
    font-size: 14px;
    color: var(--settings-text);
  }
  
  .keybinding-col {
    width: 200px;
    display: flex;
    gap: 5px;
    padding: 0 10px;
    
    &.is-editing {
      font-style: italic;
      color: var(--text-muted);
    }
    
    .key-badge {
      background-color: var(--settings-input-bg);
      padding: 3px 8px;
      border-radius: 3px;
      font-size: 12px;
      border: 1px solid var(--settings-input-border);
      color: var(--settings-text);
    }
  }
  
  .action-col {
    width: 80px;
    text-align: right;
    
    .edit-button {
      padding: 5px 10px;
      background-color: var(--settings-input-bg);
      border: 1px solid var(--settings-input-border);
      border-radius: 4px;
      color: var(--settings-text);
      cursor: pointer;
      font-size: 13px;
      transition: all 0.2s ease;
      
      &:hover {
        background-color: var(--settings-hover);
        border-color: var(--settings-border);
      }
      
      &:active {
        transform: translateY(1px);
      }
    }
  }
}

.coming-soon-placeholder {
  padding: 20px;
  background-color: var(--settings-card-bg);
  border-radius: 6px;
  color: var(--text-muted);
  text-align: center;
  font-style: italic;
  font-size: 14px;
}
</style> 