<template>
  <div class="windows-titlebar" style="--wails-draggable:drag" @contextmenu.prevent @mouseenter="checkMaximizedState" @mouseup="checkMaximizedState">
    <div class="titlebar-content" @dblclick="toggleMaximize" @contextmenu.prevent>
      <div class="titlebar-icon">
        <img src="/appicon.png" alt="voidraft" />
      </div>
      <div class="titlebar-title">voidraft</div>
    </div>
    
    <div class="titlebar-controls" style="--wails-draggable:no-drag" @contextmenu.prevent>
      <button 
        class="titlebar-button minimize-button" 
        @click="minimizeWindow"
        :title="t('titlebar.minimize')"
      >
        <span class="titlebar-icon">&#xE921;</span>
      </button>
      
      <button 
        class="titlebar-button maximize-button" 
        @click="toggleMaximize"
        :title="isMaximized ? t('titlebar.restore') : t('titlebar.maximize')"
      >
        <span class="titlebar-icon" v-html="maximizeIcon"></span>
      </button>
      
      <button 
        class="titlebar-button close-button" 
        @click="closeWindow"
        :title="t('titlebar.close')"
      >
        <span class="titlebar-icon">&#xE8BB;</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import * as runtime from '@wailsio/runtime';

const { t } = useI18n();
const isMaximized = ref(false);

// 计算属性用于图标，减少重复渲染
const maximizeIcon = computed(() => isMaximized.value ? '&#xE923;' : '&#xE922;');

const minimizeWindow = async () => {
  try {
    await runtime.Window.Minimise();
  } catch (error) {
 
  }
};

const toggleMaximize = async () => {
  try {
    // 立即更新UI状态，提供即时反馈
    const newState = !isMaximized.value;
    isMaximized.value = newState;
    
    // 然后执行实际操作
    if (newState) {
      await runtime.Window.Maximise();
    } else {
      await runtime.Window.UnMaximise();
    }
    
    // 操作完成后再次确认状态（防止操作失败时状态不一致）
    setTimeout(async () => {
      await checkMaximizedState();
    }, 100);
  } catch (error) {
    // 如果操作失败，恢复原状态
    isMaximized.value = !isMaximized.value;
  }
};

const closeWindow = async () => {
  try {
    // 使用Window的Close方法，会触发窗口关闭事件
    await runtime.Window.Close();
  } catch (error) {
  }
};

const checkMaximizedState = async () => {
  try {
    isMaximized.value = await runtime.Window.IsMaximised();
  } catch (error) {
  }
};

onMounted(async () => {
  // 检查初始最大化状态
  await checkMaximizedState();
  
  // 监听窗口状态变化事件
  runtime.Events.On('window:maximised', () => {
    isMaximized.value = true;
  });
  
  runtime.Events.On('window:unmaximised', () => {
    isMaximized.value = false;
  });

  // 监听窗口焦点事件，确保状态同步
  runtime.Events.On('window:focus', async () => {
    await checkMaximizedState();
  });

  onUnmounted(() => {
    // 清理事件监听器
    runtime.Events.Off('window:maximised');
    runtime.Events.Off('window:unmaximised');
    runtime.Events.Off('window:focus');
  });
});
</script>

<style scoped lang="scss">
.windows-titlebar {
  display: flex;
  height: 32px;
  background: #202020;
  user-select: none;
  -webkit-user-select: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
  
  /* 禁用右键菜单 */
  -webkit-context-menu: none;
  -moz-context-menu: none;
  context-menu: none;
}

.titlebar-content {
  display: flex;
  align-items: center;
  flex: 1;
  padding-left: 8px;
  gap: 8px;
  color: #ffffff;
  font-size: 12px;
  font-weight: 400;
  cursor: default;
  
  /* 禁用右键菜单 */
  -webkit-context-menu: none;
  -moz-context-menu: none;
  context-menu: none;
}

.titlebar-content .titlebar-icon {
  width: 16px;
  height: 16px;
  
  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
}

.titlebar-title {
  font-size: 12px;
  color: #ffffff;
}

.titlebar-controls {
  display: flex;
  height: 100%;
  
  /* 禁用右键菜单 */
  -webkit-context-menu: none;
  -moz-context-menu: none;
  context-menu: none;
}

.titlebar-button {
  width: 46px;
  height: 32px;
  border: none;
  background: transparent;
  color: #ffffff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.1s ease;
  padding: 0;
  margin: 0;
  
  &:hover {
    background: rgba(255, 255, 255, 0.0605);
  }
  
  &:active {
    background: rgba(255, 255, 255, 0.0837);
  }
}

.titlebar-button .titlebar-icon {
  font-family: 'Segoe MDL2 Assets', 'Segoe UI Symbol', 'Segoe UI', system-ui;
  font-size: 9px;
  line-height: 1;
  display: inline-block;
  opacity: 0.9;
  transition: opacity 0.1s ease;
  
  .titlebar-button:hover & {
    opacity: 1;
  }
}

.minimize-button:hover,
.maximize-button:hover {
  background: rgba(255, 255, 255, 0.0605);
}

.minimize-button:active,
.maximize-button:active {
  background: rgba(255, 255, 255, 0.0837);
}

.close-button:hover {
  background: #c42b1c;
  color: #ffffff;
  
  .titlebar-icon {
    opacity: 1;
  }
}

.close-button:active {
  background: #a93226;
  
  .titlebar-icon {
    opacity: 1;
  }
}
</style> 